package com.hammertime.auction.ui.screens

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.AuctionPhase
import com.hammertime.auction.model.MoneyFormatter
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.PlayerRole
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.model.TeamState
import com.hammertime.auction.state.AuctionIntent
import com.hammertime.auction.state.AuctionUiState
import com.hammertime.auction.ui.components.BroadcastCommentaryBar
import com.hammertime.auction.ui.components.CountdownBidRing
import com.hammertime.auction.ui.components.EscalationVignette
import com.hammertime.auction.ui.components.HammerStampOverlay
import com.hammertime.auction.ui.components.PaddleRaiseBadge
import com.hammertime.auction.ui.components.ParametricPlayerPortrait
import com.hammertime.auction.ui.components.PooledSoldParticlesOverlay
import com.hammertime.auction.ui.components.PreviewFixtures
import com.hammertime.auction.ui.crests.RoleBadgeChip
import com.hammertime.auction.ui.crests.TeamCrestImage
import com.hammertime.auction.ui.crests.VintageLaurelChip
import com.hammertime.auction.ui.theme.HammerNumericStyles
import com.hammertime.auction.ui.theme.HammerTheme
import com.hammertime.auction.ui.theme.goldSheenBackground
import com.hammertime.auction.ui.theme.primaryColor
import kotlinx.coroutines.delay
import kotlin.math.sin

