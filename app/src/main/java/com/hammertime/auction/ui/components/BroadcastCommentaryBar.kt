package com.hammertime.auction.ui.components

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.hammertime.auction.state.engine.CommentaryLine
import com.hammertime.auction.ui.theme.HammerTheme

@Composable
fun BroadcastCommentaryBar(
    commentary: CommentaryLine?,
    isDuelActive: Boolean,
    modifier: Modifier = Modifier
) {
    val colors = HammerTheme.colors
    val reduceMotion = HammerTheme.reduceMotion
    val animDuration = if (isDuelActive) 180 else 300

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(colors.charcoal)
            .border(1.dp, colors.hairline, RoundedCornerShape(10.dp))
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(if (isDuelActive) colors.crimson else colors.antiqueGold)
        )
        Spacer(modifier = Modifier.width(10.dp))

        if (commentary == null) {
            Text(
                text = "Broadcast desk standing by...",
                style = MaterialTheme.typography.bodySmall,
                color = colors.muted,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
        } else {
            val annotated = remember(commentary.id) {
                highlightCommentary(
                    text = commentary.text,
                    highlights = commentary.highlights,
                    highlightColor = colors.goldLight
                )
            }
            if (reduceMotion) {
                Text(
                    text = annotated,
                    style = MaterialTheme.typography.bodySmall,
                    color = colors.ivory,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            } else {
                AnimatedContent(
                    targetState = commentary.id to annotated,
                    transitionSpec = {
                        (slideInVertically(tween(animDuration)) { it / 2 } + fadeIn(tween(animDuration))) togetherWith
                            (slideOutVertically(tween(animDuration / 2)) { -it / 2 } + fadeOut(tween(animDuration / 2)))
                    },
                    label = "commentary_caption"
                ) { (_, text) ->
                    Text(
                        text = text,
                        style = MaterialTheme.typography.bodySmall,
                        color = colors.ivory,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }
}

private fun highlightCommentary(
    text: String,
    highlights: List<String>,
    highlightColor: Color
): AnnotatedString = buildAnnotatedString {
    append(text)
    for (token in highlights) {
        if (token.isBlank()) continue
        var startIdx = text.indexOf(token)
        while (startIdx >= 0) {
            addStyle(
                style = SpanStyle(
                    color = highlightColor,
                    fontWeight = FontWeight.Bold
                ),
                start = startIdx,
                end = startIdx + token.length
            )
            startIdx = text.indexOf(token, startIdx + token.length)
        }
    }
}
