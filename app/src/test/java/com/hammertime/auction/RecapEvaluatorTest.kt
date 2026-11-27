package com.hammertime.auction

import com.hammertime.auction.model.BattingStats
import com.hammertime.auction.model.BowlingStats
import com.hammertime.auction.model.KeeperStats
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.PlayerAvatar
import com.hammertime.auction.model.PlayerRole
import com.hammertime.auction.model.PlayerStats
import com.hammertime.auction.model.PlayerSubRole
import com.hammertime.auction.model.SquadEntry
import com.hammertime.auction.model.TeamAssignment
import com.hammertime.auction.model.TeamCatalog
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.model.TeamState
import com.hammertime.auction.model.VintageInfo
import com.hammertime.auction.model.WildcardInfo
import com.hammertime.auction.state.engine.RecapEvaluator
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RecapEvaluatorTest {

    private fun fakeEntry(
        id: String,
        role: PlayerRole,
        subRole: PlayerSubRole,
        rating: Int,
        overseas: Boolean = false,
        paidCr: Double = 2.0,
        isVintage: Boolean = false
    ): SquadEntry {
        val wickets = if (role == PlayerRole.BOWL || role == PlayerRole.AR) 50 else 0
        val player = Player(
            id = id,
            name = "Player $id",
            country = if (overseas) "AUS" else "IND",
            age = 26,
            overseas = overseas,
            role = role,
            subRole = subRole,
            battingStyle = "Right-hand bat",
            bowlingStyle = if (wickets > 0) "Right-arm fast" else "None",
            styleTag = "Test tag",
            set = if (isVintage) 7 else 2,
            basePriceCr = 1.0,
            rating = rating,
            stats = PlayerStats(
                batting = BattingStats(60, 1200, 30.0, 140.0),
                bowling = BowlingStats(wickets, if (wickets > 0) 7.2 else 0.0, "3/20"),
                keepers = KeeperStats(if (role == PlayerRole.WK) 40 else 10, if (role == PlayerRole.WK) 12 else 0)
            ),
            formerTeam = null,
            vintage = VintageInfo(isVintage, if (isVintage) "2010–2020" else null, null),
            wildcard = WildcardInfo(false, null),
            avatar = PlayerAvatar(2, 1, "#111111", 1)
        )
        return SquadEntry(player, paidCr, false, 1, 1)
    }

    @Test
    fun `best XI selects exactly 1 WK, at least 5 bowlers, at most 4 overseas with max rating`() {
        val squad = listOf(
            fakeEntry("OS_WK_HIGH", PlayerRole.WK, PlayerSubRole.KEEPER_BAT, 95, overseas = true),
            fakeEntry("IND_WK", PlayerRole.WK, PlayerSubRole.KEEPER_BAT, 84, overseas = false),
            fakeEntry("BAT1", PlayerRole.BAT, PlayerSubRole.OPENER, 92, overseas = false),
            fakeEntry("BAT2", PlayerRole.BAT, PlayerSubRole.OPENER, 90, overseas = true),
            fakeEntry("BAT3", PlayerRole.BAT, PlayerSubRole.ANCHOR, 88, overseas = false),
            fakeEntry("BAT4", PlayerRole.BAT, PlayerSubRole.FINISHER, 86, overseas = true),
            fakeEntry("BAT5", PlayerRole.BAT, PlayerSubRole.ANCHOR, 82, overseas = false),
            fakeEntry("AR1", PlayerRole.AR, PlayerSubRole.PACE_AR, 91, overseas = true),
            fakeEntry("AR2", PlayerRole.AR, PlayerSubRole.SPIN_AR, 89, overseas = false),
            fakeEntry("BOWL1", PlayerRole.BOWL, PlayerSubRole.PACE, 90, overseas = true),
            fakeEntry("BOWL2", PlayerRole.BOWL, PlayerSubRole.SPIN, 88, overseas = false),
            fakeEntry("BOWL3", PlayerRole.BOWL, PlayerSubRole.DEATH_SPECIALIST, 85, overseas = false),
            fakeEntry("BOWL4", PlayerRole.BOWL, PlayerSubRole.PACE, 80, overseas = false),
            fakeEntry("BENCH1", PlayerRole.BAT, PlayerSubRole.ANCHOR, 75, overseas = false)
        )

        val xi = RecapEvaluator.selectBestXI(squad)
        assertEquals(11, xi.players.size)
        assertEquals(1, xi.keeperCount)
        assertTrue("Bowling options >= 5", xi.bowlingOptionsCount >= 5)
        assertTrue("Overseas <= 4", xi.overseasCount <= 4)
        assertEquals("OS_WK_HIGH", xi.captain?.player?.id)
    }

    @Test
    fun `rating formula applies 70-15-15 weighting and penalties when balance is broken`() {
        // Squad missing a keeper and with only 3 bowlers
        val unbalancedSquad = listOf(
            fakeEntry("B1", PlayerRole.BAT, PlayerSubRole.OPENER, 80),
            fakeEntry("B2", PlayerRole.BAT, PlayerSubRole.OPENER, 80),
            fakeEntry("B3", PlayerRole.BAT, PlayerSubRole.ANCHOR, 80),
            fakeEntry("B4", PlayerRole.BAT, PlayerSubRole.ANCHOR, 80),
            fakeEntry("B5", PlayerRole.BAT, PlayerSubRole.FINISHER, 80),
            fakeEntry("B6", PlayerRole.BAT, PlayerSubRole.FINISHER, 80),
            fakeEntry("B7", PlayerRole.BAT, PlayerSubRole.ANCHOR, 80),
            fakeEntry("B8", PlayerRole.BAT, PlayerSubRole.ANCHOR, 80),
            fakeEntry("W1", PlayerRole.BOWL, PlayerSubRole.PACE, 80),
            fakeEntry("W2", PlayerRole.BOWL, PlayerSubRole.SPIN, 80),
            fakeEntry("W3", PlayerRole.BOWL, PlayerSubRole.PACE, 80),
            fakeEntry("B9", PlayerRole.BAT, PlayerSubRole.ANCHOR, 80)
        )
        val team = TeamState(
            team = TeamCatalog.byCode(TeamCode.CSK),
            assignment = TeamAssignment(TeamCode.CSK, isHuman = true),
            purseRemainingCr = 50.0,
            rtmRemaining = 2,
            squad = unbalancedSquad
        )
        val summary = RecapEvaluator.evaluateTeam(team, purseCr = 100.0, minSquadSize = 12)
        assertTrue(summary.squadRating.penaltiesApplied.any { it.contains("wicketkeeper") })
        assertTrue(summary.squadRating.penaltiesApplied.any { it.contains("bowling options") })
        // Balance = 100 - 25 (no WK) - 30 (only 3 bowlers) = 45
        assertEquals(45.0, summary.squadRating.balanceScore, 0.01)
    }
}
