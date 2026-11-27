package com.hammertime.auction.state.engine

import com.hammertime.auction.model.AuctionConfig
import com.hammertime.auction.model.AuctionValuation
import com.hammertime.auction.model.BotStyle
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.PlayerRole
import com.hammertime.auction.model.PlayerSubRole
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.model.TeamState
import kotlin.random.Random

internal data class BotLotPlan(
    val teamCode: TeamCode,
    val style: BotStyle,
    val maxWillingnessCr: Double,
    val jumpChance: Double,
    val reactionMinMs: Long,
    val reactionMaxMs: Long,
    val isBluffing: Boolean,
    var bluffUsed: Boolean = false,
    var sniperStrikesUsed: Int = 0,
    var nextActionAtMs: Long = Long.MAX_VALUE
)

internal class BotController(
    private val config: AuctionConfig,
    private val seed: Long
) {
    private val personalityRng = Random(seed xor 0x5A17C0DEL)
    private val styleMultipliers: Map<TeamCode, Double> = config.teamAssignments.associate { assignment ->
        val range = when (assignment.botStyle) {
            BotStyle.AGGRESSIVE -> 1.15 to 1.35
            BotStyle.SNIPER -> 1.00 to 1.15
            BotStyle.BALANCED -> 0.90 to 1.10
        }
        val rolled = range.first + personalityRng.nextDouble() * (range.second - range.first)
        assignment.teamCode to rolled
    }

    private val plans = HashMap<TeamCode, BotLotPlan>()

    fun prepareForLot(
        lotNumber: Int,
        player: Player,
        effectiveBaseCr: Double,
        teams: Map<TeamCode, TeamState>,
        lotStartMs: Long
    ) {
        plans.clear()
        val fairValue = AuctionValuation.computeFairValueCr(player, config.purseCr)

        for (assignment in config.teamAssignments) {
            if (assignment.isHuman) continue
            val team = teams[assignment.teamCode] ?: continue
            val lotRng = Random(seed + lotNumber * 1009L + assignment.teamCode.ordinal * 37L)

            val baseMult = styleMultipliers[assignment.teamCode] ?: 1.0
            val needFactor = computeNeedFactor(assignment.botStyle, team, player)
            val purseScarcityFactor = computePurseScarcityFactor(team, effectiveBaseCr)
            val noiseFactor = 0.92 + lotRng.nextDouble() * 0.16 // +/- 8% imperfection

            val purseCapFraction = when (assignment.botStyle) {
                BotStyle.AGGRESSIVE -> 0.30
                BotStyle.SNIPER -> 0.22
                BotStyle.BALANCED -> 0.24
            }
            val maxByPurseShare = AuctionValuation.roundToQuarterCr(team.purseRemainingCr * purseCapFraction)
            val maxByReserve = team.maxBidAllowedCr(config.minSquadSize)

            val vintageBonus = if (player.set == 7) 1.15 else 1.0
            val desiredMax = AuctionValuation.roundToQuarterCr(
                fairValue * baseMult * needFactor * purseScarcityFactor * noiseFactor * vintageBonus
            ).coerceAtLeast(effectiveBaseCr)

            val cappedMax = minOf(desiredMax, maxByPurseShare.coerceAtLeast(effectiveBaseCr), maxByReserve)
            val isBluffing = lotRng.nextDouble() < 0.10

            val (minReact, maxReact, jumpChance) = when (assignment.botStyle) {
                BotStyle.AGGRESSIVE -> Triple(600L, 1400L, 0.15)
                BotStyle.SNIPER -> Triple(350L, 850L, 0.0)
                BotStyle.BALANCED -> Triple(900L, 2200L, 0.0)
            }

            val initialDelay = if (assignment.botStyle == BotStyle.SNIPER) {
                Long.MAX_VALUE // Sniper waits until timer <= 2500ms
            } else {
                lotStartMs + lotRng.nextLong(minReact, maxReact + 1L)
            }

            plans[assignment.teamCode] = BotLotPlan(
                teamCode = assignment.teamCode,
                style = assignment.botStyle,
                maxWillingnessCr = cappedMax,
                jumpChance = jumpChance,
                reactionMinMs = minReact,
                reactionMaxMs = maxReact,
                isBluffing = isBluffing,
                nextActionAtMs = initialDelay
            )
        }
    }

    fun onBidPlaced(
        nowMs: Long,
        lotNumber: Int,
        biddingTeam: TeamCode
    ) {
        val lotRng = Random(seed + lotNumber * 3001L + nowMs)
        for ((code, plan) in plans) {
            if (code == biddingTeam) {
                plan.nextActionAtMs = Long.MAX_VALUE
            } else if (plan.style != BotStyle.SNIPER) {
                val delay = lotRng.nextLong(plan.reactionMinMs, plan.reactionMaxMs + 1L)
                plan.nextActionAtMs = nowMs + delay
            } else {
                // Sniper re-arms for final 2.5s window (max 2 strikes)
                if (plan.sniperStrikesUsed < 2) {
                    plan.nextActionAtMs = nowMs + lotRng.nextLong(plan.reactionMinMs, plan.reactionMaxMs + 1L)
                }
            }
        }
    }

    data class BotBidIntent(val teamCode: TeamCode, val jumpBid: Boolean)

    fun pollReadyBotBid(
        nowMs: Long,
        remainingMs: Long,
        lotNumber: Int,
        nextStandardBidCr: Double,
        highestBidder: TeamCode?,
        canBidCheck: (TeamCode, Double) -> Boolean
    ): BotBidIntent? {
        val candidates = mutableListOf<BotBidIntent>()
        val rng = Random(seed + lotNumber * 7919L + nowMs)

        for (plan in plans.values) {
            if (plan.teamCode == highestBidder) continue

            if (plan.style == BotStyle.SNIPER) {
                if (remainingMs > 2500L || plan.sniperStrikesUsed >= 2) continue
                if (plan.nextActionAtMs == Long.MAX_VALUE) {
                    plan.nextActionAtMs = nowMs + rng.nextLong(plan.reactionMinMs, plan.reactionMaxMs + 1L)
                    continue
                }
            }

            if (nowMs < plan.nextActionAtMs) continue
            if (!canBidCheck(plan.teamCode, nextStandardBidCr)) {
                plan.nextActionAtMs = Long.MAX_VALUE
                continue
            }

            val canAffordValuation = nextStandardBidCr <= plan.maxWillingnessCr + 1e-6
            val canBluffNow = !canAffordValuation && plan.isBluffing && !plan.bluffUsed &&
                nextStandardBidCr <= plan.maxWillingnessCr + 1.0

            if (!canAffordValuation && !canBluffNow) {
                plan.nextActionAtMs = Long.MAX_VALUE
                continue
            }

            if (canBluffNow) {
                plan.bluffUsed = true
            }
            if (plan.style == BotStyle.SNIPER) {
                plan.sniperStrikesUsed++
            }

            val jump = plan.jumpChance > 0.0 &&
                rng.nextDouble() < plan.jumpChance &&
                canBidCheck(
                    plan.teamCode,
                    nextStandardBidCr + AuctionValuation.incrementForCurrentBid(nextStandardBidCr)
                ) &&
                (nextStandardBidCr + AuctionValuation.incrementForCurrentBid(nextStandardBidCr)) <=
                plan.maxWillingnessCr + 1e-6

            candidates += BotBidIntent(plan.teamCode, jumpBid = jump)
        }

        if (candidates.isEmpty()) return null
        return candidates[rng.nextInt(candidates.size)]
    }

    fun shouldBotUseRtm(teamCode: TeamCode, priceCr: Double, team: TeamState): Boolean {
        val plan = plans[teamCode] ?: return false
        val maxAllowed = team.maxBidAllowedCr(config.minSquadSize)
        return priceCr <= maxAllowed + 1e-6 && priceCr <= plan.maxWillingnessCr * 1.05 + 1e-6
    }

    fun shouldBotCounterRaiseRtm(teamCode: TeamCode, raisedPriceCr: Double, team: TeamState): Boolean {
        val plan = plans[teamCode] ?: return false
        val maxAllowed = team.maxBidAllowedCr(config.minSquadSize)
        return raisedPriceCr <= maxAllowed + 1e-6 && raisedPriceCr <= plan.maxWillingnessCr + 1e-6
    }

    private fun computeNeedFactor(style: BotStyle, team: TeamState, player: Player): Double {
        if (style != BotStyle.BALANCED) return 1.0
        val lacksRole = when {
            player.role == PlayerRole.WK && team.keeperCount == 0 -> true
            (player.subRole == PlayerSubRole.SPIN || player.subRole == PlayerSubRole.SPIN_AR) &&
                team.spinnerCount == 0 -> true
            (player.subRole == PlayerSubRole.PACE ||
                player.subRole == PlayerSubRole.DEATH_SPECIALIST ||
                player.subRole == PlayerSubRole.PACE_AR) && team.paceCount < 2 -> true
            player.subRole == PlayerSubRole.OPENER && team.openerCount == 0 -> true
            else -> false
        }
        val saturatedRole = when {
            player.role == PlayerRole.WK && team.keeperCount >= 2 -> true
            (player.subRole == PlayerSubRole.SPIN || player.subRole == PlayerSubRole.SPIN_AR) &&
                team.spinnerCount >= 3 -> true
            (player.subRole == PlayerSubRole.PACE ||
                player.subRole == PlayerSubRole.DEATH_SPECIALIST) && team.paceCount >= 5 -> true
            player.subRole == PlayerSubRole.OPENER && team.openerCount >= 3 -> true
            else -> false
        }
        return when {
            lacksRole -> 1.20
            saturatedRole -> 0.70
            else -> 1.0
        }
    }

    private fun computePurseScarcityFactor(team: TeamState, baseCr: Double): Double {
        val slotsLeftToMin = (config.minSquadSize - team.squadCount).coerceAtLeast(1)
        val avgPerSlot = team.purseRemainingCr / slotsLeftToMin
        return when {
            avgPerSlot < baseCr * 1.15 -> 0.72
            avgPerSlot < baseCr * 1.6 -> 0.85
            else -> 1.0
        }
    }
}