@Composable
fun AuctionStageScreen(
    uiState: AuctionUiState,
    onIntent: (AuctionIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val spacing = HammerTheme.spacing
    val reduceMotion = HammerTheme.reduceMotion

    // Track triggers for bid pulse, sold particle burst, and 6dp hammer shake
    var bidTriggerCount by remember { mutableIntStateOf(0) }
    val currentBidKey = (uiState.lotNumber * 10000) + ((uiState.currentBidCr ?: 0.0) * 100).toInt()
    LaunchedEffect(currentBidKey, uiState.currentBidCr != null) {
        if (uiState.currentBidCr != null) {
            bidTriggerCount++
        }
    }

    var soldBurstTrigger by remember { mutableIntStateOf(0) }
    val shakeX = remember { Animatable(0f) }
    val shakeY = remember { Animatable(0f) }

    LaunchedEffect(uiState.phase, uiState.lotNumber) {
        if (uiState.phase == AuctionPhase.HAMMER_SOLD) {
            soldBurstTrigger++
            if (!reduceMotion) {
                delay(120L) // 120ms hit-stop before 6dp screen shake for 180ms
                val steps = 9
                for (i in 0 until steps) {
                    val decay = 1f - i / steps.toFloat()
                    val mag = 6f * decay
                    shakeX.snapTo(sin(i * 2.4f) * mag)
                    shakeY.snapTo(sin(i * 3.1f) * mag * 0.6f)
                    delay(20L)
                }
                shakeX.snapTo(0f)
                shakeY.snapTo(0f)
            }
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(colors.obsidian)
            .graphicsLayer {
                translationX = shakeX.value.dp.toPx()
                translationY = shakeY.value.dp.toPx()
            }
    ) {
        Column(
            modifier = Modifier.fillMaxSize(),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            // Top broadcast bar + scrollable purse ticker
            Column(modifier = Modifier.fillMaxWidth()) {
                BroadcastTopBar(
                    setTitle = if (uiState.isAcceleratedRound) "ACCELERATED ROUND" else "SET ${uiState.currentSetNumber} • ${uiState.currentSetTitle.uppercase()}",
                    lotCounter = "LOT ${uiState.lotNumber} of ${uiState.totalLotsInRound}",
                    isMuted = uiState.settings.isMuted,
                    onToggleMute = { onIntent(AuctionIntent.ToggleMute) }
                )

                PurseTickerStrip(
                    teams = uiState.teams,
                    highestBidder = uiState.highestBidder,
                    maxSquadSize = uiState.activeConfig.maxSquadSize,
                    onTeamClick = { onIntent(AuctionIntent.OpenSquadSheet(it)) }
                )
            }

            // Middle Stage: Set Intro OR Player Card + Duel Strip + Commentary
            Box(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = spacing.md, vertical = spacing.sm)
            ) {
                if (uiState.phase == AuctionPhase.SET_INTRO || uiState.phase == AuctionPhase.ACCELERATED_INTRO) {
                    SetIntroStageCard(
                        setNumber = uiState.currentSetNumber,
                        title = uiState.currentSetTitle,
                        subtitle = uiState.currentSetSubtitle,
                        playerCount = uiState.currentSetPlayerCount,
                        reduceMotion = reduceMotion
                    )
                } else {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(spacing.sm),
                        modifier = Modifier.fillMaxSize()
                    ) {
                        val player = uiState.currentPlayer
                        if (player != null) {
                            AnimatedContent(
                                targetState = player,
                                contentKey = { it.id },
                                transitionSpec = {
                                    if (reduceMotion) {
                                        fadeIn(tween(150)) togetherWith fadeOut(tween(150))
                                    } else {
                                        (slideInHorizontally(
                                            spring(dampingRatio = 0.8f, stiffness = Spring.StiffnessMediumLow)
                                        ) { it / 3 } + fadeIn(tween(260))) togetherWith
                                            (slideOutHorizontally(tween(200)) { -it / 3 } + fadeOut(tween(180)))
                                    }
                                },
                                label = "lot_card_reveal",
                                modifier = Modifier.weight(1f)
                            ) { lotPlayer ->
                                BroadcastPlayerCard(
                                    player = lotPlayer,
                                    effectiveBaseCr = uiState.effectiveBasePriceCr,
                                    currentBidCr = uiState.currentBidCr,
                                    highestBidder = uiState.highestBidder,
                                    bidRemainingMs = uiState.bidRemainingMs,
                                    bidTotalWindowMs = uiState.bidTotalWindowMs,
                                    isBiddingActive = uiState.phase == AuctionPhase.BIDDING,
                                    isUnsold = uiState.phase == AuctionPhase.HAMMER_UNSOLD,
                                    bidTriggerCount = bidTriggerCount,
                                    reduceMotion = reduceMotion
                                )
                            }
                        }

                        if (uiState.isDuelActive && uiState.duelTeams.size == 2) {
                            DuelStripBanner(
                                teamA = uiState.duelTeams[0],
                                teamB = uiState.duelTeams[1],
                                exchangeCount = uiState.consecutiveDuelCount
                            )
                        }

                        BroadcastCommentaryBar(
                            commentary = uiState.latestCommentary,
                            isDuelActive = uiState.isDuelActive
                        )
                    }
                }

                // Hammer / Sold / Unsold Stamp Overlay
                if (uiState.phase == AuctionPhase.HAMMER_SOLD || uiState.phase == AuctionPhase.HAMMER_UNSOLD) {
                    HammerStampOverlay(
                        isSold = uiState.phase == AuctionPhase.HAMMER_SOLD,
                        buyerCode = uiState.lastSoldRecord?.teamCode ?: uiState.highestBidder,
                        soldPriceCr = uiState.lastSoldRecord?.priceCr ?: uiState.currentBidCr,
                        triggerId = uiState.lotNumber * 10 + if (uiState.phase == AuctionPhase.HAMMER_SOLD) 1 else 2
                    )
                }
            }

            // Bottom Thumb Zone
            BottomThumbControlDeck(
                uiState = uiState,
                onIntent = onIntent
            )
        }

        // Escalation Vignette & Pooled Sold Particle Burst
        EscalationVignette(active = uiState.isDuelActive && uiState.phase == AuctionPhase.BIDDING)
        PooledSoldParticlesOverlay(
            burstTriggerId = soldBurstTrigger,
            teamCode = uiState.lastSoldRecord?.teamCode ?: uiState.highestBidder
        )

        // RTM Drama Overlay
        val rtm = uiState.rtmState
        val curPlayer = uiState.currentPlayer
        if (
            rtm != null &&
            curPlayer != null &&
            (uiState.phase == AuctionPhase.RTM_DECISION ||
                uiState.phase == AuctionPhase.RTM_COUNTER_RAISE ||
                uiState.phase == AuctionPhase.RTM_FINAL_MATCH)
        ) {
            RtmDramaOverlay(
                phase = uiState.phase,
                rtmState = rtm,
                player = curPlayer,
                phaseRemainingMs = uiState.phaseRemainingMs,
                humanTeamCodes = uiState.humanTeamCodes,
                onIntent = onIntent
            )
        }
    }

    // Squad Sheet Bottom Sheet
    val squadTeam = uiState.showSquadSheetForTeam
    if (squadTeam != null) {
        SquadSheetModal(
            teams = uiState.teams,
            selectedTeamCode = squadTeam,
            config = uiState.activeConfig,
            onSelectTeam = { onIntent(AuctionIntent.OpenSquadSheet(it)) },
            onDismiss = { onIntent(AuctionIntent.CloseSquadSheet) }
        )
    }

    // Unsold Pool Tray Bottom Sheet
    if (uiState.showUnsoldTray) {
        UnsoldPoolTrayModal(
            unsoldPlayers = uiState.unsoldPlayers,
            purseCr = uiState.activeConfig.purseCr,
            onDismiss = { onIntent(AuctionIntent.ToggleUnsoldTray(false)) }
        )
    }
}

