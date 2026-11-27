package com.hammertime.auction.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.hammertime.auction.R
import com.hammertime.auction.model.UserSettings
import com.hammertime.auction.state.AuctionIntent
import com.hammertime.auction.ui.theme.HammerTheme
import com.hammertime.auction.ui.theme.goldSheenBackground

@Composable
fun HomeScreen(
    settings: UserSettings,
    hasSavedSnapshot: Boolean,
    isPoolReady: Boolean,
    poolError: String?,
    onIntent: (AuctionIntent) -> Unit,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val spacing = HammerTheme.spacing

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(colors.obsidian)
            .padding(horizontal = spacing.lg, vertical = spacing.xl),
        verticalArrangement = Arrangement.SpaceBetween
    ) {
        // Upper broadcast marquee header
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = spacing.xl)
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(84.dp)
                    .goldSheenBackground(
                        cornerRadius = 20.dp,
                        reduceMotion = settings.reduceMotion
                    )
            ) {
                Canvas(modifier = Modifier.size(48.dp)) {
                    drawRoundRect(
                        color = colors.obsidian,
                        topLeft = Offset(size.width * 0.16f, size.height * 0.18f),
                        size = Size(size.width * 0.68f, size.height * 0.24f),
                        cornerRadius = CornerRadius(6f, 6f)
                    )
                    drawRoundRect(
                        color = colors.obsidian,
                        topLeft = Offset(size.width * 0.44f, size.height * 0.42f),
                        size = Size(size.width * 0.12f, size.height * 0.42f),
                        cornerRadius = CornerRadius(4f, 4f)
                    )
                    drawRoundRect(
                        color = colors.obsidian,
                        topLeft = Offset(size.width * 0.20f, size.height * 0.84f),
                        size = Size(size.width * 0.60f, size.height * 0.12f),
                        cornerRadius = CornerRadius(4f, 4f)
                    )
                }
            }

            Spacer(modifier = Modifier.height(spacing.lg))

            Text(
                text = "HAMMER TIME",
                style = MaterialTheme.typography.displayLarge,
                color = colors.goldLight,
                textAlign = TextAlign.Center,
                modifier = Modifier.semantics { heading() }
            )
            Spacer(modifier = Modifier.height(spacing.xs))
            Text(
                text = "CLASSIC T20 CRICKET AUCTION",
                style = MaterialTheme.typography.labelLarge,
                color = colors.antiqueGold,
                textAlign = TextAlign.Center
            )
            Spacer(modifier = Modifier.height(spacing.md))
            Text(
                text = "10 Franchises • 165 Fictional Prospects • 7 Sets • Live RTM Drama",
                style = MaterialTheme.typography.bodySmall,
                color = colors.muted,
                textAlign = TextAlign.Center
            )

            if (poolError != null) {
                Spacer(modifier = Modifier.height(spacing.md))
                Text(
                    text = poolError,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.crimson,
                    textAlign = TextAlign.Center
                )
            }
        }

        // Thumb-first lower half: primary actions + settings toggles + disclaimer
        Column(
            modifier = Modifier.fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(spacing.md)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(MaterialTheme.shapes.medium)
                    .background(colors.charcoal)
                    .border(1.dp, colors.hairline, MaterialTheme.shapes.medium)
                    .padding(horizontal = spacing.lg, vertical = spacing.sm)
            ) {
                SettingToggleRow(
                    title = "Sound Effects",
                    checked = !settings.isMuted,
                    onCheckedChange = { onIntent(AuctionIntent.ToggleMute) }
                )
                SettingToggleRow(
                    title = "Haptic Feedback",
                    checked = settings.hapticsEnabled,
                    onCheckedChange = { onIntent(AuctionIntent.ToggleHaptics) }
                )
                SettingToggleRow(
                    title = "Reduce Motion",
                    checked = settings.reduceMotion,
                    onCheckedChange = { onIntent(AuctionIntent.ToggleReduceMotion) }
                )
                SettingToggleRow(
                    title = "Auctioneer Voice (TTS)",
                    checked = settings.ttsEnabled,
                    onCheckedChange = { onIntent(AuctionIntent.ToggleTts) }
                )
            }

            if (hasSavedSnapshot) {
                OutlinedButton(
                    onClick = { onIntent(AuctionIntent.ResumeSavedAuction) },
                    enabled = isPoolReady,
                    shape = MaterialTheme.shapes.medium,
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = colors.goldLight),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(56.dp)
                ) {
                    Text(
                        text = "RESUME SAVED AUCTION",
                        style = MaterialTheme.typography.titleMedium
                    )
                }
            }

            Button(
                onClick = { onIntent(AuctionIntent.StartNewAuctionSetup) },
                enabled = isPoolReady,
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
                    text = if (isPoolReady) "NEW AUCTION" else "LOADING PLAYER POOL...",
                    style = MaterialTheme.typography.titleLarge
                )
            }

            Text(
                text = stringResource(R.string.disclaimer_footer),
                style = MaterialTheme.typography.bodySmall,
                color = colors.muted,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = spacing.xs)
            )
        }
    }
}

@Composable
private fun SettingToggleRow(
    title: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
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
            text = title,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.ivory
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = colors.obsidian,
                checkedTrackColor = colors.antiqueGold,
                uncheckedThumbColor = colors.muted,
                uncheckedTrackColor = colors.raised
            )
        )
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF0E1116, widthDp = 390, heightDp = 844)
@Composable
private fun HomeScreenPreview() {
    HammerTheme {
        HomeScreen(
            settings = UserSettings(),
            hasSavedSnapshot = true,
            isPoolReady = true,
            poolError = null,
            onIntent = {}
        )
    }
}
