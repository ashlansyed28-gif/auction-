package com.hammertime.auction.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

/**
 * Display serif & clean UI sans font families.
 * Bundled OFL TTFs (e.g. Playfair Display & Inter) can be dropped into res/font/
 * and swapped in here without changing call sites.
 */
val DisplaySerifFontFamily: FontFamily = FontFamily.Serif
val BodySansFontFamily: FontFamily = FontFamily.SansSerif

private const val TABULAR_NUMBERS = "tnum"

fun TextStyle.withTabularNumbers(): TextStyle =
    copy(fontFeatureSettings = TABULAR_NUMBERS)

object HammerNumericStyles {
    val megaBid = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp,
        lineHeight = 38.sp,
        letterSpacing = (-0.5).sp,
        fontFeatureSettings = TABULAR_NUMBERS
    )

    val timerFigure = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.ExtraBold,
        fontSize = 22.sp,
        lineHeight = 24.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    )

    val purseTicker = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
        lineHeight = 16.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    )

    val statValue = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 15.sp,
        lineHeight = 20.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    )

    val statCaption = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.4.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    )
}

val HammerTypography = Typography(
    displayLarge = TextStyle(
        fontFamily = DisplaySerifFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 34.sp,
        lineHeight = 40.sp,
        letterSpacing = (-0.25).sp
    ),
    displayMedium = TextStyle(
        fontFamily = DisplaySerifFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 28.sp,
        lineHeight = 34.sp
    ),
    headlineLarge = TextStyle(
        fontFamily = DisplaySerifFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 24.sp,
        lineHeight = 30.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = DisplaySerifFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 26.sp
    ),
    titleLarge = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 18.sp,
        lineHeight = 24.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    ),
    titleMedium = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 16.sp,
        lineHeight = 22.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    ),
    titleSmall = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 14.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.2.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    ),
    bodyLarge = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp,
        lineHeight = 22.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp,
        lineHeight = 20.sp
    ),
    bodySmall = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.Normal,
        fontSize = 12.sp,
        lineHeight = 16.sp
    ),
    labelLarge = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 14.sp,
        lineHeight = 18.sp,
        letterSpacing = 0.5.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    ),
    labelMedium = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 12.sp,
        lineHeight = 16.sp,
        letterSpacing = 0.4.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    ),
    labelSmall = TextStyle(
        fontFamily = BodySansFontFamily,
        fontWeight = FontWeight.Medium,
        fontSize = 11.sp,
        lineHeight = 14.sp,
        letterSpacing = 0.6.sp,
        fontFeatureSettings = TABULAR_NUMBERS
    )
)
