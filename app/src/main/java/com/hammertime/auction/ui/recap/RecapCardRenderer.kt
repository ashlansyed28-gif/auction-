package com.hammertime.auction.ui.recap

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.VectorGroup
import androidx.compose.ui.graphics.vector.VectorPath
import androidx.compose.ui.graphics.vector.toPath
import androidx.core.content.FileProvider
import com.hammertime.auction.model.MoneyFormatter
import com.hammertime.auction.model.RecapSummary
import com.hammertime.auction.ui.crests.TeamCrestVectors
import java.io.File
import java.io.FileOutputStream
import java.util.Locale

object RecapCardRenderer {
    const val CARD_WIDTH = 1080
    const val CARD_HEIGHT = 1920

    private const val OBSIDIAN = 0xFF0E1116.toInt()
    private const val CHARCOAL = 0xFF161B22.toInt()
    private const val RAISED = 0xFF1D242E.toInt()
    private const val HAIRLINE = 0xFF2A323D.toInt()
    private const val IVORY = 0xFFF5F0E6.toInt()
    private const val MUTED = 0xFFA8A294.toInt()
    private const val GOLD = 0xFFD4AF37.toInt()
    private const val GOLD_LIGHT = 0xFFF1D77A.toInt()
    private const val SUCCESS = 0xFF3FB950.toInt()
    private const val CRIMSON = 0xFFC0392B.toInt()

