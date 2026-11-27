package com.hammertime.auction.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf

val LocalHammerColors = staticCompositionLocalOf { DefaultHammerColors }
val LocalHammerSpacing = staticCompositionLocalOf { DefaultHammerSpacing }
val LocalReduceMotion = staticCompositionLocalOf { false }

private val HammerDarkColorScheme = darkColorScheme(
    primary = DefaultHammerColors.antiqueGold,
    onPrimary = DefaultHammerColors.obsidian,
    primaryContainer = DefaultHammerColors.goldDark,
    onPrimaryContainer = DefaultHammerColors.ivory,
    secondary = DefaultHammerColors.goldLight,
    onSecondary = DefaultHammerColors.obsidian,
    secondaryContainer = DefaultHammerColors.raised,
    onSecondaryContainer = DefaultHammerColors.ivory,
    tertiary = DefaultHammerColors.success,
    onTertiary = DefaultHammerColors.obsidian,
    background = DefaultHammerColors.obsidian,
    onBackground = DefaultHammerColors.ivory,
    surface = DefaultHammerColors.charcoal,
    onSurface = DefaultHammerColors.ivory,
    surfaceVariant = DefaultHammerColors.raised,
    onSurfaceVariant = DefaultHammerColors.muted,
    outline = DefaultHammerColors.hairline,
    outlineVariant = DefaultHammerColors.hairline,
    error = DefaultHammerColors.crimson,
    onError = DefaultHammerColors.ivory
)

object HammerTheme {
    val colors: HammerColors
        @Composable get() = LocalHammerColors.current

    val spacing: HammerSpacing
        @Composable get() = LocalHammerSpacing.current

    val reduceMotion: Boolean
        @Composable get() = LocalReduceMotion.current
}

@Composable
fun HammerTheme(
    reduceMotion: Boolean = false,
    content: @Composable () -> Unit
) {
    CompositionLocalProvider(
        LocalHammerColors provides DefaultHammerColors,
        LocalHammerSpacing provides DefaultHammerSpacing,
        LocalReduceMotion provides reduceMotion
    ) {
        MaterialTheme(
            colorScheme = HammerDarkColorScheme,
            typography = HammerTypography,
            shapes = HammerShapes,
            content = content
        )
    }
}
