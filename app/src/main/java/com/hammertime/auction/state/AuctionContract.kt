package com.hammertime.auction.state

import androidx.compose.runtime.Immutable
import com.hammertime.auction.model.AuctionConfig
import com.hammertime.auction.model.AuctionPhase
import com.hammertime.auction.model.BidEligibility
import com.hammertime.auction.model.BotStyle
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.PurseTier
import com.hammertime.auction.model.RecapSummary
import com.hammertime.auction.model.RtmState
import com.hammertime.auction.model.SetOrderMode
import com.hammertime.auction.model.SoldRecord
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.model.TeamState
import com.hammertime.auction.model.UserSettings
import com.hammertime.auction.state.engine.CommentaryLine
import kotlinx.collections.immutable.ImmutableList
import kotlinx.collections.immutable.persistentListOf

sealed interface Screen {
    data object Home : Screen
    data object RoomSetup : Screen
    data object AuctionStage : Screen
    data object Recap : Screen
}

enum class SoundCue {
    TICK,
    BID_PING,
    GOING_ONCE,
    GOING_TWICE,
    GAVEL_HIT,
    SOLD_FANFARE,
    UNSOLD_SIGH,
    RTM_STING,
    HEARTBEAT_START,
    HEARTBEAT_STOP,
    CROWD_MURMUR
}

enum class HapticCue {
    LIGHT_TICK,
    HAMMER_IMPACT
}

@Immutable
data class AuctionUiState(
    val screen: Screen = Screen.Home,
    val settings: UserSettings = UserSettings(),
    val hasSavedSnapshot: Boolean = false,
    val isPoolReady: Boolean = false,
    val poolError: String? = null,
    val setupConfig: AuctionConfig = AuctionConfig(),
    val activeConfig: AuctionConfig = AuctionConfig(),
    val phase: AuctionPhase = AuctionPhase.SET_INTRO,
    val currentSetNumber: Int = 1,
    val currentSetTitle: String = "Marquee Stars",
    val currentSetSubtitle: String = "",
    val currentSetPlayerCount: Int = 15,
    val isAcceleratedRound: Boolean = false,
    val lotNumber: Int = 1,
    val totalLotsInRound: Int = 165,
    val currentPlayer: Player? = null,
    val effectiveBasePriceCr: Double = 2.0,
    val currentBidCr: Double? = null,
    val highestBidder: TeamCode? = null,
    val nextBidCr: Double = 2.0,
    val bidRemainingMs: Long = 10_000L,
    val bidTotalWindowMs: Long = 10_000L,
    val phaseRemainingMs: Long = 0L,
    val teams: ImmutableList<TeamState> = persistentListOf(),
    val humanTeamCodes: ImmutableList<TeamCode> = persistentListOf(TeamCode.CSK),
    val activeHumanTeam: TeamCode = TeamCode.CSK,
    val activeBidEligibility: BidEligibility = BidEligibility(false, 2.0, "Loading"),
    val isDuelActive: Boolean = false,
    val duelTeams: ImmutableList<TeamCode> = persistentListOf(),
    val consecutiveDuelCount: Int = 0,
    val lastSoldRecord: SoldRecord? = null,
    val rtmState: RtmState? = null,
    val unsoldPlayers: ImmutableList<Player> = persistentListOf(),
    val soldHistory: ImmutableList<SoldRecord> = persistentListOf(),
    val latestCommentary: CommentaryLine? = null,
    val commentaryHistory: ImmutableList<CommentaryLine> = persistentListOf(),
    val showSquadSheetForTeam: TeamCode? = null,
    val showUnsoldTray: Boolean = false,
    val recapSummaries: ImmutableList<RecapSummary> = persistentListOf(),
    val selectedRecapTeam: TeamCode = TeamCode.CSK
)

sealed interface AuctionIntent {
    data object StartNewAuctionSetup : AuctionIntent
    data object ResumeSavedAuction : AuctionIntent
    data object BackToHome : AuctionIntent
    data object ToggleMute : AuctionIntent
    data object ToggleHaptics : AuctionIntent
    data object ToggleReduceMotion : AuctionIntent
    data object ToggleTts : AuctionIntent

    data class SelectPurseTier(val tier: PurseTier) : AuctionIntent
    data class UpdateSquadLimits(val minSize: Int, val maxSize: Int) : AuctionIntent
    data class UpdateMaxOverseas(val maxOverseas: Int) : AuctionIntent
    data class UpdateRtmCards(val rtmCards: Int) : AuctionIntent
    data class SelectSetOrderMode(val mode: SetOrderMode) : AuctionIntent
    data class MoveCustomSet(val fromIndex: Int, val toIndex: Int) : AuctionIntent
    data class ToggleTeamHuman(val teamCode: TeamCode) : AuctionIntent
    data class CycleBotStyle(val teamCode: TeamCode) : AuctionIntent
    data class UpdateSeed(val seed: Long) : AuctionIntent
    data object LaunchAuction : AuctionIntent

    data class SelectActiveHumanTeam(val teamCode: TeamCode) : AuctionIntent
    data object PlaceHumanBid : AuctionIntent
    data object HostSkipStage : AuctionIntent
    data class SubmitRtmDecision(val useRtm: Boolean) : AuctionIntent
    data class SubmitRtmCounterRaise(val raisePrice: Boolean) : AuctionIntent
    data class SubmitRtmFinalMatch(val matchRaise: Boolean) : AuctionIntent
    data class OpenSquadSheet(val teamCode: TeamCode) : AuctionIntent
    data object CloseSquadSheet : AuctionIntent
    data class ToggleUnsoldTray(val open: Boolean) : AuctionIntent
    data object OnAppBackground : AuctionIntent
    data object ProceedToRecap : AuctionIntent

    data class SelectRecapTeam(val teamCode: TeamCode) : AuctionIntent
    data class ShareRecapCard(val teamCode: TeamCode) : AuctionIntent
    data class SaveRecapCardToGallery(val teamCode: TeamCode) : AuctionIntent
    data object FinishToHome : AuctionIntent
}

sealed interface UiEffect {
    data class PlaySound(val cue: SoundCue) : UiEffect
    data class TriggerHaptic(val cue: HapticCue) : UiEffect
    data class SpeakCommentary(val text: String) : UiEffect
    data class ShowMessage(val message: String) : UiEffect
    data class ShareRecapBitmap(val summary: RecapSummary) : UiEffect
    data class SaveRecapBitmapToGallery(val summary: RecapSummary) : UiEffect
}
