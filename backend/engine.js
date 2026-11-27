// Pure deterministic T20 Cricket Auction Engine (mirrors Kotlin domain/engine)

export const TEAM_CATALOG = [
  { code: "CSK", name: "Clutch Squad Knights", primary: "#F2B705", secondary: "#1B2A49", persona: 'Vikram "The Anchor" Rao', defaultBotStyle: "BALANCED" },
  { code: "MBI", name: "Moneyball Icons", primary: "#1F6FEB", secondary: "#9CC9FF", persona: "Dr. Rhea Menon", defaultBotStyle: "SNIPER" },
  { code: "RCB", name: "Raging Chasers Brigade", primary: "#D62839", secondary: "#1A1A1D", persona: 'Kabir "Blitz" Gill', defaultBotStyle: "AGGRESSIVE" },
  { code: "KRC", name: "Knight Riders Club", primary: "#6A3FA0", secondary: "#D4AF37", persona: "Meera Sen", defaultBotStyle: "BALANCED" },
  { code: "DDC", name: "Daredevil Contenders", primary: "#1E4FD8", secondary: "#E63946", persona: "Arjun Khanna", defaultBotStyle: "AGGRESSIVE" },
  { code: "SRH", name: "Super Riser Heat", primary: "#F26B1D", secondary: "#2B2B2B", persona: "Tariq Varma", defaultBotStyle: "SNIPER" },
  { code: "RRG", name: "Royal Renegades", primary: "#E5379B", secondary: "#1D3A8A", persona: "Devika Rathore", defaultBotStyle: "BALANCED" },
  { code: "PBK", name: "Pure Blitz Kings", primary: "#C8102E", secondary: "#C0C6CE", persona: "Harpreet Brar", defaultBotStyle: "AGGRESSIVE" },
  { code: "GPT", name: "Gameplan Titans", primary: "#14213D", secondary: "#2EC4B6", persona: "Nikhil Patel", defaultBotStyle: "SNIPER" },
  { code: "LSG", name: "Lucky Striker Gangs", primary: "#0FA3B1", secondary: "#FF8C42", persona: "Sana Qureshi", defaultBotStyle: "BALANCED" },
];

export const TEAM_BY_CODE = Object.fromEntries(TEAM_CATALOG.map((t) => [t.code, t]));

export const SET_DESCRIPTORS = {
  1: { setNumber: 1, title: "Marquee Stars", subtitle: "Franchise cornerstones & headline icons", expectedCount: 15 },
  2: { setNumber: 2, title: "Power Batters & Openers", subtitle: "Top-order tone setters & boundary hitters", expectedCount: 25 },
  3: { setNumber: 3, title: "All-Rounders & Finishers", subtitle: "Multi-skill match-winners & late-overs closers", expectedCount: 25 },
  4: { setNumber: 4, title: "Spin Arsenal", subtitle: "Wrist-spinners, mystery tweakers & middle-overs strangle", expectedCount: 20 },
  5: { setNumber: 5, title: "Pace & Death-Over Merchants", subtitle: "Express speed, swing & pinpoint yorkers", expectedCount: 25 },
  6: { setNumber: 6, title: "Uncapped & Wildcard Chaos", subtitle: "Teen prodigies, cult heroes & high-upside punts", expectedCount: 30 },
  7: { setNumber: 7, title: "GOATs & Vintage Legends", subtitle: "Hall-of-fame titans from golden T20 eras", expectedCount: 25 },
};

export const BOT_STYLES = ["AGGRESSIVE", "SNIPER", "BALANCED"];

export const AuctionPhase = {
  SET_INTRO: "SET_INTRO",
  LOT_REVEAL: "LOT_REVEAL",
  BIDDING: "BIDDING",
  HAMMER_SOLD: "HAMMER_SOLD",
  HAMMER_UNSOLD: "HAMMER_UNSOLD",
  RTM_DECISION: "RTM_DECISION",
  RTM_COUNTER_RAISE: "RTM_COUNTER_RAISE",
  RTM_FINAL_MATCH: "RTM_FINAL_MATCH",
  ACCELERATED_INTRO: "ACCELERATED_INTRO",
  COMPLETED: "COMPLETED",
};

export const TIMINGS = {
  SET_INTRO_MS: 2200,
  LOT_REVEAL_MS: 900,
  STANDARD_INITIAL_BID_MS: 10000,
  STANDARD_RESET_BID_MS: 7000,
  ACCELERATED_INITIAL_BID_MS: 6000,
  ACCELERATED_RESET_BID_MS: 4000,
  GOING_ONCE_MS: 3000,
  GOING_TWICE_MS: 2000,
  RTM_DECISION_MS: 8000,
  SOLD_AFTERMATH_MS: 1800,
  UNSOLD_AFTERMATH_MS: 1500,
};

export function formatCr(amountCr) {
  const safe = Math.abs(amountCr) < 0.0001 ? 0 : amountCr;
  return `₹${safe.toFixed(2)} Cr`;
}

export function formatCompactCr(amountCr) {
  const safe = Math.abs(amountCr) < 0.0001 ? 0 : amountCr;
  return `${safe.toFixed(2)} Cr`;
}

export function roundToQuarterCr(value) {
  return Math.max(0.25, Math.round(value * 4) / 4);
}

export function computeFairValueCr(player, purseCr = 100.0) {
  const normalized = Math.max(0, player.rating - 50) / 49.0;
  const rawBase = 0.25 + Math.pow(normalized, 2.2) * 21.75;
  let roleMult = 1.0;
  if (player.role === "AR") roleMult = 1.1;
  else if (player.role === "WK") roleMult = 1.05;
  else if (player.role === "BOWL" && player.subRole === "SPIN") roleMult = 0.95;
  return roundToQuarterCr(rawBase * roleMult * (purseCr / 100.0));
}

export function effectiveBasePriceCr(basePrice100Cr, purseCr) {
  const scale = purseCr >= 55.0 && purseCr <= 65.0 ? 0.6 : 1.0;
  return roundToQuarterCr(basePrice100Cr * scale);
}

export function acceleratedBasePriceCr(effectiveBaseCr) {
  return roundToQuarterCr(effectiveBaseCr * 0.75);
}

export function incrementForCurrentBid(currentBidCr) {
  if (currentBidCr < 5.0) return 0.25;
  if (currentBidCr < 15.0) return 0.5;
  return 1.0;
}

export function canPlayerBowl(player) {
  return player.role === "BOWL" || player.role === "AR" || (player.stats?.bowling?.wickets ?? 0) >= 20;
}

// Deterministic Mulberry32 PRNG
export function createRng(seed) {
  let a = (Number(seed) >>> 0) || 1;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(bound) {
      return Math.floor(this.next() * bound);
    },
    nextRange(min, maxInclusive) {
      return min + Math.floor(this.next() * (maxInclusive - min + 1));
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = this.nextInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    },
  };
}

