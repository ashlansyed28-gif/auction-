package com.hammertime.auction.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color
import com.hammertime.auction.model.Team
import com.hammertime.auction.model.TeamCode

@Immutable
data class HammerColors(
    val obsidian: Color = Color(0xFF0E1116),
    val charcoal: Color = Color(0xFF161B22),
    val raised: Color = Color(0xFF1D242E),
    val hairline: Color = Color(0xFF2A323D),
    val ivory: Color = Color(0xFFF5F0E6),
    val muted: Color = Color(0xFFA8A294),
    val antiqueGold: Color = Color(0xFFD4AF37),
    val goldDark: Color = Color(0xFF9C7F1F),
    val goldLight: Color = Color(0xFFF1D77A),
    val crimson: Color = Color(0xFFC0392B),
    val success: Color = Color(0xFF3FB950),
    val warningAmber: Color = Color(0xFFE5A93B)
)

val DefaultHammerColors = HammerColors()

val Team.primaryColor: Color
    get() = Color(primaryColorHex)

val Team.secondaryColor: Color
    get() = Color(secondaryColorHex)

val TeamCode.primaryColor: Color
    get() = Color(primaryColorHex)

val TeamCode.secondaryColor: Color
    get() = Color(secondaryColorHex)
