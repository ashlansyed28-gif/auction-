package com.hammertime.auction.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hammertime.auction.model.MoneyFormatter
import com.hammertime.auction.ui.theme.HammerNumericStyles
import com.hammertime.auction.ui.theme.HammerTheme
import java.util.Locale

@Composable
fun CountdownBidRing(
    remainingMs: Long,
    totalWindowMs: Long,
    bidAmountCr: Double,
    bidCountTrigger: Int,
    isBiddingActive: Boolean,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val reduceMotion = HammerTheme.reduceMotion

    val progress = if (totalWindowMs > 0L) {
        (remainingMs.toFloat() / totalWindowMs.toFloat()).coerceIn(0f, 1f)
    } else {
        0f
    }
    val isFinalCall = isBiddingActive && remainingMs in 1L..3000L
    val flashAnim = remember { Animatable(0f) }

    LaunchedEffect(bidCountTrigger) {
        if (bidCountTrigger > 0 && !reduceMotion) {
            flashAnim.snapTo(1f)
            flashAnim.animateTo(0f, tween(durationMillis = 360, easing = FastOutSlowInEasing))
        }
    }

    val pulseAlpha = if (isFinalCall && !reduceMotion) {
        val inf = rememberInfiniteTransition(label = "ring_pulse")
        inf.animateFloat(
            initialValue = 0.55f,
            targetValue = 1.0f,
            animationSpec = infiniteRepeatable(
                animation = tween(380),
                repeatMode = RepeatMode.Reverse
            ),
            label = "ring_pulse_alpha"
        )
    } else {
        remember { mutableFloatStateOf(1f) }
    }

    val ringColor = if (isFinalCall) colors.crimson else colors.antiqueGold
    val secondsLabel = if (isBiddingActive) {
        String.format(Locale.US, "%.1fs", (remainingMs / 1000.0).coerceAtLeast(0.0))
    } else {
        "--"
    }

    val formattedPrice = MoneyFormatter.formatCompactCr(bidAmountCr)

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier
            .size(134.dp)
            .semantics {
                liveRegion = LiveRegionMode.Polite
                contentDescription = "Current bid ₹$formattedPrice, $secondsLabel remaining"
            }
    ) {
        Canvas(modifier = Modifier.matchParentSize()) {
            val strokePx = 7.dp.toPx()
            val inset = strokePx / 2f + 4.dp.toPx()
            val arcSize = Size(size.width - inset * 2f, size.height - inset * 2f)
            val topLeft = Offset(inset, inset)

            // Track ring
            drawArc(
                color = colors.hairline,
                startAngle = -90f,
                sweepAngle = 360f,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )

            // Active countdown arc
            drawArc(
                color = ringColor.copy(alpha = pulseAlpha.value),
                startAngle = -90f,
                sweepAngle = 360f * progress,
                useCenter = false,
                topLeft = topLeft,
                size = arcSize,
                style = Stroke(width = strokePx, cap = StrokeCap.Round)
            )

            // Flash halo on new bid
            val flash = flashAnim.value
            if (flash > 0.01f) {
                drawArc(
                    color = colors.goldLight.copy(alpha = flash * 0.7f),
                    startAngle = -90f,
                    sweepAngle = 360f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokePx * (1f + flash * 0.75f))
                )
            }
        }

        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(
                text = "₹",
                style = HammerNumericStyles.statCaption,
                color = colors.muted
            )
            OdometerPriceText(
                amountCr = bidAmountCr,
                reduceMotion = reduceMotion,
                textColor = colors.ivory
            )
            Text(
                text = secondsLabel,
                style = HammerNumericStyles.statCaption,
                color = if (isFinalCall) colors.crimson else colors.antiqueGold
            )
        }
    }
}

@Composable
fun OdometerPriceText(
    amountCr: Double,
    reduceMotion: Boolean,
    textColor: Color,
    modifier: Modifier = Modifier
) {
    val label = MoneyFormatter.formatCompactCr(amountCr)
    if (reduceMotion) {
        Text(
            text = label,
            style = HammerNumericStyles.timerFigure.copy(fontSize = 19.sp),
            color = textColor,
            modifier = modifier
        )
    } else {
        AnimatedContent(
            targetState = label,
            transitionSpec = {
                (slideInVertically(tween(400, easing = FastOutSlowInEasing)) { height -> height / 2 } +
                    fadeIn(tween(240))) togetherWith
                    (slideOutVertically(tween(260)) { height -> -height / 2 } +
                        fadeOut(tween(180)))
            },
            label = "odometer_bid",
            modifier = modifier
        ) { target ->
            Text(
                text = target,
                style = HammerNumericStyles.timerFigure.copy(fontSize = 19.sp),
                color = textColor
            )
        }
    }
}
