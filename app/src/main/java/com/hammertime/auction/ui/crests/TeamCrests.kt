package com.hammertime.auction.ui.crests

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp
import com.hammertime.auction.model.TeamCode
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

object TeamCrestVectors {

    private val cache: Map<TeamCode, ImageVector> by lazy {
        TeamCode.entries.associateWith { buildCrest(it) }
    }

    fun forTeam(code: TeamCode): ImageVector = cache.getValue(code)

    private fun buildCrest(code: TeamCode): ImageVector = when (code) {
        TeamCode.CSK -> buildCskCrest()
        TeamCode.MBI -> buildMbiCrest()
        TeamCode.RCB -> buildRcbCrest()
        TeamCode.KRC -> buildKrcCrest()
        TeamCode.DDC -> buildDdcCrest()
        TeamCode.SRH -> buildSrhCrest()
        TeamCode.RRG -> buildRrgCrest()
        TeamCode.PBK -> buildPbkCrest()
        TeamCode.GPT -> buildGptCrest()
        TeamCode.LSG -> buildLsgCrest()
    }

    /**
     * CSK — Clutch Squad Knights: Shield with a knight-helm visor slit.
     */
    private fun buildCskCrest(): ImageVector {
        val amber = SolidColor(Color(0xFFF2B705))
        val ink = SolidColor(Color(0xFF1B2A49))
        return ImageVector.Builder(
            name = "CrestCSK",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            path(
                fill = ink,
                stroke = amber,
                strokeLineWidth = 2.4f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(24f, 4f)
                lineTo(41f, 9.5f)
                verticalLineTo(23.5f)
                curveTo(41f, 33.5f, 33f, 41f, 24f, 44.5f)
                curveTo(15f, 41f, 7f, 33.5f, 7f, 23.5f)
                verticalLineTo(9.5f)
                close()
            }
            // Knight helm inner plate
            path(fill = amber) {
                moveTo(14f, 17f)
                curveTo(14f, 11.8f, 18.4f, 8.8f, 24f, 8.8f)
                curveTo(29.6f, 8.8f, 34f, 11.8f, 34f, 17f)
                verticalLineTo(30.5f)
                lineTo(24f, 38.5f)
                lineTo(14f, 30.5f)
                close()
            }
            // Visor slit
            path(fill = ink) {
                moveTo(15.2f, 18.8f)
                lineTo(24f, 21.6f)
                lineTo(32.8f, 18.8f)
                lineTo(31.8f, 23.2f)
                lineTo(24f, 25.4f)
                lineTo(16.2f, 23.2f)
                close()
            }
            // Vertical helm ridge & cheek vents
            path(fill = ink) {
                moveTo(22.9f, 25.2f)
                horizontalLineTo(25.1f)
                verticalLineTo(36.2f)
                horizontalLineTo(22.9f)
                close()
            }
            path(
                stroke = ink,
                strokeLineWidth = 1.6f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(16.8f, 26.8f)
                lineTo(20.6f, 28.4f)
                moveTo(16.8f, 29.8f)
                lineTo(20.6f, 31.4f)
                moveTo(31.2f, 26.8f)
                lineTo(27.4f, 28.4f)
                moveTo(31.2f, 29.8f)
                lineTo(27.4f, 31.4f)
            }
        }.build()
    }