    fun renderBitmap(summary: RecapSummary): Bitmap {
        val bmp = Bitmap.createBitmap(CARD_WIDTH, CARD_HEIGHT, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)

        val teamPrimary = summary.team.primaryColorHex.toInt()
        val teamSecondary = summary.team.secondaryColorHex.toInt()

        // 1. Background obsidian + subtle broadcast accent gradient at top
        val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                0f, 0f, 0f, CARD_HEIGHT.toFloat(),
                intArrayOf(teamSecondary, OBSIDIAN, OBSIDIAN),
                floatArrayOf(0f, 0.28f, 1f),
                Shader.TileMode.CLAMP
            )
        }
        canvas.drawRect(0f, 0f, CARD_WIDTH.toFloat(), CARD_HEIGHT.toFloat(), bgPaint)

        // Outer gold border frame
        val framePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 4f
            color = GOLD
        }
        canvas.drawRoundRect(RectF(28f, 28f, CARD_WIDTH - 28f, CARD_HEIGHT - 28f), 36f, 36f, framePaint)

        // Typography paints
        val serifBold = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
            color = IVORY
        }
        val sansBold = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
            color = IVORY
            fontFeatureSettings = "tnum"
        }
        val sansRegular = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.NORMAL)
            color = MUTED
            fontFeatureSettings = "tnum"
        }

        // 2. Top Header: HAMMER TIME + Crest + Team Name
        sansBold.textSize = 28f
        sansBold.color = GOLD
        canvas.drawText("HAMMER TIME • AUCTION RECAP", 72f, 96f, sansBold)

        val crest = TeamCrestVectors.forTeam(summary.team.code)
        drawImageVector(canvas, crest, left = 72f, top = 128f, sizePx = 156f)

        serifBold.textSize = 54f
        serifBold.color = IVORY
        canvas.drawText(summary.team.name, 256f, 194f, serifBold)

        sansBold.textSize = 32f
        sansBold.color = teamPrimary
        canvas.drawText(
            "${summary.team.code.name} • SPENT ${MoneyFormatter.formatCr(summary.totalSpentCr)} • LEFT ${MoneyFormatter.formatCr(summary.purseLeftCr)}",
            256f,
            246f,
            sansBold
        )

        // 3. Squad Rating Banner (0..100)
        val ratingBox = RectF(64f, 314f, CARD_WIDTH - 64f, 520f)
        drawPanel(canvas, ratingBox, teamPrimary)

        sansBold.textSize = 26f
        sansBold.color = GOLD_LIGHT
        canvas.drawText("SQUAD RATING", 96f, 366f, sansBold)

        sansBold.textSize = 112f
        sansBold.color = GOLD
        canvas.drawText("${summary.squadRating.totalRating}", 96f, 488f, sansBold)

        sansRegular.textSize = 28f
        sansRegular.color = MUTED
        canvas.drawText("/ 100", 256f, 484f, sansRegular)

        val breakdown = summary.squadRating
        sansRegular.textSize = 26f
        sansRegular.color = IVORY
        canvas.drawText(
            String.format(Locale.US, "Best XI Avg (70%%): %.1f", breakdown.bestXIAverage),
            440f,
            382f,
            sansRegular
        )
        canvas.drawText(
            String.format(Locale.US, "Bench Depth (15%%): %.1f", breakdown.depthAverage),
            440f,
            428f,
            sansRegular
        )
        canvas.drawText(
            String.format(Locale.US, "Balance Score (15%%): %.0f", breakdown.balanceScore),
            440f,
            474f,
            sansRegular
        )

        // 4. Key Awards: Biggest Steal, Biggest Overpay, Vintage/GOAT Pick
        val stealText = summary.biggestSteal?.let {
            val delta = MoneyFormatter.formatCompactCr(summary.biggestStealDeltaCr.coerceAtLeast(0.0))
            "${it.player.name} (${MoneyFormatter.formatCr(it.paidCr)}, +₹$delta value)"
        } ?: "No players signed"

        val overpayText = summary.biggestOverpay?.let {
            val delta = MoneyFormatter.formatCompactCr(summary.biggestOverpayDeltaCr.coerceAtLeast(0.0))
            "${it.player.name} (${MoneyFormatter.formatCr(it.paidCr)}, +₹$delta over fair)"
        } ?: "No players signed"

        val vintageText = summary.vintageOrGoatPick?.let {
            "${it.player.name} • OVR ${it.player.rating} (${it.player.vintage.era ?: "LEGEND"})"
        } ?: "No vintage legend acquired"

        drawAwardCard(canvas, 550f, "BIGGEST STEAL", stealText, SUCCESS, sansBold, sansRegular)
        drawAwardCard(canvas, 682f, "BIGGEST OVERPAY", overpayText, CRIMSON, sansBold, sansRegular)
        drawAwardCard(canvas, 814f, "VINTAGE / GOAT PICK", vintageText, GOLD, sansBold, sansRegular)

        // 5. Projected Best XI Section
        val xiBox = RectF(64f, 956f, CARD_WIDTH - 64f, 1796f)
        drawPanel(canvas, xiBox, HAIRLINE)

        val xi = summary.projectedXI
        sansBold.textSize = 30f
        sansBold.color = GOLD_LIGHT
        canvas.drawText("PROJECTED BEST XI", 96f, 1012f, sansBold)

        sansRegular.textSize = 24f
        sansRegular.color = MUTED
        canvas.drawText(
            "WK: ${xi.keeperCount}  •  BOWL OPTIONS: ${xi.bowlingOptionsCount}  •  OVERSEAS: ${xi.overseasCount}/4",
            96f,
            1050f,
            sansRegular
        )

        var rowY = 1114f
        xi.players.forEachIndexed { idx, entry ->
            val p = entry.player
            val isCaptain = xi.captain?.player?.id == p.id
            val rowBg = RectF(92f, rowY - 38f, CARD_WIDTH - 92f, rowY + 18f)
            val rowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (idx % 2 == 0) RAISED else CHARCOAL
            }
            canvas.drawRoundRect(rowBg, 12f, 12f, rowPaint)

            sansBold.textSize = 24f
            sansBold.color = GOLD
            canvas.drawText(String.format(Locale.US, "%02d", idx + 1), 112f, rowY, sansBold)

            sansBold.color = teamPrimary
            canvas.drawText(p.role.name, 166f, rowY, sansBold)

            sansBold.textSize = 26f
            sansBold.color = IVORY
            val capTag = if (isCaptain) " (C)" else ""
            val osTag = if (p.overseas) " ✈" else ""
            canvas.drawText("${p.name}$capTag$osTag", 252f, rowY, sansBold)

            sansBold.textSize = 24f
            sansBold.color = GOLD_LIGHT
            val priceStr = MoneyFormatter.formatCr(entry.paidCr)
            val priceW = sansBold.measureText(priceStr)
            canvas.drawText(priceStr, CARD_WIDTH - 114f - priceW, rowY, sansBold)

            rowY += 62f
        }

        // 6. Footer disclaimer
        sansRegular.textSize = 22f
        sansRegular.color = MUTED
        val footer = "Fan-made game. Fictional teams and players. Not affiliated with any league."
        val fw = sansRegular.measureText(footer)
        canvas.drawText(footer, (CARD_WIDTH - fw) / 2f, 1862f, sansRegular)

        return bmp
    }

    private fun drawPanel(canvas: Canvas, rect: RectF, borderColor: Int) {
        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = CHARCOAL }
        val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            style = Paint.Style.STROKE
            strokeWidth = 2.5f
            color = borderColor
        }
        canvas.drawRoundRect(rect, 24f, 24f, fill)
        canvas.drawRoundRect(rect, 24f, 24f, stroke)
    }

    private fun drawAwardCard(
        canvas: Canvas,
        top: Float,
        label: String,
        value: String,
        accent: Int,
        labelPaint: Paint,
        valuePaint: Paint
    ) {
        val box = RectF(64f, top, CARD_WIDTH - 64f, top + 112f)
        drawPanel(canvas, box, accent)

        labelPaint.textSize = 24f
        labelPaint.color = accent
        canvas.drawText(label, 96f, top + 42f, labelPaint)

        valuePaint.textSize = 28f
        valuePaint.color = IVORY
        canvas.drawText(value, 96f, top + 86f, valuePaint)
    }

    private fun drawImageVector(
        canvas: Canvas,
        vector: ImageVector,
        left: Float,
        top: Float,
        sizePx: Float
    ) {
        canvas.save()
        canvas.translate(left, top)
        canvas.scale(sizePx / vector.viewportWidth, sizePx / vector.viewportHeight)
        drawVectorGroup(canvas, vector.root)
        canvas.restore()
    }

    private fun drawVectorGroup(canvas: Canvas, group: VectorGroup) {
        for (node in group) {
            when (node) {
                is VectorGroup -> drawVectorGroup(canvas, node)
                is VectorPath -> {
                    val composePath = Path().apply {
                        fillType = if (node.pathFillType == PathFillType.EvenOdd) {
                            PathFillType.EvenOdd
                        } else {
                            PathFillType.NonZero
                        }
                    }
                    node.pathData.toPath(composePath)
                    val androidPath = composePath.asAndroidPath()

                    val fillBrush = node.fill as? SolidColor
                    if (fillBrush != null) {
                        val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                            style = Paint.Style.FILL
                            color = fillBrush.value.toArgb()
                        }
                        canvas.drawPath(androidPath, fillPaint)
                    }

                    val strokeBrush = node.stroke as? SolidColor
                    if (strokeBrush != null && node.strokeLineWidth > 0f) {
                        val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                            style = Paint.Style.STROKE
                            color = strokeBrush.value.toArgb()
                            strokeWidth = node.strokeLineWidth
                            strokeCap = when (node.strokeLineCap) {
                                StrokeCap.Round -> Paint.Cap.ROUND
                                StrokeCap.Square -> Paint.Cap.SQUARE
                                else -> Paint.Cap.BUTT
                            }
                            strokeJoin = when (node.strokeLineJoin) {
                                StrokeJoin.Round -> Paint.Join.ROUND
                                StrokeJoin.Bevel -> Paint.Join.BEVEL
                                else -> Paint.Join.MITER
                            }
                        }
                        canvas.drawPath(androidPath, strokePaint)
                    }
                }
            }
        }
    }

    fun shareRecapBitmap(context: Context, summary: RecapSummary) {
        val bmp = renderBitmap(summary)
        val dir = File(context.cacheDir, "recap").apply { mkdirs() }
        val file = File(dir, "hammer_time_${summary.team.code.name.lowercase()}.png")
        FileOutputStream(file).use { out ->
            bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
        }
        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TEXT, "${summary.team.name} Auction Recap — Rating ${summary.squadRating.totalRating}/100")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(intent, "Share Recap Card"))
    }

    fun saveRecapBitmapToGallery(context: Context, summary: RecapSummary): Boolean {
        val bmp = renderBitmap(summary)
        val fileName = "HammerTime_${summary.team.code.name}_${System.currentTimeMillis()}.png"
        val resolver = context.contentResolver

        val values = ContentValues().apply {
            put(MediaStore.Images.Media.DISPLAY_NAME, fileName)
            put(MediaStore.Images.Media.MIME_TYPE, "image/png")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Images.Media.RELATIVE_PATH, "${Environment.DIRECTORY_PICTURES}/HammerTime")
                put(MediaStore.Images.Media.IS_PENDING, 1)
            }
        }

        val uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values) ?: return false
        return try {
            resolver.openOutputStream(uri)?.use { out ->
                bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
            } ?: return false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear()
                values.put(MediaStore.Images.Media.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            }
            true
        } catch (_: Exception) {
            false
        }
    }
}
