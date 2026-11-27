import type {
  ConnectedMember,
  JerseyKitId,
  TeamBidVote,
} from "../types/auction";

export const USERNAME_REGEX = /^[A-Za-z0-9_]{3,16}$/;

export function sanitizeUsername(raw: string): string {
  return raw.trim().replace(/[^A-Za-z0-9_]/g, "").slice(0, 16);
}

export function validateSecureUsername(raw: string): { ok: true; username: string } | { ok: false; error: string } {
  const cleaned = raw.trim();
  if (!USERNAME_REGEX.test(cleaned)) {
    return {
      ok: false,
      error: "Username must be 3-16 characters (letters, numbers, and underscores only).",
    };
  }
  return { ok: true, username: cleaned };
}

export function validateEmailAddress(raw: string): boolean {
  const trimmed = raw.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIdx = trimmed.indexOf("@");
  if (atIdx <= 0) return "";
  const local = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***@${domain}`;
}

/**
 * Rebalances team roles so each active franchise has strictly ONE Captain
 * (promoting earliest member if captain left), while spectators remain SPECTATOR.
 */
export function normalizeTeamCaptains(members: ConnectedMember[]): ConnectedMember[] {
  const captainsByKit = new Map<JerseyKitId, string>();

  // Preserve existing valid captains first (earliest wins if duplicate ever occurs)
  for (const m of members) {
    if (m.kitId && m.teamRole === "CAPTAIN" && !captainsByKit.has(m.kitId)) {
      captainsByKit.set(m.kitId, m.clientId);
    }
  }

  // Assign a captain to any team that has members but no captain
  for (const m of members) {
    if (m.kitId && !captainsByKit.has(m.kitId)) {
      captainsByKit.set(m.kitId, m.clientId);
    }
  }

  return members.map((m) => {
    if (!m.kitId) {
      return { ...m, teamRole: "SPECTATOR" };
    }
    const captainId = captainsByKit.get(m.kitId);
    return {
      ...m,
      teamRole: captainId === m.clientId ? "CAPTAIN" : "MEMBER",
    };
  });
}

/**
 * Moves or adds a player into `targetKitId` (or Observe if null), enforcing
 * the `membersPerTeam` (2..4) cap and maintaining a single Captain per team.
 */
export function assignMemberToTeam(
  members: ConnectedMember[],
  incoming: Omit<ConnectedMember, "kitId" | "teamRole">,
  targetKitId: JerseyKitId | null,
  membersPerTeam: 2 | 3 | 4 = 4,
): { ok: true; members: ConnectedMember[] } | { ok: false; error: string } {
  const cap = Math.min(4, Math.max(2, membersPerTeam));
  const others = members.filter((m) => m.clientId !== incoming.clientId);

  if (targetKitId) {
    const currentInTarget = others.filter((m) => m.kitId === targetKitId);
    if (currentInTarget.length >= cap) {
      return {
        ok: false,
        error: `Team is full (${cap}/${cap} members). Pick another open seat or Observe.`,
      };
    }
    const hasCaptain = currentInTarget.some((m) => m.teamRole === "CAPTAIN");
    const nextMember: ConnectedMember = {
      ...incoming,
      kitId: targetKitId,
      teamRole: hasCaptain ? "MEMBER" : "CAPTAIN",
      joinedAt: incoming.joinedAt ?? Date.now(),
    };
    return { ok: true, members: normalizeTeamCaptains([...others, nextMember]) };
  }

  const spectator: ConnectedMember = {
    ...incoming,
    kitId: null,
    teamRole: "SPECTATOR",
    joinedAt: incoming.joinedAt ?? Date.now(),
  };
  return { ok: true, members: normalizeTeamCaptains([...others, spectator]) };
}

/**
 * Transfers the single Captain role on `kitId` to `targetClientId`.
 */
export function transferTeamCaptain(
  members: ConnectedMember[],
  kitId: JerseyKitId,
  targetClientId: string,
): ConnectedMember[] {
  const targetExists = members.some((m) => m.clientId === targetClientId && m.kitId === kitId);
  if (!targetExists) return members;

  return members.map((m) => {
    if (m.kitId !== kitId) return m;
    return {
      ...m,
      teamRole: m.clientId === targetClientId ? "CAPTAIN" : "MEMBER",
    };
  });
}

export function summarizeTeamVotes(
  teamVotes: Record<string, Record<string, TeamBidVote>> | undefined,
  teamId: string,
  lotIdx: number,
  bidStepCount: number,
): {
  bidCount: number;
  passCount: number;
  voters: TeamBidVote[];
} {
  const rawTeamVotes = teamVotes?.[teamId] || {};
  const voters = Object.values(rawTeamVotes).filter(
    (v) => v.lotIdx === lotIdx && v.bidStepCount === bidStepCount,
  );
  let bidCount = 0;
  let passCount = 0;
  for (const v of voters) {
    if (v.choice === "BID") bidCount += 1;
    else if (v.choice === "PASS") passCount += 1;
  }
  return { bidCount, passCount, voters };
}