export function createDefaultConfig() {
  return {
    purseCr: 100.0,
    minSquadSize: 12,
    maxSquadSize: 18,
    maxOverseas: 6,
    rtmCardsPerTeam: 2,
    setOrderMode: "STANDARD", // STANDARD | REVERSE_VINTAGE | CUSTOM
    customSetOrder: [1, 2, 3, 4, 5, 6, 7],
    seed: 2026,
    teamAssignments: TEAM_CATALOG.map((t) => ({
      teamCode: t.code,
      isHuman: t.code === "CSK",
      botStyle: t.defaultBotStyle,
      botPersonaName: t.persona,
    })),
  };
}

export function resolvedSetOrder(config) {
  if (config.setOrderMode === "REVERSE_VINTAGE") return [7, 1, 2, 3, 4, 5, 6];
  if (config.setOrderMode === "CUSTOM" && config.customSetOrder?.length) {
    return [...new Set(config.customSetOrder)];
  }
  return [1, 2, 3, 4, 5, 6, 7];
}

export function teamCounts(team) {
  const squad = team.squad || [];
  let overseasCount = 0;
  let keeperCount = 0;
  let spinnerCount = 0;
  let paceCount = 0;
  let openerCount = 0;
  for (const entry of squad) {
    const p = entry.player;
    if (p.overseas) overseasCount++;
    if (p.role === "WK") keeperCount++;
    if (p.subRole === "SPIN" || p.subRole === "SPIN_AR") spinnerCount++;
    if (p.subRole === "PACE" || p.subRole === "DEATH_SPECIALIST" || p.subRole === "PACE_AR") paceCount++;
    if (p.subRole === "OPENER") openerCount++;
  }
  return { squadCount: squad.length, overseasCount, keeperCount, spinnerCount, paceCount, openerCount };
}

export function maxBidAllowedCr(team, minSquadSize) {
  const slotsAfter = Math.max(0, minSquadSize - (team.squad.length + 1));
  return Math.max(0, team.purseRemainingCr - slotsAfter * 0.25);
}

class CommentaryEngine {
  constructor(rng) {
    this.rng = rng;
    this.seq = 0;
  }
  line(event, text, highlights = []) {
    return { id: ++this.seq, event, text, highlights };
  }
  setIntro(title, count) {
    return this.line("SET_INFO", `Next up: ${title} (${count} players in the bag).`, [title]);
  }
  lotOpen(lotNum, player, baseCr) {
    return this.line("LOT_OPEN", `Lot #${lotNum}: ${player.name} (${player.styleTag}) enters at ${formatCr(baseCr)}.`, [player.name, formatCr(baseCr)]);
  }
  bid(player, team, amountCr, isJump) {
    const verb = isJump ? "leaps in at" : "raises the paddle to";
    return this.line("BID", `${team.code} ${verb} ${formatCr(amountCr)} for ${player.name}.`, [team.code, formatCr(amountCr)]);
  }
  duel(player, codeA, codeB, amountCr) {
    return this.line("DUEL", `Two-horse slugfest! ${codeA} and ${codeB} battle at ${formatCr(amountCr)} for ${player.name}.`, [codeA, codeB, formatCr(amountCr)]);
  }
  goingOnce(leader, priceCr) {
    return this.line("FINAL_CALL", `Going once to ${leader} at ${formatCr(priceCr)}...`, [leader, formatCr(priceCr)]);
  }
  goingTwice(leader, priceCr) {
    return this.line("FINAL_CALL", `Going twice to ${leader} at ${formatCr(priceCr)} — any final raise?`, [leader, formatCr(priceCr)]);
  }
  sold(player, teamCode, priceCr, fairValue, viaRtm) {
    const tag = viaRtm ? "via RTM" : "at the hammer";
    const verdict = priceCr <= fairValue * 0.85 ? "Steal of the round!" : priceCr >= fairValue * 1.35 ? "Huge statement buy!" : "Clinical acquisition.";
    return this.line("SOLD", `SOLD! ${player.name} joins ${teamCode} ${tag} for ${formatCr(priceCr)}. ${verdict}`, [teamCode, formatCr(priceCr), player.name]);
  }
  unsold(player, isAccel) {
    const tail = isAccel ? "exits the auction unsold." : "moves to the Accelerated Unsold pool.";
    return this.line("UNSOLD", `UNSOLD — ${player.name} ${tail}`, [player.name]);
  }
  rtm(player, former, detail, priceCr) {
    return this.line("RTM", `RTM DRAMA! ${former} holds Right To Match for ${player.name} (${detail}, ${formatCr(priceCr)}).`, [former, player.name, formatCr(priceCr)]);
  }
}

class BotController {
  constructor(config) {
    this.config = config;
    this.seed = config.seed;
    const rng = createRng(config.seed ^ 0x5a17c0de);
    this.styleMults = {};
    for (const a of config.teamAssignments) {
      let min = 0.9, max = 1.1;
      if (a.botStyle === "AGGRESSIVE") { min = 1.15; max = 1.35; }
      else if (a.botStyle === "SNIPER") { min = 1.0; max = 1.15; }
      this.styleMults[a.teamCode] = min + rng.next() * (max - min);
    }
    this.plans = {};
  }

  prepareForLot(lotNumber, player, effectiveBaseCr, teamsByCode, lotStartMs) {
    this.plans = {};
    const fairValue = computeFairValueCr(player, this.config.purseCr);
    for (const a of this.config.teamAssignments) {
      if (a.isHuman) continue;
      const team = teamsByCode[a.teamCode];
      if (!team) continue;
      const lotRng = createRng(this.seed + lotNumber * 1009 + TEAM_CATALOG.findIndex((t) => t.code === a.teamCode) * 37);
      const baseMult = this.styleMults[a.teamCode] || 1.0;
      const needFactor = this.computeNeedFactor(a.botStyle, team, player);
      const scarcityFactor = this.computePurseScarcity(team, effectiveBaseCr);
      const noiseFactor = 0.92 + lotRng.next() * 0.16;

      let capFrac = 0.24;
      if (a.botStyle === "AGGRESSIVE") capFrac = 0.30;
      else if (a.botStyle === "SNIPER") capFrac = 0.22;

      const maxByShare = roundToQuarterCr(team.purseRemainingCr * capFrac);
      const maxByReserve = maxBidAllowedCr(team, this.config.minSquadSize);
      const vintageBonus = player.set === 7 ? 1.15 : 1.0;
      const desiredMax = Math.max(effectiveBaseCr, roundToQuarterCr(fairValue * baseMult * needFactor * scarcityFactor * noiseFactor * vintageBonus));
      const cappedMax = Math.min(desiredMax, Math.max(effectiveBaseCr, maxByShare), maxByReserve);

      const isBluffing = lotRng.next() < 0.10;
      let minR = 900, maxR = 2200, jumpChance = 0.0;
      if (a.botStyle === "AGGRESSIVE") { minR = 600; maxR = 1400; jumpChance = 0.15; }
      else if (a.botStyle === "SNIPER") { minR = 350; maxR = 850; jumpChance = 0.0; }

      const initialDelay = a.botStyle === "SNIPER" ? Number.MAX_SAFE_INTEGER : lotStartMs + lotRng.nextRange(minR, maxR);
      this.plans[a.teamCode] = {
        teamCode: a.teamCode,
        style: a.botStyle,
        maxWillingnessCr: cappedMax,
        jumpChance,
        reactionMinMs: minR,
        reactionMaxMs: maxR,
        isBluffing,
        bluffUsed: false,
        sniperStrikesUsed: 0,
        nextActionAtMs: initialDelay,
      };
    }
  }