@Composable
private fun BroadcastTopBar(
    setTitle: String,
    lotCounter: String,
    isMuted: Boolean,
    onToggleMute: () -> Unit
) {
    val colors = HammerTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.charcoal)
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = setTitle,
                style = MaterialTheme.typography.labelLarge,
                color = colors.goldLight,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = lotCounter,
                style = HammerNumericStyles.statCaption,
                color = colors.muted
            )
        }
        IconButton(
            onClick = onToggleMute,
            modifier = Modifier.size(48.dp)
        ) {
            Icon(
                imageVector = Icons.Default.Notifications,
                contentDescription = if (isMuted) "Unmute audio" else "Mute audio",
                tint = if (isMuted) colors.muted else colors.antiqueGold
            )
        }
    }
}

@Composable
private fun PurseTickerStrip(
    teams: List<TeamState>,
    highestBidder: TeamCode?,
    maxSquadSize: Int,
    onTeamClick: (TeamCode) -> Unit
) {
    val colors = HammerTheme.colors
    LazyRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.obsidian)
    ) {
        items(teams, key = { it.team.code }) { team ->
            val isLeading = team.team.code == highestBidder
            val accent = team.team.primaryColor
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier
                    .clip(RoundedCornerShape(10.dp))
                    .background(if (isLeading) accent.copy(alpha = 0.22f) else colors.charcoal)
                    .border(
                        width = if (isLeading) 1.5.dp else 1.dp,
                        color = if (isLeading) accent else colors.hairline,
                        shape = RoundedCornerShape(10.dp)
                    )
                    .clickable { onTeamClick(team.team.code) }
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                TeamCrestImage(teamCode = team.team.code, size = 24.dp)
                Spacer(modifier = Modifier.width(6.dp))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = team.team.code.name,
                            style = MaterialTheme.typography.labelMedium,
                            color = if (isLeading) accent else colors.ivory
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "${team.squadCount}/$maxSquadSize",
                            style = HammerNumericStyles.statCaption,
                            color = colors.muted
                        )
                    }
                    Text(
                        text = MoneyFormatter.formatCompactCr(team.purseRemainingCr),
                        style = HammerNumericStyles.purseTicker,
                        color = colors.goldLight
                    )
                }
            }
        }
    }
}

@Composable
private fun SetIntroStageCard(
    setNumber: Int,
    title: String,
    subtitle: String,
    playerCount: Int,
    reduceMotion: Boolean
) {
    val colors = HammerTheme.colors
    Box(
        contentAlignment = Alignment.Center,
        modifier = Modifier
            .fillMaxSize()
            .clip(MaterialTheme.shapes.large)
            .background(colors.charcoal)
            .border(1.5.dp, colors.antiqueGold, MaterialTheme.shapes.large)
            .padding(24.dp)
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Box(
                modifier = Modifier
                    .goldSheenBackground(cornerRadius = 10.dp, reduceMotion = reduceMotion)
                    .padding(horizontal = 16.dp, vertical = 6.dp)
            ) {
                Text(
                    text = if (setNumber == 0) "ACCELERATED ROUND" else "SET $setNumber",
                    style = MaterialTheme.typography.labelLarge,
                    color = colors.obsidian
                )
            }
            Text(
                text = title,
                style = MaterialTheme.typography.displayMedium,
                color = colors.ivory,
                textAlign = TextAlign.Center
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = colors.muted,
                textAlign = TextAlign.Center
            )
            Text(
                text = "$playerCount PROSPECTS IN THE DRUM",
                style = HammerNumericStyles.statValue,
                color = colors.antiqueGold
            )
        }
    }
}

