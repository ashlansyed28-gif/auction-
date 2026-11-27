package com.hammertime.auction.model

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import java.util.Locale
import kotlin.math.abs

object MoneyFormatter {
    fun formatCr(amountCr: Double): String {
        val safe = if (abs(amountCr) < 0.0001) 0.0 else amountCr
        return String.format(Locale.US, "₹%.2f Cr", safe)
    }

    fun formatCompactCr(amountCr: Double): String {
        val safe = if (abs(amountCr) < 0.0001) 0.0 else amountCr
        return String.format(Locale.US, "%.2f Cr", safe)
    }
}

@Immutable
@Serializable
data class SquadEntry(
    val player: Player,
    val paidCr: Double,
    val boughtViaRtm: Boolean,
    val soldInSet: Int,
    val lotNumber: Int
)

@Immutable
@Serializable
data class TeamState(
    val team: Team,
    val assignment: TeamAssignment,
    val purseRemainingCr: Double,
    val rtmRemaining: Int,
    val squad: List<SquadEntry> = emptyList()
) {
    val squadCount: Int get() = squad.size
    val overseasCount: Int get() = squad.count { it.player.overseas }
    val keeperCount: Int get() = squad.count { it.player.role == PlayerRole.WK }
    val spinnerCount: Int
        get() = squad.count {
            it.player.subRole == PlayerSubRole.SPIN || it.player.subRole == PlayerSubRole.SPIN_AR
        }
    val paceCount: Int
        get() = squad.count {
            it.player.subRole == PlayerSubRole.PACE ||
                it.player.subRole == PlayerSubRole.DEATH_SPECIALIST ||
                it.player.subRole == PlayerSubRole.PACE_AR
        }
    val openerCount: Int get() = squad.count { it.player.subRole == PlayerSubRole.OPENER }

    /**
     * Reserve needed AFTER buying one more player to still afford 0.25 Cr
     * for every remaining mandatory slot up to minSquadSize.
     */
    fun reserveRequiredAfterNextPurchaseCr(minSquadSize: Int): Double {
        val slotsLeftAfterNext = (minSquadSize - (squadCount + 1)).coerceAtLeast(0)
        return slotsLeftAfterNext * 0.25
    }

    fun maxBidAllowedCr(minSquadSize: Int): Double =
        (purseRemainingCr - reserveRequiredAfterNextPurchaseCr(minSquadSize)).coerceAtLeast(0.0)
}

@Serializable
enum class AuctionPhase {
    SET_INTRO,
    LOT_REVEAL,
    BIDDING,
    HAMMER_SOLD,
    HAMMER_UNSOLD,
    RTM_DECISION,
    RTM_COUNTER_RAISE,
    RTM_FINAL_MATCH,
    AFTERMATH,
    ACCELERATED_INTRO,
    COMPLETED
}

@Immutable
@Serializable
data class BidEvent(
    val teamCode: TeamCode,
    val amountCr: Double,
    val elapsedLotMs: Long,
    val isJumpBid: Boolean = false,
    val isHuman: Boolean = false
)

@Immutable
@Serializable
data class RtmState(
    val winningTeam: TeamCode,
    val formerTeam: TeamCode,
    val originalBidCr: Double,
    val counterRaiseBidCr: Double? = null,
    val stageDeadlineMs: Long,
    val outcomeLabel: String? = null
)

@Immutable
@Serializable
data class SoldRecord(
    val playerId: String,
    val playerName: String,
    val teamCode: TeamCode,
    val priceCr: Double,
    val fairValueCr: Double,
    val viaRtm: Boolean,
    val lotNumber: Int
)

@Immutable
@Serializable
data class BidEligibility(
    val canBid: Boolean,
    val nextBidCr: Double,
    val blockReason: String? = null
)

@Immutable
@Serializable
data class ProjectedXI(
    val players: List<SquadEntry>,
    val captain: SquadEntry?,
    val keeperCount: Int,
    val bowlingOptionsCount: Int,
    val overseasCount: Int
)

@Immutable
@Serializable
data class SquadRatingBreakdown(
    val totalRating: Int,
    val bestXIAverage: Double,
    val depthAverage: Double,
    val balanceScore: Double,
    val penaltiesApplied: List<String>
)

@Immutable
@Serializable
data class RecapSummary(
    val team: Team,
    val squadRating: SquadRatingBreakdown,
    val projectedXI: ProjectedXI,
    val biggestSteal: SquadEntry?,
    val biggestStealDeltaCr: Double,
    val biggestOverpay: SquadEntry?,
    val biggestOverpayDeltaCr: Double,
    val vintageOrGoatPick: SquadEntry?,
    val totalSpentCr: Double,
    val purseLeftCr: Double
)

@Immutable
@Serializable
data class UserSettings(
    val isMuted: Boolean = false,
    val hapticsEnabled: Boolean = true,
    val reduceMotion: Boolean = false,
    val ttsEnabled: Boolean = false
)