  onBidPlaced(nowMs, lotNumber, biddingTeam) {
    const lotRng = createRng(this.seed + lotNumber * 3001 + nowMs);
    for (const [code, plan] of Object.entries(this.plans)) {
      if (code === biddingTeam) {
        plan.nextActionAtMs = Number.MAX_SAFE_INTEGER;
      } else if (plan.style !== "SNIPER") {
        plan.nextActionAtMs = nowMs + lotRng.nextRange(plan.reactionMinMs, plan.reactionMaxMs);
      } else if (plan.sniperStrikesUsed < 2) {
        plan.nextActionAtMs = nowMs + lotRng.nextRange(plan.reactionMinMs, plan.reactionMaxMs);
      }
    }
  }

  pollReadyBotBid(nowMs, remainingMs, lotNumber, nextStandardBidCr, highestBidder, canBidCheck) {
    const candidates = [];
    const rng = createRng(this.seed + lotNumber * 7919 + nowMs);
    for (const plan of Object.values(this.plans)) {
      if (plan.teamCode === highestBidder) continue;
      if (plan.style === "SNIPER") {
        if (remainingMs > 2500 || plan.sniperStrikesUsed >= 2) continue;
        if (plan.nextActionAtMs === Number.MAX_SAFE_INTEGER) {
          plan.nextActionAtMs = nowMs + rng.nextRange(plan.reactionMinMs, plan.reactionMaxMs);
          continue;
        }
      }
      if (nowMs < plan.nextActionAtMs) continue;
      if (!canBidCheck(plan.teamCode, nextStandardBidCr)) {
        plan.nextActionAtMs = Number.MAX_SAFE_INTEGER;
        continue;
      }
      const canAfford = nextStandardBidCr <= plan.maxWillingnessCr + 1e-6;
      const canBluff = !canAfford && plan.isBluffing && !plan.bluffUsed && nextStandardBidCr <= plan.maxWillingnessCr + 1.0;
      if (!canAfford && !canBluff) {
        plan.nextActionAtMs = Number.MAX_SAFE_INTEGER;
        continue;
      }
      if (canBluff) plan.bluffUsed = true;
      if (plan.style === "SNIPER") plan.sniperStrikesUsed++;

      const jumpPrice = nextStandardBidCr + incrementForCurrentBid(nextStandardBidCr);
      const jump = plan.jumpChance > 0 && rng.next() < plan.jumpChance && canBidCheck(plan.teamCode, jumpPrice) && jumpPrice <= plan.maxWillingnessCr + 1e-6;
      candidates.push({ teamCode: plan.teamCode, jumpBid: jump });
    }
    if (!candidates.length) return null;
    return candidates[rng.nextInt(candidates.length)];
  }

  shouldBotUseRtm(teamCode, priceCr, team) {
    const plan = this.plans[teamCode];
    if (!plan) return false;
    return priceCr <= maxBidAllowedCr(team, this.config.minSquadSize) + 1e-6 && priceCr <= plan.maxWillingnessCr * 1.05 + 1e-6;
  }

  shouldBotCounterRaiseRtm(teamCode, raisedCr, team) {
    const plan = this.plans[teamCode];
    if (!plan) return false;
    return raisedCr <= maxBidAllowedCr(team, this.config.minSquadSize) + 1e-6 && raisedCr <= plan.maxWillingnessCr + 1e-6;
  }

  computeNeedFactor(style, team, player) {
    if (style !== "BALANCED") return 1.0;
    const c = teamCounts(team);
    const lacks =
      (player.role === "WK" && c.keeperCount === 0) ||
      ((player.subRole === "SPIN" || player.subRole === "SPIN_AR") && c.spinnerCount === 0) ||
      ((player.subRole === "PACE" || player.subRole === "DEATH_SPECIALIST" || player.subRole === "PACE_AR") && c.paceCount < 2) ||
      (player.subRole === "OPENER" && c.openerCount === 0);
    const saturated =
      (player.role === "WK" && c.keeperCount >= 2) ||
      ((player.subRole === "SPIN" || player.subRole === "SPIN_AR") && c.spinnerCount >= 3) ||
      ((player.subRole === "PACE" || player.subRole === "DEATH_SPECIALIST") && c.paceCount >= 5) ||
      (player.subRole === "OPENER" && c.openerCount >= 3);
    if (lacks) return 1.2;
    if (saturated) return 0.7;
    return 1.0;
  }

  computePurseScarcity(team, baseCr) {
    const slotsLeft = Math.max(1, this.config.minSquadSize - team.squad.length);
    const avg = team.purseRemainingCr / slotsLeft;
    if (avg < baseCr * 1.15) return 0.72;
    if (avg < baseCr * 1.6) return 0.85;
    return 1.0;
  }
}

export class AuctionEngine {
  constructor(allPlayers, config, nowProvider = () => Date.now()) {
    this.allPlayers = allPlayers;
    this.playerById = Object.fromEntries(allPlayers.map((p) => [p.id, p]));
    this.config = config;
    this.nowProvider = nowProvider;
    this.rng = createRng(config.seed);
    this.commentary = new CommentaryEngine(createRng(config.seed ^ 0x1337beef));
    this.botController = new BotController(config);

    this.teams = {};
    this.mainQueue = [];
    this.acceleratedQueue = [];
    this.unsoldPool = [];
    this.finalUnsoldPool = [];
    this.soldRecords = [];
    this.isAcceleratedRound = false;
    this.currentQueueIndex = 0;
    this.phase = AuctionPhase.SET_INTRO;
    this.currentBidCr = null;
    this.highestBidder = null;
    this.rtmState = null;
    this.lotBidHistory = [];
    this.consecutiveDuelCount = 0;
    this.duelTeams = null;

    this.lotDeadlineMs = 0;
    this.phaseDeadlineMs = 0;
    this.lastTickMs = nowProvider();
    this.lotStartMs = this.lastTickMs;
    this.lastSetNumberSeen = -1;
    this.goingOnceFired = false;
    this.goingTwiceFired = false;
    this.lastBotRtmActAtMs = 0;
    this.latestCommentary = null;
    this.commentaryHistory = [];
    this.pendingEvents = [];

    this.initFreshAuction();
  }

  initFreshAuction() {
    for (const a of this.config.teamAssignments) {
      const meta = TEAM_BY_CODE[a.teamCode];
      this.teams[a.teamCode] = {
        team: meta,
        assignment: a,
        purseRemainingCr: this.config.purseCr,
        rtmRemaining: this.config.rtmCardsPerTeam,
        squad: [],
      };
    }
    const grouped = {};
    for (const p of this.allPlayers) {
      (grouped[p.set] ||= []).push(p);
    }
    for (const setNum of resolvedSetOrder(this.config)) {
      const list = [...(grouped[setNum] || [])];
      createRng(this.config.seed + setNum * 997).shuffle(list);
      this.mainQueue.push(...list);
    }
    this.startCurrentLot(this.nowProvider());
  }