    /**
     * MBI — Moneyball Icons: Hexagon with three rising bars.
     */
    private fun buildMbiCrest(): ImageVector {
        val cobalt = SolidColor(Color(0xFF1F6FEB))
        val ice = SolidColor(Color(0xFF9CC9FF))
        val deep = SolidColor(Color(0xFF0E2954))
        return ImageVector.Builder(
            name = "CrestMBI",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            path(
                fill = deep,
                stroke = cobalt,
                strokeLineWidth = 2.6f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(24f, 4f)
                lineTo(41.3f, 14f)
                verticalLineTo(34f)
                lineTo(24f, 44f)
                lineTo(6.7f, 34f)
                verticalLineTo(14f)
                close()
            }
            path(
                stroke = ice,
                strokeLineWidth = 1.2f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(24f, 7.5f)
                lineTo(38.3f, 15.8f)
                verticalLineTo(32.2f)
                lineTo(24f, 40.5f)
                lineTo(9.7f, 32.2f)
                verticalLineTo(15.8f)
                close()
            }
            // Three rising bars
            path(fill = cobalt) {
                moveTo(13.5f, 25.5f)
                horizontalLineTo(18.5f)
                verticalLineTo(34.5f)
                horizontalLineTo(13.5f)
                close()
            }
            path(fill = ice) {
                moveTo(21.5f, 19.5f)
                horizontalLineTo(26.5f)
                verticalLineTo(34.5f)
                horizontalLineTo(21.5f)
                close()
            }
            path(fill = cobalt) {
                moveTo(29.5f, 13.5f)
                horizontalLineTo(34.5f)
                verticalLineTo(34.5f)
                horizontalLineTo(29.5f)
                close()
            }
            // Baseline
            path(
                stroke = ice,
                strokeLineWidth = 1.8f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(12f, 35.5f)
                horizontalLineTo(36f)
            }
        }.build()
    }

    /**
     * RCB — Raging Chasers Brigade: Circle with a lightning chevron.
     */
    private fun buildRcbCrest(): ImageVector {
        val crimson = SolidColor(Color(0xFFD62839))
        val black = SolidColor(Color(0xFF1A1A1D))
        val highlight = SolidColor(Color(0xFFF5F0E6))
        return ImageVector.Builder(
            name = "CrestRCB",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            path(
                fill = black,
                stroke = crimson,
                strokeLineWidth = 2.8f
            ) {
                moveTo(24f, 4f)
                arcTo(20f, 20f, 0f, true, true, 23.99f, 4f)
                close()
            }
            path(
                stroke = crimson,
                strokeLineWidth = 1.1f
            ) {
                moveTo(24f, 8.2f)
                arcTo(15.8f, 15.8f, 0f, true, true, 23.99f, 8.2f)
                close()
            }
            // Lightning chevron
            path(fill = crimson, pathFillType = PathFillType.NonZero) {
                moveTo(27.5f, 9f)
                lineTo(15f, 25.5f)
                horizontalLineTo(23.5f)
                lineTo(20.5f, 39f)
                lineTo(33.5f, 22f)
                horizontalLineTo(24.8f)
                close()
            }
            // Inner razor highlight on bolt
            path(
                stroke = highlight,
                strokeLineWidth = 1.1f,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(26.2f, 12.2f)
                lineTo(18f, 24f)
                horizontalLineTo(24.5f)
            }
        }.build()
    }

    /**
     * KRC — Knight Riders Club: Shield with a five-point crown.
     */
    private fun buildKrcCrest(): ImageVector {
        val violet = SolidColor(Color(0xFF6A3FA0))
        val gold = SolidColor(Color(0xFFD4AF37))
        val deepViolet = SolidColor(Color(0xFF2D1947))
        return ImageVector.Builder(
            name = "CrestKRC",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            path(
                fill = deepViolet,
                stroke = gold,
                strokeLineWidth = 2.4f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(24f, 4f)
                lineTo(41f, 9.5f)
                verticalLineTo(23f)
                curveTo(41f, 33.5f, 33f, 41f, 24f, 44.5f)
                curveTo(15f, 41f, 7f, 33.5f, 7f, 23f)
                verticalLineTo(9.5f)
                close()
            }
            // Inner violet field
            path(fill = violet) {
                moveTo(24f, 7.2f)
                lineTo(38f, 11.8f)
                verticalLineTo(23f)
                curveTo(38f, 31.5f, 31.5f, 37.8f, 24f, 40.9f)
                curveTo(16.5f, 37.8f, 10f, 31.5f, 10f, 23f)
                verticalLineTo(11.8f)
                close()
            }
            // Five-point crown
            path(fill = gold) {
                moveTo(13f, 28.5f)
                lineTo(12.2f, 17f)
                lineTo(17.5f, 22.2f)
                lineTo(18.8f, 14f)
                lineTo(22.2f, 21f)
                lineTo(24f, 11.5f)
                lineTo(25.8f, 21f)
                lineTo(29.2f, 14f)
                lineTo(30.5f, 22.2f)
                lineTo(35.8f, 17f)
                lineTo(35f, 28.5f)
                close()
            }
            // Crown base band
            path(fill = gold) {
                moveTo(13f, 30f)
                horizontalLineTo(35f)
                verticalLineTo(33.4f)
                horizontalLineTo(13f)
                close()
            }
        }.build()
    }