@Composable
private fun BroadcastPlayerCard(
    player: Player,
    effectiveBaseCr: Double,
    currentBidCr: Double?,
    highestBidder: TeamCode?,
    bidRemainingMs: Long,
    bidTotalWindowMs: Long,
    isBiddingActive: Boolean,
    isUnsold: Boolean,
    bidTriggerCount: Int,
    reduceMotion: Boolean
) {
    val colors = HammerTheme.colors
    val statFillAnim = remember(player.id) { Animatable(if (reduceMotion) 1f else 0f) }

    LaunchedEffect(player.id) {
        if (!reduceMotion) {
            statFillAnim.snapTo(0f)
            statFillAnim.animateTo(1f, tween(durationMillis = 700, easing = FastOutSlowInEasing))
        }
    }

    val isGoingOnce = isBiddingActive && bidRemainingMs in 2001L..3000L
    val isGoingTwice = isBiddingActive && bidRemainingMs in 1L..2000L

    Column(
        verticalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxSize()
            .clip(MaterialTheme.shapes.medium)
            .background(colors.charcoal)
            .border(
                width = 1.dp,
                color = if (player.vintage.isVintage) colors.antiqueGold else colors.hairline,
                shape = MaterialTheme.shapes.medium
            )
            .padding(12.dp)
    ) {
        // Top strip: badges + OVR + Former team
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                RoleBadgeChip(role = player.role)
                if (player.vintage.isVintage) {
                    VintageLaurelChip(era = player.vintage.era)
                } else if (player.wildcard.isWildcard && player.wildcard.trait != null) {
                    Text(
                        text = player.wildcard.trait.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.obsidian,
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(colors.goldLight)
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    )
                }
            }
            Text(
                text = "OVR ${player.rating}",
                style = HammerNumericStyles.statValue,
                color = colors.goldLight
            )
        }

        // Portrait + Bio + Animated Stat Bars
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .padding(vertical = 6.dp)
        ) {
            ParametricPlayerPortrait(
                avatar = player.avatar,
                country = player.country,
                desaturate = isUnsold,
                modifier = Modifier.size(104.dp)
            )
            Spacer(modifier = Modifier.width(12.dp))
            Column(
                verticalArrangement = Arrangement.spacedBy(4.dp),
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = "${player.country}${if (player.overseas) " • OVERSEAS" else " • HOME"} • AGE ${player.age}",
                    style = HammerNumericStyles.statCaption,
                    color = colors.muted
                )
                Text(
                    text = player.styleTag,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.ivory,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(2.dp))
                PlayerStatBars(
                    player = player,
                    fillProgressProvider = { statFillAnim.value }
                )
            }
        }

        // Final-call ladder callout + Lower-third bar with Countdown Ring
        if (isGoingOnce || isGoingTwice) {
            Text(
                text = if (isGoingTwice) "GOING TWICE!" else "GOING ONCE...",
                style = MaterialTheme.typography.titleMedium,
                color = colors.crimson,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        }

        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(colors.raised)
                .border(1.dp, colors.hairline, RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "BASE ${MoneyFormatter.formatCr(effectiveBaseCr)}",
                    style = HammerNumericStyles.statCaption,
                    color = colors.muted
                )
                Text(
                    text = player.name,
                    style = MaterialTheme.typography.headlineMedium,
                    color = colors.ivory,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
                Spacer(modifier = Modifier.height(4.dp))
                if (highestBidder != null) {
                    PaddleRaiseBadge(
                        bidderCode = highestBidder,
                        bidTriggerId = bidTriggerCount
                    )
                } else {
                    Text(
                        text = if (player.formerTeam != null) "RTM Eligible: ${player.formerTeam.name}" else "Awaiting opening paddle",
                        style = MaterialTheme.typography.labelSmall,
                        color = colors.antiqueGold
                    )
                }
            }

            Spacer(modifier = Modifier.width(8.dp))

            CountdownBidRing(
                remainingMs = bidRemainingMs,
                totalWindowMs = bidTotalWindowMs,
                bidAmountCr = currentBidCr ?: effectiveBaseCr,
                bidCountTrigger = bidTriggerCount,
                isBiddingActive = isBiddingActive
            )
        }
    }
}

