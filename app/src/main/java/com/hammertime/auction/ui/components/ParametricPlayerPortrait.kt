package com.hammertime.auction.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.tooling.preview.Preview
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.PlayerAvatar
import com.hammertime.auction.ui.theme.HammerTheme
import kotlin.math.PI
import kotlin.math.sin

private val SKIN_TONES = listOf(
    Color(0xFFF3CFB6),
    Color(0xFFE3B18E),
    Color(0xFFC98E66),
    Color(0xFFA96D46),
    Color(0xFF7D4B2B),
    Color(0xFF54301B)
)

private fun countryJerseyColors(country: String): Pair<Color, Color> = when (country) {
    "IND" -> Color(0xFF1A56DB) to Color(0xFFFF7A18)
    "AUS" -> Color(0xFFF4C430) to Color(0xFF14532D)
    "ENG" -> Color(0xFF1D3557) to Color(0xFFE63946)
    "RSA" -> Color(0xFF1B7A43) to Color(0xFFF2C94C)
    "NZL" -> Color(0xFF20242A) to Color(0xFFBDC3C7)
    "WIN" -> Color(0xFF6E1423) to Color(0xFFF2B705)
    "SRL" -> Color(0xFF0B3D91) to Color(0xFFF1C40F)
    "AFG" -> Color(0xFF1E40AF) to Color(0xFFDC2626)
    "BAN" -> Color(0xFF0A6847) to Color(0xFFD92D20)
    "PAK" -> Color(0xFF15803D) to Color(0xFFA3E635)
    "IRE" -> Color(0xFF16A34A) to Color(0xFFF5F0E6)
    "NED" -> Color(0xFFEA580C) to Color(0xFF1E3A8A)
    "ZIM" -> Color(0xFFB91C1C) to Color(0xFFFACC15)
    "NAM" -> Color(0xFF1D4ED8) to Color(0xFFE11D48)
    "SCO" -> Color(0xFF1E293B) to Color(0xFF7E22CE)
    else -> Color(0xFF2B3544) to Color(0xFFD4AF37)
}

private fun parseHairColor(hex: String): Color = runCatching {
    val clean = hex.removePrefix("#")
    val parsed = clean.toLong(16)
    Color(0xFF000000L or parsed)
}.getOrDefault(Color(0xFF1C1A19))

