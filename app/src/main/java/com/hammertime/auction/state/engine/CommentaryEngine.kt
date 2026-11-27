package com.hammertime.auction.state.engine

import androidx.compose.runtime.Immutable
import com.hammertime.auction.model.MoneyFormatter
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.PlayerRole
import com.hammertime.auction.model.PlayerSubRole
import com.hammertime.auction.model.TeamState
import kotlin.random.Random

enum class CommentaryEvent {
    SET_INTRO,
    OPEN,
    BID,
    DUEL,
    GOING_ONCE,
    GOING_TWICE,
    SOLD,
    STEAL,
    OVERPAY,
    UNSOLD,
    RTM
}

@Immutable
data class CommentaryLine(
    val id: Long,
    val event: CommentaryEvent,
    val text: String,
    val highlights: List<String>
)

class CommentaryEngine(private val random: Random) {
    private var nextId = 1L

    fun setIntro(setTitle: String, count: Int): CommentaryLine {
        val variants = listOf(
            "Lights up in the hall — $setTitle is live with $count prospects on the block.",
            "Next up: $setTitle. $count names, plenty of purse tension ahead.",
            "We turn the page to $setTitle — $count players waiting for the gavel.",
            "Analysts lean in as $setTitle opens with $count contenders.",
            "Strategy boards are out for $setTitle — $count lots ready to roll.",
            "The room settles. $setTitle begins with $count names in the drum.",
            "Big purse swings ahead in $setTitle featuring $count specialists.",
            "Broadcast desk ready: $setTitle brings $count fresh battles to the floor."
        )
        return line(CommentaryEvent.SET_INTRO, variants.random(random), listOf(setTitle, "$count"))
    }

    fun lotOpen(lotNumber: Int, player: Player, basePriceCr: Double): CommentaryLine {
        val price = MoneyFormatter.formatCr(basePriceCr)
        val role = player.subRole.label
        val variants = listOf(
            "Lot $lotNumber enters the floor: ${player.name}, ${player.country} $role at $price.",
            "Up now at Lot $lotNumber — ${player.name}! Opening ask is $price.",
            "Eyes on the podium for ${player.name} (${player.styleTag}). Base set at $price.",
            "Lot $lotNumber: ${player.name} walks onto the ticker, starting at $price.",
            "Who starts the bidding for ${player.name}? Opening call is $price.",
            "Paddles poised for Lot $lotNumber — ${player.name}, $role, base $price.",
            "The gavel awaits ${player.name} at Lot $lotNumber. Bidding opens at $price.",
            "Scouts love the numbers on ${player.name}. Lot $lotNumber begins at $price."
        )
        return line(CommentaryEvent.OPEN, variants.random(random), listOf(player.name, price, "Lot $lotNumber"))
    }

    fun bid(
        player: Player,
        bidder: TeamState,
        amountCr: Double,
        isJumpBid: Boolean
    ): CommentaryLine {
        val price = MoneyFormatter.formatCr(amountCr)
        val code = bidder.team.code.name
        val purse = MoneyFormatter.formatCr(bidder.purseRemainingCr)
        val roleCountHint = roleCountPhrase(bidder, player)

        val variants = if (isJumpBid) {
            listOf(
                "$code slams the paddle down with a statement jump to $price for ${player.name}!",
                "Bold jump bid! $code leaps straight to $price with $purse still in the bank.",
                "$code skips a gear — $price for ${player.name}! The room feels the heat.",
                "Aggressive intent from $code, vaulting to $price on ${player.name}.",
                "Power play by $code! Straight to $price ($purse purse left).",
                "$code tries to shut the door early with a jump to $price!",
                "Statement paddle from $code: $price for ${player.name}.",
                "$code drops a marker at $price — $roleCountHint"
            )
        } else {
            listOf(
                "$code raises the paddle — $price for ${player.name}.",
                "$code steps in at $price, holding $purse remaining.",
                "Bid with $code at $price. $roleCountHint",
                "$code answers cleanly at $price for ${player.name}.",
                "Paddle up from $code! Current offer moves to $price.",
                "$code stays in the hunt at $price ($purse left).",
                "Measured nod from the $code table — $price is on the board.",
                "$code claims the lead at $price for ${player.name}."
            )
        }
        return line(CommentaryEvent.BID, variants.random(random), listOf(code, price, player.name))
    }

    fun duel(
        player: Player,
        teamA: TeamState,
        teamB: TeamState,
        amountCr: Double
    ): CommentaryLine {
        val price = MoneyFormatter.formatCr(amountCr)
        val a = teamA.team.code.name
        val b = teamB.team.code.name
        val variants = listOf(
            "Two-horse slugfest! $a and $b trade blows up to $price for ${player.name}.",
            "Neither $a nor $b is blinking — ${player.name} surges to $price!",
            "Head-to-head lock between $a and $b! Price climbs to $price.",
            "Broadcast cameras split screen: $a vs $b at $price for ${player.name}.",
            "Pure brinkmanship! $a and $b refuse to fold at $price.",
            "The room goes quiet as $a and $b duel past $price.",
            "Every nod adds pressure — $a and $b locked together at $price!",
            "Relentless paddle duel between $a and $b on ${player.name} ($price)."
        )
        return line(CommentaryEvent.DUEL, variants.random(random), listOf(a, b, price, player.name))
    }

