package com.hammertime.auction.ui.components

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.MoneyFormatter
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.ui.crests.TeamCrestImage
import com.hammertime.auction.ui.theme.HammerNumericStyles
import com.hammertime.auction.ui.theme.HammerTheme
import com.hammertime.auction.ui.theme.primaryColor
import com.hammertime.auction.ui.theme.secondaryColor
import kotlinx.coroutines.delay
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random

private class PooledParticle {
    var active: Boolean = false
    var x: Float = 0f
    var y: Float = 0f
    var vx: Float = 0f
    var vy: Float = 0f
    var size: Float = 6f
    var rotation: Float = 0f
    var vRot: Float = 0f
    var colorIndex: Int = 0
    var life: Float = 0f
    var maxLife: Float = 1f
}

private const val MAX_POOLED_PARTICLES = 160

@Composable
fun PooledSoldParticlesOverlay(
    burstTriggerId: Int,
    teamCode: TeamCode?,
    modifier: Modifier = Modifier
) {
    val reduceMotion = HammerTheme.reduceMotion
    val colors = HammerTheme.colors
    if (reduceMotion || burstTriggerId <= 0 || teamCode == null) return

    val pool = remember { Array(MAX_POOLED_PARTICLES) { PooledParticle() } }
    val frameTick = remember { mutableFloatStateOf(0f) }

    val color0 = teamCode.primaryColor
    val color1 = teamCode.secondaryColor
    val color2 = colors.antiqueGold

    LaunchedEffect(burstTriggerId) {
        val rng = Random(burstTriggerId * 9973)
        for (i in 0 until MAX_POOLED_PARTICLES) {
            val p = pool[i]
            p.active = true
            p.x = 0.5f + (rng.nextFloat() - 0.5f) * 0.12f
            p.y = 0.42f + (rng.nextFloat() - 0.5f) * 0.08f
            val angle = rng.nextFloat() * 2f * PI.toFloat()
            val speed = 0.25f + rng.nextFloat() * 0.75f
            p.vx = cos(angle) * speed
            p.vy = sin(angle) * speed - 0.45f
            p.size = 5f + rng.nextFloat() * 7f
            p.rotation = rng.nextFloat() * 360f
            p.vRot = (rng.nextFloat() - 0.5f) * 320f
            p.colorIndex = i % 3
            p.life = 0f
            p.maxLife = 0.9f + rng.nextFloat() * 0.7f
        }

        var lastNanos = 0L
        while (true) {
            var anyAlive = false
            withFrameNanos { nowNanos ->
                if (lastNanos == 0L) lastNanos = nowNanos
                val dt = ((nowNanos - lastNanos) / 1_000_000_000f).coerceIn(0f, 0.05f)
                lastNanos = nowNanos

                for (i in 0 until MAX_POOLED_PARTICLES) {
                    val p = pool[i]
                    if (!p.active) continue
                    p.life += dt
                    if (p.life >= p.maxLife) {
                        p.active = false
                        continue
                    }
                    anyAlive = true
                    p.vy += 1.05f * dt
                    p.x += p.vx * dt
                    p.y += p.vy * dt
                    p.rotation += p.vRot * dt
                }
                frameTick.floatValue = nowNanos.toFloat()
            }
            if (!anyAlive) break
        }
    }

    Canvas(modifier = modifier.fillMaxSize()) {
        // Read frameTick inside draw lambda to re-draw without recomposition
        @Suppress("UNUSED_VARIABLE")
        val tick = frameTick.floatValue
        val w = size.width
        val h = size.height

        for (i in 0 until MAX_POOLED_PARTICLES) {
            val p = pool[i]
            if (!p.active) continue
            val alpha = (1f - (p.life / p.maxLife)).coerceIn(0f, 1f)
            val c = when (p.colorIndex) {
                0 -> color0
                1 -> color1
                else -> color2
            }.copy(alpha = alpha)
            val px = p.x * w
            val py = p.y * h
            rotate(degrees = p.rotation, pivot = Offset(px, py)) {
                drawRect(
                    color = c,
                    topLeft = Offset(px - p.size * 0.5f, py - p.size * 0.3f),
                    size = Size(p.size, p.size * 0.6f)
                )
            }
        }
    }
}

@Composable
fun EscalationVignette(
    active: Boolean,
    modifier: Modifier = Modifier
) {
    val reduceMotion = HammerTheme.reduceMotion
    val colors = HammerTheme.colors
    if (!active || reduceMotion) return

    val pulse = rememberInfiniteTransition(label = "duel_vignette").animateFloat(
        initialValue = 0.25f,
        targetValue = 0.55f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 680, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "vignette_alpha"
    )

    Canvas(modifier = modifier.fillMaxSize()) {
        val alpha = pulse.value
        val brush = Brush.radialGradient(
            colors = listOf(
                Color.Transparent,
                colors.crimson.copy(alpha = alpha * 0.45f),
                colors.obsidian.copy(alpha = alpha * 0.85f)
            ),
            center = center,
            radius = size.maxDimension * 0.68f
        )
        drawRect(brush = brush)
    }
}

