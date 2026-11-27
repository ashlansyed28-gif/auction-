import type { BroadcastPlayer, FriendTeam, JerseyTheme, PlayerRole, TeamScorecard } from "../types/auction";

export const JERSEY_THEMES: JerseyTheme[] = [
  {
    id: "csk",
    code: "CSK",
    label: "Gold & Navy",
    franchiseName: "Clutch Squad Knights",
    primary: "#F2B705",
    secondary: "#1B2A49",
    accent: "#FDE68A",
    stripe: "#D97706",
    glow: "rgba(242, 183, 5, 0.45)",
    spotlight: "rgba(242, 183, 5, 0.28)",
  },
  {
    id: "mbi",
    code: "MBI",
    label: "Royal Blue",
    franchiseName: "Moneyball Icons",
    primary: "#1F6FEB",
    secondary: "#0F1E3D",
    accent: "#9CC9FF",
    stripe: "#1D4ED8",
    glow: "rgba(31, 111, 235, 0.45)",
    spotlight: "rgba(59, 130, 246, 0.28)",
  },
  {
    id: "rcb",
    code: "RCB",
    label: "Crimson & Obsidian",
    franchiseName: "Raging Chasers Brigade",
    primary: "#D62839",
    secondary: "#1A1A1D",
    accent: "#FCA5A5",
    stripe: "#991B1B",
    glow: "rgba(214, 40, 57, 0.45)",
    spotlight: "rgba(225, 29, 72, 0.28)",
  },
  {
    id: "krc",
    code: "KRC",
    label: "Purple & Gold",
    franchiseName: "Knight Riders Club",
    primary: "#6A3FA0",
    secondary: "#1E1036",
    accent: "#D4AF37",
    stripe: "#581C87",
    glow: "rgba(106, 63, 160, 0.45)",
    spotlight: "rgba(168, 85, 247, 0.28)",
  },
  {
    id: "ddc",
    code: "DDC",
    label: "Electric Blue & Red",
    franchiseName: "Daredevil Contenders",
    primary: "#1E4FD8",
    secondary: "#3B0A18",
    accent: "#FB7185",
    stripe: "#E63946",
    glow: "rgba(30, 79, 216, 0.45)",
    spotlight: "rgba(59, 130, 246, 0.28)",
  },
  {
    id: "srh",
    code: "SRH",
    label: "Blaze Orange",
    franchiseName: "Super Riser Heat",
    primary: "#F26B1D",
    secondary: "#2B2B2B",
    accent: "#FDE047",
    stripe: "#C2410C",
    glow: "rgba(242, 107, 29, 0.45)",
    spotlight: "rgba(249, 115, 22, 0.28)",
  },
  {
    id: "rrg",
    code: "RRG",
    label: "Magenta & Indigo",
    franchiseName: "Royal Renegades",
    primary: "#E5379B",
    secondary: "#1D3A8A",
    accent: "#FBCFE8",
    stripe: "#BE185D",
    glow: "rgba(229, 55, 155, 0.45)",
    spotlight: "rgba(236, 72, 153, 0.28)",
  },
  {
    id: "pbk",
    code: "PBK",
    label: "Scarlet & Silver",
    franchiseName: "Pure Blitz Kings",
    primary: "#C8102E",
    secondary: "#27272A",
    accent: "#E2E8F0",
    stripe: "#9F1239",
    glow: "rgba(200, 16, 46, 0.45)",
    spotlight: "rgba(225, 29, 72, 0.28)",
  },
  {
    id: "gpt",
    code: "GPT",
    label: "Navy & Teal",
    franchiseName: "Gameplan Titans",
    primary: "#2EC4B6",
    secondary: "#14213D",
    accent: "#99F6E4",
    stripe: "#0F766E",
    glow: "rgba(46, 196, 182, 0.45)",
    spotlight: "rgba(20, 184, 166, 0.28)",
  },
  {
    id: "lsg",
    code: "LSG",
    label: "Emerald & Tangerine",
    franchiseName: "Lucky Striker Gangs",
    primary: "#0FA3B1",
    secondary: "#064E3B",
    accent: "#FF8C42",
    stripe: "#047857",
    glow: "rgba(15, 163, 177, 0.45)",
    spotlight: "rgba(16, 185, 129, 0.28)",
  },
];

