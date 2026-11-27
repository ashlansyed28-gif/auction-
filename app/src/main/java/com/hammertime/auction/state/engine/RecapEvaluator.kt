package com.hammertime.auction.state.engine

import com.hammertime.auction.model.AuctionValuation
import com.hammertime.auction.model.PlayerRole
import com.hammertime.auction.model.ProjectedXI
import com.hammertime.auction.model.RecapSummary
import com.hammertime.auction.model.SquadEntry
import com.hammertime.auction.model.SquadRatingBreakdown
import com.hammertime.auction.model.TeamState
import kotlin.math.roundToInt

object RecapEvaluator {

    fun evaluateTeam(
        teamState: TeamState,
        purseCr: Double,
        minSquadSize: Int = 12
    ): RecapSummary {
        val squad = teamState.squad
        val projectedXI = selectBestXI(squad)
        val ratingBreakdown = computeSquadRating(
            squad = squad,
            projectedXI = projectedXI,
            minSquadSize = minSquadSize
        )

        var stealEntry: SquadEntry? = null
        var stealDelta = Double.NEGATIVE_INFINITY
        var overpayEntry: SquadEntry? = null
        var overpayDelta = Double.NEGATIVE_INFINITY

        for (entry in squad) {
            val fair = AuctionValuation.computeFairValueCr(entry.player, purseCr)
            val sDelta = fair - entry.paidCr
            if (sDelta > stealDelta) {
                stealDelta = sDelta
                stealEntry = entry
            }
            val oDelta = entry.paidCr - fair
            if (oDelta > overpayDelta) {
                overpayDelta = oDelta
                overpayEntry = entry
            }
        }

        val vintagePick = squad
            .filter { it.player.vintage.isVintage }
            .maxWithOrNull(
                compareBy<SquadEntry> { it.player.rating }
                    .thenBy { it.player.stats.batting.matches }
            )

        val spent = squad.sumOf { it.paidCr }

        return RecapSummary(
            team = teamState.team,
            squadRating = ratingBreakdown,
            projectedXI = projectedXI,
            biggestSteal = stealEntry,
            biggestStealDeltaCr = if (stealEntry == null) 0.0 else stealDelta,
            biggestOverpay = overpayEntry,
            biggestOverpayDeltaCr = if (overpayEntry == null) 0.0 else overpayDelta,
            vintageOrGoatPick = vintagePick,
            totalSpentCr = spent,
            purseLeftCr = teamState.purseRemainingCr
        )
    }

    /**
     * Selects the highest-total-rating 11-player XI satisfying:
     * - Exactly 1 Wicketkeeper (role == WK)
     * - At least 5 bowling options (canBowl)
     * - At most 4 overseas players
     * Falls back gracefully if a squad lacks required roles.
     */
    fun selectBestXI(squad: List<SquadEntry>): ProjectedXI {
        if (squad.isEmpty()) {
            return ProjectedXI(emptyList(), null, 0, 0, 0)
        }
        val sorted = squad.sortedWith(
            compareByDescending<SquadEntry> { it.player.rating }
                .thenByDescending { it.player.stats.batting.matches }
                .thenBy { it.player.id }
        )

        if (sorted.size <= 11) {
            return buildProjectedXI(sorted)
        }

        val suffixMaxSum = IntArray(sorted.size + 1)
        val n = sorted.size
        // Precompute prefix rating helper is unnecessary with simple upper bound using top remaining items
        var bestScore = Int.MIN_VALUE
        var bestSelection: List<SquadEntry>? = null
        val current = ArrayList<SquadEntry>(11)

        fun upperBound(startIdx: Int, slotsLeft: Int): Int {
            var sum = 0
            val limit = (startIdx + slotsLeft).coerceAtMost(n)
            for (i in startIdx until limit) {
                sum += sorted[i].player.rating
            }
            return sum
        }

        fun dfs(
            idx: Int,
            currentSum: Int,
            wkCount: Int,
            bowlCount: Int,
            osCount: Int
        ) {
            val picked = current.size
            val slotsLeft = 11 - picked
            if (slotsLeft == 0) {
                if (wkCount == 1 && bowlCount >= 5 && osCount <= 4 && currentSum > bestScore) {
                    bestScore = currentSum
                    bestSelection = current.toList()
                }
                return
            }
            if (idx >= n || n - idx < slotsLeft) return
            if (currentSum + upperBound(idx, slotsLeft) <= bestScore) return

            // Prune if impossible to get 1 WK or 5 bowlers
            if (wkCount > 1 || osCount > 4) return

            val candidate = sorted[idx]
            val isWk = candidate.player.role == PlayerRole.WK
            val isBowl = candidate.player.canBowl
            val isOs = candidate.player.overseas

            // Branch 1: pick candidate if constraints allow
            if (!(isWk && wkCount >= 1) && !(isOs && osCount >= 4)) {
                current.add(candidate)
                dfs(
                    idx = idx + 1,
                    currentSum = currentSum + candidate.player.rating,
                    wkCount = wkCount + if (isWk) 1 else 0,
                    bowlCount = bowlCount + if (isBowl) 1 else 0,
                    osCount = osCount + if (isOs) 1 else 0
                )
                current.removeAt(current.lastIndex)
            }

            // Branch 2: skip candidate
            dfs(idx + 1, currentSum, wkCount, bowlCount, osCount)
        }

        dfs(0, 0, 0, 0, 0)

        val chosen = bestSelection ?: fallbackXI(sorted)
        return buildProjectedXI(chosen)
    }