@Composable
private fun PlayerStatBars(
    player: Player,
    fillProgressProvider: () -> Float
) {
    val colors = HammerTheme.colors
    val bat = player.stats.batting
    val bowl = player.stats.bowling

    val metrics: List<Triple<String, String, Float>> = when (player.role) {
        PlayerRole.BOWL -> listOf(
            Triple("WKTS", "${bowl.wickets}", (bowl.wickets / 180f).coerceIn(0.1f, 1f)),
            Triple("ECON", String.format(java.util.Locale.US, "%.2f", bowl.economy), ((10.5 - bowl.economy) / 4.5).toFloat().coerceIn(0.1f, 1f)),
            Triple("MAT", "${bat.matches}", (bat.matches / 200f).coerceIn(0.1f, 1f))
        )
        PlayerRole.AR -> listOf(
            Triple("RUNS", "${bat.runs}", (bat.runs / 3500f).coerceIn(0.1f, 1f)),
            Triple("SR", "${bat.strikeRate.toInt()}", (bat.strikeRate / 175.0).toFloat().coerceIn(0.1f, 1f)),
            Triple("WKTS", "${bowl.wickets}", (bowl.wickets / 150f).coerceIn(0.1f, 1f))
        )
        else -> listOf(
            Triple("RUNS", "${bat.runs}", (bat.runs / 6000f).coerceIn(0.1f, 1f)),
            Triple("AVG", String.format(java.util.Locale.US, "%.1f", bat.avg), (bat.avg / 48.0).toFloat().coerceIn(0.1f, 1f)),
            Triple("SR", "${bat.strikeRate.toInt()}", (bat.strikeRate / 175.0).toFloat().coerceIn(0.1f, 1f))
        )
    }

    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        metrics.forEach { (label, valueText, targetFrac) ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = label,
                    style = HammerNumericStyles.statCaption,
                    color = colors.muted,
                    modifier = Modifier.width(38.dp)
                )
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp))
                        .background(colors.hairline)
                ) {
                    val frac = (targetFrac * fillProgressProvider()).coerceIn(0f, 1f)
                    Box(
                        modifier = Modifier
                            .fillMaxHeight()
                            .fillMaxWidth(frac)
                            .background(colors.antiqueGold)
                    )
                }
                Spacer(modifier = Modifier.width(6.dp))
                Text(
                    text = valueText,
                    style = HammerNumericStyles.statCaption,
                    color = colors.ivory,
                    modifier = Modifier.width(38.dp),
                    textAlign = TextAlign.End
                )
            }
        }
    }
}

@Composable
private fun DuelStripBanner(
    teamA: TeamCode,
    teamB: TeamCode,
    exchangeCount: Int
) {
    val colors = HammerTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(colors.crimson.copy(alpha = 0.22f))
            .border(1.dp, colors.crimson, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            TeamCrestImage(teamCode = teamA, size = 22.dp)
            Spacer(modifier = Modifier.width(6.dp))
            Text(teamA.name, style = MaterialTheme.typography.labelLarge, color = teamA.primaryColor)
        }
        Text(
            text = "DUEL • $exchangeCount BIDS",
            style = HammerNumericStyles.statCaption,
            color = colors.goldLight
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(teamB.name, style = MaterialTheme.typography.labelLarge, color = teamB.primaryColor)
            Spacer(modifier = Modifier.width(6.dp))
            TeamCrestImage(teamCode = teamB, size = 22.dp)
        }
    }
}