  toSnapshot() {
    const now = this.nowProvider();
    const activeQ = this.isAcceleratedRound ? this.acceleratedQueue : this.mainQueue;
    return {
      config: this.config,
      queueIds: activeQ.map((p) => p.id),
      currentQueueIndex: this.currentQueueIndex,
      isAcceleratedRound: this.isAcceleratedRound,
      unsoldIds: this.unsoldPool.map((p) => p.id),
      finalUnsoldIds: this.finalUnsoldPool.map((p) => p.id),
      teams: this.teamStates(),
      phase: this.phase,
      currentBidCr: this.currentBidCr,
      highestBidder: this.highestBidder,
      lotBidHistory: [...this.lotBidHistory],
      consecutiveDuelCount: this.consecutiveDuelCount,
      duelTeams: this.duelTeams ? [...this.duelTeams] : [],
      lotRemainingMs: Math.max(0, this.lotDeadlineMs - now),
      phaseRemainingMs: Math.max(0, this.phaseDeadlineMs - now),
      rtmState: this.rtmState,
      soldRecords: [...this.soldRecords],
      currentSetNumber: this.lastSetNumberSeen,
    };
  }

  restoreFromSnapshot(snap) {
    this.teams = {};
    for (const t of snap.teams) this.teams[t.team.code] = t;
    this.isAcceleratedRound = snap.isAcceleratedRound;
    this.currentQueueIndex = snap.currentQueueIndex;
    this.phase = snap.phase;
    this.currentBidCr = snap.currentBidCr;
    this.highestBidder = snap.highestBidder;
    this.rtmState = snap.rtmState;
    this.unsoldPool = (snap.unsoldIds || []).map((id) => this.playerById[id]).filter(Boolean);
    this.finalUnsoldPool = (snap.finalUnsoldIds || []).map((id) => this.playerById[id]).filter(Boolean);
    this.soldRecords = [...(snap.soldRecords || [])];
    this.lotBidHistory = [...(snap.lotBidHistory || [])];
    this.consecutiveDuelCount = snap.consecutiveDuelCount || 0;
    this.duelTeams = snap.duelTeams?.length === 2 ? [...snap.duelTeams] : null;

    const q = (snap.queueIds || []).map((id) => this.playerById[id]).filter(Boolean);
    if (this.isAcceleratedRound) this.acceleratedQueue = q;
    else this.mainQueue = q;

    const now = this.nowProvider();
    this.lastTickMs = now;
    this.lotStartMs = now;
    this.lotDeadlineMs = now + (snap.lotRemainingMs || 0);
    this.phaseDeadlineMs = now + (snap.phaseRemainingMs || 0);
    this.lastSetNumberSeen = snap.currentSetNumber ?? -1;

    const p = this.currentPlayerOrNull();
    if (p) {
      this.botController.prepareForLot(this.currentLotNumber(), p, this.currentEffectiveBasePriceCr(), this.teams, now);
    }
  }

  drainEvents() {
    if (!this.pendingEvents.length) return [];
    const copy = [...this.pendingEvents];
    this.pendingEvents = [];
    return copy;
  }

  activeQueueSize() {
    return this.isAcceleratedRound ? this.acceleratedQueue.length : this.mainQueue.length;
  }

  currentLotNumber() {
    return Math.min(Math.max(1, this.activeQueueSize()), this.currentQueueIndex + 1);
  }

  currentPlayerOrNull() {
    const q = this.isAcceleratedRound ? this.acceleratedQueue : this.mainQueue;
    return q[this.currentQueueIndex] || null;
  }

  currentEffectiveBasePriceCr() {
    const p = this.currentPlayerOrNull();
    if (!p) return 0.25;
    const scaled = effectiveBasePriceCr(p.basePriceCr, this.config.purseCr);
    return this.isAcceleratedRound ? acceleratedBasePriceCr(scaled) : scaled;
  }

  nextBidAmountCr() {
    if (this.currentBidCr == null) return this.currentEffectiveBasePriceCr();
    return this.currentBidCr + incrementForCurrentBid(this.currentBidCr);
  }

  bidRemainingMs(now = this.nowProvider()) {
    return this.phase === AuctionPhase.BIDDING ? Math.max(0, this.lotDeadlineMs - now) : 0;
  }

  phaseRemainingMs(now = this.nowProvider()) {
    return Math.max(0, this.phaseDeadlineMs - now);
  }

  teamStates() {
    return this.config.teamAssignments.map((a) => this.teams[a.teamCode]).filter(Boolean);
  }

  checkBidEligibility(teamCode, proposedBidCr = this.nextBidAmountCr()) {
    if (this.phase !== AuctionPhase.BIDDING) return { canBid: false, nextBidCr: proposedBidCr, blockReason: "Bidding closed" };
    const player = this.currentPlayerOrNull();
    if (!player) return { canBid: false, nextBidCr: proposedBidCr, blockReason: "No active lot" };
    const team = this.teams[teamCode];
    if (!team) return { canBid: false, nextBidCr: proposedBidCr, blockReason: "Unknown team" };

    if (this.highestBidder === teamCode) return { canBid: false, nextBidCr: proposedBidCr, blockReason: "Already highest bidder" };
    const c = teamCounts(team);
    if (c.squadCount >= this.config.maxSquadSize) return { canBid: false, nextBidCr: proposedBidCr, blockReason: `Squad full (${this.config.maxSquadSize}/${this.config.maxSquadSize})` };
    if (player.overseas && c.overseasCount >= this.config.maxOverseas) return { canBid: false, nextBidCr: proposedBidCr, blockReason: `Overseas limit (${this.config.maxOverseas}/${this.config.maxOverseas})` };

    const slotsAfter = Math.max(0, this.config.minSquadSize - (c.squadCount + 1));
    const reserve = slotsAfter * 0.25;
    if (team.purseRemainingCr - proposedBidCr < reserve - 1e-6) {
      const reason = slotsAfter > 0
        ? `Reserve needed for ${slotsAfter} more ${slotsAfter === 1 ? "player" : "players"}`
        : "Insufficient purse";
      return { canBid: false, nextBidCr: proposedBidCr, blockReason: reason };
    }
    return { canBid: true, nextBidCr: proposedBidCr, blockReason: null };
  }

  placeHumanBid(teamCode) {
    const team = this.teams[teamCode];
    if (!team || !team.assignment.isHuman) return false;
    return this.placeBidInternal(teamCode, this.nextBidAmountCr(), false, true);
  }