    private fun fallbackXI(sorted: List<SquadEntry>): List<SquadEntry> {
        val picked = mutableListOf<SquadEntry>()
        val pickedIds = HashSet<String>()
        var osCount = 0

        fun tryAdd(entry: SquadEntry, enforceOsCap: Boolean): Boolean {
            if (picked.size >= 11 || entry.player.id in pickedIds) return false
            if (enforceOsCap && entry.player.overseas && osCount >= 4) return false
            picked += entry
            pickedIds += entry.player.id
            if (entry.player.overseas) osCount++
            return true
        }

        // 1. Pick at most 1 WK first
        sorted.firstOrNull { it.player.role == PlayerRole.WK && !it.player.overseas }
            ?.let { tryAdd(it, true) }
            ?: sorted.firstOrNull { it.player.role == PlayerRole.WK }?.let { tryAdd(it, true) }

        // 2. Pick up to 5 bowling options (domestic priority if needed to preserve OS slots)
        for (entry in sorted) {
            if (picked.count { it.player.canBowl } >= 5) break
            if (entry.player.canBowl) {
                tryAdd(entry, enforceOsCap = true)
            }
        }

        // 3. Fill remaining slots up to 11 respecting overseas <= 4
        for (entry in sorted) {
            if (picked.size == 11) break
            tryAdd(entry, enforceOsCap = true)
        }

        // 4. Final fallback if squad lacks domestic players to stay <= 4 overseas
        if (picked.size < 11) {
            for (entry in sorted) {
                if (picked.size == 11) break
                tryAdd(entry, enforceOsCap = false)
            }
        }
        return picked
    }

    private fun buildProjectedXI(players: List<SquadEntry>): ProjectedXI {
        val ordered = players.sortedWith(
            compareBy<SquadEntry> { roleSortOrder(it.player.role) }
                .thenByDescending { it.player.rating }
        )
        val captain = players.maxWithOrNull(
            compareBy<SquadEntry> { it.player.rating }
                .thenBy { it.player.stats.batting.matches }
        )
        return ProjectedXI(
            players = ordered,
            captain = captain,
            keeperCount = players.count { it.player.role == PlayerRole.WK },
            bowlingOptionsCount = players.count { it.player.canBowl },
            overseasCount = players.count { it.player.overseas }
        )
    }

    private fun roleSortOrder(role: PlayerRole): Int = when (role) {
        PlayerRole.BAT -> 0
        PlayerRole.WK -> 1
        PlayerRole.AR -> 2
        PlayerRole.BOWL -> 3
    }

    fun computeSquadRating(
        squad: List<SquadEntry>,
        projectedXI: ProjectedXI,
        minSquadSize: Int = 12
    ): SquadRatingBreakdown {
        if (squad.isEmpty() || projectedXI.players.isEmpty()) {
            return SquadRatingBreakdown(
                totalRating = 0,
                bestXIAverage = 0.0,
                depthAverage = 0.0,
                balanceScore = 0.0,
                penaltiesApplied = listOf("Empty squad")
            )
        }

        val xiAvg = projectedXI.players.map { it.player.rating }.average()

        val xiIds = projectedXI.players.mapTo(HashSet()) { it.player.id }
        val benchTop5 = squad
            .filterNot { it.player.id in xiIds }
            .sortedByDescending { it.player.rating }
            .take(5)
        val benchSum = benchTop5.sumOf { it.player.rating.toDouble() } +
            (5 - benchTop5.size).coerceAtLeast(0) * 45.0
        val depthAvg = benchSum / 5.0

        var balance = 100.0
        val penalties = mutableListOf<String>()

        if (projectedXI.keeperCount == 0) {
            balance -= 25.0
            penalties += "No wicketkeeper (-25)"
        } else if (projectedXI.keeperCount > 1) {
            balance -= 10.0
            penalties += "Extra keeper in XI (-10)"
        }

        if (projectedXI.bowlingOptionsCount < 5) {
            val short = 5 - projectedXI.bowlingOptionsCount
            val pen = short * 15.0
            balance -= pen
            penalties += "Only ${projectedXI.bowlingOptionsCount} bowling options (-${pen.toInt()})"
        }

        if (projectedXI.overseasCount > 4) {
            balance -= 20.0
            penalties += "Over 4 overseas in XI (-20)"
        }

        if (squad.size < minSquadSize) {
            balance -= 10.0
            penalties += "Under minimum squad ($minSquadSize) (-10)"
        }

        balance = balance.coerceIn(0.0, 100.0)
        val composite = (0.70 * xiAvg + 0.15 * depthAvg + 0.15 * balance)
            .roundToInt()
            .coerceIn(0, 100)

        return SquadRatingBreakdown(
            totalRating = composite,
            bestXIAverage = xiAvg,
            depthAverage = depthAvg,
            balanceScore = balance,
            penaltiesApplied = penalties
        )
    }
}
