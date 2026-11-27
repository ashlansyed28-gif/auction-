package com.hammertime.auction.ui.components

import com.hammertime.auction.model.AuctionConfig
import com.hammertime.auction.model.AuctionPhase
import com.hammertime.auction.model.BattingStats
import com.hammertime.auction.model.BidEligibility
import com.hammertime.auction.model.BowlingStats
import com.hammertime.auction.model.KeeperStats
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.PlayerAvatar
import com.hammertime.auction.model.PlayerRole
import com.hammertime.auction.model.PlayerStats
import com.hammertime.auction.model.PlayerSubRole
import com.hammertime.auction.model.SquadEntry
import com.hammertime.auction.model.TeamCatalog
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.model.TeamState
import com.hammertime.auction.model.VintageInfo
import com.hammertime.auction.model.WildcardInfo
import com.hammertime.auction.state.AuctionUiState
import com.hammertime.auction.state.Screen
import com.hammertime.auction.state.engine.CommentaryEvent
import com.hammertime.auction.state.engine.CommentaryLine
import com.hammertime.auction.state.engine.RecapEvaluator
import kotlinx.collections.immutable.persistentListOf
import kotlinx.collections.immutable.toImmutableList

object PreviewFixtures {

    val sampleMarqueePlayer = Player(
        id = "HT-S1-001",
        name = "Viraat Kholi",
        country = "IND",
        age = 36,
        overseas = false,
        role = PlayerRole.BAT,
        subRole = PlayerSubRole.ANCHOR,
        battingStyle = "Right-hand bat",
        bowlingStyle = "Right-arm medium",
        styleTag = "Chase Master & Cover-Drive Icon",
        set = 1,
        basePriceCr = 2.0,
        rating = 97,
        stats = PlayerStats(
            batting = BattingStats(252, 8004, 38.7, 132.0),
            bowling = BowlingStats(4, 8.05, "1/13"),
            keepers = KeeperStats(114, 0)
        ),
        formerTeam = TeamCode.RCB,
        vintage = VintageInfo(false, null, null),
        wildcard = WildcardInfo(false, null),
        avatar = PlayerAvatar(skinTone = 2, hairStyle = 4, hairColor = "#181615", beard = 3)
    )

    val sampleVintagePlayer = Player(
        id = "HT-S7-001",
        name = "M.S. Dhony",
        country = "IND",
        age = 43,
        overseas = false,
        role = PlayerRole.WK,
        subRole = PlayerSubRole.FINISHER,
        battingStyle = "Right-hand bat",
        bowlingStyle = "Right-arm medium",
        styleTag = "Captain Cool & Helicopter Architect",
        set = 7,
        basePriceCr = 2.0,
        rating = 99,
        stats = PlayerStats(
            batting = BattingStats(264, 5243, 39.1, 137.5),
            bowling = BowlingStats(0, 0.0, "0/0"),
            keepers = KeeperStats(152, 42)
        ),
        formerTeam = TeamCode.CSK,
        vintage = VintageInfo(true, "2008–2024", "IMMORTAL"),
        wildcard = WildcardInfo(false, null),
        avatar = PlayerAvatar(skinTone = 3, hairStyle = 6, hairColor = "#2C2A29", beard = 2)
    )

    val sampleTeamStates: List<TeamState> = AuctionConfig.defaultTeamAssignments().mapIndexed { idx, a ->
        val sampleSquad = if (idx == 0) {
            listOf(
                SquadEntry(sampleMarqueePlayer, 11.5, false, 1, 1),
                SquadEntry(sampleVintagePlayer, 14.0, true, 7, 2)
            )
        } else {
            emptyList()
        }
        TeamState(
            team = TeamCatalog.byCode(a.teamCode),
            assignment = a,
            purseRemainingCr = if (idx == 0) 74.5 else 100.0 - idx * 3.5,
            rtmRemaining = 2,
            squad = sampleSquad
        )
    }

    val sampleAuctionState = AuctionUiState(
        screen = Screen.AuctionStage,
        isPoolReady = true,
        phase = AuctionPhase.BIDDING,
        currentSetNumber = 1,
        currentSetTitle = "Marquee Stars",
        currentSetSubtitle = "Franchise cornerstones & headline icons",
        currentSetPlayerCount = 15,
        lotNumber = 4,
        totalLotsInRound = 165,
        currentPlayer = sampleMarqueePlayer,
        effectiveBasePriceCr = 2.0,
        currentBidCr = 9.5,
        highestBidder = TeamCode.RCB,
        nextBidCr = 10.0,
        bidRemainingMs = 6400L,
        bidTotalWindowMs = 10_000L,
        teams = sampleTeamStates.toImmutableList(),
        humanTeamCodes = persistentListOf(TeamCode.CSK),
        activeHumanTeam = TeamCode.CSK,
        activeBidEligibility = BidEligibility(true, 10.0, null),
        isDuelActive = true,
        duelTeams = persistentListOf(TeamCode.CSK, TeamCode.RCB),
        consecutiveDuelCount = 4,
        latestCommentary = CommentaryLine(
            id = 12L,
            event = CommentaryEvent.DUEL,
            text = "Two-horse slugfest! CSK and RCB trade blows up to ₹9.50 Cr for Viraat Kholi.",
            highlights = listOf("CSK", "RCB", "₹9.50 Cr", "Viraat Kholi")
        )
    )

    val sampleRecapSummaries = sampleTeamStates.map {
        RecapEvaluator.evaluateTeam(it, purseCr = 100.0, minSquadSize = 12)
    }.toImmutableList()
}
