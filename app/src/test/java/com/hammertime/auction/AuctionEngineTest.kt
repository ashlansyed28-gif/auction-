package com.hammertime.auction

import com.hammertime.auction.data.AssetPlayerRepository
import com.hammertime.auction.model.AuctionConfig
import com.hammertime.auction.model.AuctionPhase
import com.hammertime.auction.model.AuctionValuation
import com.hammertime.auction.model.BattingStats
import com.hammertime.auction.model.BotStyle
import com.hammertime.auction.model.BowlingStats
import com.hammertime.auction.model.KeeperStats
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.PlayerAvatar
import com.hammertime.auction.model.PlayerRole
import com.hammertime.auction.model.PlayerStats
import com.hammertime.auction.model.PlayerSubRole
import com.hammertime.auction.model.PurseTier
import com.hammertime.auction.model.SetOrderMode
import com.hammertime.auction.model.TeamAssignment
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.model.VintageInfo
import com.hammertime.auction.model.WildcardInfo
import com.hammertime.auction.state.engine.AuctionClock
import com.hammertime.auction.state.engine.AuctionEngine
import com.hammertime.auction.state.engine.AuctionSnapshot
import com.hammertime.auction.state.engine.RecapEvaluator
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class AuctionEngineTest {

    private class FakeClock(var timeMs: Long = 10_000L) : AuctionClock {
        override fun nowMs(): Long = timeMs
        fun advance(ms: Long) {
            timeMs += ms
        }
    }

    private fun testPlayer(
        id: String,
        set: Int = 1,
        baseCr: Double = 1.0,
        rating: Int = 85,
        overseas: Boolean = false,
        formerTeam: TeamCode? = null
    ): Player = Player(
        id = id,
        name = "Test $id",
        country = if (overseas) "AUS" else "IND",
        age = 26,
        overseas = overseas,
        role = PlayerRole.BAT,
        subRole = PlayerSubRole.OPENER,
        battingStyle = "Right-hand bat",
        bowlingStyle = "None",
        styleTag = "Test player",
        set = set,
        basePriceCr = baseCr,
        rating = rating,
        stats = PlayerStats(
            batting = BattingStats(60, 1800, 35.0, 145.0),
            bowling = BowlingStats(0, 0.0, "0/0"),
            keepers = KeeperStats(20, 0)
        ),
        formerTeam = formerTeam,
        vintage = VintageInfo(set == 7, if (set == 7) "2010–2020" else null, null),
        wildcard = WildcardInfo(false, null),
        avatar = PlayerAvatar(2, 1, "#111111", 1)
    )

    private fun allHumanConfig(
        purseCr: Double = 100.0,
        minSquad: Int = 12,
        maxSquad: Int = 18,
        maxOverseas: Int = 6,
        rtmCards: Int = 2,
        seed: Long = 42L
    ): AuctionConfig = AuctionConfig(
        purseCr = purseCr,
        minSquadSize = minSquad,
        maxSquadSize = maxSquad,
        maxOverseas = maxOverseas,
        rtmCardsPerTeam = rtmCards,
        setOrderMode = SetOrderMode.STANDARD,
        teamAssignments = TeamCode.entries.map {
            TeamAssignment(it, isHuman = true, botStyle = BotStyle.BALANCED)
        },
        seed = seed
    )

    @Test
    fun `bid increments follow exact bracket rules`() {
        assertEquals(0.25, AuctionValuation.incrementForCurrentBid(1.0), 1e-6)
        assertEquals(0.25, AuctionValuation.incrementForCurrentBid(4.75), 1e-6)
        assertEquals(0.50, AuctionValuation.incrementForCurrentBid(5.0), 1e-6)
        assertEquals(0.50, AuctionValuation.incrementForCurrentBid(14.5), 1e-6)
        assertEquals(1.00, AuctionValuation.incrementForCurrentBid(15.0), 1e-6)
        assertEquals(1.00, AuctionValuation.incrementForCurrentBid(24.0), 1e-6)
    }

    @Test
    fun `reserve math blocks bid with exact inline message`() {
        val clock = FakeClock()
        // Purse 2.00 Cr, minSquad = 4 -> for 1st player, 3 slots remain after => reserve = 0.75 Cr
        // Max allowed bid for 1st player = 1.25 Cr. Proposed bid 1.50 Cr must fail.
        val player = testPlayer("P1", baseCr = 1.5)
        val config = allHumanConfig(purseCr = 2.0, minSquad = 4, maxSquad = 6)
        val engine = AuctionEngine(listOf(player), config, clock)

        clock.advance(AuctionEngine.SET_INTRO_MS)
        engine.tick()
        clock.advance(AuctionEngine.LOT_REVEAL_MS)
        engine.tick()
        assertEquals(AuctionPhase.BIDDING, engine.phase)

        val check = engine.checkBidEligibility(TeamCode.CSK)
        assertFalse(check.canBid)
        assertEquals("Reserve needed for 3 more players", check.blockReason)
    }

    @Test
    fun `overseas limit prevents exceeding configured overseas cap`() {
        val clock = FakeClock()
        val p1 = testPlayer("OS1", baseCr = 0.5, overseas = true)
        val p2 = testPlayer("OS2", baseCr = 0.5, overseas = true)
        val config = allHumanConfig(purseCr = 100.0, minSquad = 2, maxSquad = 4, maxOverseas = 1)
        val engine = AuctionEngine(listOf(p1, p2), config, clock)

        // Lot 1: CSK buys OS1
        engine.hostSkipCurrentStage() // SET_INTRO -> LOT_REVEAL
        engine.hostSkipCurrentStage() // LOT_REVEAL -> BIDDING
        assertTrue(engine.placeHumanBid(TeamCode.CSK))
        clock.advance(AuctionEngine.STANDARD_INITIAL_BID_MS + 100L)
        engine.tick()
        assertEquals(AuctionPhase.HAMMER_SOLD, engine.phase)
        engine.hostSkipCurrentStage() // -> Lot 2 LOT_REVEAL
        engine.hostSkipCurrentStage() // -> Lot 2 BIDDING

        val check = engine.checkBidEligibility(TeamCode.CSK)
        assertFalse(check.canBid)
        assertTrue(check.blockReason?.contains("Overseas limit") == true)
    }

    @Test
    fun `RTM counter raise consumes card even when former team declines final match`() {
        val clock = FakeClock()
        val p1 = testPlayer("RTM1", baseCr = 2.0, formerTeam = TeamCode.MBI)
        val config = allHumanConfig(purseCr = 100.0, minSquad = 1, maxSquad = 5, rtmCards = 2)
        val engine = AuctionEngine(listOf(p1), config, clock)

        engine.hostSkipCurrentStage()
        engine.hostSkipCurrentStage()
        assertTrue(engine.placeHumanBid(TeamCode.CSK)) // CSK bids 2.0
        clock.advance(AuctionEngine.STANDARD_INITIAL_BID_MS + 100L)
        engine.tick()

        assertEquals(AuctionPhase.RTM_DECISION, engine.phase)
        assertTrue(engine.submitRtmDecision(useRtm = true)) // MBI commits RTM -> card consumed
        assertEquals(1, engine.teamState(TeamCode.MBI).rtmRemaining)

        assertEquals(AuctionPhase.RTM_COUNTER_RAISE, engine.phase)
        assertEquals(2.25, engine.rtmState?.counterRaiseBidCr ?: 0.0, 1e-6)
        assertTrue(engine.submitRtmCounterRaise(raisePrice = true)) // CSK raises to 2.25

        assertEquals(AuctionPhase.RTM_FINAL_MATCH, engine.phase)
        assertTrue(engine.submitRtmFinalMatch(matchRaise = false)) // MBI declines

        assertEquals(AuctionPhase.HAMMER_SOLD, engine.phase)
        assertEquals(1, engine.teamState(TeamCode.CSK).squadCount)
        assertEquals(2.25, engine.teamState(TeamCode.CSK).squad.first().paidCr, 1e-6)
        assertEquals(1, engine.teamState(TeamCode.MBI).rtmRemaining)
    }

    @Test
    fun `unsold player enters accelerated round at 25 percent discount and auto-fills min squad`() {
        val clock = FakeClock()
        val p1 = testPlayer("P1", set = 1, baseCr = 2.0)
        val p2 = testPlayer("P2", set = 2, baseCr = 1.0)
        val config = allHumanConfig(purseCr = 20.0, minSquad = 1, maxSquad = 5)
        val engine = AuctionEngine(listOf(p1, p2), config, clock)

        // Let P1 go unsold
        engine.hostSkipCurrentStage()
        engine.hostSkipCurrentStage()
        clock.advance(AuctionEngine.STANDARD_INITIAL_BID_MS + 100L)
        engine.tick()
        assertEquals(AuctionPhase.HAMMER_UNSOLD, engine.phase)
        engine.hostSkipCurrentStage()

        // Let P2 go unsold
        engine.hostSkipCurrentStage()
        engine.hostSkipCurrentStage()
        clock.advance(AuctionEngine.STANDARD_INITIAL_BID_MS + 100L)
        engine.tick()
        assertEquals(AuctionPhase.HAMMER_UNSOLD, engine.phase)
        engine.hostSkipCurrentStage()

        // Should now enter Accelerated Intro
        assertEquals(AuctionPhase.ACCELERATED_INTRO, engine.phase)
        assertTrue(engine.isAcceleratedRound)
        engine.hostSkipCurrentStage() // -> LOT_REVEAL
        engine.hostSkipCurrentStage() // -> BIDDING

        val accelPlayer = engine.currentPlayerOrNull()
        assertNotNull(accelPlayer)
        val expectedDiscount = AuctionValuation.acceleratedBasePriceCr(accelPlayer!!.basePriceCr)
        assertEquals(expectedDiscount, engine.currentEffectiveBasePriceCr(), 1e-6)
    }

    @Test
    fun `bots are strictly deterministic with a fixed seed`() {
        val players = listOf(
            testPlayer("D1", set = 1, baseCr = 2.0, rating = 92),
            testPlayer("D2", set = 2, baseCr = 1.0, rating = 84),
            testPlayer("D3", set = 3, baseCr = 0.75, rating = 80)
        )

        fun runSim(): List<Pair<TeamCode, Double>> {
            val clock = FakeClock(0L)
            val cfg = AuctionConfig(
                purseCr = 100.0,
                minSquadSize = 1,
                maxSquadSize = 4,
                seed = 777L,
                teamAssignments = TeamCode.entries.map {
                    TeamAssignment(it, isHuman = false, botStyle = BotStyle.entries[it.ordinal % 3])
                }
            )
            val eng = AuctionEngine(players, cfg, clock)
            var guard = 0
            while (eng.phase != AuctionPhase.COMPLETED && guard < 10_000) {
                clock.advance(200L)
                eng.tick()
                guard++
            }
            return eng.soldHistory().map { it.teamCode to it.priceCr }
        }

        val run1 = runSim()
        val run2 = runSim()
        assertTrue(run1.isNotEmpty())
        assertEquals(run1, run2)
    }

    @Test
    fun `autoFill populates teams below minimum squad cheapest first`() {
        val clock = FakeClock()
        val cheap = testPlayer("CHEAP", set = 2, baseCr = 0.25, rating = 65)
        val pricey = testPlayer("PRICEY", set = 2, baseCr = 1.5, rating = 85)
        val config = AuctionConfig(
            purseCr = 20.0,
            minSquadSize = 1,
            maxSquadSize = 5,
            seed = 10L,
            teamAssignments = listOf(
                TeamAssignment(TeamCode.CSK, isHuman = true),
                TeamAssignment(TeamCode.MBI, isHuman = true)
            )
        )
        val engine = AuctionEngine(listOf(pricey, cheap), config, clock)

        // Skip all lots without bidding through main + accelerated rounds
        var guard = 0
        while (engine.phase != AuctionPhase.COMPLETED && guard < 100) {
            if (engine.phase == AuctionPhase.BIDDING) {
                clock.advance(AuctionEngine.STANDARD_INITIAL_BID_MS + 100L)
                engine.tick()
            } else {
                engine.hostSkipCurrentStage()
            }
            guard++
        }
        assertEquals(AuctionPhase.COMPLETED, engine.phase)
        assertEquals(1, engine.teamState(TeamCode.CSK).squadCount)
        assertEquals("CHEAP", engine.teamState(TeamCode.CSK).squad.first().player.id)
        assertEquals(1, engine.teamState(TeamCode.MBI).squadCount)
        assertEquals("PRICEY", engine.teamState(TeamCode.MBI).squad.first().player.id)
    }

    private fun loadReal165Players(): List<Player> {
        val dir = listOf(File("src/main/assets/players"), File("app/src/main/assets/players"))
            .first { it.exists() && it.isDirectory }
        val json = Json { ignoreUnknownKeys = false; isLenient = false }
        return AssetPlayerRepository.SET_FILES.flatMap { name ->
            json.decodeFromString<List<Player>>(File(dir, name).readText())
        }
    }

    @Test
    fun `full 165-player 10-team auction completes with valid squads, snapshot roundtrip, and recaps`() {
        val pool = loadReal165Players()
        assertEquals(165, pool.size)

        val clock = FakeClock(0L)
        val config = AuctionConfig(
            purseCr = PurseTier.STANDARD_100.purseCr,
            minSquadSize = 12,
            maxSquadSize = 18,
            maxOverseas = 6,
            rtmCardsPerTeam = 2,
            seed = 2026L,
            teamAssignments = TeamCode.entries.map {
                TeamAssignment(it, isHuman = false, botStyle = BotStyle.entries[it.ordinal % 3])
            }
        )
        val engine = AuctionEngine(pool, config, clock)
        var snapshotVerified = false

        var guard = 0
        while (engine.phase != AuctionPhase.COMPLETED && guard < 150_000) {
            clock.advance(250L)
            engine.tick()
            if (!snapshotVerified && engine.soldHistory().size >= 15) {
                val snap = engine.toSnapshot()
                val encoded = Json.encodeToString(snap)
                val decoded = Json.decodeFromString<AuctionSnapshot>(encoded)
                val restored = AuctionEngine(pool, decoded.config, FakeClock(clock.nowMs()))
                restored.restoreFromSnapshot(decoded)
                assertEquals(snap.soldRecords.size, restored.soldHistory().size)
                assertEquals(snap.currentQueueIndex, restored.currentQueueIndex)
                snapshotVerified = true
            }
            guard++
        }

        assertTrue("Snapshot roundtrip should be verified mid-auction", snapshotVerified)
        assertEquals(AuctionPhase.COMPLETED, engine.phase)

        val teams = engine.teamStates()
        assertEquals(10, teams.size)
        for (t in teams) {
            assertTrue("${t.team.code} squad ${t.squadCount} < min", t.squadCount >= config.minSquadSize)
            assertTrue("${t.team.code} squad ${t.squadCount} > max", t.squadCount <= config.maxSquadSize)
            assertTrue("${t.team.code} overseas ${t.overseasCount} > max", t.overseasCount <= config.maxOverseas)
            assertTrue("${t.team.code} negative purse ${t.purseRemainingCr}", t.purseRemainingCr >= -1e-6)

            val recap = RecapEvaluator.evaluateTeam(t, config.purseCr, config.minSquadSize)
            assertEquals(11, recap.projectedXI.players.size)
            assertTrue(recap.squadRating.totalRating in 1..100)
        }
    }

    @Test
    fun `60 Cr crunch mode scales base prices and completes 165-player auction cleanly`() {
        val pool = loadReal165Players()
        val clock = FakeClock(0L)
        val config = AuctionConfig(
            purseCr = PurseTier.CRUNCH_60.purseCr,
            minSquadSize = 12,
            maxSquadSize = 16,
            maxOverseas = 6,
            rtmCardsPerTeam = 2,
            setOrderMode = SetOrderMode.REVERSE_VINTAGE,
            seed = 9001L,
            teamAssignments = TeamCode.entries.map {
                TeamAssignment(it, isHuman = false, botStyle = BotStyle.entries[it.ordinal % 3])
            }
        )
        val engine = AuctionEngine(pool, config, clock)
        assertEquals(7, engine.currentPlayerOrNull()?.set)
        // Set 7 base 2.00 Cr scales to 0.6x = 1.25 Cr (rounded to nearest 0.25) in 60 Cr crunch
        assertEquals(1.25, engine.currentEffectiveBasePriceCr(), 1e-6)

        var guard = 0
        while (engine.phase != AuctionPhase.COMPLETED && guard < 150_000) {
            clock.advance(250L)
            engine.tick()
            guard++
        }
        assertEquals(AuctionPhase.COMPLETED, engine.phase)
        for (t in engine.teamStates()) {
            assertTrue("${t.team.code} purse ${t.purseRemainingCr}", t.purseRemainingCr >= -1e-6)
            assertTrue("${t.team.code} squad ${t.squadCount}", t.squadCount in config.minSquadSize..config.maxSquadSize)
        }
    }
}