    fun goingOnce(player: Player, leaderCode: String, amountCr: Double): CommentaryLine {
        val price = MoneyFormatter.formatCr(amountCr)
        val variants = listOf(
            "Going once at $price to $leaderCode...",
            "Clock ticking down — $price with $leaderCode, going once!",
            "Any advance on $price from $leaderCode? Going once...",
            "Paddles down across the hall? $leaderCode leads at $price, going once.",
            "Final three seconds — ${player.name} at $price to $leaderCode, going once!",
            "Holding at $price for $leaderCode. Going once...",
            "Room silent on ${player.name}... $price with $leaderCode, going once.",
            "Auctioneer leans over the desk: $price to $leaderCode, going once!"
        )
        return line(CommentaryEvent.GOING_ONCE, variants.random(random), listOf(price, leaderCode, player.name))
    }

    fun goingTwice(player: Player, leaderCode: String, amountCr: Double): CommentaryLine {
        val price = MoneyFormatter.formatCr(amountCr)
        val variants = listOf(
            "Going twice at $price! Last chance to stop $leaderCode!",
            "Going twice! ${player.name} nearly bound for $leaderCode at $price!",
            "Final heartbeat — $price to $leaderCode, going twice!",
            "Gavel raised high! $price with $leaderCode, going twice!",
            "Two seconds left! Does anyone dare challenge $leaderCode at $price?",
            "Going twice on ${player.name} at $price!",
            "Almost locked in for $leaderCode at $price — going twice!",
            "Hands hovering, clock bleeding — $price to $leaderCode, going twice!"
        )
        return line(CommentaryEvent.GOING_TWICE, variants.random(random), listOf(price, leaderCode, player.name))
    }

    fun sold(
        player: Player,
        buyer: TeamState,
        priceCr: Double,
        fairValueCr: Double,
        viaRtm: Boolean
    ): CommentaryLine {
        val price = MoneyFormatter.formatCr(priceCr)
        val fair = MoneyFormatter.formatCr(fairValueCr)
        val code = buyer.team.code.name
        val purseLeft = MoneyFormatter.formatCr(buyer.purseRemainingCr)
        val gap = fairValueCr - priceCr
        val rtmSuffix = if (viaRtm) " via RTM" else ""
        val roleNote = afterPurchaseRoleNote(buyer, player)

        return when {
            gap >= 2.0 -> {
                val variants = listOf(
                    "STEAL! $code snags ${player.name} at $price$rtmSuffix (fair value $fair)!",
                    "Bargain of the session! $code lands ${player.name} for just $price$rtmSuffix.",
                    "How did $code pull that off? ${player.name} at $price vs $fair valuation!",
                    "Moneyball coup by $code — ${player.name} signed at $price$rtmSuffix.",
                    "Daylight robbery! $code pockets ${player.name} for $price ($purseLeft left).",
                    "Table erupts at $code — ${player.name} locked in at a cut-price $price$rtmSuffix.",
                    "Massive value! $code grabs ${player.name} for $price, saving huge purse.",
                    "Quietly brilliant business: $code secures ${player.name} at $price. $roleNote"
                )
                line(CommentaryEvent.STEAL, variants.random(random), listOf("STEAL", code, price, player.name))
            }
            gap <= -2.5 -> {
                val variants = listOf(
                    "PREMIUM BUY! $code goes all-in at $price$rtmSuffix for ${player.name} (fair $fair)!",
                    "Sky-high gavel! $code pays $price$rtmSuffix to win ${player.name} ($purseLeft left).",
                    "Statement cheque signed by $code — $price for ${player.name}, well over $fair.",
                    "Purse alert! $code stretches to $price$rtmSuffix to fend off rivals for ${player.name}.",
                    "Heated bidding pushes ${player.name} to $price — $code pays top rupee!",
                    "No compromise from $code: $price$rtmSuffix for ${player.name}. $roleNote",
                    "Big splash! $code breaks the bank at $price for ${player.name}.",
                    "Aggressive valuation by $code — ${player.name} joins for $price$rtmSuffix."
                )
                line(CommentaryEvent.OVERPAY, variants.random(random), listOf(code, price, player.name))
            }
            else -> {
                val variants = listOf(
                    "SOLD! ${player.name} goes to $code for $price$rtmSuffix. $roleNote",
                    "Hammer down! $code signs ${player.name} at $price$rtmSuffix ($purseLeft left).",
                    "Deal done — ${player.name} joins $code for $price$rtmSuffix.",
                    "Clean gavel! $code adds ${player.name} at $price$rtmSuffix. $roleNote",
                    "${player.name} is officially $code-bound for $price$rtmSuffix!",
                    "Right on the valuation mark — $code lands ${player.name} for $price$rtmSuffix.",
                    "Applauded at the $code table: ${player.name} locked in at $price$rtmSuffix.",
                    "Pen to paper for $code — ${player.name} acquired at $price$rtmSuffix."
                )
                line(CommentaryEvent.SOLD, variants.random(random), listOf("SOLD", code, price, player.name))
            }
        }
    }

