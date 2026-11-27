package com.hammertime.auction.model

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable
import kotlin.math.pow
import kotlin.math.round

@Serializable
enum class PlayerRole(val label: String) {
    BAT("Batter"),
    BOWL("Bowler"),
    AR("All-Rounder"),
    WK("Wicketkeeper")
}

@Serializable
enum class PlayerSubRole(val label: String) {
    OPENER("Opener"),
    ANCHOR("Anchor"),
    FINISHER("Finisher"),
    SPIN("Spinner"),
    PACE("Pace"),
    DEATH_SPECIALIST("Death Specialist"),
    KEEPER_BAT("Keeper-Batter"),
    PACE_AR("Pace All-Rounder"),
    SPIN_AR("Spin All-Rounder")
}

@Immutable
@Serializable
data class BattingStats(
    val matches: Int,
    val runs: Int,
    val avg: Double,
    val strikeRate: Double
)

@Immutable
@Serializable
data class BowlingStats(
    val wickets: Int,
    val economy: Double,
    val best: String
)

@Immutable
@Serializable
data class KeeperStats(
    val catches: Int,
    val stumpings: Int
)

@Immutable
@Serializable
data class PlayerStats(
    val batting: BattingStats,
    val bowling: BowlingStats,
    val keepers: KeeperStats
)

@Immutable
@Serializable
data class VintageInfo(
    val isVintage: Boolean,
    val era: String? = null,
    val legendTier: String? = null
)

@Immutable
@Serializable
data class WildcardInfo(
    val isWildcard: Boolean,
    val trait: String? = null
)

@Immutable
@Serializable
data class PlayerAvatar(
    val skinTone: Int,
    val hairStyle: Int,
    val hairColor: String,
    val beard: Int
)

@Immutable
@Serializable
data class Player(
    val id: String,
    val name: String,
    val country: String,
    val age: Int,
    val overseas: Boolean,
    val role: PlayerRole,
    val subRole: PlayerSubRole,
    val battingStyle: String,
    val bowlingStyle: String,
    val styleTag: String,
    val set: Int,
    val basePriceCr: Double,
    val rating: Int,
    val stats: PlayerStats,
    val formerTeam: TeamCode? = null,
    val vintage: VintageInfo,
    val wildcard: WildcardInfo,
    val avatar: PlayerAvatar
) {
    val canBowl: Boolean
        get() = role == PlayerRole.BOWL || role == PlayerRole.AR || stats.bowling.wickets >= 20
}

@Immutable
data class PlayerSetDescriptor(
    val setNumber: Int,
    val title: String,
    val subtitle: String,
    val expectedCount: Int
)

object PlayerSetCatalog {
    val sets: List<PlayerSetDescriptor> = listOf(
        PlayerSetDescriptor(1, "Marquee Stars", "Franchise cornerstones & headline icons", 15),
        PlayerSetDescriptor(2, "Power Batters & Openers", "Top-order tone setters & boundary hitters", 25),
        PlayerSetDescriptor(3, "All-Rounders & Finishers", "Multi-skill match-winners & late-overs closers", 25),
        PlayerSetDescriptor(4, "Spin Arsenal", "Wrist-spinners, mystery tweakers & middle-overs strangle", 20),
        PlayerSetDescriptor(5, "Pace & Death-Over Merchants", "Express speed, swing & pinpoint yorkers", 25),
        PlayerSetDescriptor(6, "Uncapped & Wildcard Chaos", "Teen prodigies, cult heroes & high-upside punts", 30),
        PlayerSetDescriptor(7, "GOATs & Vintage Legends", "Hall-of-fame titans from golden T20 eras", 25)
    )

    fun descriptorFor(setNumber: Int): PlayerSetDescriptor =
        sets.firstOrNull { it.setNumber == setNumber }
            ?: PlayerSetDescriptor(setNumber, "Accelerated Unsold", "Final-chance bargains at reduced base", 0)
}

object AuctionValuation {
    private const val MIN_PRICE_CR = 0.25

    fun roundToQuarterCr(value: Double): Double {
        val rounded = round(value * 4.0) / 4.0
        return rounded.coerceAtLeast(MIN_PRICE_CR)
    }

    /**
     * Computes fair market value in ₹ Cr from player rating and role:
     * 0.25 + ((rating - 50) / 49)^2.2 * 21.75, multiplied by role factor, rounded to nearest 0.25.
     * Scales proportionally when playing with a non-100 Cr purse (e.g., 60 Cr crunch).
     */
    fun computeFairValueCr(player: Player, purseCr: Double = 100.0): Double {
        val normalized = ((player.rating - 50).coerceAtLeast(0)) / 49.0
        val rawBase = MIN_PRICE_CR + normalized.pow(2.2) * 21.75
        val roleMultiplier = when (player.role) {
            PlayerRole.AR -> 1.10
            PlayerRole.WK -> 1.05
            PlayerRole.BAT -> 1.00
            PlayerRole.BOWL -> if (player.subRole == PlayerSubRole.SPIN) 0.95 else 1.00
        }
        val purseScale = purseCr / 100.0
        return roundToQuarterCr(rawBase * roleMultiplier * purseScale)
    }

    /**
     * Scales a 100 Cr base price to the 60 Cr crunch tier (0.6x),
     * rounded to nearest 0.25 Cr with a floor of 0.25 Cr.
     */
    fun effectiveBasePriceCr(basePrice100Cr: Double, purseCr: Double): Double {
        val scale = if (purseCr in 55.0..65.0) 0.6 else 1.0
        return roundToQuarterCr(basePrice100Cr * scale)
    }

    /**
     * Accelerated round reduces base price by 25%, rounded to nearest 0.25 Cr (min 0.25 Cr).
     */
    fun acceleratedBasePriceCr(effectiveBaseCr: Double): Double =
        roundToQuarterCr(effectiveBaseCr * 0.75)

    /**
     * Next bid increment based on the CURRENT highest bid:
     * - < ₹5.00 Cr: +0.25 Cr
     * - ₹5.00 Cr to < ₹15.00 Cr: +0.50 Cr
     * - >= ₹15.00 Cr: +1.00 Cr
     */
    fun incrementForCurrentBid(currentBidCr: Double): Double = when {
        currentBidCr < 5.0 -> 0.25
        currentBidCr < 15.0 -> 0.50
        else -> 1.00
    }
}
