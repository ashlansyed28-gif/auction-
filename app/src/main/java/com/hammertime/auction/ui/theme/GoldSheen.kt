package com.hammertime.auction.ui.theme

import android.graphics.RuntimeShader
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

private const val GOLD_SHEEN_AGSL = """
    uniform float2 resolution;
    uniform float phase;
    uniform float4 colorDark;
    uniform float4 colorMid;
    uniform float4 colorLight;

    half4 main(float2 fragCoord) {
        float2 safeRes = max(resolution, float2(1.0, 1.0));
        float2 uv = fragCoord / safeRes;
        float diag = uv.x * 0.72 + uv.y * 0.28;
        float sweep = fract(phase) * 1.6 - 0.3;
        float dist = abs(diag - sweep);
        float band = smoothstep(0.24, 0.0, dist);
        float4 base = mix(colorDark, colorMid, clamp(uv.x * 0.65 + 0.18, 0.0, 1.0));
        float4 finalCol = mix(base, colorLight, band * 0.85);
        return half4(finalCol);
    }
"""

@Composable
fun rememberGoldSheenPhase(reduceMotion: Boolean): State<Float> {
    if (reduceMotion) {
        return remember { mutableFloatStateOf(0.5f) }
    }
    val infiniteTransition = rememberInfiniteTransition(label = "gold_sheen_transition")
    return infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 3600, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "gold_sheen_phase"
    )
}

fun Modifier.goldSheenBackground(
    cornerRadius: Dp = 10.dp,
    reduceMotion: Boolean = false,
    darkColor: Color = DefaultHammerColors.goldDark,
    midColor: Color = DefaultHammerColors.antiqueGold,
    lightColor: Color = DefaultHammerColors.goldLight
): Modifier = composed {
    val phaseState = rememberGoldSheenPhase(reduceMotion = reduceMotion)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !reduceMotion) {
        goldSheenAgslModifier(
            cornerRadius = cornerRadius,
            phaseProvider = { phaseState.value },
            darkColor = darkColor,
            midColor = midColor,
            lightColor = lightColor
        )
    } else {
        goldSheenFallbackModifier(
            cornerRadius = cornerRadius,
            reduceMotion = reduceMotion,
            phaseProvider = { phaseState.value },
            darkColor = darkColor,
            midColor = midColor,
            lightColor = lightColor
        )
    }
}

@RequiresApi(Build.VERSION_CODES.TIRAMISU)
private fun Modifier.goldSheenAgslModifier(
    cornerRadius: Dp,
    phaseProvider: () -> Float,
    darkColor: Color,
    midColor: Color,
    lightColor: Color
): Modifier = drawWithCache {
    val shader = RuntimeShader(GOLD_SHEEN_AGSL).apply {
        setFloatUniform("colorDark", darkColor.red, darkColor.green, darkColor.blue, darkColor.alpha)
        setFloatUniform("colorMid", midColor.red, midColor.green, midColor.blue, midColor.alpha)
        setFloatUniform("colorLight", lightColor.red, lightColor.green, lightColor.blue, lightColor.alpha)
    }
    val brush = ShaderBrush(shader)
    val radiusPx = cornerRadius.toPx()

    onDrawBehind {
        shader.setFloatUniform("resolution", size.width, size.height)
        shader.setFloatUniform("phase", phaseProvider())
        drawRoundRect(
            brush = brush,
            cornerRadius = CornerRadius(radiusPx, radiusPx)
        )
    }
}

private fun Modifier.goldSheenFallbackModifier(
    cornerRadius: Dp,
    reduceMotion: Boolean,
    phaseProvider: () -> Float,
    darkColor: Color,
    midColor: Color,
    lightColor: Color
): Modifier = drawWithCache {
    val radiusPx = cornerRadius.toPx()
    val clipRoundRectPath = Path().apply {
        addRoundRect(
            RoundRect(
                rect = Rect(0f, 0f, size.width, size.height),
                cornerRadius = CornerRadius(radiusPx, radiusPx)
            )
        )
    }
    val baseBrush = Brush.linearGradient(
        colors = listOf(darkColor, midColor, darkColor),
        start = Offset.Zero,
        end = Offset(size.width, size.height)
    )
    val bandWidth = (size.width * 0.55f).coerceAtLeast(1f)
    val sheenBrush = Brush.linearGradient(
        colors = listOf(Color.Transparent, lightColor.copy(alpha = 0.72f), Color.Transparent),
        start = Offset.Zero,
        end = Offset(bandWidth, size.height * 0.35f)
    )

    onDrawBehind {
        drawRoundRect(
            brush = baseBrush,
            cornerRadius = CornerRadius(radiusPx, radiusPx)
        )
        if (!reduceMotion) {
            val phase = phaseProvider()
            val travelX = -bandWidth + (size.width + bandWidth * 2f) * phase
            clipPath(clipRoundRectPath) {
                translate(left = travelX) {
                    drawRect(
                        brush = sheenBrush,
                        topLeft = Offset.Zero,
                        size = size.copy(width = bandWidth)
                    )
                }
            }
        }
    }
}
