package com.hammertime.auction.ui.screens

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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.AuctionConfig
import com.hammertime.auction.model.MoneyFormatter
import com.hammertime.auction.model.PlayerRole
import com.hammertime.auction.model.SquadEntry
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.model.TeamState
import com.hammertime.auction.state.engine.RecapEvaluator
import com.hammertime.auction.ui.components.PreviewFixtures
import com.hammertime.auction.ui.crests.TeamCrestImage
import com.hammertime.auction.ui.theme.HammerNumericStyles
import com.hammertime.auction.ui.theme.HammerTheme
import com.hammertime.auction.ui.theme.primaryColor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SquadSheetModal(
    teams: List<TeamState>,
    selectedTeamCode: TeamCode,
    config: AuctionConfig,
    onSelectTeam: (TeamCode) -> Unit,
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
        SquadSheetContent(
            teams = teams,
            selectedTeamCode = selectedTeamCode,
            config = config,
            onSelectTeam = onSelectTeam
        )
    }
}

@Composable
fun SquadSheetContent(
    teams: List<TeamState>,
    selectedTeamCode: TeamCode,
    config: AuctionConfig,
    onSelectTeam: (TeamCode) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val team = teams.firstOrNull { it.team.code == selectedTeamCode } ?: teams.firstOrNull() ?: return
    var activeTab by remember { mutableIntStateOf(0) } // 0 = Roster, 1 = Projected XI
    val projectedXI = remember(team.squad) { RecapEvaluator.selectBestXI(team.squad) }

    Column(
        modifier = modifier
            .fillMaxWidth()
            .fillMaxHeight(0.86f)
            .background(colors.charcoal)
            .padding(horizontal = 16.dp)
    ) {
        // Horizontal team switcher
        LazyRow(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = PaddingValues(vertical = 6.dp)
        ) {
            items(teams, key = { it.team.code }) { t ->
                val isSelected = t.team.code == team.team.code
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier
                        .height(48.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (isSelected) t.team.primaryColor.copy(alpha = 0.22f) else colors.raised)
                        .border(
                            width = if (isSelected) 1.5.dp else 1.dp,
                            color = if (isSelected) t.team.primaryColor else colors.hairline,
                            shape = RoundedCornerShape(10.dp)
                        )
                        .clickable { onSelectTeam(t.team.code) }
                        .padding(horizontal = 10.dp)
                ) {
                    TeamCrestImage(teamCode = t.team.code, size = 24.dp)
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        text = t.team.code.name,
                        style = MaterialTheme.typography.labelLarge,
                        color = if (isSelected) colors.goldLight else colors.ivory
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Summary header
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clip(MaterialTheme.shapes.medium)
                .background(colors.raised)
                .border(1.dp, team.team.primaryColor.copy(alpha = 0.6f), MaterialTheme.shapes.medium)
                .padding(12.dp)
        ) {
            TeamCrestImage(teamCode = team.team.code, size = 44.dp)
            Spacer(modifier = Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = team.team.name,
                    style = MaterialTheme.typography.titleMedium,
                    color = colors.ivory
                )
                Text(
                    text = "Purse: ${MoneyFormatter.formatCr(team.purseRemainingCr)} • RTM: ${team.rtmRemaining}",
                    style = HammerNumericStyles.purseTicker,
                    color = colors.goldLight
                )
            }
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = "${team.squadCount}/${config.maxSquadSize}",
                    style = HammerNumericStyles.statValue,
                    color = colors.ivory
                )
                Text(
                    text = "OS ${team.overseasCount}/${config.maxOverseas}",
                    style = HammerNumericStyles.statCaption,
                    color = colors.muted
                )
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Role composition bars
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            PlayerRole.entries.forEach { role ->
                val count = team.squad.count { it.player.role == role }
                val fillFrac = (count / 6f).coerceIn(0f, 1f)
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(colors.raised)
                        .padding(8.dp)
                ) {
                    Row(
                        horizontalArrangement = Arrangement.SpaceBetween,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(role.name, style = MaterialTheme.typography.labelSmall, color = colors.muted)
                        Text("$count", style = HammerNumericStyles.statCaption, color = colors.ivory)
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(5.dp)
                            .clip(RoundedCornerShape(3.dp))
                            .background(colors.hairline)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth(fillFrac)
                                .height(5.dp)
                                .background(team.team.primaryColor)
                        )
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(10.dp))

        // Tab switcher: Full Squad vs Projected XI
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TabPill(
                label = "Squad (${team.squadCount})",
                selected = activeTab == 0,
                onClick = { activeTab = 0 },
                modifier = Modifier.weight(1f)
            )
            TabPill(
                label = "Projected XI",
                selected = activeTab == 1,
                onClick = { activeTab = 1 },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(modifier = Modifier.height(10.dp))

        if (activeTab == 0) {
            if (team.squad.isEmpty()) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .fillMaxWidth()
                        .weight(1f)
                ) {
                    Text(
                        text = "No players acquired yet.",
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
                    items(team.squad, key = { it.player.id }) { entry ->
                        SquadPlayerRow(entry = entry, isCaptain = false)
                    }
                }
            }
        } else {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "WK: ${projectedXI.keeperCount} • Bowl Options: ${projectedXI.bowlingOptionsCount} • Overseas: ${projectedXI.overseasCount}/4",
                    style = HammerNumericStyles.statCaption,
                    color = colors.antiqueGold
                )
                Spacer(modifier = Modifier.height(8.dp))
                if (projectedXI.players.isEmpty()) {
                    Text(
                        text = "Acquire players to generate a Projected XI.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.muted
                    )
                } else {
                    LazyColumn(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        contentPadding = PaddingValues(bottom = 24.dp),
                        modifier = Modifier.weight(1f)
                    ) {
                        items(projectedXI.players, key = { it.player.id }) { entry ->
                            val isCap = projectedXI.captain?.player?.id == entry.player.id
                            SquadPlayerRow(entry = entry, isCaptain = isCap)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TabPill(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .height(48.dp)
            .clip(RoundedCornerShape(10.dp))
            .background(if (selected) colors.antiqueGold.copy(alpha = 0.22f) else colors.raised)
            .border(
                width = 1.dp,
                color = if (selected) colors.antiqueGold else colors.hairline,
                shape = RoundedCornerShape(10.dp)
            )
            .clickable(onClick = onClick)
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            color = if (selected) colors.goldLight else colors.muted
        )
    }
}

@Composable
private fun SquadPlayerRow(
    entry: SquadEntry,
    isCaptain: Boolean
) {
    val colors = HammerTheme.colors
    val p = entry.player
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
                text = buildString {
                    append(p.name)
                    if (isCaptain) append(" (C)")
                    if (p.overseas) append(" ✈")
                },
                style = MaterialTheme.typography.titleSmall,
                color = colors.ivory,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = "${p.country} • OVR ${p.rating}${if (entry.boughtViaRtm) " • RTM" else ""}",
                style = HammerNumericStyles.statCaption,
                color = colors.muted
            )
        }
        Text(
            text = MoneyFormatter.formatCr(entry.paidCr),
            style = HammerNumericStyles.statValue,
            color = colors.goldLight
        )
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF161B22, widthDp = 390, heightDp = 640)
@Composable
private fun SquadSheetPreview() {
    HammerTheme {
        SquadSheetContent(
            teams = PreviewFixtures.sampleTeamStates,
            selectedTeamCode = TeamCode.CSK,
            config = AuctionConfig(),
            onSelectTeam = {}
        )
    }
}