export function generateRoomCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export const DEFAULT_TEAM_NAMES = JERSEY_THEMES.map((t) => t.franchiseName);

/** Formats ₹ Cr values cleanly in Indian English Lakhs and Crores. */
export function formatLakhsCrores(amountCr: number): string {
  const safe = Math.max(0, Math.round(amountCr * 100) / 100);
  if (safe < 1) {
    const lakhs = Math.round(safe * 100);
    return `${lakhs} ${lakhs === 1 ? "Lakh" : "Lakhs"}`;
  }
  return `${safe.toFixed(2)} ${Math.abs(safe - 1) < 0.001 ? "Crore" : "Crores"}`;
}

/** Compact currency readout for purse chips (e.g. ₹78.40 Cr or ₹60 L). */
export function formatCompactPurse(amountCr: number): string {
  const safe = Math.max(0, Math.round(amountCr * 100) / 100);
  if (safe < 1) {
    return `₹${Math.round(safe * 100)} L`;
  }
  return `₹${safe.toFixed(2)} Cr`;
}

export function roundToTenLakhs(value: number): number {
  return Math.max(0.2, Math.round(value * 10) / 10);
}

/**
 * Dynamic T20 bid step ladder in Lakhs & Crores:
 * - Under ₹1 Cr: +₹20 Lakhs (0.20 Cr)
 * - ₹1 Cr to ₹5 Cr: +₹25 Lakhs (0.25 Cr)
 * - ₹5 Cr to ₹15 Cr: +₹50 Lakhs (0.50 Cr)
 * - Above ₹15 Cr: +₹1.00 Crore (1.00 Cr)
 */
export function nextBidIncrementCr(currentBidCr: number): number {
  if (currentBidCr < 1.0) return 0.2;
  if (currentBidCr < 5.0) return 0.25;
  if (currentBidCr < 15.0) return 0.5;
  return 1.0;
}

export function formatIncrementTag(incCr: number): string {
  if (incCr < 1.0) return `+${Math.round(incCr * 100)}L`;
  return `+${incCr.toFixed(0)}Cr`;
}

export function computeFairValueCr(player: BroadcastPlayer, purseCr = 80): number {
  const norm = Math.max(0, player.ovr - 50) / 49;
  const base = 0.25 + Math.pow(norm, 2.15) * 18.5;
  const roleMult = player.role === "All-Rounder" ? 1.1 : player.role === "WK-Batter" ? 1.05 : 1.0;
  return roundToTenLakhs(base * roleMult * (purseCr / 80));
}

export interface EligibilityResult {
  canBid: boolean;
  nextBidCr: number;
  reason: string | null;
}