    /**
     * DDC — Daredevil Contenders: Triangle with a stylized flame.
     */
    private fun buildDdcCrest(): ImageVector {
        val royalBlue = SolidColor(Color(0xFF1E4FD8))
        val scarlet = SolidColor(Color(0xFFE63946))
        val ivory = SolidColor(Color(0xFFF5F0E6))
        return ImageVector.Builder(
            name = "CrestDDC",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            path(
                fill = royalBlue,
                stroke = scarlet,
                strokeLineWidth = 2.6f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(24f, 5f)
                lineTo(43f, 39.5f)
                horizontalLineTo(5f)
                close()
            }
            // Stylized flame
            path(fill = scarlet) {
                moveTo(24.5f, 14f)
                curveTo(27.5f, 19.2f, 31.8f, 22.2f, 31.8f, 28.2f)
                curveTo(31.8f, 33.2f, 28.3f, 36.6f, 24f, 36.6f)
                curveTo(19.7f, 36.6f, 16.2f, 33.2f, 16.2f, 28.2f)
                curveTo(16.2f, 24f, 18.6f, 21f, 20.8f, 18.8f)
                curveTo(20.6f, 21.6f, 22f, 23.2f, 23.2f, 23.2f)
                curveTo(22.4f, 19.5f, 23.2f, 16.2f, 24.5f, 14f)
                close()
            }
            // Inner core flame
            path(fill = ivory) {
                moveTo(24f, 25f)
                curveTo(25.8f, 27.6f, 27.2f, 29.4f, 27.2f, 31.8f)
                curveTo(27.2f, 34f, 25.8f, 35.6f, 24f, 35.6f)
                curveTo(22.2f, 35.6f, 20.8f, 34f, 20.8f, 31.8f)
                curveTo(20.8f, 29.4f, 22.2f, 27.6f, 24f, 25f)
                close()
            }
        }.build()
    }

    /**
     * SRH — Super Riser Heat: Sunburst with twelve rays.
     */
    private fun buildSrhCrest(): ImageVector {
        val ember = SolidColor(Color(0xFFF26B1D))
        val charcoal = SolidColor(Color(0xFF2B2B2B))
        val goldWarm = SolidColor(Color(0xFFFFB74D))
        return ImageVector.Builder(
            name = "CrestSRH",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            path(
                fill = charcoal,
                stroke = ember,
                strokeLineWidth = 2f
            ) {
                moveTo(24f, 4f)
                arcTo(20f, 20f, 0f, true, true, 23.99f, 4f)
                close()
            }
            // Twelve triangular sun rays around center (24, 24)
            path(fill = ember) {
                val cx = 24f
                val cy = 24f
                val outerR = 20.5f
                val baseR = 11.2f
                val halfSpreadRad = (9.5 * PI / 180.0)
                for (i in 0 until 12) {
                    val angle = i * (2.0 * PI / 12.0) - PI / 2.0
                    val tipX = cx + outerR * cos(angle).toFloat()
                    val tipY = cy + outerR * sin(angle).toFloat()
                    val leftX = cx + baseR * cos(angle - halfSpreadRad).toFloat()
                    val leftY = cy + baseR * sin(angle - halfSpreadRad).toFloat()
                    val rightX = cx + baseR * cos(angle + halfSpreadRad).toFloat()
                    val rightY = cy + baseR * sin(angle + halfSpreadRad).toFloat()
                    moveTo(leftX, leftY)
                    lineTo(tipX, tipY)
                    lineTo(rightX, rightY)
                    close()
                }
            }
            // Inner charcoal ring + glowing core
            path(fill = charcoal) {
                moveTo(24f, 13.5f)
                arcTo(10.5f, 10.5f, 0f, true, true, 23.99f, 13.5f)
                close()
            }
            path(fill = ember) {
                moveTo(24f, 15.8f)
                arcTo(8.2f, 8.2f, 0f, true, true, 23.99f, 15.8f)
                close()
            }
            path(fill = goldWarm) {
                moveTo(24f, 19.5f)
                arcTo(4.5f, 4.5f, 0f, true, true, 23.99f, 19.5f)
                close()
            }
        }.build()
    }