  hostSkipCurrentStage() {
    const now = this.nowProvider();
    if (this.phase === AuctionPhase.SET_INTRO || this.phase === AuctionPhase.ACCELERATED_INTRO) {
      this.enterLotReveal(now);
    } else if (this.phase === AuctionPhase.LOT_REVEAL) {
      this.enterBidding(now);
    } else if (this.phase === AuctionPhase.BIDDING) {
      this.lotDeadlineMs = now;
      this.handleBiddingTimeout(now);
    } else if (this.phase === AuctionPhase.HAMMER_SOLD || this.phase === AuctionPhase.HAMMER_UNSOLD) {
      this.advanceToNextLot(now);
    }
  }

  submitRtmDecision(useRtm) {
    if (this.phase !== AuctionPhase.RTM_DECISION || !this.rtmState) return false;
    const state = this.rtmState;
    const player = this.currentPlayerOrNull();
    if (!player) return false;
    const now = this.nowProvider();

    if (!useRtm) {
      this.rtmState = { ...state, outcomeLabel: "RTM DECLINED" };
      this.finalizeSale(player, state.winningTeam, state.originalBidCr, false, now);
      return true;
    }

    this.consumeRtmCard(state.formerTeam);
    const counterRaiseCr = state.originalBidCr + incrementForCurrentBid(state.originalBidCr);
    const winnerTeam = this.teams[state.winningTeam];
    if (counterRaiseCr > maxBidAllowedCr(winnerTeam, this.config.minSquadSize) + 1e-6) {
      this.rtmState = { ...state, outcomeLabel: "MATCHED" };
      this.finalizeSale(player, state.formerTeam, state.originalBidCr, true, now);
      return true;
    }

    this.phase = AuctionPhase.RTM_COUNTER_RAISE;
    this.phaseDeadlineMs = now + TIMINGS.RTM_DECISION_MS;
    this.lastBotRtmActAtMs = now + this.rng.nextRange(1100, 2400);
    this.rtmState = { ...state, counterRaiseBidCr: counterRaiseCr, stageDeadlineMs: this.phaseDeadlineMs };
    this.emitCommentary(this.commentary.rtm(player, state.formerTeam, `${state.winningTeam} may raise once`, counterRaiseCr));
    return true;
  }

  submitRtmCounterRaise(raisePrice) {
    if (this.phase !== AuctionPhase.RTM_COUNTER_RAISE || !this.rtmState) return false;
    const state = this.rtmState;
    const player = this.currentPlayerOrNull();
    if (!player) return false;
    const now = this.nowProvider();

    if (!raisePrice) {
      this.rtmState = { ...state, outcomeLabel: "MATCHED" };
      this.finalizeSale(player, state.formerTeam, state.originalBidCr, true, now);
      return true;
    }

    const raisedCr = state.counterRaiseBidCr;
    const formerTeam = this.teams[state.formerTeam];
    if (raisedCr > maxBidAllowedCr(formerTeam, this.config.minSquadSize) + 1e-6) {
      this.rtmState = { ...state, outcomeLabel: "RTM DECLINED" };
      this.finalizeSale(player, state.winningTeam, raisedCr, false, now);
      return true;
    }

    this.phase = AuctionPhase.RTM_FINAL_MATCH;
    this.phaseDeadlineMs = now + TIMINGS.RTM_DECISION_MS;
    this.lastBotRtmActAtMs = now + this.rng.nextRange(1100, 2400);
    this.rtmState = { ...state, stageDeadlineMs: this.phaseDeadlineMs };
    this.emitCommentary(this.commentary.rtm(player, state.formerTeam, `${state.formerTeam} final match call`, raisedCr));
    return true;
  }

  submitRtmFinalMatch(matchRaise) {
    if (this.phase !== AuctionPhase.RTM_FINAL_MATCH || !this.rtmState) return false;
    const state = this.rtmState;
    const player = this.currentPlayerOrNull();
    if (!player) return false;
    const raisedCr = state.counterRaiseBidCr ?? state.originalBidCr;
    const now = this.nowProvider();

    if (matchRaise) {
      this.rtmState = { ...state, outcomeLabel: "MATCHED" };
      this.finalizeSale(player, state.formerTeam, raisedCr, true, now);
    } else {
      this.rtmState = { ...state, outcomeLabel: "RTM DECLINED" };
      this.finalizeSale(player, state.winningTeam, raisedCr, false, now);
    }
    return true;
  }

  tick() {
    const now = this.nowProvider();
    if (now < this.lastTickMs) {
      this.lastTickMs = now;
      return;
    }
    this.lastTickMs = now;

    if (this.phase === AuctionPhase.SET_INTRO || this.phase === AuctionPhase.ACCELERATED_INTRO) {
      if (now >= this.phaseDeadlineMs) this.enterLotReveal(now);
    } else if (this.phase === AuctionPhase.LOT_REVEAL) {
      if (now >= this.phaseDeadlineMs) this.enterBidding(now);
    } else if (this.phase === AuctionPhase.BIDDING) {
      const rem = this.lotDeadlineMs - now;
      if (rem <= 0) {
        this.handleBiddingTimeout(now);
        return;
      }
      this.checkFinalCallLadder(rem);
      this.pollBotBid(now, rem);
    } else if (this.phase === AuctionPhase.RTM_DECISION && this.rtmState) {
      const formerHuman = this.teams[this.rtmState.formerTeam]?.assignment.isHuman;
      if (!formerHuman && now >= this.lastBotRtmActAtMs) {
        this.submitRtmDecision(this.botController.shouldBotUseRtm(this.rtmState.formerTeam, this.rtmState.originalBidCr, this.teams[this.rtmState.formerTeam]));
      } else if (now >= this.phaseDeadlineMs) {
        this.submitRtmDecision(false);
      }
    } else if (this.phase === AuctionPhase.RTM_COUNTER_RAISE && this.rtmState) {
      const winnerHuman = this.teams[this.rtmState.winningTeam]?.assignment.isHuman;
      if (!winnerHuman && now >= this.lastBotRtmActAtMs) {
        const raised = this.rtmState.counterRaiseBidCr ?? this.rtmState.originalBidCr;
        this.submitRtmCounterRaise(this.botController.shouldBotCounterRaiseRtm(this.rtmState.winningTeam, raised, this.teams[this.rtmState.winningTeam]));
      } else if (now >= this.phaseDeadlineMs) {
        this.submitRtmCounterRaise(false);
      }
    } else if (this.phase === AuctionPhase.RTM_FINAL_MATCH && this.rtmState) {
      const formerHuman = this.teams[this.rtmState.formerTeam]?.assignment.isHuman;
      if (!formerHuman && now >= this.lastBotRtmActAtMs) {
        const raised = this.rtmState.counterRaiseBidCr ?? this.rtmState.originalBidCr;
        this.submitRtmFinalMatch(this.botController.shouldBotUseRtm(this.rtmState.formerTeam, raised, this.teams[this.rtmState.formerTeam]));
      } else if (now >= this.phaseDeadlineMs) {
        this.submitRtmFinalMatch(false);
      }
    } else if (this.phase === AuctionPhase.HAMMER_SOLD || this.phase === AuctionPhase.HAMMER_UNSOLD) {
      if (now >= this.phaseDeadlineMs) this.advanceToNextLot(now);
    }
  }