export function checkTeamBidEligibility(
  team: FriendTeam,
  player: BroadcastPlayer | null,
  currentBidCr: number | null,
  highestBidderId: string | null,
  minSquadSize: number,
  maxSquadSize: number,
  maxOverseas: number,
): EligibilityResult {
  if (!player) {
    return { canBid: false, nextBidCr: 0, reason: "No active lot" };
  }
  const proposedBidCr =
    currentBidCr === null
      ? player.basePriceCr
      : Math.round((currentBidCr + nextBidIncrementCr(currentBidCr)) * 100) / 100;

  if (highestBidderId === team.id) {
    return { canBid: false, nextBidCr: proposedBidCr, reason: "Leading bid" };
  }
  if (team.squad.length >= maxSquadSize) {
    return { canBid: false, nextBidCr: proposedBidCr, reason: `Squad full (${maxSquadSize}/${maxSquadSize})` };
  }
  const osCount = team.squad.filter((s) => Boolean(s.player.overseas)).length;
  if (player.overseas && osCount >= maxOverseas) {
    return { canBid: false, nextBidCr: proposedBidCr, reason: `Overseas cap (${maxOverseas})` };
  }
  const slotsAfter = Math.max(0, minSquadSize - (team.squad.length + 1));
  const reserveCr = slotsAfter * 0.25;
  if (team.purseRemainingCr - proposedBidCr < reserveCr - 1e-6) {
    return {
      canBid: false,
      nextBidCr: proposedBidCr,
      reason: slotsAfter > 0 ? `Reserve ₹${reserveCr.toFixed(2)} Cr for ${slotsAfter} slot(s)` : "Insufficient purse",
    };
  }
  return { canBid: true, nextBidCr: proposedBidCr, reason: null };
}

export function evaluateFriendScorecard(
  team: FriendTeam,
  minSquadSize: number,
): TeamScorecard {
  const squad = team.squad;
  const totalSpentCr = squad.reduce((acc, s) => acc + s.paidCr, 0);
  const roleCounts: Record<PlayerRole, number> = {
    Batter: 0,
    "WK-Batter": 0,
    "All-Rounder": 0,
    Bowler: 0,
  };
  let overseasCount = 0;
  for (const s of squad) {
    roleCounts[s.player.role] += 1;
    if (s.player.overseas) overseasCount += 1;
  }

  const avgRating = squad.length
    ? squad.reduce((acc, s) => acc + s.player.ovr, 0) / squad.length
    : 0;

  let balanceScore = 100;
  const warnings: string[] = [];
  if (squad.length === 0) {
    balanceScore = 0;
    warnings.push("No players signed");
  } else {
    if (roleCounts["WK-Batter"] === 0) {
      balanceScore -= 18;
      warnings.push("Missing a Wicketkeeper");
    }
    if (roleCounts.Bowler + roleCounts["All-Rounder"] < Math.min(4, Math.ceil(squad.length * 0.4))) {
      balanceScore -= 15;
      warnings.push("Light on bowling depth");
    }
    if (squad.length < minSquadSize) {
      balanceScore -= Math.min(35, (minSquadSize - squad.length) * 6);
      warnings.push(`Under min squad (${squad.length}/${minSquadSize})`);
    }
  }
  balanceScore = Math.max(0, Math.min(100, balanceScore));

  const squadRating = squad.length
    ? Math.max(1, Math.min(100, Math.round(avgRating * 0.72 + balanceScore * 0.28)))
    : 0;

  let biggestSteal: TeamScorecard["biggestSteal"] = null;
  let biggestStealDeltaCr = -1e9;
  let biggestOverpay: TeamScorecard["biggestOverpay"] = null;
  let biggestOverpayDeltaCr = -1e9;

  for (const s of squad) {
    const stealDelta = s.fairValueCr - s.paidCr;
    if (stealDelta > biggestStealDeltaCr) {
      biggestStealDeltaCr = stealDelta;
      biggestSteal = s;
    }
    const overDelta = s.paidCr - s.fairValueCr;
    if (overDelta > biggestOverpayDeltaCr) {
      biggestOverpayDeltaCr = overDelta;
      biggestOverpay = s;
    }
  }

  const mvp = [...squad].sort((a, b) => b.player.ovr - a.player.ovr)[0] || null;

  return {
    team,
    totalSpentCr,
    purseLeftCr: team.purseRemainingCr,
    squadRating,
    avgRating,
    balanceScore,
    overseasCount,
    roleCounts,
    biggestSteal,
    biggestStealDeltaCr: biggestSteal ? biggestStealDeltaCr : 0,
    biggestOverpay,
    biggestOverpayDeltaCr: biggestOverpay ? biggestOverpayDeltaCr : 0,
    mvp,
    warnings,
  };
}
