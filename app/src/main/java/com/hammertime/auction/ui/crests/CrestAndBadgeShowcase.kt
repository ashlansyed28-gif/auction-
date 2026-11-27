package com.hammertime.auction.ui.crests

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.MoneyFormatter
import com.hammertime.auction.model.PlayerRole
import com.hammertime.auction.model.Team
import com.hammertime.auction.model.TeamCatalog
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.ui.theme.HammerNumericStyles
import com.hammertime.auction.ui.theme.HammerTheme
import com.hammertime.auction.ui.theme.goldSheenBackground
import com.hammertime.auction.ui.theme.primaryColor
import com.hammertime.auction.ui.theme.secondaryColor

@Composable
fun TeamCrestImage(
    teamCode: TeamCode,
    size: Dp = 48.dp,
    modifier: Modifier = Modifier
) {
    val vector = rememberTeamCrest(teamCode)
    Image(
        imageVector = vector,
        contentDescription = "${teamCode.fullName} crest",
        modifier = modifier.size(size)
    )
}

@Composable
fun RoleBadgeChip(
    role: PlayerRole,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(colors.raised)
            .border(1.dp, colors.hairline, RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Image(
            imageVector = RoleBadgeVectors.forRole(role),
            contentDescription = role.label,
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = role.name,
            style = MaterialTheme.typography.labelMedium,
            color = colors.ivory
        )
    }
}

@Composable
fun VintageLaurelChip(
    era: String?,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(colors.raised)
            .border(1.dp, colors.antiqueGold.copy(alpha = 0.7f), RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Image(
            imageVector = RoleBadgeVectors.vintageLaurel,
            contentDescription = "Vintage Legend",
            modifier = Modifier.size(18.dp)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = era ?: "VINTAGE",
            style = MaterialTheme.typography.labelMedium,
            color = colors.goldLight
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun BrandAndCrestGallery(
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val spacing = HammerTheme.spacing
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.obsidian)
            .verticalScroll(rememberScrollState())
            .padding(spacing.lg),
        verticalArrangement = Arrangement.spacedBy(spacing.lg)
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .goldSheenBackground(
                    cornerRadius = 16.dp,
                    reduceMotion = HammerTheme.reduceMotion
                )
                .padding(spacing.lg)
        ) {
            Column {
                Text(
                    text = "HAMMER TIME",
                    style = MaterialTheme.typography.displayMedium,
                    color = colors.obsidian
                )
                Spacer(modifier = Modifier.height(spacing.xs))
                Text(
                    text = "CLASSIC T20 AUCTION BROADCAST • ${MoneyFormatter.formatCr(100.0)}",
                    style = HammerNumericStyles.purseTicker,
                    color = colors.obsidian
                )
            }
        }

        Text(
            text = "FRANCHISE CRESTS (24dp & 64dp)",
            style = MaterialTheme.typography.labelLarge,
            color = colors.antiqueGold
        )

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(spacing.md),
            verticalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            TeamCatalog.allTeams.forEach { team ->
                TeamCrestTile(team = team)
            }
        }

        Text(
            text = "ROLE BADGES & VINTAGE LAUREL",
            style = MaterialTheme.typography.labelLarge,
            color = colors.antiqueGold
        )

        FlowRow(
            horizontalArrangement = Arrangement.spacedBy(spacing.sm),
            verticalArrangement = Arrangement.spacedBy(spacing.sm)
        ) {
            PlayerRole.entries.forEach { role ->
                RoleBadgeChip(role = role)
            }
            VintageLaurelChip(era = "2008–2016")
        }
    }
}

@Composable
private fun TeamCrestTile(team: Team) {
    val colors = HammerTheme.colors
    Surface(
        shape = MaterialTheme.shapes.medium,
        color = colors.charcoal,
        modifier = Modifier
            .width(156.dp)
            .border(1.dp, team.primaryColor.copy(alpha = 0.55f), MaterialTheme.shapes.medium)
    ) {
        Column(
            modifier = Modifier.padding(12.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                TeamCrestImage(teamCode = team.code, size = 56.dp)
                TeamCrestImage(teamCode = team.code, size = 24.dp)
            }
            Text(
                text = team.code.name,
                style = MaterialTheme.typography.titleMedium,
                color = team.primaryColor
            )
            Text(
                text = team.name,
                style = MaterialTheme.typography.bodySmall,
                color = colors.ivory
            )
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(
                    modifier = Modifier
                        .size(14.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(team.primaryColor)
                )
                Box(
                    modifier = Modifier
                        .size(14.dp)
                        .clip(RoundedCornerShape(4.dp))
                        .background(team.secondaryColor)
                        .border(0.5.dp, colors.hairline, RoundedCornerShape(4.dp))
                )
            }
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0E1116, widthDp = 390, heightDp = 844)
@Composable
private fun BrandAndCrestGalleryPreview() {
    HammerTheme {
        BrandAndCrestGallery()
    }
}