@Composable
fun PaddleRaiseBadge(
    bidderCode: TeamCode?,
    bidTriggerId: Int,
    modifier: Modifier = Modifier
) {
    val reduceMotion = HammerTheme.reduceMotion
    val colors = HammerTheme.colors
    if (bidderCode == null) return

    val popScale = remember { Animatable(1f) }
    LaunchedEffect(bidTriggerId) {
        if (!reduceMotion && bidTriggerId > 0) {
            popScale.snapTo(0.82f)
            popScale.animateTo(
                targetValue = 1f,
                animationSpec = spring(
                    dampingRatio = Spring.DampingRatioMediumBouncy,
                    stiffness = Spring.StiffnessMedium
                )
            )
        }
    }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .graphicsLayer {
                val s = popScale.value
                scaleX = s
                scaleY = s
                translationY = (1f - s) * 18f
            }
            .clip(RoundedCornerShape(10.dp))
            .background(bidderCode.secondaryColor.copy(alpha = 0.92f))
            .border(1.5.dp, bidderCode.primaryColor, RoundedCornerShape(10.dp))
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        TeamCrestImage(teamCode = bidderCode, size = 22.dp)
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = "${bidderCode.name} LEADS",
            style = MaterialTheme.typography.labelMedium,
            color = colors.ivory
        )
    }
}

@Composable
fun HammerStampOverlay(
    isSold: Boolean,
    buyerCode: TeamCode?,
    soldPriceCr: Double?,
    triggerId: Int,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val reduceMotion = HammerTheme.reduceMotion

    val stampScale = remember { Animatable(if (reduceMotion) 1f else 1.65f) }
    val stampAlpha = remember { Animatable(0f) }
    val gavelAngle = remember { Animatable(-35f) }

    LaunchedEffect(triggerId) {
        if (reduceMotion) {
            stampScale.snapTo(1f)
            stampAlpha.snapTo(1f)
            gavelAngle.snapTo(0f)
        } else {
            stampScale.snapTo(1.65f)
            stampAlpha.snapTo(0f)
            gavelAngle.snapTo(-38f)
            // 120ms hit-stop freeze on gavel impact
            gavelAngle.animateTo(8f, tween(90))
            delay(120L)
            gavelAngle.animateTo(0f, tween(110))
            stampAlpha.animateTo(1f, tween(100))
            stampScale.animateTo(
                targetValue = 1.0f,
                animationSpec = spring(
                    dampingRatio = 0.55f,
                    stiffness = Spring.StiffnessMediumLow
                )
            )
        }
    }

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier.fillMaxSize()
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier
                .graphicsLayer {
                    scaleX = stampScale.value
                    scaleY = stampScale.value
                    alpha = stampAlpha.value
                    rotationZ = -7f
                }
                .clip(RoundedCornerShape(16.dp))
                .background(colors.obsidian.copy(alpha = 0.92f))
                .border(
                    width = 3.dp,
                    color = if (isSold) (buyerCode?.primaryColor ?: colors.antiqueGold) else colors.muted,
                    shape = RoundedCornerShape(16.dp)
                )
                .padding(horizontal = 24.dp, vertical = 14.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                // Gavel icon drawn in Canvas
                Canvas(
                    modifier = Modifier
                        .size(28.dp)
                        .graphicsLayer { rotationZ = gavelAngle.value }
                ) {
                    val gold = colors.antiqueGold
                    drawRoundRect(
                        color = gold,
                        topLeft = Offset(size.width * 0.15f, size.height * 0.15f),
                        size = Size(size.width * 0.5f, size.height * 0.25f),
                        cornerRadius = CornerRadius(4f, 4f)
                    )
                    drawLine(
                        color = colors.goldLight,
                        start = Offset(size.width * 0.45f, size.height * 0.35f),
                        end = Offset(size.width * 0.85f, size.height * 0.85f),
                        strokeWidth = 4f
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = if (isSold) "SOLD!" else "UNSOLD",
                    style = MaterialTheme.typography.displayMedium,
                    color = if (isSold) colors.goldLight else colors.muted
                )
            }
            if (isSold && buyerCode != null && soldPriceCr != null) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    TeamCrestImage(teamCode = buyerCode, size = 28.dp)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "${buyerCode.name} • ${MoneyFormatter.formatCr(soldPriceCr)}",
                        style = HammerNumericStyles.statValue,
                        color = colors.ivory
                    )
                }
            }
        }
    }
}