@Composable
fun ParametricPlayerPortrait(
    avatar: PlayerAvatar,
    country: String,
    desaturate: Boolean = false,
    modifier: Modifier = Modifier
) {
    val reduceMotion = HammerTheme.reduceMotion
    val phaseState = if (reduceMotion) {
        remember { mutableFloatStateOf(0f) }
    } else {
        rememberInfiniteTransition(label = "portrait_life").animateFloat(
            initialValue = 0f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 3600, easing = LinearEasing),
                repeatMode = RepeatMode.Restart
            ),
            label = "portrait_phase"
        )
    }

    val skin = SKIN_TONES[avatar.skinTone.coerceIn(0, SKIN_TONES.lastIndex)]
    val skinShadow = Color(
        red = (skin.red * 0.82f),
        green = (skin.green * 0.82f),
        blue = (skin.blue * 0.82f)
    )
    val hair = parseHairColor(avatar.hairColor)
    val (jerseyPrimary, jerseyTrim) = countryJerseyColors(country)
    val finalJersey = if (desaturate) Color(0xFF474E58) else jerseyPrimary
    val finalTrim = if (desaturate) Color(0xFF7B838E) else jerseyTrim
    val finalSkin = if (desaturate) Color(0xFF8C8E91) else skin
    val finalSkinShadow = if (desaturate) Color(0xFF717478) else skinShadow

    val jerseyPath = remember { Path() }
    val hairPath = remember { Path() }
    val beardPath = remember { Path() }

    Canvas(modifier = modifier) {
        val w = size.width
        val h = size.height
        val cx = w * 0.5f

        val phase = phaseState.value
        val bobY = if (reduceMotion) 0f else sin(phase * 2f * PI.toFloat()) * (h * 0.015f)
        // Blink briefly around phase 0.78..0.84
        val isBlinking = !reduceMotion && phase in 0.78f..0.84f

        // Jersey shoulders & collar (fixed base)
        jerseyPath.reset()
        jerseyPath.moveTo(w * 0.14f, h * 0.98f)
        jerseyPath.quadraticTo(w * 0.17f, h * 0.72f, cx - w * 0.11f, h * 0.68f)
        jerseyPath.lineTo(cx + w * 0.11f, h * 0.68f)
        jerseyPath.quadraticTo(w * 0.83f, h * 0.72f, w * 0.86f, h * 0.98f)
        jerseyPath.close()

        drawPath(path = jerseyPath, color = finalJersey)

        // Jersey V-collar & diagonal trim stripes
        drawLine(
            color = finalTrim,
            start = Offset(cx - w * 0.10f, h * 0.69f),
            end = Offset(cx, h * 0.82f),
            strokeWidth = w * 0.045f,
            cap = StrokeCap.Round
        )
        drawLine(
            color = finalTrim,
            start = Offset(cx + w * 0.10f, h * 0.69f),
            end = Offset(cx, h * 0.82f),
            strokeWidth = w * 0.045f,
            cap = StrokeCap.Round
        )
        drawLine(
            color = finalTrim.copy(alpha = 0.75f),
            start = Offset(w * 0.23f, h * 0.82f),
            end = Offset(w * 0.31f, h * 0.98f),
            strokeWidth = w * 0.035f,
            cap = StrokeCap.Round
        )
        drawLine(
            color = finalTrim.copy(alpha = 0.75f),
            start = Offset(w * 0.77f, h * 0.82f),
            end = Offset(w * 0.69f, h * 0.98f),
            strokeWidth = w * 0.035f,
            cap = StrokeCap.Round
        )

        translate(top = bobY) {
            // Neck
            drawRoundRect(
                color = finalSkinShadow,
                topLeft = Offset(cx - w * 0.075f, h * 0.56f),
                size = Size(w * 0.15f, h * 0.16f),
                cornerRadius = CornerRadius(w * 0.05f, w * 0.05f)
            )

            // Ears
            drawCircle(
                color = finalSkinShadow,
                radius = w * 0.052f,
                center = Offset(cx - w * 0.21f, h * 0.43f)
            )
            drawCircle(
                color = finalSkinShadow,
                radius = w * 0.052f,
                center = Offset(cx + w * 0.21f, h * 0.43f)
            )

            // Head oval
            val headW = w * 0.40f
            val headH = h * 0.44f
            val headLeft = cx - headW / 2f
            val headTop = h * 0.18f
            drawRoundRect(
                color = finalSkin,
                topLeft = Offset(headLeft, headTop),
                size = Size(headW, headH),
                cornerRadius = CornerRadius(headW * 0.46f, headW * 0.46f)
            )

            // Hair style (0..7)
            hairPath.reset()
            when (avatar.hairStyle % 8) {
                0 -> { // Short buzz fade
                    hairPath.moveTo(headLeft + headW * 0.05f, headTop + headH * 0.28f)
                    hairPath.quadraticTo(cx, headTop - headH * 0.06f, headLeft + headW * 0.95f, headTop + headH * 0.28f)
                    hairPath.quadraticTo(cx, headTop + headH * 0.16f, headLeft + headW * 0.05f, headTop + headH * 0.28f)
                    hairPath.close()
                    drawPath(hairPath, color = hair)
                }
                1 -> { // Classic side part
                    hairPath.moveTo(headLeft, headTop + headH * 0.34f)
                    hairPath.quadraticTo(cx - headW * 0.15f, headTop - headH * 0.16f, headLeft + headW * 0.98f, headTop + headH * 0.24f)
                    hairPath.quadraticTo(cx + headW * 0.2f, headTop + headH * 0.14f, headLeft, headTop + headH * 0.34f)
                    hairPath.close()
                    drawPath(hairPath, color = hair)
                }
                2 -> { // Quiff / swept up
                    hairPath.moveTo(headLeft + headW * 0.04f, headTop + headH * 0.30f)
                    hairPath.cubicTo(
                        cx - headW * 0.15f, headTop - headH * 0.25f,
                        cx + headW * 0.30f, headTop - headH * 0.22f,
                        headLeft + headW * 0.96f, headTop + headH * 0.28f
                    )
                    hairPath.quadraticTo(cx, headTop + headH * 0.14f, headLeft + headW * 0.04f, headTop + headH * 0.30f)
                    hairPath.close()
                    drawPath(hairPath, color = hair)
                }
                3 -> { // Textured curls
                    for (i in 0..4) {
                        val rx = headLeft + headW * (0.14f + i * 0.18f)
                        val ry = headTop + headH * (0.12f - (if (i in 1..3) 0.07f else 0f))
                        drawCircle(color = hair, radius = headW * 0.14f, center = Offset(rx, ry))
                    }
                }
                4 -> { // Swept fringe
                    hairPath.moveTo(headLeft - headW * 0.02f, headTop + headH * 0.36f)
                    hairPath.quadraticTo(cx, headTop - headH * 0.18f, headLeft + headW * 1.02f, headTop + headH * 0.32f)
                    hairPath.lineTo(cx + headW * 0.05f, headTop + headH * 0.22f)
                    hairPath.close()
                    drawPath(hairPath, color = hair)
                }
                5 -> { // Vintage parted / slightly longer back
                    hairPath.moveTo(headLeft - headW * 0.04f, headTop + headH * 0.45f)
                    hairPath.quadraticTo(cx, headTop - headH * 0.16f, headLeft + headW * 1.04f, headTop + headH * 0.45f)
                    hairPath.quadraticTo(cx, headTop + headH * 0.15f, headLeft - headW * 0.04f, headTop + headH * 0.45f)
                    hairPath.close()
                    drawPath(hairPath, color = hair)
                }
                6 -> { // Turban / Patka wrap
                    drawRoundRect(
                        color = finalTrim,
                        topLeft = Offset(headLeft - headW * 0.04f, headTop - headH * 0.10f),
                        size = Size(headW * 1.08f, headH * 0.36f),
                        cornerRadius = CornerRadius(headW * 0.25f, headW * 0.25f)
                    )
                    drawLine(
                        color = finalJersey,
                        start = Offset(headLeft, headTop + headH * 0.12f),
                        end = Offset(headLeft + headW, headTop + headH * 0.04f),
                        strokeWidth = w * 0.025f
                    )
                }
                else -> { // Crowned locs / headband
                    drawRoundRect(
                        color = hair,
                        topLeft = Offset(headLeft - headW * 0.05f, headTop - headH * 0.12f),
                        size = Size(headW * 1.10f, headH * 0.42f),
                        cornerRadius = CornerRadius(headW * 0.22f, headW * 0.22f)
                    )
                    drawRect(
                        color = finalTrim,
                        topLeft = Offset(headLeft, headTop + headH * 0.16f),
                        size = Size(headW, headH * 0.06f)
                    )
                }
            }

            // Eyebrows
            val eyeY = headTop + headH * 0.45f
            val eyeOffset = headW * 0.20f
            drawLine(
                color = hair,
                start = Offset(cx - eyeOffset - headW * 0.08f, eyeY - headH * 0.10f),
                end = Offset(cx - eyeOffset + headW * 0.08f, eyeY - headH * 0.11f),
                strokeWidth = w * 0.022f,
                cap = StrokeCap.Round
            )
            drawLine(
                color = hair,
                start = Offset(cx + eyeOffset - headW * 0.08f, eyeY - headH * 0.11f),
                end = Offset(cx + eyeOffset + headW * 0.08f, eyeY - headH * 0.10f),
                strokeWidth = w * 0.022f,
                cap = StrokeCap.Round
            )

            // Eyes (blink!)
            if (isBlinking) {
                drawLine(
                    color = Color(0xFF1A1817),
                    start = Offset(cx - eyeOffset - w * 0.028f, eyeY),
                    end = Offset(cx - eyeOffset + w * 0.028f, eyeY),
                    strokeWidth = w * 0.02f,
                    cap = StrokeCap.Round
                )
                drawLine(
                    color = Color(0xFF1A1817),
                    start = Offset(cx + eyeOffset - w * 0.028f, eyeY),
                    end = Offset(cx + eyeOffset + w * 0.028f, eyeY),
                    strokeWidth = w * 0.02f,
                    cap = StrokeCap.Round
                )
            } else {
                drawCircle(color = Color(0xFFF5F0E6), radius = w * 0.027f, center = Offset(cx - eyeOffset, eyeY))
                drawCircle(color = Color(0xFFF5F0E6), radius = w * 0.027f, center = Offset(cx + eyeOffset, eyeY))
                drawCircle(color = Color(0xFF161514), radius = w * 0.015f, center = Offset(cx - eyeOffset, eyeY))
                drawCircle(color = Color(0xFF161514), radius = w * 0.015f, center = Offset(cx + eyeOffset, eyeY))
            }

            // Nose bridge
            drawLine(
                color = finalSkinShadow,
                start = Offset(cx, eyeY + headH * 0.02f),
                end = Offset(cx - w * 0.01f, headTop + headH * 0.62f),
                strokeWidth = w * 0.018f,
                cap = StrokeCap.Round
            )

            // Beard (0..3)
            beardPath.reset()
            when (avatar.beard % 4) {
                1 -> { // Designer stubble
                    beardPath.moveTo(headLeft + headW * 0.06f, headTop + headH * 0.68f)
                    beardPath.quadraticTo(cx, headTop + headH * 1.06f, headLeft + headW * 0.94f, headTop + headH * 0.68f)
                    beardPath.quadraticTo(cx, headTop + headH * 0.88f, headLeft + headW * 0.06f, headTop + headH * 0.68f)
                    beardPath.close()
                    drawPath(beardPath, color = hair.copy(alpha = 0.35f))
                }
                2 -> { // Sharp trimmed beard
                    beardPath.moveTo(headLeft + headW * 0.04f, headTop + headH * 0.62f)
                    beardPath.quadraticTo(cx, headTop + headH * 1.08f, headLeft + headW * 0.96f, headTop + headH * 0.62f)
                    beardPath.quadraticTo(cx, headTop + headH * 0.82f, headLeft + headW * 0.04f, headTop + headH * 0.62f)
                    beardPath.close()
                    drawPath(beardPath, color = hair)
                }
                3 -> { // Full dense beard
                    beardPath.moveTo(headLeft + headW * 0.02f, headTop + headH * 0.56f)
                    beardPath.cubicTo(
                        headLeft + headW * 0.05f, headTop + headH * 1.12f,
                        headLeft + headW * 0.95f, headTop + headH * 1.12f,
                        headLeft + headW * 0.98f, headTop + headH * 0.56f
                    )
                    beardPath.quadraticTo(cx, headTop + headH * 0.78f, headLeft + headW * 0.02f, headTop + headH * 0.56f)
                    beardPath.close()
                    drawPath(beardPath, color = hair)
                }
                else -> Unit
            }

            // Confident smile
            drawArc(
                color = if (avatar.beard >= 2) Color(0xFFF5F0E6).copy(alpha = 0.8f) else Color(0xFF4A2C22),
                startAngle = 15f,
                sweepAngle = 150f,
                useCenter = false,
                topLeft = Offset(cx - w * 0.06f, headTop + headH * 0.67f),
                size = Size(w * 0.12f, headH * 0.09f),
                style = Stroke(width = w * 0.018f, cap = StrokeCap.Round)
            )
        }
    }
}

@Preview(showBackground = true, backgroundColor = 0xFF161B22)
@Composable
private fun ParametricPortraitPreview() {
    HammerTheme {
        ParametricPlayerPortrait(
            avatar = PreviewFixtures.sampleMarqueePlayer.avatar,
            country = "IND",
            modifier = Modifier.size(120.dp)
        )
    }
}