  startCurrentLot(nowMs) {
    if (this.areAllTeamsFull()) {
      this.completeAuction();
      return;
    }
    const player = this.currentPlayerOrNull();
    if (!player) {
      if (!this.isAcceleratedRound && this.unsoldPool.length > 0) {
        this.startAcceleratedRound(nowMs);
      } else {
        this.completeAuction();
      }
      return;
    }

    this.currentBidCr = null;
    this.highestBidder = null;
    this.rtmState = null;
    this.lotBidHistory = [];
    this.consecutiveDuelCount = 0;
    this.duelTeams = null;
    this.goingOnceFired = false;
    this.goingTwiceFired = false;

    if (!this.isAcceleratedRound && player.set !== this.lastSetNumberSeen) {
      this.lastSetNumberSeen = player.set;
      const desc = SET_DESCRIPTORS[player.set] || { title: `Set ${player.set}` };
      const count = this.mainQueue.filter((p) => p.set === player.set).length;
      this.phase = AuctionPhase.SET_INTRO;
      this.phaseDeadlineMs = nowMs + TIMINGS.SET_INTRO_MS;
      this.emitCommentary(this.commentary.setIntro(desc.title, count));
      this.pendingEvents.push({ type: "SET_INTRO", setNumber: player.set, title: desc.title, count });
    } else {
      this.enterLotReveal(nowMs);
    }
  }

  startAcceleratedRound(nowMs) {
    this.isAcceleratedRound = true;
    this.acceleratedQueue = [...this.unsoldPool];
    this.unsoldPool = [];
    this.currentQueueIndex = 0;
    if (!this.acceleratedQueue.length) {
      this.completeAuction();
      return;
    }
    this.phase = AuctionPhase.ACCELERATED_INTRO;
    this.phaseDeadlineMs = nowMs + TIMINGS.SET_INTRO_MS;
    this.emitCommentary(this.commentary.setIntro("Accelerated Unsold Round", this.acceleratedQueue.length));
    this.pendingEvents.push({ type: "SET_INTRO", setNumber: 0, title: "Accelerated Unsold Round", count: this.acceleratedQueue.length });
  }

  enterLotReveal(nowMs) {
    const player = this.currentPlayerOrNull();
    if (!player) return this.completeAuction();
    const baseCr = this.currentEffectiveBasePriceCr();
    this.phase = AuctionPhase.LOT_REVEAL;
    this.phaseDeadlineMs = nowMs + TIMINGS.LOT_REVEAL_MS;
    this.lotStartMs = nowMs;
    this.botController.prepareForLot(this.currentLotNumber(), player, baseCr, this.teams, nowMs);
    this.emitCommentary(this.commentary.lotOpen(this.currentLotNumber(), player, baseCr));
    this.pendingEvents.push({ type: "LOT_REVEALED", player, baseCr });
  }

  enterBidding(nowMs) {
    const dur = this.isAcceleratedRound ? TIMINGS.ACCELERATED_INITIAL_BID_MS : TIMINGS.STANDARD_INITIAL_BID_MS;
    this.phase = AuctionPhase.BIDDING;
    this.lotDeadlineMs = nowMs + dur;
    this.lotStartMs = nowMs;
  }

  pollBotBid(nowMs, remainingMs) {
    const nextStd = this.nextBidAmountCr();
    const intent = this.botController.pollReadyBotBid(
      nowMs,
      remainingMs,
      this.currentLotNumber(),
      nextStd,
      this.highestBidder,
      (code, amt) => this.checkBidEligibility(code, amt).canBid
    );
    if (!intent) return;
    const amount = intent.jumpBid ? nextStd + incrementForCurrentBid(nextStd) : nextStd;
    this.placeBidInternal(intent.teamCode, amount, intent.jumpBid, false);
  }

  placeBidInternal(teamCode, amountCr, isJumpBid, isHuman) {
    if (!this.checkBidEligibility(teamCode, amountCr).canBid) return false;
    const player = this.currentPlayerOrNull();
    if (!player) return false;
    const now = this.nowProvider();
    const resetDur = this.isAcceleratedRound ? TIMINGS.ACCELERATED_RESET_BID_MS : TIMINGS.STANDARD_RESET_BID_MS;
    const rem = Math.max(0, this.lotDeadlineMs - now);
    this.lotDeadlineMs = now + Math.max(rem, resetDur);
    if (this.lotDeadlineMs - now > TIMINGS.GOING_ONCE_MS) {
      this.goingOnceFired = false;
      this.goingTwiceFired = false;
    }

    this.currentBidCr = amountCr;
    this.highestBidder = teamCode;
    const ev = { teamCode, amountCr, elapsedLotMs: Math.max(0, now - this.lotStartMs), isJumpBid, isHuman };
    this.lotBidHistory.push(ev);
    this.updateDuelTracking();
    this.botController.onBidPlaced(now, this.currentLotNumber(), teamCode);

    const isDuel = this.consecutiveDuelCount >= 3 && this.duelTeams;
    if (isDuel) {
      this.emitCommentary(this.commentary.duel(player, this.duelTeams[0], this.duelTeams[1], amountCr));
    } else {
      this.emitCommentary(this.commentary.bid(player, { code: teamCode }, amountCr, isJumpBid));
    }
    this.pendingEvents.push({ type: "BID_ACCEPTED", bid: ev, isDuel: Boolean(isDuel) });
    return true;
  }

  updateDuelTracking() {
    const n = this.lotBidHistory.length;
    if (n < 2) {
      this.consecutiveDuelCount = 0;
      this.duelTeams = null;
      return;
    }
    const last = this.lotBidHistory[n - 1].teamCode;
    const prev = this.lotBidHistory[n - 2].teamCode;
    if (last === prev) {
      this.consecutiveDuelCount = 0;
      this.duelTeams = null;
      return;
    }
    let count = 2;
    let i = n - 3;
    while (i >= 0) {
      const t = this.lotBidHistory[i].teamCode;
      if ((t === last || t === prev) && t !== this.lotBidHistory[i + 1].teamCode) {
        count++;
        i--;
      } else {
        break;
      }
    }
    this.consecutiveDuelCount = count;
    this.duelTeams = count >= 3 ? [prev, last] : null;
  }

  checkFinalCallLadder(remMs) {
    const leader = this.highestBidder || "the floor";
    const price = this.currentBidCr ?? this.currentEffectiveBasePriceCr();
    if (remMs <= TIMINGS.GOING_TWICE_MS && !this.goingTwiceFired) {
      this.goingTwiceFired = true;
      this.goingOnceFired = true;
      if (this.highestBidder) this.emitCommentary(this.commentary.goingTwice(leader, price));
      this.pendingEvents.push({ type: "FINAL_CALL", stage: 2 });
    } else if (remMs <= TIMINGS.GOING_ONCE_MS && !this.goingOnceFired) {
      this.goingOnceFired = true;
      if (this.highestBidder) this.emitCommentary(this.commentary.goingOnce(leader, price));
      this.pendingEvents.push({ type: "FINAL_CALL", stage: 1 });
    }
  }

