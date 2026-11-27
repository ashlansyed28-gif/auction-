package com.hammertime.auction.state.engine

import androidx.compose.runtime.Immutable
import com.hammertime.auction.model.AuctionConfig
import com.hammertime.auction.model.AuctionPhase
import com.hammertime.auction.model.AuctionValuation
import com.hammertime.auction.model.BidEligibility
import com.hammertime.auction.model.BidEvent
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.PlayerSetCatalog
import com.hammertime.auction.model.RtmState
import com.hammertime.auction.model.SoldRecord
import com.hammertime.auction.model.SquadEntry
import com.hammertime.auction.model.TeamCatalog
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.model.TeamState
import kotlinx.serialization.Serializable
import kotlin.math.max
import kotlin.random.Random

fun interface AuctionClock {
    fun nowMs(): Long
}

object SystemAuctionClock : AuctionClock {
    override fun nowMs(): Long = System.currentTimeMillis()
}

sealed interface EngineEvent {
    data class SetIntroStarted(val setNumber: Int, val setTitle: String, val playerCount: Int) : EngineEvent
    data class LotRevealed(val lotNumber: Int, val player: Player, val basePriceCr: Double) : EngineEvent
    data class BidAccepted(val bid: BidEvent, val isDuel: Boolean, val consecutiveDuelCount: Int) : EngineEvent
    data class FinalCallEscalated(val stage: Int) : EngineEvent // 1 = going once, 2 = going twice
    data class HammerSold(val record: SoldRecord) : EngineEvent
    data class HammerUnsold(val player: Player, val isAccelerated: Boolean) : EngineEvent
    data class RtmPrompted(val rtmState: RtmState) : EngineEvent
    data class RtmResolved(val player: Player, val finalTeam: TeamCode, val priceCr: Double, val matched: Boolean) : EngineEvent
    data class AuctionCompleted(val autoFilledCount: Int) : EngineEvent
}

@Immutable
@Serializable
data class AuctionSnapshot(
    val config: AuctionConfig,
    val queueIds: List<String>,
    val currentQueueIndex: Int,
    val isAcceleratedRound: Boolean,
    val unsoldIds: List<String>,
    val finalUnsoldIds: List<String>,
    val teams: List<TeamState>,
    val phase: AuctionPhase,
    val currentBidCr: Double?,
    val highestBidder: TeamCode?,
    val lotBidHistory: List<BidEvent>,
    val consecutiveDuelCount: Int,
    val duelTeams: List<TeamCode>,
    val lotRemainingMs: Long,
    val phaseRemainingMs: Long,
    val rtmState: RtmState?,
    val soldRecords: List<SoldRecord>,
    val soldInCurrentSetCount: Int,
    val currentSetNumber: Int
)

/**
 * Pure Kotlin deterministic T20 auction state machine.
 * Contains zero Android framework imports so it runs in fast JVM unit tests.
 */
