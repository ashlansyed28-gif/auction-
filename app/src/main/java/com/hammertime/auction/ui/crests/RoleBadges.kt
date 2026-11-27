package com.hammertime.auction.ui.crests

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.PlayerRole
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

object RoleBadgeVectors {

    private val batVector: ImageVector by lazy { buildBatVector() }
    private val bowlVector: ImageVector by lazy { buildBowlVector() }
    private val allRounderVector: ImageVector by lazy { buildAllRounderVector() }
    private val keeperVector: ImageVector by lazy { buildKeeperVector() }
    val vintageLaurel: ImageVector by lazy { buildVintageLaurelVector() }

    fun forRole(role: PlayerRole): ImageVector = when (role) {
        PlayerRole.BAT -> batVector
        PlayerRole.BOWL -> bowlVector
        PlayerRole.AR -> allRounderVector
        PlayerRole.WK -> keeperVector
    }

    private fun buildBatVector(): ImageVector {
        val fill = SolidColor(Color(0xFFF5F0E6))
        val accent = SolidColor(Color(0xFFD4AF37))
        return ImageVector.Builder(
            name = "RoleBAT",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            // Diagonal cricket bat blade
            path(
                fill = fill,
                stroke = accent,
                strokeLineWidth = 0.9f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(15.2f, 4.4f)
                lineTo(19.6f, 8.8f)
                lineTo(10.8f, 17.6f)
                lineTo(6.4f, 13.2f)
                close()
            }
            // Handle
            path(
                stroke = accent,
                strokeLineWidth = 2.2f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(8.6f, 15.4f)
                lineTo(4.5f, 19.5f)
            }
        }.build()
    }

    private fun buildBowlVector(): ImageVector {
        val crimson = SolidColor(Color(0xFFC0392B))
        val seam = SolidColor(Color(0xFFF5F0E6))
        val gold = SolidColor(Color(0xFFD4AF37))
        return ImageVector.Builder(
            name = "RoleBOWL",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            path(
                fill = crimson,
                stroke = gold,
                strokeLineWidth = 1f
            ) {
                moveTo(13.5f, 4.5f)
                arcTo(7.5f, 7.5f, 0f, true, true, 13.49f, 4.5f)
                close()
            }
            // Stitched seam
            path(
                stroke = seam,
                strokeLineWidth = 1.4f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(9.2f, 7.2f)
                curveTo(12.2f, 10.2f, 14.8f, 12.8f, 17.8f, 16.8f)
            }
            // Speed arcs
            path(
                stroke = gold,
                strokeLineWidth = 1.3f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(2.5f, 9f)
                horizontalLineTo(5.2f)
                moveTo(2f, 12.5f)
                horizontalLineTo(4.6f)
                moveTo(3f, 16f)
                horizontalLineTo(5.6f)
            }
        }.build()
    }

    private fun buildAllRounderVector(): ImageVector {
        val gold = SolidColor(Color(0xFFD4AF37))
        val ivory = SolidColor(Color(0xFFF5F0E6))
        val crimson = SolidColor(Color(0xFFC0392B))
        return ImageVector.Builder(
            name = "RoleAR",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            // Bat diagonal
            path(fill = ivory) {
                moveTo(14.5f, 3.8f)
                lineTo(18.2f, 7.5f)
                lineTo(10.5f, 15.2f)
                lineTo(6.8f, 11.5f)
                close()
            }
            path(
                stroke = gold,
                strokeLineWidth = 2f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(8.6f, 13.4f)
                lineTo(4.6f, 17.4f)
            }
            // Cricket ball overlapping lower right
            path(
                fill = crimson,
                stroke = gold,
                strokeLineWidth = 1.1f
            ) {
                moveTo(16.5f, 12.5f)
                arcTo(4.2f, 4.2f, 0f, true, true, 16.49f, 12.5f)
                close()
            }
        }.build()
    }

    private fun buildKeeperVector(): ImageVector {
        val ivory = SolidColor(Color(0xFFF5F0E6))
        val gold = SolidColor(Color(0xFFD4AF37))
        return ImageVector.Builder(
            name = "RoleWK",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            // Three stumps behind
            path(
                stroke = gold,
                strokeLineWidth = 1.4f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(8f, 4.5f)
                verticalLineTo(12f)
                moveTo(12f, 4.5f)
                verticalLineTo(12f)
                moveTo(16f, 4.5f)
                verticalLineTo(12f)
                moveTo(7.5f, 4.5f)
                horizontalLineTo(16.5f)
            }
            // Left & right keeper gloves
            path(
                fill = ivory,
                stroke = gold,
                strokeLineWidth = 1f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                // Left glove
                moveTo(4.5f, 14f)
                curveTo(4.5f, 11.5f, 7f, 10.5f, 9f, 11.5f)
                lineTo(11f, 14.5f)
                verticalLineTo(19.5f)
                horizontalLineTo(5.5f)
                close()
                // Right glove
                moveTo(19.5f, 14f)
                curveTo(19.5f, 11.5f, 17f, 10.5f, 15f, 11.5f)
                lineTo(13f, 14.5f)
                verticalLineTo(19.5f)
                horizontalLineTo(18.5f)
                close()
            }
        }.build()
    }

    private fun buildVintageLaurelVector(): ImageVector {
        val gold = SolidColor(Color(0xFFD4AF37))
        val lightGold = SolidColor(Color(0xFFF1D77A))
        return ImageVector.Builder(
            name = "VintageLaurel",
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f
        ).apply {
            // Left curved laurel stem & leaves
            path(
                stroke = gold,
                strokeLineWidth = 1.5f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(11f, 20f)
                curveTo(6.2f, 18.2f, 4.2f, 13.5f, 5.8f, 7.2f)
            }
            // Right curved laurel stem & leaves
            path(
                stroke = gold,
                strokeLineWidth = 1.5f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(13f, 20f)
                curveTo(17.8f, 18.2f, 19.8f, 13.5f, 18.2f, 7.2f)
            }
            // Laurel leaf buds
            path(fill = gold) {
                val leaves = listOf(
                    4.8f to 10.5f, 4.4f to 14f, 6.2f to 17.2f,
                    19.2f to 10.5f, 19.6f to 14f, 17.8f to 17.2f
                )
                for ((lx, ly) in leaves) {
                    moveTo(lx, ly - 1.3f)
                    lineTo(lx + 1.4f, ly)
                    lineTo(lx, ly + 1.3f)
                    lineTo(lx - 1.4f, ly)
                    close()
                }
            }
            // Center vintage star
            path(fill = lightGold) {
                val cx = 12f
                val cy = 11f
                val outerR = 4.2f
                val innerR = 1.8f
                for (i in 0 until 10) {
                    val r = if (i % 2 == 0) outerR else innerR
                    val angle = i * (PI / 5.0) - PI / 2.0
                    val x = cx + r * cos(angle).toFloat()
                    val y = cy + r * sin(angle).toFloat()
                    if (i == 0) moveTo(x, y) else lineTo(x, y)
                }
                close()
            }
        }.build()
    }
}
