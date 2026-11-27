package com.hammertime.auction.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.AuctionConfig
import com.hammertime.auction.model.PlayerSetCatalog
import com.hammertime.auction.model.PurseTier
import com.hammertime.auction.model.SetOrderMode
import com.hammertime.auction.model.TeamAssignment
import com.hammertime.auction.state.AuctionIntent
import com.hammertime.auction.ui.crests.TeamCrestImage
import com.hammertime.auction.ui.theme.HammerNumericStyles
import com.hammertime.auction.ui.theme.HammerTheme
import com.hammertime.auction.ui.theme.primaryColor
import kotlin.random.Random

@Composable
fun RoomSetupScreen(
    config: AuctionConfig,
    onIntent: (AuctionIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val spacing = HammerTheme.spacing

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.obsidian)
    ) {
        // Top header bar
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.charcoal)
                .padding(horizontal = spacing.sm, vertical = spacing.sm)
        ) {
            IconButton(
                onClick = { onIntent(AuctionIntent.BackToHome) },
                modifier = Modifier.size(48.dp)
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                    contentDescription = "Back to Home",
                    tint = colors.ivory
                )
            }
            Column {
                Text(
                    text = "AUCTION ROOM SETUP",
                    style = MaterialTheme.typography.titleLarge,
                    color = colors.goldLight
                )
                Text(
                    text = "Configure rules, franchises & hot-seat humans (1–3)",
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.muted
                )
            }
        }

        LazyColumn(
            contentPadding = PaddingValues(spacing.lg),
            verticalArrangement = Arrangement.spacedBy(spacing.md),
            modifier = Modifier.weight(1f)
        ) {
            item(key = "purse_section") {
                SectionCard(title = "FRANCHISE PURSE") {
                    Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        PurseTier.entries.forEach { tier ->
                            val selected = config.purseCr == tier.purseCr
                            SelectablePill(
                                label = tier.label,
                                selected = selected,
                                onClick = { onIntent(AuctionIntent.SelectPurseTier(tier)) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }

            item(key = "squad_rules") {
                SectionCard(title = "SQUAD & RTM RULES") {
                    StepperRow(
                        label = "Min Squad Size",
                        valueText = "${config.minSquadSize}",
                        onDecrement = {
                            onIntent(AuctionIntent.UpdateSquadLimits(config.minSquadSize - 1, config.maxSquadSize))
                        },
                        onIncrement = {
                            onIntent(AuctionIntent.UpdateSquadLimits(config.minSquadSize + 1, config.maxSquadSize))
                        }
                    )
                    StepperRow(
                        label = "Max Squad Size",
                        valueText = "${config.maxSquadSize}",
                        onDecrement = {
                            onIntent(AuctionIntent.UpdateSquadLimits(config.minSquadSize, config.maxSquadSize - 1))
                        },
                        onIncrement = {
                            onIntent(AuctionIntent.UpdateSquadLimits(config.minSquadSize, config.maxSquadSize + 1))
                        }
                    )
                    StepperRow(
                        label = "Max Overseas Players",
                        valueText = "${config.maxOverseas}",
                        onDecrement = { onIntent(AuctionIntent.UpdateMaxOverseas(config.maxOverseas - 1)) },
                        onIncrement = { onIntent(AuctionIntent.UpdateMaxOverseas(config.maxOverseas + 1)) }
                    )
                    StepperRow(
                        label = "RTM Cards per Team",
                        valueText = "${config.rtmCardsPerTeam}",
                        onDecrement = { onIntent(AuctionIntent.UpdateRtmCards(config.rtmCardsPerTeam - 1)) },
                        onIncrement = { onIntent(AuctionIntent.UpdateRtmCards(config.rtmCardsPerTeam + 1)) }
                    )
                }
            }

            item(key = "set_order") {
                SectionCard(title = "SET ORDER") {
                    Row(horizontalArrangement = Arrangement.spacedBy(spacing.sm)) {
                        SetOrderMode.entries.forEach { mode ->
                            SelectablePill(
                                label = mode.label,
                                selected = config.setOrderMode == mode,
                                onClick = { onIntent(AuctionIntent.SelectSetOrderMode(mode)) },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    if (config.setOrderMode == SetOrderMode.CUSTOM) {
                        Spacer(modifier = Modifier.height(spacing.sm))
                        config.customSetOrder.forEachIndexed { idx, setNum ->
                            val desc = PlayerSetCatalog.descriptorFor(setNum)
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 3.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(colors.raised)
                                    .padding(horizontal = 10.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = "${idx + 1}. Set $setNum — ${desc.title}",
                                    style = MaterialTheme.typography.bodySmall,
                                    color = colors.ivory,
                                    modifier = Modifier.weight(1f)
                                )
                                IconButton(
                                    onClick = { onIntent(AuctionIntent.MoveCustomSet(idx, idx - 1)) },
                                    enabled = idx > 0,
                                    modifier = Modifier.size(48.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.KeyboardArrowUp,
                                        contentDescription = "Move set up",
                                        tint = if (idx > 0) colors.antiqueGold else colors.hairline
                                    )
                                }
                                IconButton(
                                    onClick = { onIntent(AuctionIntent.MoveCustomSet(idx, idx + 1)) },
                                    enabled = idx < config.customSetOrder.lastIndex,
                                    modifier = Modifier.size(48.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.KeyboardArrowDown,
                                        contentDescription = "Move set down",
                                        tint = if (idx < config.customSetOrder.lastIndex) colors.antiqueGold else colors.hairline
                                    )
                                }
                            }
                        }
                    }
                }
            }

            item(key = "seed_row") {
                SectionCard(title = "DETERMINISTIC SEED") {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = "Seed #${config.seed}",
                            style = HammerNumericStyles.statValue,
                            color = colors.ivory
                        )
                        OutlinedButton(
                            onClick = { onIntent(AuctionIntent.UpdateSeed(Random.nextLong(1000L, 99999L))) },
                            modifier = Modifier.height(48.dp)
                        ) {
                            Text("Randomize Seed", color = colors.antiqueGold)
                        }
                    }
                }
            }

            item(key = "teams_header") {
                val humans = config.humanTeamCodes.size
                Text(
                    text = "FRANCHISE ASSIGNMENTS ($humans HUMAN • ${10 - humans} AI BOTS)",
                    style = MaterialTheme.typography.labelLarge,
                    color = colors.antiqueGold
                )
            }

            items(
                items = config.teamAssignments,
                key = { it.teamCode }
            ) { assignment ->
                TeamAssignmentRow(
                    assignment = assignment,
                    onToggleHuman = { onIntent(AuctionIntent.ToggleTeamHuman(assignment.teamCode)) },
                    onCycleBotStyle = { onIntent(AuctionIntent.CycleBotStyle(assignment.teamCode)) }
                )
            }
        }

        // Thumb-first launch footer
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.charcoal)
                .border(1.dp, colors.hairline)
                .padding(spacing.lg)
        ) {
            Button(
                onClick = { onIntent(AuctionIntent.LaunchAuction) },
                shape = MaterialTheme.shapes.medium,
                colors = ButtonDefaults.buttonColors(
                    containerColor = colors.antiqueGold,
                    contentColor = colors.obsidian
                ),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(60.dp)
            ) {
                Text(
                    text = "ENTER AUCTION HALL",
                    style = MaterialTheme.typography.titleLarge
                )
            }
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    content: @Composable () -> Unit
) {
    val colors = HammerTheme.colors
    Column(
        verticalArrangement = Arrangement.spacedBy(10.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(colors.charcoal)
            .border(1.dp, colors.hairline, MaterialTheme.shapes.medium)
            .padding(14.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.labelLarge,
            color = colors.antiqueGold
        )
        content()
    }
}

@Composable
private fun SelectablePill(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val shape = RoundedCornerShape(10.dp)
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
        modifier = modifier
            .height(48.dp)
            .clip(shape)
            .background(if (selected) colors.antiqueGold.copy(alpha = 0.2f) else colors.raised)
            .border(
                width = if (selected) 1.5.dp else 1.dp,
                color = if (selected) colors.antiqueGold else colors.hairline,
                shape = shape
            )
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = if (selected) colors.goldLight else colors.ivory,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
    }
}

@Composable
private fun StepperRow(
    label: String,
    valueText: String,
    onDecrement: () -> Unit,
    onIncrement: () -> Unit
) {
    val colors = HammerTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier
            .fillMaxWidth()
            .height(48.dp)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.ivory
        )
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(
                onClick = onDecrement,
                contentPadding = PaddingValues(0.dp),
                modifier = Modifier.size(48.dp)
            ) {
                Text("-", style = MaterialTheme.typography.titleMedium, color = colors.ivory)
            }
            Text(
                text = valueText,
                style = HammerNumericStyles.statValue,
                color = colors.goldLight,
                modifier = Modifier.padding(horizontal = 14.dp)
            )
            OutlinedButton(
                onClick = onIncrement,
                contentPadding = PaddingValues(0.dp),
                modifier = Modifier.size(48.dp)
            ) {
                Text("+", style = MaterialTheme.typography.titleMedium, color = colors.ivory)
            }
        }
    }
}

