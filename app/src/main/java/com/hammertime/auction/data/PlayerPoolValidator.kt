package com.hammertime.auction.data

import com.hammertime.auction.model.Player
import kotlin.math.abs
import kotlin.math.round

class PlayerPoolValidationException(val errors: List<String>) :
    IllegalStateException("Player pool validation failed (${errors.size} issue(s)):\n${errors.joinToString("\n")}")

object PlayerPoolValidator {

    const val EXPECTED_TOTAL_PLAYERS = 165

    val EXPECTED_SET_COUNTS: Map<Int, Int> = mapOf(
        1 to 15,
        2 to 25,
        3 to 25,
        4 to 20,
        5 to 25,
        6 to 30,
        7 to 25
    )

    fun validateOrThrow(players: List<Player>) {
        val errors = validate(players)
        if (errors.isNotEmpty()) {
            throw PlayerPoolValidationException(errors)
        }
    }

    fun validate(players: List<Player>): List<String> {
        val errors = mutableListOf<String>()

        if (players.size != EXPECTED_TOTAL_PLAYERS) {
            errors += "Expected $EXPECTED_TOTAL_PLAYERS total players, found ${players.size}."
        }

        val seenIds = HashSet<String>(players.size)
        val setCounts = HashMap<Int, Int>()

        players.forEachIndexed { index, p ->
            val tag = "Player[$index:${p.id}]"
            if (p.id.isBlank()) {
                errors += "$tag has blank id."
            } else if (!seenIds.add(p.id)) {
                errors += "Duplicate player id '${p.id}'."
            }

            if (p.name.isBlank()) errors += "$tag has blank name."
            if (p.country.length != 3 || p.country != p.country.uppercase()) {
                errors += "$tag invalid 3-letter country '${p.country}'."
            }
            if (p.overseas != (p.country != "IND")) {
                errors += "$tag overseas flag (${p.overseas}) does not match country '${p.country}'."
            }
            if (p.age !in 16..50) errors += "$tag age ${p.age} out of range 16..50."
            if (p.battingStyle.isBlank()) errors += "$tag blank battingStyle."
            if (p.bowlingStyle.isBlank()) errors += "$tag blank bowlingStyle."
            if (p.styleTag.isBlank()) errors += "$tag blank styleTag."

            if (p.set !in 1..7) {
                errors += "$tag invalid set ${p.set}."
            } else {
                setCounts[p.set] = (setCounts[p.set] ?: 0) + 1
            }

            if (p.rating !in 40..99) {
                errors += "$tag rating ${p.rating} out of range 40..99."
            }
            if (p.basePriceCr < 0.25 || abs(p.basePriceCr * 4.0 - round(p.basePriceCr * 4.0)) > 1e-6) {
                errors += "$tag invalid basePriceCr ${p.basePriceCr}."
            }
            if ((p.set == 1 || p.set == 7) && abs(p.basePriceCr - 2.0) > 1e-6) {
                errors += "$tag in set ${p.set} must have basePriceCr 2.00, found ${p.basePriceCr}."
            }

            if (p.set == 7 && !p.vintage.isVintage) {
                errors += "$tag in set 7 must have vintage.isVintage = true."
            }
            if (p.set != 7 && p.vintage.isVintage) {
                errors += "$tag in set ${p.set} must not have vintage.isVintage = true."
            }

            if (p.avatar.skinTone !in 0..5) errors += "$tag invalid skinTone ${p.avatar.skinTone}."
            if (p.avatar.hairStyle !in 0..7) errors += "$tag invalid hairStyle ${p.avatar.hairStyle}."
            if (p.avatar.beard !in 0..3) errors += "$tag invalid beard ${p.avatar.beard}."
            if (!p.avatar.hairColor.startsWith("#")) errors += "$tag invalid hairColor '${p.avatar.hairColor}'."

            val bat = p.stats.batting
            val bowl = p.stats.bowling
            val wk = p.stats.keepers
            if (bat.matches <= 0 || bat.runs < 0 || bat.avg < 0.0 || bat.strikeRate < 0.0) {
                errors += "$tag invalid batting stats."
            }
            if (bowl.wickets < 0 || bowl.economy < 0.0 || bowl.best.isBlank()) {
                errors += "$tag invalid bowling stats."
            }
            if (wk.catches < 0 || wk.stumpings < 0) {
                errors += "$tag invalid keeper stats."
            }
        }

        EXPECTED_SET_COUNTS.forEach { (setNum, expectedCount) ->
            val actual = setCounts[setNum] ?: 0
            if (actual != expectedCount) {
                errors += "Set $setNum expected $expectedCount players, found $actual."
            }
        }

        return errors
    }
}