@Composable
private fun BottomThumbControlDeck(
    uiState: AuctionUiState,
    onIntent: (AuctionIntent) -> Unit
) {
    val colors = HammerTheme.colors
    val spacing = HammerTheme.spacing

    Column(
        verticalArrangement = Arrangement.spacedBy(spacing.sm),
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.charcoal)
            .border(1.dp, colors.hairline)
            .padding(horizontal = spacing.md, vertical = spacing.md)
    ) {
        // Hot-seat "Bid as" switcher when > 1 human team
        if (uiState.humanTeamCodes.size > 1) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(
                    text = "BID AS:",
                    style = MaterialTheme.typography.labelSmall,
                    color = colors.muted
                )
                uiState.humanTeamCodes.forEach { code ->
                    val selected = code == uiState.activeHumanTeam
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .height(48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(if (selected) code.primaryColor.copy(alpha = 0.24f) else colors.raised)
                            .border(
                                width = if (selected) 1.5.dp else 1.dp,
                                color = if (selected) code.primaryColor else colors.hairline,
                                shape = RoundedCornerShape(10.dp)
                            )
                            .clickable { onIntent(AuctionIntent.SelectActiveHumanTeam(code)) }
                            .padding(horizontal = 10.dp)
                    ) {
                        TeamCrestImage(teamCode = code, size = 22.dp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(code.name, style = MaterialTheme.typography.labelMedium, color = colors.ivory)
                    }
                }
            }
        }

        // Primary CTA: Bid Button (>= 64dp) or View Recap when COMPLETED
        if (uiState.phase == AuctionPhase.COMPLETED) {
            Button(
                onClick = { onIntent(AuctionIntent.ProceedToRecap) },
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.antiqueGold,
                    contentColor = colors.obsidian
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
            ) {
                Text(
                    text = "AUCTION COMPLETE — VIEW RECAP",
                    style = MaterialTheme.typography.titleLarge
                )
            }
        } else {
            val elig = uiState.activeBidEligibility
            val bidLabel = if (elig.canBid) {
                "BID ${MoneyFormatter.formatCr(elig.nextBidCr)} (${uiState.activeHumanTeam.name})"
            } else {
                elig.blockReason ?: "WAIT..."
            }
            val bidContentDesc = if (elig.canBid) {
                "Place bid of ${MoneyFormatter.formatCr(elig.nextBidCr)} as ${uiState.activeHumanTeam.fullName}"
            } else {
                "Bid disabled: ${elig.blockReason ?: "not available"}"
            }

            Button(
                onClick = { onIntent(AuctionIntent.PlaceHumanBid) },
                enabled = elig.canBid,
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.buttonColors(
                    containerColor = uiState.activeHumanTeam.primaryColor,
                    contentColor = colors.obsidian,
                    disabledContainerColor = colors.raised,
                    disabledContentColor = colors.muted
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(64.dp)
                    .semantics { contentDescription = bidContentDesc }
            ) {
                Text(
                    text = bidLabel,
                    style = MaterialTheme.typography.titleLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        // Secondary action row (>= 48dp touch targets)
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            OutlinedButton(
                onClick = { onIntent(AuctionIntent.OpenSquadSheet(uiState.activeHumanTeam)) },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp)
            ) {
                Icon(Icons.AutoMirrored.Filled.List, contentDescription = null, tint = colors.ivory, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(4.dp))
                Text("Squads", style = MaterialTheme.typography.labelLarge, color = colors.ivory)
            }
            OutlinedButton(
                onClick = { onIntent(AuctionIntent.ToggleUnsoldTray(true)) },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .weight(1f)
                    .height(48.dp)
            ) {
                Text(
                    "Unsold (${uiState.unsoldPlayers.size})",
                    style = HammerNumericStyles.statCaption,
                    color = colors.ivory
                )
            }
            OutlinedButton(
                onClick = { onIntent(AuctionIntent.HostSkipStage) },
                shape = RoundedCornerShape(10.dp),
                modifier = Modifier
                    .weight(0.85f)
                    .height(48.dp)
            ) {
                Icon(Icons.Default.PlayArrow, contentDescription = null, tint = colors.antiqueGold, modifier = Modifier.size(18.dp))
                Spacer(modifier = Modifier.width(2.dp))
                Text("Skip", style = MaterialTheme.typography.labelLarge, color = colors.antiqueGold)
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0E1116, widthDp = 390, heightDp = 844)
@Composable
private fun AuctionStageScreenPreview() {
    HammerTheme {
        AuctionStageScreen(
            uiState = PreviewFixtures.sampleAuctionState,
            onIntent = {}
        )
    }
}
