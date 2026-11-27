import playersJson from "./players.json";
import { players as rosterPlayers, type Player } from "./roster";
import type { BroadcastPlayer } from "../types/auction";

function deriveInitials(name: string): string {
  const parts = name.replace(/\./g, " ").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "HT";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function normalizePlayer(p: Player): BroadcastPlayer {
  const photoUrl = p.photoUrl || `/players/${p.slug}.jpg`;
  return {
    ...p,
    photoUrl,
    initials: deriveInitials(p.name),
  };
}

// Prefer typed roster.ts and fall back to players.json if needed
const SOURCE_ROSTER: Player[] = rosterPlayers.length > 0 ? rosterPlayers : (playersJson as Player[]);

export const ALL_PLAYERS: BroadcastPlayer[] = SOURCE_ROSTER
  .slice()
  .sort((a, b) => a.lotNumber - b.lotNumber)
  .map(normalizePlayer);

/** Balanced 24-player curated deck (Marquee + top Capped/Uncapped stars across all 4 roles) */
export const CURATED_CHALLENGE_PLAYERS: BroadcastPlayer[] = [
  ...ALL_PLAYERS.filter((p) => p.category === "Marquee").slice(0, 10),
  ...ALL_PLAYERS.filter((p) => p.category === "Capped" && p.role === "All-Rounder").slice(0, 4),
  ...ALL_PLAYERS.filter((p) => p.category === "Capped" && p.role === "Bowler").slice(0, 4),
  ...ALL_PLAYERS.filter((p) => p.category === "Capped" && p.role === "WK-Batter").slice(0, 3),
  ...ALL_PLAYERS.filter((p) => p.category === "Uncapped").slice(0, 3),
];
