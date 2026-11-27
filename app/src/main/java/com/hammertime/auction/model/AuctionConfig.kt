package com.hammertime.auction.model

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable

@Serializable
enum class PurseTier(val purseCr: Double, val label: String) {
    STANDARD_100(100.0, "₹100.00 Cr (Standard)"),
    CRUNCH_60(60.0, "₹60.00 Cr (Crunch)")
}

@Serializable
enum class SetOrderMode(val label: String) {
    STANDARD("Standard (1 → 7)"),
    REVERSE_VINTAGE("Vintage First (7, 1 → 6)"),
    CUSTOM("Custom Order")
}

@Serializable
enum class BotStyle(val label: String, val summary: String) {
    AGGRESSIVE("Aggressive", "Bids fast, jumps increments, chases stars"),
    SNIPER("Sniper", "Waits until final 2.5s before striking"),
    BALANCED("Balanced", "Value-focused with squad-need adjustments")
}

@Immutable
@Serializable
data class TeamAssignment(
    val teamCode: TeamCode,
    val isHuman: Boolean,
    val botStyle: BotStyle = BotStyle.BALANCED,
    val botPersonaName: String = teamCode.defaultBotPersona
)

@Immutable
@Serializable
data class AuctionConfig(
    val purseCr: Double = PurseTier.STANDARD_100.purseCr,
    val minSquadSize: Int = 12,
    val maxSquadSize: Int = 18,
    val maxOverseas: Int = 6,
    val rtmCardsPerTeam: Int = 2,
    val setOrderMode: SetOrderMode = SetOrderMode.STANDARD,
    val customSetOrder: List<Int> = listOf(1, 2, 3, 4, 5, 6, 7),
    val teamAssignments: List<TeamAssignment> = defaultTeamAssignments(),
    val seed: Long = 2026L
) {
    fun resolvedSetOrder(): List<Int> = when (setOrderMode) {
        SetOrderMode.STANDARD -> listOf(1, 2, 3, 4, 5, 6, 7)
        SetOrderMode.REVERSE_VINTAGE -> listOf(7, 1, 2, 3, 4, 5, 6)
        SetOrderMode.CUSTOM -> customSetOrder.distinct().ifEmpty { listOf(1, 2, 3, 4, 5, 6, 7) }
    }

    val humanTeamCodes: List<TeamCode>
        get() = teamAssignments.filter { it.isHuman }.map { it.teamCode }

    companion object {
        fun defaultTeamAssignments(): List<TeamAssignment> {
            val defaultBotStyles = mapOf(
                TeamCode.CSK to BotStyle.BALANCED,
                TeamCode.MBI to BotStyle.SNIPER,
                TeamCode.RCB to BotStyle.AGGRESSIVE,
                TeamCode.KRC to BotStyle.BALANCED,
                TeamCode.DDC to BotStyle.AGGRESSIVE,
                TeamCode.SRH to BotStyle.SNIPER,
                TeamCode.RRG to BotStyle.BALANCED,
                TeamCode.PBK to BotStyle.AGGRESSIVE,
                TeamCode.GPT to BotStyle.SNIPER,
                TeamCode.LSG to BotStyle.BALANCED
            )
            return TeamCode.entries.map { code ->
                TeamAssignment(
                    teamCode = code,
                    isHuman = code == TeamCode.CSK,
                    botStyle = defaultBotStyles[code] ?: BotStyle.BALANCED,
                    botPersonaName = code.defaultBotPersona
                )
            }
        }
    }
}