    /**
     * RRG — Royal Renegades: Crown over a diamond.
     */
    private fun buildRrgCrest(): ImageVector {
        val magenta = SolidColor(Color(0xFFE5379B))
        val navy = SolidColor(Color(0xFF1D3A8A))
        val lightPink = SolidColor(Color(0xFFF7A8D8))
        return ImageVector.Builder(
            name = "CrestRRG",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            // Three-peak royal crown on top
            path(fill = magenta) {
                moveTo(14f, 15.5f)
                lineTo(13f, 6.5f)
                lineTo(19f, 11f)
                lineTo(24f, 4.5f)
                lineTo(29f, 11f)
                lineTo(35f, 6.5f)
                lineTo(34f, 15.5f)
                close()
            }
            // Diamond below crown
            path(
                fill = navy,
                stroke = magenta,
                strokeLineWidth = 2.4f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(24f, 17.5f)
                lineTo(40f, 30.5f)
                lineTo(24f, 43.5f)
                lineTo(8f, 30.5f)
                close()
            }
            // Inner diamond facets
            path(fill = magenta) {
                moveTo(24f, 22.5f)
                lineTo(33.5f, 30.5f)
                lineTo(24f, 38.5f)
                lineTo(14.5f, 30.5f)
                close()
            }
            path(fill = lightPink) {
                moveTo(24f, 26f)
                lineTo(28.5f, 30.5f)
                lineTo(24f, 35f)
                lineTo(19.5f, 30.5f)
                close()
            }
        }.build()
    }