  handleBiddingTimeout(nowMs) {
    const player = this.currentPlayerOrNull();
    if (!player) return;
    const winner = this.highestBidder;
    const finalPrice = this.currentBidCr;
    if (!winner || finalPrice == null) {
      if (this.isAcceleratedRound) this.finalUnsoldPool.push(player);
      else this.unsoldPool.push(player);
      this.phase = AuctionPhase.HAMMER_UNSOLD;
      this.phaseDeadlineMs = nowMs + TIMINGS.UNSOLD_AFTERMATH_MS;
      this.emitCommentary(this.commentary.unsold(player, this.isAcceleratedRound));
      this.pendingEvents.push({ type: "HAMMER_UNSOLD", player, isAccelerated: this.isAcceleratedRound });
      return;
    }

    const former = player.formerTeam;
    if (former && former !== winner && this.canTeamExerciseRtm(former, player, finalPrice)) {
      this.phase = AuctionPhase.RTM_DECISION;
      this.phaseDeadlineMs = nowMs + TIMINGS.RTM_DECISION_MS;
      this.lastBotRtmActAtMs = nowMs + this.rng.nextRange(1100, 2400);
      this.rtmState = { winningTeam: winner, formerTeam: former, originalBidCr: finalPrice, counterRaiseBidCr: null, stageDeadlineMs: this.phaseDeadlineMs, outcomeLabel: null };
      this.emitCommentary(this.commentary.rtm(player, former, "8s decision window", finalPrice));
      this.pendingEvents.push({ type: "RTM_PROMPTED", rtmState: this.rtmState });
    } else {
      this.finalizeSale(player, winner, finalPrice, false, nowMs);
    }
  }

  canTeamExerciseRtm(former, player, priceCr) {
    const team = this.teams[former];
    if (!team || team.rtmRemaining <= 0) return false;
    const c = teamCounts(team);
    if (c.squadCount >= this.config.maxSquadSize) return false;
    if (player.overseas && c.overseasCount >= this.config.maxOverseas) return false;
    return priceCr <= maxBidAllowedCr(team, this.config.minSquadSize) + 1e-6;
  }

  consumeRtmCard(teamCode) {
    const t = this.teams[teamCode];
    if (t) t.rtmRemaining = Math.max(0, t.rtmRemaining - 1);
  }

  finalizeSale(player, winner, priceCr, viaRtm, nowMs) {
    const buyer = this.teams[winner];
    buyer.purseRemainingCr = Math.max(0, buyer.purseRemainingCr - priceCr);
    buyer.squad.push({
      player,
      paidCr: priceCr,
      boughtViaRtm: viaRtm,
      soldInSet: this.isAcceleratedRound ? 0 : player.set,
      lotNumber: this.currentLotNumber(),
    });
    const fair = computeFairValueCr(player, this.config.purseCr);
    const record = { playerId: player.id, playerName: player.name, teamCode: winner, priceCr, fairValueCr: fair, viaRtm, lotNumber: this.currentLotNumber() };
    this.soldRecords.push(record);
    this.phase = AuctionPhase.HAMMER_SOLD;
    this.phaseDeadlineMs = nowMs + TIMINGS.SOLD_AFTERMATH_MS;
    this.emitCommentary(this.commentary.sold(player, winner, priceCr, fair, viaRtm));
    this.pendingEvents.push({ type: "HAMMER_SOLD", record });
  }

  advanceToNextLot(nowMs) {
    if (this.areAllTeamsFull()) return this.completeAuction();
    this.currentQueueIndex++;
    const activeQ = this.isAcceleratedRound ? this.acceleratedQueue : this.mainQueue;
    if (this.currentQueueIndex >= activeQ.length) {
      if (!this.isAcceleratedRound && this.unsoldPool.length > 0) {
        this.startAcceleratedRound(nowMs);
      } else {
        this.completeAuction();
      }
    } else {
      this.startCurrentLot(nowMs);
    }
  }

  areAllTeamsFull() {
    return Object.values(this.teams).every((t) => t.squad.length >= this.config.maxSquadSize);
  }

  completeAuction() {
    const autoFillCount = this.performAutoFill();
    this.phase = AuctionPhase.COMPLETED;
    this.pendingEvents.push({ type: "AUCTION_COMPLETED", autoFillCount });
  }

  performAutoFill() {
    const sorted = [...this.finalUnsoldPool, ...this.unsoldPool].sort((a, b) => {
      const ca = effectiveBasePriceCr(a.basePriceCr, this.config.purseCr);
      const cb = effectiveBasePriceCr(b.basePriceCr, this.config.purseCr);
      if (ca !== cb) return ca - cb;
      if (a.overseas !== b.overseas) return a.overseas ? 1 : -1;
      return b.rating - a.rating;
    });

    let filled = 0;
    for (const a of this.config.teamAssignments) {
      const team = this.teams[a.teamCode];
      while (team.squad.length < this.config.minSquadSize && sorted.length > 0) {
        const c = teamCounts(team);
        const slotsAfter = Math.max(0, this.config.minSquadSize - (team.squad.length + 1));
        const maxAffordable = Math.max(0, team.purseRemainingCr - slotsAfter * 0.25 + 1e-6);

        let idx = sorted.findIndex((p) => {
          const cost = effectiveBasePriceCr(p.basePriceCr, this.config.purseCr);
          const osOk = !p.overseas || c.overseasCount < this.config.maxOverseas;
          return osOk && cost <= maxAffordable;
        });
        let emergencyCost = null;
        if (idx < 0 && maxAffordable >= 0.25 - 1e-6) {
          idx = sorted.findIndex((p) => !p.overseas || c.overseasCount < this.config.maxOverseas);
          if (idx >= 0) {
            const baseCost = effectiveBasePriceCr(sorted[idx].basePriceCr, this.config.purseCr);
            emergencyCost = Math.max(0.25, Math.min(baseCost, roundToQuarterCr(maxAffordable)));
          }
        }
        if (idx < 0) break;
        const picked = sorted.splice(idx, 1)[0];
        const cost = emergencyCost ?? effectiveBasePriceCr(picked.basePriceCr, this.config.purseCr);
        team.purseRemainingCr = Math.max(0, team.purseRemainingCr - cost);
        team.squad.push({ player: picked, paidCr: cost, boughtViaRtm: false, soldInSet: 0, lotNumber: 0 });
        filled++;
      }
    }
    return filled;
  }

  emitCommentary(line) {
    this.latestCommentary = line;
    this.commentaryHistory.push(line);
    if (this.commentaryHistory.length > 60) this.commentaryHistory.shift();
  }
}

