import type { Category, Player, Role } from "../data/roster";

export type JerseyKitId =
  | "csk"
  | "mbi"
  | "rcb"
  | "krc"
  | "ddc"
  | "srh"
  | "rrg"
  | "pbk"
  | "gpt"
  | "lsg";

export type PlayerRole = Role;
export type PlayerCategory = Category;

export interface AuthenticatedUser {
  userId: string;
  email: string;
  emailMasked: string;
  username: string;
  provider: "supabase" | "guest" | "local";
  verified: boolean;
}

export interface JerseyTheme {
  id: JerseyKitId;
  code: string;
  label: string;
  franchiseName: string;
  primary: string;
  secondary: string;
  accent: string;
  stripe: string;
  glow: string;
  spotlight: string;
}

export interface BroadcastPlayer extends Player {
  initials: string;
  overseas?: boolean;
}

export interface SquadSigning {
  player: BroadcastPlayer;
  paidCr: number;
  fairValueCr: number;
  lotNumber: number;
}

export interface FriendTeam {
  id: string;
  name: string;
  ownerName?: string;
  clientId?: string;
  connected?: boolean;
  kit: JerseyTheme;
  purseRemainingCr: number;
  initialPurseCr: number;
  squad: SquadSigning[];
}

export interface ChallengeConfig {
  roomTitle?: string;
  teamCount: number;
  membersPerTeam?: 2 | 3 | 4;
  purseCr: number;
  minSquadSize: number;
  maxSquadSize: number;
  maxOverseas: number;
  poolMode: "CURATED_24" | "FULL_165";
  teamNames: string[];
}

export interface TeamScorecard {
  team: FriendTeam;
  totalSpentCr: number;
  purseLeftCr: number;
  squadRating: number;
  avgRating: number;
  balanceScore: number;
  overseasCount: number;
  roleCounts: Record<PlayerRole, number>;
  biggestSteal: SquadSigning | null;
  biggestStealDeltaCr: number;
  biggestOverpay: SquadSigning | null;
  biggestOverpayDeltaCr: number;
  mvp: SquadSigning | null;
  warnings: string[];
}

export type RoomMode = "LOCAL" | "HOST" | "GUEST";
export type TeamMemberRole = "CAPTAIN" | "MEMBER" | "SPECTATOR";

export interface ConnectedMember {
  clientId: string;
  userId?: string;
  friendName: string;
  emailMasked?: string;
  kitId: JerseyKitId | null;
  teamRole: TeamMemberRole;
  joinedAt?: number;
  isHost: boolean;
  lastSeenAt: number;
}

export type TeamVoteChoice = "BID" | "PASS";

export interface TeamBidVote {
  clientId: string;
  username: string;
  choice: TeamVoteChoice;
  lotIdx: number;
  bidStepCount: number;
  updatedAt: number;
}

export interface RoomChatMessage {
  id: string;
  senderClientId: string;
  senderName: string;
  kitId: JerseyKitId | null;
  text: string;
  isSystem?: boolean;
  ts: number;
}

export interface RoomAuctionSnapshot {
  roomCode: string;
  hostClientId: string;
  version: number;
  screen: "LOBBY" | "STAGE" | "SCORECARD";
  config: ChallengeConfig;
  members: ConnectedMember[];
  teams: FriendTeam[];
  chatMessages: RoomChatMessage[];
  teamVotes: Record<string, Record<string, TeamBidVote>>;
  lotIdx: number;
  currentBidCr: number | null;
  highestBidderId: string | null;
  passedIds: string[];
  turnIndex: number;
  bidStepCount: number;
  lotBidderIds: string[];
  resolution: "BIDDING" | "FINAL_CALL" | "SOLD" | "UNSOLD";
  unsoldCount: number;
  updatedAt: number;
}