    /**
     * PBK — Pure Blitz Kings: Twin-peak crown with a star.
     */
    private fun buildPbkCrest(): ImageVector {
        val red = SolidColor(Color(0xFFC8102E))
        val silver = SolidColor(Color(0xFFC0C6CE))
        val darkRed = SolidColor(Color(0xFF5A0716))
        return ImageVector.Builder(
            name = "CrestPBK",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            path(
                fill = darkRed,
                stroke = silver,
                strokeLineWidth = 2.4f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(24f, 4f)
                lineTo(40.5f, 10.5f)
                verticalLineTo(25f)
                curveTo(40.5f, 34.5f, 33f, 41.2f, 24f, 44.2f)
                curveTo(15f, 41.2f, 7.5f, 34.5f, 7.5f, 25f)
                verticalLineTo(10.5f)
                close()
            }
            path(fill = red) {
                moveTo(24f, 7f)
                lineTo(37.5f, 12.4f)
                verticalLineTo(25f)
                curveTo(37.5f, 32.8f, 31.4f, 38.4f, 24f, 41f)
                curveTo(16.6f, 38.4f, 10.5f, 32.8f, 10.5f, 25f)
                verticalLineTo(12.4f)
                close()
            }
            // Twin-peak crown
            path(fill = silver) {
                moveTo(13f, 33.5f)
                lineTo(14.5f, 18.5f)
                lineTo(24f, 26.5f)
                lineTo(33.5f, 18.5f)
                lineTo(35f, 33.5f)
                close()
            }
            path(fill = silver) {
                moveTo(13f, 35f)
                horizontalLineTo(35f)
                verticalLineTo(37.8f)
                horizontalLineTo(13f)
                close()
            }
            // Five-point star nestled between peaks
            path(fill = silver) {
                val cx = 24f
                val cy = 15.5f
                val outerR = 5.4f
                val innerR = 2.3f
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

    /**
     * GPT — Gameplan Titans: Octagon with a column and chess-grid.
     */
    private fun buildGptCrest(): ImageVector {
        val navy = SolidColor(Color(0xFF14213D))
        val teal = SolidColor(Color(0xFF2EC4B6))
        val mutedTeal = SolidColor(Color(0x552EC4B6))
        return ImageVector.Builder(
            name = "CrestGPT",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            // Regular octagon
            path(
                fill = navy,
                stroke = teal,
                strokeLineWidth = 2.4f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                val cx = 24f
                val cy = 24f
                val r = 20f
                for (i in 0 until 8) {
                    val angle = (22.5 + i * 45.0) * PI / 180.0
                    val x = cx + r * cos(angle).toFloat()
                    val y = cy + r * sin(angle).toFloat()
                    if (i == 0) moveTo(x, y) else lineTo(x, y)
                }
                close()
            }
            // Chess-grid squares behind the column
            path(fill = mutedTeal) {
                // Top-left & bottom-right checker tiles on a 4x4 4px grid centered around (24,24)
                val squares = listOf(
                    13f to 14f, 21f to 14f, 29f to 14f,
                    17f to 19f, 25f to 19f,
                    13f to 24f, 21f to 24f, 29f to 24f,
                    17f to 29f, 25f to 29f
                )
                for ((sx, sy) in squares) {
                    moveTo(sx, sy)
                    horizontalLineTo(sx + 4.5f)
                    verticalLineTo(sy + 4.5f)
                    horizontalLineTo(sx)
                    close()
                }
            }
            // Classical column: capital, fluted shaft, base
            path(fill = teal) {
                // Capital
                moveTo(17.5f, 12f)
                horizontalLineTo(30.5f)
                verticalLineTo(15f)
                horizontalLineTo(28.5f)
                lineTo(27.5f, 16.8f)
                horizontalLineTo(20.5f)
                lineTo(19.5f, 15f)
                horizontalLineTo(17.5f)
                close()
                // Shaft
                moveTo(20.8f, 17.5f)
                horizontalLineTo(27.2f)
                verticalLineTo(32.5f)
                horizontalLineTo(20.8f)
                close()
                // Pedestal base
                moveTo(17f, 33.2f)
                horizontalLineTo(31f)
                verticalLineTo(36.2f)
                horizontalLineTo(17f)
                close()
            }
            // Column fluting
            path(
                stroke = navy,
                strokeLineWidth = 1.2f,
                strokeLineCap = StrokeCap.Round
            ) {
                moveTo(22.8f, 19f)
                verticalLineTo(31f)
                moveTo(25.2f, 19f)
                verticalLineTo(31f)
            }
        }.build()
    }

    /**
     * LSG — Lucky Striker Gangs: Four-leaf clover with a bolt.
     */
    private fun buildLsgCrest(): ImageVector {
        val teal = SolidColor(Color(0xFF0FA3B1))
        val tangerine = SolidColor(Color(0xFFFF8C42))
        val deepTeal = SolidColor(Color(0xFF093A42))
        return ImageVector.Builder(
            name = "CrestLSG",
            defaultWidth = 48.dp,
            defaultHeight = 48.dp,
            viewportWidth = 48f,
            viewportHeight = 48f
        ).apply {
            path(
                fill = deepTeal,
                stroke = teal,
                strokeLineWidth = 2.2f
            ) {
                moveTo(24f, 4f)
                arcTo(20f, 20f, 0f, true, true, 23.99f, 4f)
                close()
            }
            // Four-leaf clover (4 circular lobes)
            path(fill = teal) {
                // Top leaf
                moveTo(24f, 8.2f)
                arcTo(6.2f, 6.2f, 0f, true, true, 23.99f, 8.2f)
                close()
                // Bottom leaf
                moveTo(24f, 27.4f)
                arcTo(6.2f, 6.2f, 0f, true, true, 23.99f, 27.4f)
                close()
                // Left leaf
                moveTo(14.4f, 17.8f)
                arcTo(6.2f, 6.2f, 0f, true, true, 14.39f, 17.8f)
                close()
                // Right leaf
                moveTo(33.6f, 17.8f)
                arcTo(6.2f, 6.2f, 0f, true, true, 33.59f, 17.8f)
                close()
            }
            // Tangerine lightning bolt cutting across the clover
            path(
                fill = tangerine,
                stroke = deepTeal,
                strokeLineWidth = 1f,
                strokeLineJoin = StrokeJoin.Round
            ) {
                moveTo(26.8f, 11.5f)
                lineTo(18.5f, 24.5f)
                horizontalLineTo(24.2f)
                lineTo(21.2f, 36.5f)
                lineTo(29.8f, 22.8f)
                horizontalLineTo(24.0f)
                close()
            }
        }.build()
    }
}

@Composable
fun rememberTeamCrest(code: TeamCode): ImageVector =
    remember(code) { TeamCrestVectors.forTeam(code) }
