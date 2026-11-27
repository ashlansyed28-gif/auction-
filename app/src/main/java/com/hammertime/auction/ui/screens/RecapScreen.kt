package com.hammertime.auction.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.RecapSummary
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.state.AuctionIntent
import com.hammertime.auction.ui.components.PreviewFixtures
import com.hammertime.auction.ui.crests.TeamCrestImage
import com.hammertime.auction.ui.recap.RecapCardRenderer
import com.hammertime.auction.ui.theme.HammerNumericStyles
import com.hammertime.auction.ui.theme.HammerTheme
import com.hammertime.auction.ui.theme.primaryColor

@Composable
fun RecapScreen(
    summaries: List<RecapSummary>,
    selectedTeamCode: TeamCode,
    onIntent: (AuctionIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val spacing = HammerTheme.spacing
    val activeSummary = summaries.firstOrNull { it.team.code == selectedTeamCode } ?: summaries.firstOrNull()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.obsidian)
    ) {
        // Header + Franchise Switcher
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(colors.charcoal)
                .padding(top = spacing.md, bottom = spacing.sm)
        ) {
            Text(
                text = "AUCTION SEASON RECAP",
                style = MaterialTheme.typography.titleLarge,
                color = colors.goldLight,
                modifier = Modifier.padding(horizontal = spacing.lg)
            )
            Spacer(modifier = Modifier.height(8.dp))

            LazyRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                contentPadding = PaddingValues(horizontal = spacing.lg)
            ) {
                items(summaries, key = { it.team.code }) { summary ->
                    val selected = summary.team.code == activeSummary?.team?.code
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .height(48.dp)
                            .clip(RoundedCornerShape(10.dp))
                            .background(
                                if (selected) summary.team.primaryColor.copy(alpha = 0.24f) else colors.raised
                            )
                            .border(
                                width = if (selected) 1.5.dp else 1.dp,
                                color = if (selected) summary.team.primaryColor else colors.hairline,
                                shape = RoundedCornerShape(10.dp)
                            )
                            .clickable { onIntent(AuctionIntent.SelectRecapTeam(summary.team.code)) }
                            .padding(horizontal = 10.dp)
                    ) {
                        TeamCrestImage(teamCode = summary.team.code, size = 24.dp)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "${summary.team.code.name} (${summary.squadRating.totalRating})",
                            style = HammerNumericStyles.purseTicker,
                            color = if (selected) colors.goldLight else colors.ivory
                        )
                    }
                }
            }
        }

        // Scrollable crisp 9:16 Canvas Recap Card Preview
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(spacing.lg)
        ) {
            if (activeSummary != null) {
                val cardBitmap = remember(activeSummary.team.code, activeSummary.squadRating.totalRating) {
                    RecapCardRenderer.renderBitmap(activeSummary).asImageBitmap()
                }
                Image(
                    bitmap = cardBitmap,
                    contentDescription = "${activeSummary.team.name} 9:16 Recap Card",
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier
                        .fillMaxWidth(0.88f)
                        .aspectRatio(9f / 16f)
                        .clip(MaterialTheme.shapes.medium)
                        .border(1.dp, colors.hairline, MaterialTheme.shapes.medium)
                )
            } else {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier.fillMaxSize()
                ) {
                    Text(
                        text = "No recap data available.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = colors.muted
                    )
                }
            }
        }

        // Thumb-first Export, Save & Finish Deck
        if (activeSummary != null) {
            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .background(colors.charcoal)
                    .border(1.dp, colors.hairline)
                    .padding(spacing.lg)
            ) {
                Row(
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedButton(
                        onClick = { onIntent(AuctionIntent.SaveRecapCardToGallery(activeSummary.team.code)) },
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                    ) {
                        Text("Save to Gallery", color = colors.ivory)
                    }
                    Button(
                        onClick = { onIntent(AuctionIntent.ShareRecapCard(activeSummary.team.code)) },
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = colors.antiqueGold,
                            contentColor = colors.obsidian
                        ),
                        modifier = Modifier
                            .weight(1f)
                            .height(52.dp)
                    ) {
                        Icon(Icons.Default.Share, contentDescription = null)
                        Spacer(modifier = Modifier.width(6.dp))
                        Text("Share Card", style = MaterialTheme.typography.titleSmall)
                    }
                }
                OutlinedButton(
                    onClick = { onIntent(AuctionIntent.FinishToHome) },
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp)
                ) {
                    Text("RETURN TO HOME", color = colors.muted)
                }
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0E1116, widthDp = 390, heightDp = 844)
@Composable
private fun RecapScreenPreview() {
    HammerTheme {
        RecapScreen(
            summaries = PreviewFixtures.sampleRecapSummaries,
            selectedTeamCode = TeamCode.CSK,
            onIntent = {}
        )
    }
}