class AuctionEngine(
    private val allPlayers: List<Player>,
    val config: AuctionConfig,
    private val clock: AuctionClock = SystemAuctionClock
) {
    private val playerById: Map<String, Player> = allPlayers.associateBy { it.id }
    private val random = Random(config.seed)
    private val commentary = CommentaryEngine(Random(config.seed xor 0x1337BEEFL))
    private val botController = BotController(config, config.seed)

    private val teams: MutableMap<TeamCode, TeamState> = LinkedHashMap()
    private val mainQueue: MutableList<Player> = mutableListOf()
    private val acceleratedQueue: MutableList<Player> = mutableListOf()
    private val unsoldPool: MutableList<Player> = mutableListOf()
    private val finalUnsoldPool: MutableList<Player> = mutableListOf()
    private val soldRecords: MutableList<SoldRecord> = mutableListOf()

    var isAcceleratedRound: Boolean = false
        private set
    var currentQueueIndex: Int = 0
        private set
    var phase: AuctionPhase = AuctionPhase.SET_INTRO
        private set
    var currentBidCr: Double? = null
        private set
    var highestBidder: TeamCode? = null
        private set
    var rtmState: RtmState? = null
        private set

    private val lotBidHistory: MutableList<BidEvent> = mutableListOf()
    private var consecutiveDuelCount: Int = 0
    private var duelTeams: Pair<TeamCode, TeamCode>? = null

    private var lotDeadlineMs: Long = 0L
    private var phaseDeadlineMs: Long = 0L
    private var lastTickMs: Long = clock.nowMs()
    private var lotStartMs: Long = lastTickMs
    private var lastSetNumberSeen: Int = -1
    private var goingOnceFired: Boolean = false
    private var goingTwiceFired: Boolean = false
    private var lastBotRtmActAtMs: Long = 0L

    var latestCommentary: CommentaryLine? = null
        private set
    val commentaryHistory: MutableList<CommentaryLine> = mutableListOf()
    private val pendingEvents: MutableList<EngineEvent> = mutableListOf()

    init {
        initFreshAuction()
    }

    private fun initFreshAuction() {
        for (assignment in config.teamAssignments) {
            val team = TeamCatalog.byCode(assignment.teamCode)
            teams[assignment.teamCode] = TeamState(
                team = team,
                assignment = assignment,
                purseRemainingCr = config.purseCr,
                rtmRemaining = config.rtmCardsPerTeam,
                squad = emptyList()
            )
        }
        val grouped = allPlayers.groupBy { it.set }
        val order = config.resolvedSetOrder()
        for (setNum in order) {
            val setPlayers = grouped[setNum].orEmpty().toMutableList()
            val setRng = Random(config.seed + setNum * 997L)
            setPlayers.shuffle(setRng)
            mainQueue += setPlayers
        }
        startCurrentLot(clock.nowMs())
    }

    fun restoreFromSnapshot(snapshot: AuctionSnapshot) {
        teams.clear()
        snapshot.teams.forEach { teams[it.team.code] = it }

        isAcceleratedRound = snapshot.isAcceleratedRound
        currentQueueIndex = snapshot.currentQueueIndex
        phase = snapshot.phase
        currentBidCr = snapshot.currentBidCr
        highestBidder = snapshot.highestBidder
        rtmState = snapshot.rtmState

        unsoldPool.clear()
        snapshot.unsoldIds.mapNotNullTo(unsoldPool) { playerById[it] }
        finalUnsoldPool.clear()
        snapshot.finalUnsoldIds.mapNotNullTo(finalUnsoldPool) { playerById[it] }
        soldRecords.clear()
        soldRecords.addAll(snapshot.soldRecords)

        lotBidHistory.clear()
        lotBidHistory.addAll(snapshot.lotBidHistory)
        consecutiveDuelCount = snapshot.consecutiveDuelCount
        duelTeams = if (snapshot.duelTeams.size == 2) {
            snapshot.duelTeams[0] to snapshot.duelTeams[1]
        } else {
            null
        }

        val queuePlayers = snapshot.queueIds.mapNotNull { playerById[it] }
        if (isAcceleratedRound) {
            acceleratedQueue.clear()
            acceleratedQueue.addAll(queuePlayers)
        } else {
            mainQueue.clear()
            mainQueue.addAll(queuePlayers)
        }

        val now = clock.nowMs()
        lastTickMs = now
        lotStartMs = now
        lotDeadlineMs = now + snapshot.lotRemainingMs
        phaseDeadlineMs = now + snapshot.phaseRemainingMs
        lastSetNumberSeen = snapshot.currentSetNumber

        currentPlayerOrNull()?.let { p ->
            botController.prepareForLot(
                lotNumber = currentLotNumber(),
                player = p,
                effectiveBaseCr = currentEffectiveBasePriceCr(),
                teams = teams,
                lotStartMs = now
            )
        }
    }

    fun toSnapshot(): AuctionSnapshot {
        val now = clock.nowMs()
        val activeQueue = if (isAcceleratedRound) acceleratedQueue else mainQueue
        return AuctionSnapshot(
            config = config,
            queueIds = activeQueue.map { it.id },
            currentQueueIndex = currentQueueIndex,
            isAcceleratedRound = isAcceleratedRound,
            unsoldIds = unsoldPool.map { it.id },
            finalUnsoldIds = finalUnsoldPool.map { it.id },
            teams = config.teamAssignments.mapNotNull { teams[it.teamCode] },
            phase = phase,
            currentBidCr = currentBidCr,
            highestBidder = highestBidder,
            lotBidHistory = lotBidHistory.toList(),
            consecutiveDuelCount = consecutiveDuelCount,
            duelTeams = duelTeams?.let { listOf(it.first, it.second) } ?: emptyList(),
            lotRemainingMs = (lotDeadlineMs - now).coerceAtLeast(0L),
            phaseRemainingMs = (phaseDeadlineMs - now).coerceAtLeast(0L),
            rtmState = rtmState,
            soldRecords = soldRecords.toList(),
            soldInCurrentSetCount = soldRecords.size,
            currentSetNumber = lastSetNumberSeen
        )
    }

    fun drainEvents(): List<EngineEvent> {
        if (pendingEvents.isEmpty()) return emptyList()
        val copy = pendingEvents.toList()
        pendingEvents.clear()
        return copy
    }

    fun activeQueueSize(): Int = if (isAcceleratedRound) acceleratedQueue.size else mainQueue.size

    fun currentLotNumber(): Int = (currentQueueIndex + 1).coerceAtMost(activeQueueSize().coerceAtLeast(1))

    fun currentPlayerOrNull(): Player? {
        val q = if (isAcceleratedRound) acceleratedQueue else mainQueue
        return q.getOrNull(currentQueueIndex)
    }

    fun currentEffectiveBasePriceCr(): Double {
        val player = currentPlayerOrNull() ?: return 0.25
        val scaled = AuctionValuation.effectiveBasePriceCr(player.basePriceCr, config.purseCr)
        return if (isAcceleratedRound) AuctionValuation.acceleratedBasePriceCr(scaled) else scaled
    }

    fun nextBidAmountCr(): Double {
        val cur = currentBidCr ?: return currentEffectiveBasePriceCr()
        return cur + AuctionValuation.incrementForCurrentBid(cur)
    }

    fun bidRemainingMs(nowMs: Long = clock.nowMs()): Long =
        if (phase == AuctionPhase.BIDDING) (lotDeadlineMs - nowMs).coerceAtLeast(0L) else 0L

    fun phaseRemainingMs(nowMs: Long = clock.nowMs()): Long =
        (phaseDeadlineMs - nowMs).coerceAtLeast(0L)

    fun teamStates(): List<TeamState> =
        config.teamAssignments.mapNotNull { teams[it.teamCode] }

    fun teamState(code: TeamCode): TeamState = teams.getValue(code)

    fun unsoldPlayers(): List<Player> = unsoldPool.toList()
    fun finalUnsoldPlayers(): List<Player> = finalUnsoldPool.toList()
    fun soldHistory(): List<SoldRecord> = soldRecords.toList()
    fun currentBidHistory(): List<BidEvent> = lotBidHistory.toList()
    fun currentDuelTeams(): Pair<TeamCode, TeamCode>? = duelTeams
    fun currentDuelCount(): Int = consecutiveDuelCount

    fun checkBidEligibility(teamCode: TeamCode, proposedBidCr: Double = nextBidAmountCr()): BidEligibility {
        if (phase != AuctionPhase.BIDDING) {
            return BidEligibility(false, proposedBidCr, "Bidding closed")
        }
        val player = currentPlayerOrNull()
            ?: return BidEligibility(false, proposedBidCr, "No active lot")
        val team = teams[teamCode]
            ?: return BidEligibility(false, proposedBidCr, "Unknown team")

        if (highestBidder == teamCode) {
            return BidEligibility(false, proposedBidCr, "Already highest bidder")
        }
        if (team.squadCount >= config.maxSquadSize) {
            return BidEligibility(false, proposedBidCr, "Squad full (${config.maxSquadSize}/${config.maxSquadSize})")
        }
        if (player.overseas && team.overseasCount >= config.maxOverseas) {
            return BidEligibility(false, proposedBidCr, "Overseas limit (${config.maxOverseas}/${config.maxOverseas})")
        }

        val slotsNeededAfter = (config.minSquadSize - (team.squadCount + 1)).coerceAtLeast(0)
        val reserve = slotsNeededAfter * 0.25
        if (team.purseRemainingCr - proposedBidCr < reserve - 1e-6) {
            val reason = if (slotsNeededAfter > 0) {
                val noun = if (slotsNeededAfter == 1) "player" else "players"
                "Reserve needed for $slotsNeededAfter more $noun"
            } else {
                "Insufficient purse"
            }
            return BidEligibility(false, proposedBidCr, reason)
        }
        return BidEligibility(true, proposedBidCr, null)
    }

    fun placeHumanBid(teamCode: TeamCode): Boolean {
        val team = teams[teamCode] ?: return false
        if (!team.assignment.isHuman) return false
        return placeBidInternal(teamCode = teamCode, amountCr = nextBidAmountCr(), isJumpBid = false, isHuman = true)
    }

    /**
     * Skips the current intro / aftermath / bidding (host action for faster play).
     */
    fun hostSkipCurrentStage() {
        val now = clock.nowMs()
        when (phase) {
            AuctionPhase.SET_INTRO,
            AuctionPhase.ACCELERATED_INTRO -> {
                enterLotReveal(now)
            }
            AuctionPhase.LOT_REVEAL -> {
                enterBidding(now)
            }
            AuctionPhase.BIDDING -> {
                // Force immediate hammer fall
                lotDeadlineMs = now
                handleBiddingTimeout(now)
            }
            AuctionPhase.HAMMER_SOLD,
            AuctionPhase.HAMMER_UNSOLD,
            AuctionPhase.AFTERMATH -> {
                advanceToNextLot(now)
            }
            else -> Unit
        }
    }

    fun submitRtmDecision(useRtm: Boolean): Boolean {
        if (phase != AuctionPhase.RTM_DECISION) return false
        val state = rtmState ?: return false
        val player = currentPlayerOrNull() ?: return false
        val now = clock.nowMs()

        if (!useRtm) {
            rtmState = state.copy(outcomeLabel = "RTM DECLINED")
            finalizeSale(
                player = player,
                winner = state.winningTeam,
                priceCr = state.originalBidCr,
                viaRtm = false,
                consumeRtmFrom = null,
                nowMs = now
            )
            return true
        }

        // Former team committed to RTM: consume RTM card regardless of counter-raise outcome
        consumeRtmCard(state.formerTeam)

        val counterRaiseCr = state.originalBidCr + AuctionValuation.incrementForCurrentBid(state.originalBidCr)
        val winnerTeam = teams.getValue(state.winningTeam)
        val winnerCanRaise = counterRaiseCr <= winnerTeam.maxBidAllowedCr(config.minSquadSize) + 1e-6

        if (!winnerCanRaise) {
            rtmState = state.copy(outcomeLabel = "MATCHED")
            finalizeSale(
                player = player,
                winner = state.formerTeam,
                priceCr = state.originalBidCr,
                viaRtm = true,
                consumeRtmFrom = null,
                nowMs = now
            )
            return true
        }

        phase = AuctionPhase.RTM_COUNTER_RAISE
        phaseDeadlineMs = now + RTM_DECISION_MS
        lastBotRtmActAtMs = now + random.nextLong(1100L, 2400L)
        rtmState = state.copy(
            counterRaiseBidCr = counterRaiseCr,
            stageDeadlineMs = phaseDeadlineMs
        )
        emitCommentary(
            commentary.rtm(
                player = player,
                formerCode = state.formerTeam.name,
                winnerCode = state.winningTeam.name,
                priceCr = counterRaiseCr,
                stageDetail = "${state.winningTeam.name} may raise once"
            )
        )
        return true
    }

    fun submitRtmCounterRaise(raisePrice: Boolean): Boolean {
        if (phase != AuctionPhase.RTM_COUNTER_RAISE) return false
        val state = rtmState ?: return false
        val player = currentPlayerOrNull() ?: return false
        val now = clock.nowMs()

        if (!raisePrice) {
            rtmState = state.copy(outcomeLabel = "MATCHED")
            finalizeSale(
                player = player,
                winner = state.formerTeam,
                priceCr = state.originalBidCr,
                viaRtm = true,
                consumeRtmFrom = null,
                nowMs = now
            )
            return true
        }

        val raisedCr = state.counterRaiseBidCr ?: return false
        val formerTeamState = teams.getValue(state.formerTeam)
        val formerCanMatch = raisedCr <= formerTeamState.maxBidAllowedCr(config.minSquadSize) + 1e-6
        if (!formerCanMatch) {
            rtmState = state.copy(outcomeLabel = "RTM DECLINED")
            finalizeSale(
                player = player,
                winner = state.winningTeam,
                priceCr = raisedCr,
                viaRtm = false,
                consumeRtmFrom = null,
                nowMs = now
            )
            return true
        }

        phase = AuctionPhase.RTM_FINAL_MATCH
        phaseDeadlineMs = now + RTM_DECISION_MS
        lastBotRtmActAtMs = now + random.nextLong(1100L, 2400L)
        rtmState = state.copy(stageDeadlineMs = phaseDeadlineMs)
        emitCommentary(
            commentary.rtm(
                player = player,
                formerCode = state.formerTeam.name,
                winnerCode = state.winningTeam.name,
                priceCr = raisedCr,
                stageDetail = "${state.formerTeam.name} final match call"
            )
        )
        return true
    }

    fun submitRtmFinalMatch(matchRaise: Boolean): Boolean {
        if (phase != AuctionPhase.RTM_FINAL_MATCH) return false
        val state = rtmState ?: return false
        val player = currentPlayerOrNull() ?: return false
        val raisedCr = state.counterRaiseBidCr ?: state.originalBidCr
        val now = clock.nowMs()

        return if (matchRaise) {
            rtmState = state.copy(outcomeLabel = "MATCHED")
            finalizeSale(
                player = player,
                winner = state.formerTeam,
                priceCr = raisedCr,
                viaRtm = true,
                consumeRtmFrom = null,
                nowMs = now
            )
            true
        } else {
            rtmState = state.copy(outcomeLabel = "RTM DECLINED")
            finalizeSale(
                player = player,
                winner = state.winningTeam,
                priceCr = raisedCr,
                viaRtm = false,
                consumeRtmFrom = null,
                nowMs = now
            )
            true
        }
    }

    /**
     * Advances the auction simulation to `clock.nowMs()`.
     * Call periodically (e.g. every 50ms) from ViewModel or in unit tests with FakeAuctionClock.
     */
    fun tick() {
        val now = clock.nowMs()
        if (now < lastTickMs) {
            lastTickMs = now
            return
        }
        lastTickMs = now

        when (phase) {
            AuctionPhase.SET_INTRO,
            AuctionPhase.ACCELERATED_INTRO -> {
                if (now >= phaseDeadlineMs) {
                    enterLotReveal(now)
                }
            }
            AuctionPhase.LOT_REVEAL -> {
                if (now >= phaseDeadlineMs) {
                    enterBidding(now)
                }
            }
            AuctionPhase.BIDDING -> {
                val remaining = lotDeadlineMs - now
                if (remaining <= 0L) {
                    handleBiddingTimeout(now)
                    return
                }
                checkFinalCallLadder(remaining)
                pollBotBid(now, remaining)
            }
            AuctionPhase.RTM_DECISION -> {
                val state = rtmState ?: return
                val formerIsHuman = teams[state.formerTeam]?.assignment?.isHuman == true
                if (!formerIsHuman && now >= lastBotRtmActAtMs) {
                    val useRtm = botController.shouldBotUseRtm(
                        teamCode = state.formerTeam,
                        priceCr = state.originalBidCr,
                        team = teams.getValue(state.formerTeam)
                    )
                    submitRtmDecision(useRtm)
                } else if (now >= phaseDeadlineMs) {
                    submitRtmDecision(false)
                }
            }
            AuctionPhase.RTM_COUNTER_RAISE -> {
                val state = rtmState ?: return
                val winnerIsHuman = teams[state.winningTeam]?.assignment?.isHuman == true
                if (!winnerIsHuman && now >= lastBotRtmActAtMs) {
                    val raisedCr = state.counterRaiseBidCr ?: state.originalBidCr
                    val shouldRaise = botController.shouldBotCounterRaiseRtm(
                        teamCode = state.winningTeam,
                        raisedPriceCr = raisedCr,
                        team = teams.getValue(state.winningTeam)
                    )
                    submitRtmCounterRaise(shouldRaise)
                } else if (now >= phaseDeadlineMs) {
                    submitRtmCounterRaise(false)
                }
            }
            AuctionPhase.RTM_FINAL_MATCH -> {
                val state = rtmState ?: return
                val formerIsHuman = teams[state.formerTeam]?.assignment?.isHuman == true
                if (!formerIsHuman && now >= lastBotRtmActAtMs) {
                    val raisedCr = state.counterRaiseBidCr ?: state.originalBidCr
                    val shouldMatch = botController.shouldBotUseRtm(
                        teamCode = state.formerTeam,
                        priceCr = raisedCr,
                        team = teams.getValue(state.formerTeam)
                    )
                    submitRtmFinalMatch(shouldMatch)
                } else if (now >= phaseDeadlineMs) {
                    submitRtmFinalMatch(false)
                }
            }
            AuctionPhase.HAMMER_SOLD,
            AuctionPhase.HAMMER_UNSOLD,
            AuctionPhase.AFTERMATH -> {
                if (now >= phaseDeadlineMs) {
                    advanceToNextLot(now)
                }
            }
            AuctionPhase.COMPLETED -> Unit
        }
    }

    private fun startCurrentLot(nowMs: Long) {
        if (areAllTeamsFull()) {
            completeAuction()
            return
        }
        val player = currentPlayerOrNull()
        if (player == null) {
            if (!isAcceleratedRound && unsoldPool.isNotEmpty()) {
                startAcceleratedRound(nowMs)
            } else {
                completeAuction()
            }
            return
        }

        currentBidCr = null
        highestBidder = null
        rtmState = null
        lotBidHistory.clear()
        consecutiveDuelCount = 0
        duelTeams = null
        goingOnceFired = false
        goingTwiceFired = false

        if (!isAcceleratedRound && player.set != lastSetNumberSeen) {
            lastSetNumberSeen = player.set
            val descriptor = PlayerSetCatalog.descriptorFor(player.set)
            val countInSet = mainQueue.count { it.set == player.set }
            phase = AuctionPhase.SET_INTRO
            phaseDeadlineMs = nowMs + SET_INTRO_MS
            emitCommentary(commentary.setIntro(descriptor.title, countInSet))
            pendingEvents += EngineEvent.SetIntroStarted(player.set, descriptor.title, countInSet)
        } else {
            enterLotReveal(nowMs)
        }
    }

    private fun startAcceleratedRound(nowMs: Long) {
        isAcceleratedRound = true
        acceleratedQueue.clear()
        acceleratedQueue.addAll(unsoldPool)
        unsoldPool.clear()
        currentQueueIndex = 0
        if (acceleratedQueue.isEmpty()) {
            completeAuction()
            return
        }
        phase = AuctionPhase.ACCELERATED_INTRO
        phaseDeadlineMs = nowMs + SET_INTRO_MS
        emitCommentary(commentary.setIntro("Accelerated Unsold Round", acceleratedQueue.size))
        pendingEvents += EngineEvent.SetIntroStarted(0, "Accelerated Unsold Round", acceleratedQueue.size)
    }

    private fun enterLotReveal(nowMs: Long) {
        val player = currentPlayerOrNull() ?: return completeAuction()
        val baseCr = currentEffectiveBasePriceCr()
        phase = AuctionPhase.LOT_REVEAL
        phaseDeadlineMs = nowMs + LOT_REVEAL_MS
        lotStartMs = nowMs

        botController.prepareForLot(
            lotNumber = currentLotNumber(),
            player = player,
            effectiveBaseCr = baseCr,
            teams = teams,
            lotStartMs = nowMs
        )

        emitCommentary(commentary.lotOpen(currentLotNumber(), player, baseCr))
        pendingEvents += EngineEvent.LotRevealed(currentLotNumber(), player, baseCr)
    }

    private fun enterBidding(nowMs: Long) {
        val duration = if (isAcceleratedRound) ACCELERATED_INITIAL_BID_MS else STANDARD_INITIAL_BID_MS
        phase = AuctionPhase.BIDDING
        lotDeadlineMs = nowMs + duration
        lotStartMs = nowMs
    }

    private fun pollBotBid(nowMs: Long, remainingMs: Long) {
        val nextStandard = nextBidAmountCr()
        val intent = botController.pollReadyBotBid(
            nowMs = nowMs,
            remainingMs = remainingMs,
            lotNumber = currentLotNumber(),
            nextStandardBidCr = nextStandard,
            highestBidder = highestBidder,
            canBidCheck = { code, amt -> checkBidEligibility(code, amt).canBid }
        ) ?: return

        val bidAmount = if (intent.jumpBid) {
            nextStandard + AuctionValuation.incrementForCurrentBid(nextStandard)
        } else {
            nextStandard
        }
        placeBidInternal(
            teamCode = intent.teamCode,
            amountCr = bidAmount,
            isJumpBid = intent.jumpBid,
            isHuman = false
        )
    }

    private fun placeBidInternal(
        teamCode: TeamCode,
        amountCr: Double,
        isJumpBid: Boolean,
        isHuman: Boolean
    ): Boolean {
        val eligibility = checkBidEligibility(teamCode, amountCr)
        if (!eligibility.canBid) return false

        val player = currentPlayerOrNull() ?: return false
        val now = clock.nowMs()
        val resetDuration = if (isAcceleratedRound) ACCELERATED_RESET_BID_MS else STANDARD_RESET_BID_MS
        val remaining = (lotDeadlineMs - now).coerceAtLeast(0L)
        lotDeadlineMs = now + max(remaining, resetDuration)

        if (lotDeadlineMs - now > GOING_ONCE_MS) {
            goingOnceFired = false
            goingTwiceFired = false
        }

        currentBidCr = amountCr
        highestBidder = teamCode

        val event = BidEvent(
            teamCode = teamCode,
            amountCr = amountCr,
            elapsedLotMs = (now - lotStartMs).coerceAtLeast(0L),
            isJumpBid = isJumpBid,
            isHuman = isHuman
        )
        lotBidHistory += event

        updateDuelTracking()
        botController.onBidPlaced(now, currentLotNumber(), teamCode)

        val bidderState = teams.getValue(teamCode)
        val isDuel = consecutiveDuelCount >= 3
        if (isDuel && duelTeams != null) {
            val (a, b) = duelTeams!!
            emitCommentary(commentary.duel(player, teams.getValue(a), teams.getValue(b), amountCr))
        } else {
            emitCommentary(commentary.bid(player, bidderState, amountCr, isJumpBid))
        }
        pendingEvents += EngineEvent.BidAccepted(event, isDuel, consecutiveDuelCount)
        return true
    }

    private fun updateDuelTracking() {
        val size = lotBidHistory.size
        if (size < 2) {
            consecutiveDuelCount = 0
            duelTeams = null
            return
        }
        val last = lotBidHistory[size - 1].teamCode
        val prev = lotBidHistory[size - 2].teamCode
        if (last == prev) {
            consecutiveDuelCount = 0
            duelTeams = null
            return
        }
        var count = 2
        var i = size - 3
        while (i >= 0) {
            val t = lotBidHistory[i].teamCode
            if (t == last || t == prev) {
                if (t != lotBidHistory[i + 1].teamCode) {
                    count++
                    i--
                    continue
                }
            }
            break
        }
        consecutiveDuelCount = count
        duelTeams = if (count >= 3) prev to last else null
    }

    private fun checkFinalCallLadder(remainingMs: Long) {
        val player = currentPlayerOrNull() ?: return
        val leader = highestBidder?.name ?: "the floor"
        val price = currentBidCr ?: currentEffectiveBasePriceCr()

        if (remainingMs <= GOING_TWICE_MS && !goingTwiceFired) {
            goingTwiceFired = true
            goingOnceFired = true
            if (highestBidder != null) {
                emitCommentary(commentary.goingTwice(player, leader, price))
            }
            pendingEvents += EngineEvent.FinalCallEscalated(2)
        } else if (remainingMs <= GOING_ONCE_MS && !goingOnceFired) {
            goingOnceFired = true
            if (highestBidder != null) {
                emitCommentary(commentary.goingOnce(player, leader, price))
            }
            pendingEvents += EngineEvent.FinalCallEscalated(1)
        }
    }

    private fun handleBiddingTimeout(nowMs: Long) {
        val player = currentPlayerOrNull() ?: return
        val winner = highestBidder
        val finalPrice = currentBidCr

        if (winner == null || finalPrice == null) {
            if (isAcceleratedRound) {
                finalUnsoldPool += player
            } else {
                unsoldPool += player
            }
            phase = AuctionPhase.HAMMER_UNSOLD
            phaseDeadlineMs = nowMs + UNSOLD_AFTERMATH_MS
            emitCommentary(commentary.unsold(player, isAcceleratedRound))
            pendingEvents += EngineEvent.HammerUnsold(player, isAcceleratedRound)
            return
        }

        val former = player.formerTeam
        if (former != null && former != winner && canTeamExerciseRtm(former, player, finalPrice)) {
            phase = AuctionPhase.RTM_DECISION
            phaseDeadlineMs = nowMs + RTM_DECISION_MS
            lastBotRtmActAtMs = nowMs + random.nextLong(1100L, 2400L)
            val state = RtmState(
                winningTeam = winner,
                formerTeam = former,
                originalBidCr = finalPrice,
                stageDeadlineMs = phaseDeadlineMs
            )
            rtmState = state
            emitCommentary(
                commentary.rtm(
                    player = player,
                    formerCode = former.name,
                    winnerCode = winner.name,
                    priceCr = finalPrice,
                    stageDetail = "8s decision window"
                )
            )
            pendingEvents += EngineEvent.RtmPrompted(state)
        } else {
            finalizeSale(
                player = player,
                winner = winner,
                priceCr = finalPrice,
                viaRtm = false,
                consumeRtmFrom = null,
                nowMs = nowMs
            )
        }
    }

    private fun canTeamExerciseRtm(former: TeamCode, player: Player, priceCr: Double): Boolean {
        val team = teams[former] ?: return false
        if (team.rtmRemaining <= 0) return false
        if (team.squadCount >= config.maxSquadSize) return false
        if (player.overseas && team.overseasCount >= config.maxOverseas) return false
        return priceCr <= team.maxBidAllowedCr(config.minSquadSize) + 1e-6
    }

    private fun consumeRtmCard(teamCode: TeamCode) {
        val team = teams[teamCode] ?: return
        teams[teamCode] = team.copy(rtmRemaining = (team.rtmRemaining - 1).coerceAtLeast(0))
    }

    private fun finalizeSale(
        player: Player,
        winner: TeamCode,
        priceCr: Double,
        viaRtm: Boolean,
        consumeRtmFrom: TeamCode?,
        nowMs: Long
    ) {
        if (consumeRtmFrom != null) {
            consumeRtmCard(consumeRtmFrom)
        }
        val buyer = teams.getValue(winner)
        val entry = SquadEntry(
            player = player,
            paidCr = priceCr,
            boughtViaRtm = viaRtm,
            soldInSet = if (isAcceleratedRound) 0 else player.set,
            lotNumber = currentLotNumber()
        )
        val updatedBuyer = buyer.copy(
            purseRemainingCr = (buyer.purseRemainingCr - priceCr).coerceAtLeast(0.0),
            squad = buyer.squad + entry
        )
        teams[winner] = updatedBuyer

        val fairValue = AuctionValuation.computeFairValueCr(player, config.purseCr)
        val record = SoldRecord(
            playerId = player.id,
            playerName = player.name,
            teamCode = winner,
            priceCr = priceCr,
            fairValueCr = fairValue,
            viaRtm = viaRtm,
            lotNumber = currentLotNumber()
        )
        soldRecords += record

        if (rtmState != null) {
            pendingEvents += EngineEvent.RtmResolved(player, winner, priceCr, viaRtm)
        }

        phase = AuctionPhase.HAMMER_SOLD
        phaseDeadlineMs = nowMs + SOLD_AFTERMATH_MS
        emitCommentary(commentary.sold(player, updatedBuyer, priceCr, fairValue, viaRtm))
        pendingEvents += EngineEvent.HammerSold(record)
    }

    private fun advanceToNextLot(nowMs: Long) {
        if (areAllTeamsFull()) {
            completeAuction()
            return
        }
        currentQueueIndex++
        val activeQueue = if (isAcceleratedRound) acceleratedQueue else mainQueue
        if (currentQueueIndex >= activeQueue.size) {
            if (!isAcceleratedRound && unsoldPool.isNotEmpty()) {
                startAcceleratedRound(nowMs)
            } else {
                completeAuction()
            }
        } else {
            startCurrentLot(nowMs)
        }
    }

    private fun areAllTeamsFull(): Boolean =
        teams.values.all { it.squadCount >= config.maxSquadSize }

    private fun completeAuction() {
        val autoFillCount = performAutoFill()
        phase = AuctionPhase.COMPLETED
        pendingEvents += EngineEvent.AuctionCompleted(autoFillCount)
    }

    private fun performAutoFill(): Int {
        // Gather remaining unsold players cheapest base price first (prefer domestic to preserve overseas cap)
        val remaining = (finalUnsoldPool + unsoldPool).toMutableList()
        val sortedPool = remaining.sortedWith(
            compareBy<Player> {
                AuctionValuation.effectiveBasePriceCr(it.basePriceCr, config.purseCr)
            }.thenBy { it.overseas }
                .thenByDescending { it.rating }
        ).toMutableList()

        var filled = 0
        for (code in config.teamAssignments.map { it.teamCode }) {
            var team = teams.getValue(code)
            while (team.squadCount < config.minSquadSize && sortedPool.isNotEmpty()) {
                val slotsAfter = (config.minSquadSize - (team.squadCount + 1)).coerceAtLeast(0)
                val maxAffordable = (team.purseRemainingCr - slotsAfter * 0.25 + 1e-6).coerceAtLeast(0.0)

                // First try an unsold player at their full effective base price;
                // if none fit the remaining ₹0.25 Cr/slot reserve, fall back to an emergency min-draft pick at <= maxAffordable.
                var pickIdx = sortedPool.indexOfFirst { p ->
                    val cost = AuctionValuation.effectiveBasePriceCr(p.basePriceCr, config.purseCr)
                    val osOk = !p.overseas || team.overseasCount < config.maxOverseas
                    osOk && cost <= maxAffordable
                }
                var emergencyCost: Double? = null
                if (pickIdx < 0 && maxAffordable >= 0.25 - 1e-6) {
                    pickIdx = sortedPool.indexOfFirst { p ->
                        !p.overseas || team.overseasCount < config.maxOverseas
                    }
                    if (pickIdx >= 0) {
                        val baseCost = AuctionValuation.effectiveBasePriceCr(sortedPool[pickIdx].basePriceCr, config.purseCr)
                        emergencyCost = minOf(baseCost, AuctionValuation.roundToQuarterCr(maxAffordable)).coerceAtLeast(0.25)
                    }
                }
                if (pickIdx < 0) break

                val picked = sortedPool.removeAt(pickIdx)
                val cost = emergencyCost ?: AuctionValuation.effectiveBasePriceCr(picked.basePriceCr, config.purseCr)
                val entry = SquadEntry(
                    player = picked,
                    paidCr = cost,
                    boughtViaRtm = false,
                    soldInSet = 0,
                    lotNumber = 0
                )
                team = team.copy(
                    purseRemainingCr = (team.purseRemainingCr - cost).coerceAtLeast(0.0),
                    squad = team.squad + entry
                )
                teams[code] = team
                filled++
            }
        }
        return filled
    }

    private fun emitCommentary(line: CommentaryLine) {
        latestCommentary = line
        commentaryHistory += line
        if (commentaryHistory.size > 60) {
            commentaryHistory.removeAt(0)
        }
    }

    companion object {
        const val SET_INTRO_MS = 2_200L
        const val LOT_REVEAL_MS = 900L
        const val STANDARD_INITIAL_BID_MS = 10_000L
        const val STANDARD_RESET_BID_MS = 7_000L
        const val ACCELERATED_INITIAL_BID_MS = 6_000L
        const val ACCELERATED_RESET_BID_MS = 4_000L
        const val GOING_ONCE_MS = 3_000L
        const val GOING_TWICE_MS = 2_000L
        const val RTM_DECISION_MS = 8_000L
        const val SOLD_AFTERMATH_MS = 1_800L
        const val UNSOLD_AFTERMATH_MS = 1_500L
    }
}
