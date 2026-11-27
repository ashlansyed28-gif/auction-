package com.hammertime.auction.model

import androidx.compose.runtime.Immutable
import kotlinx.serialization.Serializable

@Serializable
enum class TeamCode(
    val fullName: String,
    val shortTag: String,
    val primaryColorHex: Long,
    val secondaryColorHex: Long,
    val defaultBotPersona: String
) {
    CSK(
        fullName = "Clutch Squad Knights",
        shortTag = "CSK",
        primaryColorHex = 0xFFF2B705L,
        secondaryColorHex = 0xFF1B2A49L,
        defaultBotPersona = "Vikram \"The Anchor\" Rao"
    ),
    MBI(
        fullName = "Moneyball Icons",
        shortTag = "MBI",
        primaryColorHex = 0xFF1F6FEBL,
        secondaryColorHex = 0xFF9CC9FFL,
        defaultBotPersona = "Dr. Rhea Menon"
    ),
    RCB(
        fullName = "Raging Chasers Brigade",
        shortTag = "RCB",
        primaryColorHex = 0xFFD62839L,
        secondaryColorHex = 0xFF1A1A1DL,
        defaultBotPersona = "Kabir \"Blitz\" Gill"
    ),
    KRC(
        fullName = "Knight Riders Club",
        shortTag = "KRC",
        primaryColorHex = 0xFF6A3FA0L,
        secondaryColorHex = 0xFFD4AF37L,
        defaultBotPersona = "Meera Sen"
    ),
    DDC(
        fullName = "Daredevil Contenders",
        shortTag = "DDC",
        primaryColorHex = 0xFF1E4FD8L,
        secondaryColorHex = 0xFFE63946L,
        defaultBotPersona = "Arjun Khanna"
    ),
    SRH(
        fullName = "Super Riser Heat",
        shortTag = "SRH",
        primaryColorHex = 0xFFF26B1DL,
        secondaryColorHex = 0xFF2B2B2BL,
        defaultBotPersona = "Tariq Varma"
    ),
    RRG(
        fullName = "Royal Renegades",
        shortTag = "RRG",
        primaryColorHex = 0xFFE5379BL,
        secondaryColorHex = 0xFF1D3A8AL,
        defaultBotPersona = "Devika Rathore"
    ),
    PBK(
        fullName = "Pure Blitz Kings",
        shortTag = "PBK",
        primaryColorHex = 0xFFC8102EL,
        secondaryColorHex = 0xFFC0C6CEL,
        defaultBotPersona = "Harpreet Brar"
    ),
    GPT(
        fullName = "Gameplan Titans",
        shortTag = "GPT",
        primaryColorHex = 0xFF14213DL,
        secondaryColorHex = 0xFF2EC4B6L,
        defaultBotPersona = "Nikhil Patel"
    ),
    LSG(
        fullName = "Lucky Striker Gangs",
        shortTag = "LSG",
        primaryColorHex = 0xFF0FA3B1L,
        secondaryColorHex = 0xFFFF8C42L,
        defaultBotPersona = "Sana Qureshi"
    )
}

@Immutable
@Serializable
data class Team(
    val code: TeamCode,
    val name: String,
    val primaryColorHex: Long,
    val secondaryColorHex: Long
)

object TeamCatalog {
    val allTeams: List<Team> = TeamCode.entries.map { code ->
        Team(
            code = code,
            name = code.fullName,
            primaryColorHex = code.primaryColorHex,
            secondaryColorHex = code.secondaryColorHex
        )
    }

    private val teamMap: Map<TeamCode, Team> = allTeams.associateBy { it.code }

    fun byCode(code: TeamCode): Team = teamMap.getValue(code)
}