@Composable
private fun TeamAssignmentRow(
    assignment: TeamAssignment,
    onToggleHuman: () -> Unit,
    onCycleBotStyle: () -> Unit
) {
    val colors = HammerTheme.colors
    val accent = assignment.teamCode.primaryColor
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(MaterialTheme.shapes.medium)
            .background(colors.charcoal)
            .border(
                width = if (assignment.isHuman) 1.5.dp else 1.dp,
                color = if (assignment.isHuman) accent else colors.hairline,
                shape = MaterialTheme.shapes.medium
            )
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        TeamCrestImage(teamCode = assignment.teamCode, size = 40.dp)
        Spacer(modifier = Modifier.width(10.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "${assignment.teamCode.name} • ${assignment.teamCode.fullName}",
                style = MaterialTheme.typography.titleSmall,
                color = colors.ivory,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = if (assignment.isHuman) "Human Hot-Seat Controller" else "Bot GM: ${assignment.botPersonaName}",
                style = MaterialTheme.typography.bodySmall,
                color = if (assignment.isHuman) accent else colors.muted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(modifier = Modifier.width(8.dp))
        if (!assignment.isHuman) {
            SelectablePill(
                label = assignment.botStyle.label,
                selected = false,
                onClick = onCycleBotStyle,
                modifier = Modifier.width(96.dp)
            )
            Spacer(modifier = Modifier.width(6.dp))
        }
        SelectablePill(
            label = if (assignment.isHuman) "HUMAN" else "BOT",
            selected = assignment.isHuman,
            onClick = onToggleHuman,
            modifier = Modifier.width(68.dp)
        )
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0E1116, widthDp = 390, heightDp = 844)
@Composable
private fun RoomSetupScreenPreview() {
    HammerTheme {
        RoomSetupScreen(
            config = AuctionConfig(),
            onIntent = {}
        )
    }
}