export function selectBestXI(squad) {
  if (!squad || !squad.length) return { players: [], captain: null, keeperCount: 0, bowlingOptionsCount: 0, overseasCount: 0 };
  const sorted = [...squad].sort((a, b) => {
    if (b.player.rating !== a.player.rating) return b.player.rating - a.player.rating;
    const mb = b.player.stats?.batting?.matches ?? 0;
    const ma = a.player.stats?.batting?.matches ?? 0;
    if (mb !== ma) return mb - ma;
    return a.player.id.localeCompare(b.player.id);
  });
  if (sorted.length <= 11) return buildProjectedXI(sorted);

  const n = sorted.length;
  let bestScore = -1e9;
  let bestSel = null;
  const cur = [];

  function upperBound(start, left) {
    let s = 0;
    const end = Math.min(n, start + left);
    for (let i = start; i < end; i++) s += sorted[i].player.rating;
    return s;
  }

  function dfs(idx, sum, wk, bowl, os) {
    const left = 11 - cur.length;
    if (left === 0) {
      if (wk === 1 && bowl >= 5 && os <= 4 && sum > bestScore) {
        bestScore = sum;
        bestSel = [...cur];
      }
      return;
    }
    if (idx >= n || n - idx < left) return;
    if (sum + upperBound(idx, left) <= bestScore) return;
    if (wk > 1 || os > 4) return;

    const cand = sorted[idx];
    const isWk = cand.player.role === "WK";
    const isBowl = canPlayerBowl(cand.player);
    const isOs = cand.player.overseas;

    if (!(isWk && wk >= 1) && !(isOs && os >= 4)) {
      cur.push(cand);
      dfs(idx + 1, sum + cand.player.rating, wk + (isWk ? 1 : 0), bowl + (isBowl ? 1 : 0), os + (isOs ? 1 : 0));
      cur.pop();
    }
    dfs(idx + 1, sum, wk, bowl, os);
  }

  dfs(0, 0, 0, 0, 0);
  return buildProjectedXI(bestSel || fallbackXI(sorted));
}

function fallbackXI(sorted) {
  const picked = [];
  const ids = new Set();
  let os = 0;
  function tryAdd(entry, enforceOs) {
    if (picked.length >= 11 || ids.has(entry.player.id)) return false;
    if (enforceOs && entry.player.overseas && os >= 4) return false;
    picked.push(entry);
    ids.add(entry.player.id);
    if (entry.player.overseas) os++;
    return true;
  }
  const domWk = sorted.find((e) => e.player.role === "WK" && !e.player.overseas);
  if (domWk) tryAdd(domWk, true);
  else {
    const anyWk = sorted.find((e) => e.player.role === "WK");
    if (anyWk) tryAdd(anyWk, true);
  }
  for (const e of sorted) {
    if (picked.filter((x) => canPlayerBowl(x.player)).length >= 5) break;
    if (canPlayerBowl(e.player)) tryAdd(e, true);
  }
  for (const e of sorted) {
    if (picked.length >= 11) break;
    tryAdd(e, true);
  }
  for (const e of sorted) {
    if (picked.length >= 11) break;
    tryAdd(e, false);
  }
  return picked;
}

function buildProjectedXI(players) {
  const order = { BAT: 0, WK: 1, AR: 2, BOWL: 3 };
  const ordered = [...players].sort((a, b) => {
    const oa = order[a.player.role] ?? 9;
    const ob = order[b.player.role] ?? 9;
    if (oa !== ob) return oa - ob;
    return b.player.rating - a.player.rating;
  });
  const captain = [...players].sort((a, b) => b.player.rating - a.player.rating || (b.player.stats?.batting?.matches ?? 0) - (a.player.stats?.batting?.matches ?? 0))[0] || null;
  return {
    players: ordered,
    captain,
    keeperCount: players.filter((e) => e.player.role === "WK").length,
    bowlingOptionsCount: players.filter((e) => canPlayerBowl(e.player)).length,
    overseasCount: players.filter((e) => e.player.overseas).length,
  };
}

export function evaluateTeam(teamState, purseCr, minSquadSize = 12) {
  const squad = teamState.squad || [];
  const projectedXI = selectBestXI(squad);
  if (!squad.length || !projectedXI.players.length) {
    return {
      team: teamState.team,
      squadRating: { totalRating: 0, bestXIAverage: 0, depthAverage: 0, balanceScore: 0, penaltiesApplied: ["Empty squad"] },
      projectedXI,
      biggestSteal: null,
      biggestStealDeltaCr: 0,
      biggestOverpay: null,
      biggestOverpayDeltaCr: 0,
      vintageOrGoatPick: null,
      totalSpentCr: 0,
      purseLeftCr: teamState.purseRemainingCr,
    };
  }

  const xiAvg = projectedXI.players.reduce((s, e) => s + e.player.rating, 0) / projectedXI.players.length;
  const xiIds = new Set(projectedXI.players.map((e) => e.player.id));
  const benchTop5 = squad.filter((e) => !xiIds.has(e.player.id)).sort((a, b) => b.player.rating - a.player.rating).slice(0, 5);
  const benchSum = benchTop5.reduce((s, e) => s + e.player.rating, 0) + Math.max(0, 5 - benchTop5.length) * 45.0;
  const depthAvg = benchSum / 5.0;

  let balance = 100.0;
  const penalties = [];
  if (projectedXI.keeperCount === 0) { balance -= 25; penalties.push("No wicketkeeper (-25)"); }
  else if (projectedXI.keeperCount > 1) { balance -= 10; penalties.push("Extra keeper in XI (-10)"); }
  if (projectedXI.bowlingOptionsCount < 5) {
    const pen = (5 - projectedXI.bowlingOptionsCount) * 15;
    balance -= pen;
    penalties.push(`Only ${projectedXI.bowlingOptionsCount} bowling options (-${pen})`);
  }
  if (projectedXI.overseasCount > 4) { balance -= 20; penalties.push("Over 4 overseas in XI (-20)"); }
  if (squad.length < minSquadSize) { balance -= 10; penalties.push(`Under minimum squad (${minSquadSize}) (-10)`); }
  balance = Math.max(0, Math.min(100, balance));
  const totalRating = Math.max(0, Math.min(100, Math.round(0.7 * xiAvg + 0.15 * depthAvg + 0.15 * balance)));

  let steal = null, stealDelta = -1e9, overpay = null, overpayDelta = -1e9;
  for (const entry of squad) {
    const fair = computeFairValueCr(entry.player, purseCr);
    const sd = fair - entry.paidCr;
    if (sd > stealDelta) { stealDelta = sd; steal = entry; }
    const od = entry.paidCr - fair;
    if (od > overpayDelta) { overpayDelta = od; overpay = entry; }
  }
  const vintagePick = squad.filter((e) => e.player.vintage?.isVintage).sort((a, b) => b.player.rating - a.player.rating)[0] || null;
  const spent = squad.reduce((s, e) => s + e.paidCr, 0);

  return {
    team: teamState.team,
    squadRating: { totalRating, bestXIAverage: xiAvg, depthAverage: depthAvg, balanceScore: balance, penaltiesApplied: penalties },
    projectedXI,
    biggestSteal: steal,
    biggestStealDeltaCr: steal ? stealDelta : 0,
    biggestOverpay: overpay,
    biggestOverpayDeltaCr: overpay ? overpayDelta : 0,
    vintageOrGoatPick: vintagePick,
    totalSpentCr: spent,
    purseLeftCr: teamState.purseRemainingCr,
  };
}
