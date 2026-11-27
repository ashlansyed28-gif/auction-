package com.hammertime.auction.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.AuctionPhase
import com.hammertime.auction.model.AuctionValuation
import com.hammertime.auction.model.MoneyFormatter
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.RtmState
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.state.AuctionIntent
import com.hammertime.auction.state.engine.AuctionEngine
import com.hammertime.auction.ui.crests.TeamCrestImage
import com.hammertime.auction.ui.theme.HammerNumericStyles
import com.hammertime.auction.ui.theme.HammerTheme
import com.hammertime.auction.ui.theme.primaryColor
import java.util.Locale

@Composable
fun RtmDramaOverlay(
    phase: AuctionPhase,
    rtmState: RtmState,
    player: Player,
    phaseRemainingMs: Long,
    humanTeamCodes: List<TeamCode>,
    onIntent: (AuctionIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val progress = (phaseRemainingMs.toFloat() / AuctionEngine.RTM_DECISION_MS.toFloat()).coerceIn(0f, 1f)
    val formerAccent = rtmState.formerTeam.primaryColor
    val secondsText = String.format(Locale.US, "%.1fs", (phaseRemainingMs / 1000.0).coerceAtLeast(0.0))

    val isFormerHuman = rtmState.formerTeam in humanTeamCodes
    val isWinnerHuman = rtmState.winningTeam in humanTeamCodes

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .fillMaxSize()
            .background(colors.obsidian.copy(alpha = 0.90f))
            .padding(24.dp)
    ) {
        // Spotlight behind former team crest
        Canvas(modifier = Modifier.fillMaxSize()) {
            drawCircle(
                brush = Brush.radialGradient(
                    colors = listOf(formerAccent.copy(alpha = 0.28f), Color.Transparent),
                    center = Offset(size.width / 2f, size.height * 0.34f),
                    radius = size.minDimension * 0.52f
                )
            )
        }

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(14.dp),
            modifier = Modifier
                .fillMaxWidth()
                .clip(MaterialTheme.shapes.large)
                .background(colors.charcoal)
                .border(2.dp, formerAccent, MaterialTheme.shapes.large)
                .padding(20.dp)
        ) {
            Text(
                text = "RIGHT TO MATCH",
                style = MaterialTheme.typography.labelLarge,
                color = colors.goldLight
            )
            Text(
                text = player.name,
                style = MaterialTheme.typography.headlineMedium,
                color = colors.ivory,
                textAlign = TextAlign.Center
            )

            // 8s spotlight countdown ring wrapping the former team's crest
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier.size(116.dp)
            ) {
                Canvas(modifier = Modifier.matchParentSize()) {
                    val strokePx = 6.dp.toPx()
                    val inset = strokePx / 2f
                    drawArc(
                        color = colors.hairline,
                        startAngle = -90f,
                        sweepAngle = 360f,
                        useCenter = false,
                        topLeft = Offset(inset, inset),
                        size = Size(size.width - strokePx, size.height - strokePx),
                        style = Stroke(width = strokePx, cap = StrokeCap.Round)
                    )
                    drawArc(
                        color = formerAccent,
                        startAngle = -90f,
                        sweepAngle = 360f * progress,
                        useCenter = false,
                        topLeft = Offset(inset, inset),
                        size = Size(size.width - strokePx, size.height - strokePx),
                        style = Stroke(width = strokePx, cap = StrokeCap.Round)
                    )
                }
                TeamCrestImage(teamCode = rtmState.formerTeam, size = 72.dp)
            }

            Text(
                text = "$secondsText • ${rtmState.formerTeam.fullName}",
                style = HammerNumericStyles.statValue,
                color = colors.antiqueGold
            )

            when (phase) {
                AuctionPhase.RTM_DECISION -> {
                    Text(
                        text = "${rtmState.winningTeam.name} won at ${MoneyFormatter.formatCr(rtmState.originalBidCr)}. Exercise RTM?",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.ivory,
                        textAlign = TextAlign.Center
                    )
                    if (isFormerHuman) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            OutlinedButton(
                                onClick = { onIntent(AuctionIntent.SubmitRtmDecision(false)) },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                            ) {
                                Text("DECLINE", color = colors.muted)
                            }
                            Button(
                                onClick = { onIntent(AuctionIntent.SubmitRtmDecision(true)) },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = colors.antiqueGold,
                                    contentColor = colors.obsidian
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                            ) {
                                Text("USE RTM", style = MaterialTheme.typography.titleSmall)
                            }
                        }
                    } else {
                        Text(
                            text = "${rtmState.formerTeam.name} table is deliberating...",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.muted
                        )
                    }
                }

                AuctionPhase.RTM_COUNTER_RAISE -> {
                    val raisePrice = rtmState.counterRaiseBidCr ?: rtmState.originalBidCr
                    Text(
                        text = "${rtmState.formerTeam.name} triggered RTM! ${rtmState.winningTeam.name} has one final raise to ${MoneyFormatter.formatCr(raisePrice)}.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.ivory,
                        textAlign = TextAlign.Center
                    )
                    if (isWinnerHuman) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            OutlinedButton(
                                onClick = { onIntent(AuctionIntent.SubmitRtmCounterRaise(false)) },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                            ) {
                                Text("PASS", color = colors.muted)
                            }
                            Button(
                                onClick = { onIntent(AuctionIntent.SubmitRtmCounterRaise(true)) },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = colors.antiqueGold,
                                    contentColor = colors.obsidian
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                            ) {
                                Text(
                                    "RAISE ${MoneyFormatter.formatCompactCr(raisePrice)}",
                                    style = MaterialTheme.typography.titleSmall
                                )
                            }
                        }
                    } else {
                        Text(
                            text = "${rtmState.winningTeam.name} table weighing counter-raise...",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.muted
                        )
                    }
                }

                AuctionPhase.RTM_FINAL_MATCH -> {
                    val finalAsk = rtmState.counterRaiseBidCr ?: rtmState.originalBidCr
                    Text(
                        text = "${rtmState.winningTeam.name} raised to ${MoneyFormatter.formatCr(finalAsk)}! Match to keep ${player.name}?",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.ivory,
                        textAlign = TextAlign.Center
                    )
                    if (isFormerHuman) {
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            OutlinedButton(
                                onClick = { onIntent(AuctionIntent.SubmitRtmFinalMatch(false)) },
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                            ) {
                                Text("DECLINE", color = colors.muted)
                            }
                            Button(
                                onClick = { onIntent(AuctionIntent.SubmitRtmFinalMatch(true)) },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = colors.antiqueGold,
                                    contentColor = colors.obsidian
                                ),
                                modifier = Modifier
                                    .weight(1f)
                                    .height(54.dp)
                            ) {
                                Text(
                                    "MATCH ${MoneyFormatter.formatCompactCr(finalAsk)}",
                                    style = MaterialTheme.typography.titleSmall
                                )
                            }
                        }
                    } else {
                        Text(
                            text = "${rtmState.formerTeam.name} deciding final match...",
                            style = MaterialTheme.typography.bodySmall,
                            color = colors.muted
                        )
                    }
                }

                else -> Unit
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UnsoldPoolTrayModal(
    unsoldPlayers: List<Player>,
    purseCr: Double,
    onDismiss: () -> Unit
) {
    val colors = HammerTheme.colors
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = colors.charcoal,
        contentColor = colors.ivory
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .fillMaxHeight(0.75f)
                .padding(horizontal = 16.dp)
        ) {
            Text(
                text = "UNSOLD POOL (${unsoldPlayers.size})",
                style = MaterialTheme.typography.titleLarge,
                color = colors.goldLight
            )
            Text(
                text = "Re-offered in Accelerated Round at 25% reduced base price",
                style = MaterialTheme.typography.bodySmall,
                color = colors.muted
            )
            Spacer(modifier = Modifier.height(12.dp))

            if (unsoldPlayers.isEmpty()) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    Text(
                        text = "No unsold players so far.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.muted
                    )
                }
            } else {
                LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    contentPadding = PaddingValues(bottom = 24.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    items(unsoldPlayers, key = { it.id }) { p ->
                        val scaled = AuctionValuation.effectiveBasePriceCr(p.basePriceCr, purseCr)
                        val accel = AuctionValuation.acceleratedBasePriceCr(scaled)
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(colors.raised)
                                .border(1.dp, colors.hairline, RoundedCornerShape(10.dp))
                                .padding(horizontal = 12.dp, vertical = 10.dp)
                        ) {
                            Text(
                                text = p.role.name,
                                style = MaterialTheme.typography.labelMedium,
                                color = colors.antiqueGold,
                                modifier = Modifier.width(42.dp)
                            )
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "${p.name}${if (p.overseas) " ✈" else ""}",
                                    style = MaterialTheme.typography.titleSmall,
                                    color = colors.ivory,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                                Text(
                                    text = "${p.country} • OVR ${p.rating} • ${p.styleTag}",
                                    style = HammerNumericStyles.statCaption,
                                    color = colors.muted,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                            Text(
                                text = MoneyFormatter.formatCr(accel),
                                style = HammerNumericStyles.statValue,
                                color = colors.goldLight
                            )
                        }
                    }
                }
            }
        }
    }
}