    fun unsold(player: Player, isAccelerated: Boolean): CommentaryLine {
        val variants = if (isAccelerated) {
            listOf(
                "Final gavel — ${player.name} goes unsold in the accelerated round.",
                "No takers even at the reduced ask; ${player.name}'s auction ends here.",
                "Silence in the hall for ${player.name} — final unsold.",
                "Franchises hold their remaining slots; ${player.name} finishes unsold.",
                "${player.name} misses out in the accelerated blitz.",
                "Clock expires without a paddle for ${player.name}.",
                "Tough break for ${player.name} — no final-round bid.",
                "Gavel drops softly: ${player.name} remains unsold."
            )
        } else {
            listOf(
                "UNSOLD — ${player.name} receives no opening bid and moves to the waiting tray.",
                "No paddles raised for ${player.name}; we may see them again in the accelerated round.",
                "Franchises keep their powder dry — ${player.name} goes unsold for now.",
                "Quiet beat in the room as ${player.name} slips into the unsold pool.",
                "${player.name} misses the first pass; reduced base awaits later.",
                "Purses stay guarded — ${player.name} goes unsold.",
                "Passed over for now: ${player.name} heads to the unsold rack.",
                "Zero bids on ${player.name} at the current ask."
            )
        }
        return line(CommentaryEvent.UNSOLD, variants.random(random), listOf("UNSOLD", player.name))
    }

    fun rtm(
        player: Player,
        formerCode: String,
        winnerCode: String,
        priceCr: Double,
        stageDetail: String
    ): CommentaryLine {
        val price = MoneyFormatter.formatCr(priceCr)
        val variants = listOf(
            "RTM DRAMA! $formerCode weighs reclaiming ${player.name} from $winnerCode ($stageDetail).",
            "Spotlight swings to $formerCode — Right to Match on ${player.name} at $price ($stageDetail)!",
            "Hold the gavel! $formerCode holds an RTM card for ${player.name} ($stageDetail).",
            "High tension between $formerCode and $winnerCode over ${player.name} — $stageDetail.",
            "Former franchise $formerCode enters the spotlight at $price ($stageDetail)!",
            "RTM check on ${player.name}: $formerCode vs $winnerCode — $stageDetail.",
            "The room freezes for $formerCode's RTM call on ${player.name} ($stageDetail).",
            "Loyalty meets budget! $formerCode faces $winnerCode on ${player.name} ($stageDetail)."
        )
        return line(CommentaryEvent.RTM, variants.random(random), listOf("RTM", formerCode, winnerCode, player.name, price))
    }

    private fun roleCountPhrase(team: TeamState, player: Player): String {
        return when {
            player.role == PlayerRole.WK && team.keeperCount == 0 ->
                "Still hunting their first keeper."
            player.subRole == PlayerSubRole.SPIN || player.subRole == PlayerSubRole.SPIN_AR ->
                if (team.spinnerCount >= 2) "Already carrying ${team.spinnerCount} spinners." else "Spin depth in focus."
            player.subRole == PlayerSubRole.OPENER ->
                if (team.openerCount == 0) "Need an opener up top." else "Adding top-order depth."
            player.role == PlayerRole.AR ->
                "All-round balance always commands a premium."
            else -> "Building out squad #${team.squadCount + 1}."
        }
    }

    private fun afterPurchaseRoleNote(team: TeamState, player: Player): String {
        return when {
            player.role == PlayerRole.WK -> "That's keeper #${team.keeperCount} for ${team.team.code.name}."
            player.subRole == PlayerSubRole.SPIN || player.subRole == PlayerSubRole.SPIN_AR ->
                "That's spinner #${team.spinnerCount} in the ${team.team.code.name} stable."
            player.subRole == PlayerSubRole.PACE || player.subRole == PlayerSubRole.DEATH_SPECIALIST ->
                "Pace unit climbs to ${team.paceCount} options."
            player.subRole == PlayerSubRole.OPENER ->
                "Opener count is now ${team.openerCount}."
            else -> "Squad stands at ${team.squadCount} players."
        }
    }

    private fun line(event: CommentaryEvent, text: String, highlights: List<String>): CommentaryLine =
        CommentaryLine(
            id = nextId++,
            event = event,
            text = text,
            highlights = highlights.distinct()
        )
}
