import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuctionStage, type IncomingRoomCommand } from "./components/AuctionStage";
import { CustomRoomLobby } from "./components/CustomRoomLobby";
import { EmailAuthPanel } from "./components/EmailAuthPanel";
import { FinalScorecard } from "./components/FinalScorecard";
import { HomeModeHub } from "./components/HomeModeHub";
import { QuickMatchSetup, type QuickSubMode } from "./components/QuickMatchSetup";
import { SetupLobby, type LobbyTab } from "./components/SetupLobby";
import { SquadLineupHub } from "./components/SquadLineupHub";
import { TournamentHub } from "./components/TournamentHub";
import {
  BroadcastMatchView,
  type MatchControlMode,
} from "./components/match/BroadcastMatchView";
import { MatchPreGame } from "./components/match/MatchPreGame";
import { ALL_PLAYERS, CURATED_CHALLENGE_PLAYERS } from "./data/players";
import {
  createMatchState,
  resolveDelivery,
  type BotDifficulty,
  type BowlingLength,
  type BowlingLine,
  type MatchConfig,
  type MatchState,
  type MatchTeamLineup,
  type PitchCondition,
  type ShotType,
  type TimingGrade,
  type WicketRule,
} from "./engine/matchEngine";
import {
  buildLineupsFromAuctionTeams,
  computePointsTable,
  createTournament,
  recordTournamentMatchResult,
  simulateFixtureWithEngine,
  type TournamentFixture,
  type TournamentState,
} from "./engine/tournamentEngine";
import type {
  AuthenticatedUser,
  BroadcastPlayer,
  ChallengeConfig,
  ConnectedMember,
  FriendTeam,
  JerseyKitId,
  RoomAuctionSnapshot,
  RoomChatMessage,
  RoomEventBanner,
  RoomMode,
  TeamBidVote,
  TeamVoteChoice,
  ThemeMode,
} from "./types/auction";
import { DEFAULT_TEAM_NAMES, JERSEY_THEMES, generateRoomCode } from "./utils/auctionRules";
import {
  createGuestUser,
  getCurrentAuthUser,
  getSupabaseClient,
  onAuthStateChanged,
  signOutAuth,
} from "./utils/authService";
import {
  createRealtimeTransport,
  getOrCreateClientId,
  normalizeRoomCode,
  type OnlineQuickMatchSnapshot,
  type RealtimeRoomTransport,
  type RoomWireMessage,
} from "./utils/realtimeSync";
import {
  assignMemberToTeam,
  normalizeTeamCaptains,
  transferTeamCaptain,
} from "./utils/teamRoomHelpers";

type AppScreen =
  | "HOME"
  | "SETUP"
  | "STAGE"
  | "SCORECARD"
  | "LINEUP_HUB"
  | "TOURNAMENT"
  | "QUICK_SETUP"
  | "PREGAME"
  | "MATCH";

const PERSIST_KEY = "cbw_persisted_state_v1";
const THEME_KEY = "cbw_theme_mode";

const INITIAL_CONFIG: ChallengeConfig = {
  roomTitle: "CRICKET BID WARS • T20 ARENA",
  teamCount: 4,
  membersPerTeam: 4,
  purseCr: 80,
  minSquadSize: 4,
  maxSquadSize: 4,
  maxOverseas: 4,
  poolMode: "CURATED_24",
  teamNames: [...DEFAULT_TEAM_NAMES],
};

function buildTeamsFromConfig(config: ChallengeConfig, members: ConnectedMember[]): FriendTeam[] {
  const safeNames = Array.isArray(config?.teamNames) ? config.teamNames : DEFAULT_TEAM_NAMES;
  const safeMembers = Array.isArray(members) ? members : [];
  return JERSEY_THEMES.slice(0, config.teamCount || 4).map((kit, idx) => {
    const captain =
      safeMembers.find((m) => m.kitId === kit.id && m.teamRole === "CAPTAIN") ||
      safeMembers.find((m) => m.kitId === kit.id);
    return {
      id: `team-${kit.id}`,
      name: safeNames[idx] || kit.franchiseName || DEFAULT_TEAM_NAMES[idx],
      ownerName: captain?.friendName,
      clientId: captain?.clientId,
      connected: Boolean(captain),
      kit,
      purseRemainingCr: config.purseCr,
      initialPurseCr: config.purseCr,
      squad: [],
    };
  });
}

function getInviteRoomFromUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    const params = new URLSearchParams(window.location.search);
    return normalizeRoomCode(params.get("room") || "");
  } catch {
    return "";
  }
}

interface PersistedProgress {
  savedAuctionTeams?: FriendTeam[];
  tournament?: TournamentState | null;
}

function loadPersistedProgress(): PersistedProgress {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    return raw ? (JSON.parse(raw) as PersistedProgress) : {};
  } catch {
    return {};
  }
}

export function App() {
  const clientId = useMemo(() => getOrCreateClientId(), []);
  const inviteCode = useMemo(() => getInviteRoomFromUrl(), []);
  const supabaseConfigured = Boolean(getSupabaseClient());

  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  const [authLoading, setAuthLoading] = useState(supabaseConfigured);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [offlinePassPlayAllowed, setOfflinePassPlayAllowed] = useState(false);

  const [screen, setScreen] = useState<AppScreen>("HOME");
  const [lobbyTab, setLobbyTab] = useState<LobbyTab>(() => (inviteCode ? "JOIN" : "CREATE"));
  const [roomMode, setRoomMode] = useState<RoomMode>("HOST");
  const [inCustomRoom, setInCustomRoom] = useState(false);
  const [roomCode, setRoomCode] = useState<string>(() => generateRoomCode(6));
  const [selectedKitId, setSelectedKitId] = useState<JerseyKitId | null>("csk");
  const [config, setConfig] = useState<ChallengeConfig>(INITIAL_CONFIG);
  const [connectedMembers, setConnectedMembers] = useState<ConnectedMember[]>([]);
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [teamVotes, setTeamVotes] = useState<Record<string, Record<string, TeamBidVote>>>({});
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [eventBanner, setEventBanner] = useState<RoomEventBanner | null>(null);

  const [teams, setTeams] = useState<FriendTeam[]>(() => buildTeamsFromConfig(INITIAL_CONFIG, []));
  const [deck, setDeck] = useState<BroadcastPlayer[]>(CURATED_CHALLENGE_PLAYERS);
  const [unsoldCount, setUnsoldCount] = useState(0);
  const [sessionId, setSessionId] = useState(1);

  const [syncedSnapshot, setSyncedSnapshot] = useState<RoomAuctionSnapshot | null>(null);
  const [incomingCommand, setIncomingCommand] = useState<IncomingRoomCommand | null>(null);

  // Mode 1 Post-Auction (Step B Lineups & Step C Tournament) + Mode 2 Quick Match State
  const initialPersisted = useMemo(() => loadPersistedProgress(), []);
  const [savedAuctionTeams, setSavedAuctionTeams] = useState<FriendTeam[]>(
    () => initialPersisted.savedAuctionTeams || [],
  );
  const [draftLineups, setDraftLineups] = useState<MatchTeamLineup[]>([]);
  const [tournament, setTournament] = useState<TournamentState | null>(
    () => initialPersisted.tournament || null,
  );
  const [activeFixture, setActiveFixture] = useState<TournamentFixture | null>(null);

  const [quickSubMode, setQuickSubMode] = useState<QuickSubMode>("BOT");
  const [pendingPreGame, setPendingPreGame] = useState<{
    teamA: MatchTeamLineup;
    teamB: MatchTeamLineup;
    pitch: PitchCondition;
    wicketRule: WicketRule;
    botDifficulty: BotDifficulty;
    controlMode: MatchControlMode;
    fixtureLabel?: string;
    fixtureId?: string;
  } | null>(null);
  const [activeMatch, setActiveMatch] = useState<MatchState | null>(null);
  const [activeMatchControl, setActiveMatchControl] = useState<MatchControlMode>("VS_BOT");
  const [activeBotDifficulty, setActiveBotDifficulty] = useState<BotDifficulty>("Medium");

  // Online Friend Quick Match State
  const [qmRoomCode, setQmRoomCode] = useState<string | null>(null);
  const [qmSnapshot, setQmSnapshot] = useState<OnlineQuickMatchSnapshot | null>(null);
  const [qmIsHost, setQmIsHost] = useState(false);
  const [qmStatus, setQmStatus] = useState<string | null>(null);
  const [qmLeftNotice, setQmLeftNotice] = useState<string | null>(null);
  const qmTransportRef = useRef<RealtimeRoomTransport | null>(null);
  const qmSnapRef = useRef<OnlineQuickMatchSnapshot | null>(null);

  const transportRef = useRef<RealtimeRoomTransport | null>(null);
  const versionRef = useRef(1);
  const cmdSeqRef = useRef(1);
  const snapshotRef = useRef<RoomAuctionSnapshot | null>(null);
  const membersRef = useRef<ConnectedMember[]>([]);
  const chatRef = useRef<RoomChatMessage[]>([]);
  const votesRef = useRef<Record<string, Record<string, TeamBidVote>>>({});
  const configRef = useRef<ChallengeConfig>(INITIAL_CONFIG);
  const screenRef = useRef<AppScreen>(screen);

  configRef.current = config;
  screenRef.current = screen;

  // Persist tournament & last auction squads cleanly
  useEffect(() => {
    try {
      const payload: PersistedProgress = {
        savedAuctionTeams,
        tournament,
      };
      localStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
    } catch {}
  }, [savedAuctionTeams, tournament]);

  // Load Supabase Email Auth / Guest session on startup
  useEffect(() => {
    let mounted = true;
    getCurrentAuthUser().then((user) => {
      if (!mounted) return;
      setCurrentUser(user);
      setAuthLoading(false);
    });
    const unsub = onAuthStateChanged((user) => {
      if (!mounted) return;
      if (user) setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const transportMode = transportRef.current?.mode || "local";

  const emitLeaveNotice = useCallback(
    (context: "LOBBY" | "GAME") => {
      if (!currentUser) return;
      if (transportRef.current && roomMode !== "LOCAL") {
        transportRef.current.send({
          type: "LEAVE_ROOM",
          clientId,
          username: currentUser.username,
          context,
        });
      }
      if (qmTransportRef.current) {
        qmTransportRef.current.send({
          type: "LEAVE_ROOM",
          clientId,
          username: currentUser.username,
          context: "GAME",
        });
      }
    },
    [clientId, currentUser, roomMode],
  );

  const teardownTransport = useCallback(() => {
    transportRef.current?.destroy();
    transportRef.current = null;
  }, []);

  const teardownQmTransport = useCallback(() => {
    qmTransportRef.current?.destroy();
    qmTransportRef.current = null;
  }, []);

  // Broadcast LEAVE_ROOM when user closes tab / refreshes mobile browser
  useEffect(() => {
    const handleBeforeUnload = () => {
      const ctx: "LOBBY" | "GAME" = screenRef.current === "SETUP" ? "LOBBY" : "GAME";
      emitLeaveNotice(ctx);
    };
    window.addEventListener("pagehide", handleBeforeUnload);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("pagehide", handleBeforeUnload);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [emitLeaveNotice]);

  const publishHostSnapshot = useCallback(
    (nextSnap: RoomAuctionSnapshot) => {
      snapshotRef.current = nextSnap;
      membersRef.current = nextSnap.members;
      chatRef.current = nextSnap.chatMessages;
      votesRef.current = nextSnap.teamVotes;
      transportRef.current?.send({
        type: "STATE_SYNC",
        snapshot: nextSnap,
        senderId: clientId,
      });
    },
    [clientId],
  );

  const appendSystemChat = useCallback((text: string): RoomChatMessage[] => {
    const entry: RoomChatMessage = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderClientId: "system",
      senderName: "System",
      kitId: null,
      text,
      isSystem: true,
      ts: Date.now(),
    };
    const next = [...chatRef.current, entry].slice(-80);
    chatRef.current = next;
    setChatMessages(next);
    return next;
  }, []);

  const showTempEventBanner = useCallback((banner: RoomEventBanner) => {
    setEventBanner(banner);
    setTimeout(() => {
      setEventBanner((cur) => (cur?.id === banner.id ? null : cur));
    }, 5500);
  }, []);

  // Host handles explicit departure OR timeout removal
  const handleMemberDepartedOnHost = useCallback(
    (departedId: string, username: string, context: "LOBBY" | "GAME") => {
      const exists = membersRef.current.some((m) => m.clientId === departedId);
      if (!exists) return;
      const remaining = normalizeTeamCaptains(
        membersRef.current.filter((m) => m.clientId !== departedId),
      );
      membersRef.current = remaining;
      setConnectedMembers(remaining);

      const leaveText =
        context === "GAME"
          ? `⚠️ @${username} left the game.`
          : `⚠️ @${username} left the lobby.`;
      const banner: RoomEventBanner = {
        id: `leave_${Date.now()}_${departedId}`,
        text: leaveText,
        kind: "LEAVE",
        ts: Date.now(),
      };
      showTempEventBanner(banner);
      const nextChat = appendSystemChat(leaveText);

      if (snapshotRef.current) {
        publishHostSnapshot({
          ...snapshotRef.current,
          version: ++versionRef.current,
          members: remaining,
          teams:
            snapshotRef.current.screen === "LOBBY"
              ? buildTeamsFromConfig(configRef.current, remaining)
              : snapshotRef.current.teams,
          chatMessages: nextChat,
          lastEventBanner: banner,
          updatedAt: Date.now(),
        });
      }
    },
    [appendSystemChat, publishHostSnapshot, showTempEventBanner],
  );

  // Initialize Host Custom Room
  const connectAsHost = useCallback(
    (
      code: string,
      hostCfg: ChallengeConfig,
      authUser: AuthenticatedUser,
      hostKit: JerseyKitId | null,
    ) => {
      teardownTransport();
      const transport = createRealtimeTransport(code);
      transportRef.current = transport;

      const hostMember: ConnectedMember = {
        clientId,
        userId: authUser.userId,
        friendName: authUser.username,
        emailMasked: authUser.emailMasked,
        kitId: hostKit,
        teamRole: hostKit ? "CAPTAIN" : "SPECTATOR",
        joinedAt: Date.now(),
        isHost: true,
        lastSeenAt: Date.now(),
      };

      const welcomeChat: RoomChatMessage[] = [
        {
          id: `sys_${Date.now()}`,
          senderClientId: "system",
          senderName: "System",
          kitId: null,
          text: `@${authUser.username} created Room ${code}. Teams hold 2-${hostCfg.membersPerTeam ?? 4} members (1 Captain each).`,
          isSystem: true,
          ts: Date.now(),
        },
      ];

      membersRef.current = [hostMember];
      chatRef.current = welcomeChat;
      votesRef.current = {};
      setConnectedMembers([hostMember]);
      setChatMessages(welcomeChat);
      setTeamVotes({});
      setEventBanner(null);
      setInCustomRoom(true);
      setJoinStatus(null);

      const initialSnap: RoomAuctionSnapshot = {
        roomCode: code,
        hostClientId: clientId,
        version: ++versionRef.current,
        screen: "LOBBY",
        config: hostCfg,
        members: [hostMember],
        teams: buildTeamsFromConfig(hostCfg, [hostMember]),
        chatMessages: welcomeChat,
        teamVotes: {},
        lastEventBanner: null,
        lotIdx: 0,
        currentBidCr: null,
        highestBidderId: null,
        passedIds: [],
        turnIndex: 0,
        bidStepCount: 0,
        lotBidderIds: [],
        resolution: "BIDDING",
        unsoldCount: 0,
        updatedAt: Date.now(),
      };
      publishHostSnapshot(initialSnap);

      transport.subscribe((msg: RoomWireMessage) => {
        if (msg.type === "JOIN_REQUEST") {
          const cap = configRef.current.membersPerTeam ?? 4;
          const incomingBase = {
            clientId: msg.clientId,
            userId: msg.userId,
            friendName: msg.friendName,
            emailMasked: msg.emailMasked,
            isHost: false,
            lastSeenAt: Date.now(),
          };
          let result = assignMemberToTeam(membersRef.current, incomingBase, msg.kitId, cap);
          if (!result.ok) {
            result = assignMemberToTeam(membersRef.current, incomingBase, null, cap);
          }
          if (result.ok) {
            membersRef.current = result.members;
            setConnectedMembers(result.members);
            const assigned = result.members.find((m) => m.clientId === msg.clientId);
            const note = assigned?.kitId
              ? `@${msg.friendName} joined ${assigned.kitId.toUpperCase()} (${assigned.teamRole === "CAPTAIN" ? "Captain" : "Member"}).`
              : `@${msg.friendName} entered Observe.`;
            const nextChat = appendSystemChat(note);

            if (snapshotRef.current) {
              const patchedTeams =
                snapshotRef.current.screen === "LOBBY"
                  ? buildTeamsFromConfig(configRef.current, result.members)
                  : snapshotRef.current.teams;
              publishHostSnapshot({
                ...snapshotRef.current,
                version: ++versionRef.current,
                members: result.members,
                teams: patchedTeams,
                chatMessages: nextChat,
                updatedAt: Date.now(),
              });
            }
          }
        } else if (msg.type === "LEAVE_ROOM") {
          handleMemberDepartedOnHost(msg.clientId, msg.username, msg.context);
        } else if (msg.type === "SWITCH_TEAM") {
          const existing = membersRef.current.find((m) => m.clientId === msg.clientId);
          if (!existing) return;
          const cap = configRef.current.membersPerTeam ?? 4;
          const result = assignMemberToTeam(membersRef.current, existing, msg.kitId, cap);
          if (!result.ok) return;
          membersRef.current = result.members;
          setConnectedMembers(result.members);
          const moved = result.members.find((m) => m.clientId === msg.clientId);
          const nextChat = appendSystemChat(
            moved?.kitId
              ? `@${existing.friendName} moved to ${moved.kitId.toUpperCase()} (${moved.teamRole}).`
              : `@${existing.friendName} moved to Observe.`,
          );
          if (snapshotRef.current) {
            publishHostSnapshot({
              ...snapshotRef.current,
              version: ++versionRef.current,
              members: result.members,
              teams:
                snapshotRef.current.screen === "LOBBY"
                  ? buildTeamsFromConfig(configRef.current, result.members)
                  : snapshotRef.current.teams,
              chatMessages: nextChat,
              updatedAt: Date.now(),
            });
          }
        } else if (msg.type === "PROMOTE_CAPTAIN") {
          const requester = membersRef.current.find((m) => m.clientId === msg.requesterClientId);
          const canPromote =
            requester &&
            (requester.isHost || (requester.kitId === msg.kitId && requester.teamRole === "CAPTAIN"));
          if (!canPromote) return;
          const nextMembers = transferTeamCaptain(membersRef.current, msg.kitId, msg.targetClientId);
          membersRef.current = nextMembers;
          setConnectedMembers(nextMembers);
          const newCap = nextMembers.find((m) => m.clientId === msg.targetClientId);
          const nextChat = appendSystemChat(
            `@${newCap?.friendName || "Player"} is now Captain of ${msg.kitId.toUpperCase()}.`,
          );
          if (snapshotRef.current) {
            publishHostSnapshot({
              ...snapshotRef.current,
              version: ++versionRef.current,
              members: nextMembers,
              teams:
                snapshotRef.current.screen === "LOBBY"
                  ? buildTeamsFromConfig(configRef.current, nextMembers)
                  : snapshotRef.current.teams,
              chatMessages: nextChat,
              updatedAt: Date.now(),
            });
          }
        } else if (msg.type === "ROOM_CHAT") {
          const nextChat = [...chatRef.current, msg.message].slice(-80);
          chatRef.current = nextChat;
          setChatMessages(nextChat);
          if (snapshotRef.current) {
            publishHostSnapshot({
              ...snapshotRef.current,
              version: ++versionRef.current,
              chatMessages: nextChat,
              updatedAt: Date.now(),
            });
          }
        } else if (msg.type === "TEAM_VOTE") {
          const prevTeamMap = votesRef.current[msg.teamId] || {};
          const nextVotes: Record<string, Record<string, TeamBidVote>> = {
            ...votesRef.current,
            [msg.teamId]: {
              ...prevTeamMap,
              [msg.clientId]: {
                clientId: msg.clientId,
                username: msg.username,
                choice: msg.choice,
                lotIdx: msg.lotIdx,
                bidStepCount: msg.bidStepCount,
                updatedAt: Date.now(),
              },
            },
          };
          votesRef.current = nextVotes;
          setTeamVotes(nextVotes);
          if (snapshotRef.current) {
            publishHostSnapshot({
              ...snapshotRef.current,
              version: ++versionRef.current,
              teamVotes: nextVotes,
              updatedAt: Date.now(),
            });
          }
        } else if (msg.type === "REQUEST_SYNC") {
          if (snapshotRef.current) {
            publishHostSnapshot({
              ...snapshotRef.current,
              version: ++versionRef.current,
              updatedAt: Date.now(),
            });
          }
        } else if (msg.type === "REMOTE_BID") {
          setIncomingCommand({
            seq: cmdSeqRef.current++,
            type: "BID",
            teamId: msg.teamId,
            clientId: msg.clientId,
          });
        } else if (msg.type === "REMOTE_PASS") {
          setIncomingCommand({
            seq: cmdSeqRef.current++,
            type: "PASS",
            teamId: msg.teamId,
            clientId: msg.clientId,
          });
        } else if (msg.type === "PING") {
          setConnectedMembers((prev) => {
            const updated = prev.map((m) =>
              m.clientId === msg.clientId ? { ...m, lastSeenAt: msg.ts } : m,
            );
            membersRef.current = updated;
            return updated;
          });
        }
      });
    },
    [clientId, publishHostSnapshot, teardownTransport, appendSystemChat, handleMemberDepartedOnHost],
  );

  // Periodic heartbeat ping + Guest initial sync retry + Host stale-peer departure detector
  useEffect(() => {
    if (!inCustomRoom && screen !== "STAGE") return;
    if (roomMode === "LOCAL") return;
    const timer = setInterval(() => {
      const now = Date.now();
      transportRef.current?.send({
        type: "PING",
        clientId,
        kitId: selectedKitId,
        ts: now,
      });
      if (roomMode === "GUEST" && joinStatus && currentUser) {
        transportRef.current?.send({
          type: "JOIN_REQUEST",
          clientId,
          userId: currentUser.userId,
          friendName: currentUser.username,
          emailMasked: currentUser.emailMasked,
          kitId: selectedKitId,
        });
        transportRef.current?.send({ type: "REQUEST_SYNC", clientId });
      }
      if (roomMode === "HOST") {
        const stale = membersRef.current.filter(
          (m) => !m.isHost && now - m.lastSeenAt > 12000,
        );
        for (const s of stale) {
          handleMemberDepartedOnHost(
            s.clientId,
            s.friendName,
            screenRef.current === "STAGE" ? "GAME" : "LOBBY",
          );
        }
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [
    inCustomRoom,
    screen,
    roomMode,
    joinStatus,
    currentUser,
    clientId,
    selectedKitId,
    handleMemberDepartedOnHost,
  ]);

  useEffect(
    () => () => {
      teardownTransport();
      teardownQmTransport();
    },
    [teardownTransport, teardownQmTransport],
  );

  const handleChangeTab = (tab: LobbyTab) => {
    setLobbyTab(tab);
    setJoinStatus(null);
    setInCustomRoom(false);
    if (tab === "LOCAL") {
      setRoomMode("LOCAL");
      teardownTransport();
    } else if (tab === "CREATE") {
      setRoomMode("HOST");
      if (currentUser) {
        connectAsHost(roomCode, config, currentUser, selectedKitId ?? "csk");
      }
    } else {
      setRoomMode("GUEST");
      teardownTransport();
    }
  };

  const handleHostUpdateConfig = (nextCfg: ChallengeConfig) => {
    setConfig(nextCfg);
    configRef.current = nextCfg;
    if (roomMode === "HOST" && snapshotRef.current) {
      publishHostSnapshot({
        ...snapshotRef.current,
        version: ++versionRef.current,
        config: nextCfg,
        teams: buildTeamsFromConfig(nextCfg, membersRef.current),
        updatedAt: Date.now(),
      });
    }
  };

  const handleJoinRoom = (
    rawCode: string,
    kitId: JerseyKitId | null,
    overrideUser?: AuthenticatedUser,
  ) => {
    const activeUser = overrideUser || currentUser;
    if (!activeUser) {
      setJoinStatus("Enter as Guest or Sign In before joining a room.");
      return;
    }
    const code = normalizeRoomCode(rawCode);
    if (code.length < 4) {
      setJoinStatus("Enter a valid 4-6 character room code.");
      return;
    }
    teardownTransport();
    setRoomCode(code);
    setRoomMode("GUEST");
    setLobbyTab("JOIN");
    setSelectedKitId(kitId);
    setInCustomRoom(true);
    setScreen("SETUP");
    setJoinStatus(`Connecting to Room ${code}… waiting for Host sync.`);

    const transport = createRealtimeTransport(code);
    transportRef.current = transport;

    const applySyncedSnapshot = (snap: RoomAuctionSnapshot) => {
      if (!snap || !snap.config) return;
      const safeCfg: ChallengeConfig = {
        ...INITIAL_CONFIG,
        ...snap.config,
        teamNames: Array.isArray(snap.config?.teamNames)
          ? snap.config.teamNames
          : [...DEFAULT_TEAM_NAMES],
      };
      const safeMembers = Array.isArray(snap.members) ? snap.members : [];
      const safeTeams = Array.isArray(snap.teams)
        ? snap.teams
        : buildTeamsFromConfig(safeCfg, safeMembers);
      const safeChat = Array.isArray(snap.chatMessages) ? snap.chatMessages : [];
      const safeVotes = snap.teamVotes || {};

      setSyncedSnapshot({
        ...snap,
        config: safeCfg,
        members: safeMembers,
        teams: safeTeams,
        chatMessages: safeChat,
        teamVotes: safeVotes,
      });
      setConfig(safeCfg);
      setConnectedMembers(safeMembers);
      setChatMessages(safeChat);
      setTeamVotes(safeVotes);
      if (snap.lastEventBanner) {
        showTempEventBanner(snap.lastEventBanner);
      }
      setDeck(safeCfg.poolMode === "FULL_165" ? ALL_PLAYERS : CURATED_CHALLENGE_PLAYERS);
      setJoinStatus(null);

      if (snap.screen === "STAGE") {
        setScreen("STAGE");
      } else if (snap.screen === "SCORECARD") {
        setTeams(safeTeams);
        setSavedAuctionTeams(safeTeams);
        setUnsoldCount(snap.unsoldCount || 0);
        setScreen("SCORECARD");
      } else {
        setScreen("SETUP");
      }
    };

    const cached = transport.readCachedSnapshot();
    if (cached) {
      applySyncedSnapshot(cached);
    }

    transport.subscribe((msg: RoomWireMessage) => {
      if (msg.type === "STATE_SYNC") {
        applySyncedSnapshot(msg.snapshot);
      } else if (msg.type === "LEAVE_ROOM") {
        const msgText =
          msg.context === "GAME"
            ? `⚠️ @${msg.username} left the game.`
            : `⚠️ @${msg.username} left the lobby.`;
        showTempEventBanner({
          id: `gleave_${Date.now()}`,
          text: msgText,
          kind: "LEAVE",
          ts: Date.now(),
        });
      }
    });

    transport.send({
      type: "JOIN_REQUEST",
      clientId,
      userId: activeUser.userId,
      friendName: activeUser.username,
      emailMasked: activeUser.emailMasked,
      kitId,
    });
    transport.send({ type: "REQUEST_SYNC", clientId });
  };

  const handleSwitchTeam = (kitId: JerseyKitId | null) => {
    setSelectedKitId(kitId);
    if (roomMode === "GUEST") {
      transportRef.current?.send({ type: "SWITCH_TEAM", clientId, kitId });
      return;
    }
    if (roomMode === "HOST" && snapshotRef.current) {
      const existing = membersRef.current.find((m) => m.clientId === clientId);
      if (!existing) return;
      const cap = config.membersPerTeam ?? 4;
      const result = assignMemberToTeam(membersRef.current, existing, kitId, cap);
      if (!result.ok) {
        setJoinStatus(result.error);
        return;
      }
      setJoinStatus(null);
      membersRef.current = result.members;
      setConnectedMembers(result.members);
      const moved = result.members.find((m) => m.clientId === clientId);
      const nextChat = appendSystemChat(
        moved?.kitId
          ? `@${existing.friendName} moved to ${moved.kitId.toUpperCase()} (${moved.teamRole}).`
          : `@${existing.friendName} moved to Observe.`,
      );
      publishHostSnapshot({
        ...snapshotRef.current,
        version: ++versionRef.current,
        members: result.members,
        teams: buildTeamsFromConfig(config, result.members),
        chatMessages: nextChat,
        updatedAt: Date.now(),
      });
    }
  };

  const handlePromoteCaptain = (kitId: JerseyKitId, targetClientId: string) => {
    if (roomMode === "GUEST") {
      transportRef.current?.send({
        type: "PROMOTE_CAPTAIN",
        requesterClientId: clientId,
        kitId,
        targetClientId,
      });
      return;
    }
    if (roomMode === "HOST" && snapshotRef.current) {
      const nextMembers = transferTeamCaptain(membersRef.current, kitId, targetClientId);
      membersRef.current = nextMembers;
      setConnectedMembers(nextMembers);
      const newCap = nextMembers.find((m) => m.clientId === targetClientId);
      const nextChat = appendSystemChat(
        `@${newCap?.friendName || "Player"} is now Captain of ${kitId.toUpperCase()}.`,
      );
      publishHostSnapshot({
        ...snapshotRef.current,
        version: ++versionRef.current,
        members: nextMembers,
        teams: buildTeamsFromConfig(config, nextMembers),
        chatMessages: nextChat,
        updatedAt: Date.now(),
      });
    }
  };

  const handleSendChat = (text: string) => {
    if (!currentUser) return;
    const me = connectedMembers.find((m) => m.clientId === clientId);
    const msg: RoomChatMessage = {
      id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderClientId: clientId,
      senderName: currentUser.username,
      kitId: me?.kitId ?? null,
      text,
      ts: Date.now(),
    };
    if (roomMode === "GUEST") {
      transportRef.current?.send({ type: "ROOM_CHAT", message: msg });
      return;
    }
    if (roomMode === "HOST" && snapshotRef.current) {
      const nextChat = [...chatRef.current, msg].slice(-80);
      chatRef.current = nextChat;
      setChatMessages(nextChat);
      publishHostSnapshot({
        ...snapshotRef.current,
        version: ++versionRef.current,
        chatMessages: nextChat,
        updatedAt: Date.now(),
      });
    }
  };

  const handleCastVote = (
    teamId: string,
    choice: TeamVoteChoice,
    lotIdxVal: number,
    bidStepCountVal: number,
  ) => {
    const username = currentUser?.username || "Member";
    if (roomMode === "GUEST") {
      transportRef.current?.send({
        type: "TEAM_VOTE",
        clientId,
        username,
        teamId,
        choice,
        lotIdx: lotIdxVal,
        bidStepCount: bidStepCountVal,
      });
      return;
    }
    if (roomMode === "HOST" && snapshotRef.current) {
      const prevTeamMap = votesRef.current[teamId] || {};
      const nextVotes: Record<string, Record<string, TeamBidVote>> = {
        ...votesRef.current,
        [teamId]: {
          ...prevTeamMap,
          [clientId]: {
            clientId,
            username,
            choice,
            lotIdx: lotIdxVal,
            bidStepCount: bidStepCountVal,
            updatedAt: Date.now(),
          },
        },
      };
      votesRef.current = nextVotes;
      setTeamVotes(nextVotes);
      publishHostSnapshot({
        ...snapshotRef.current,
        version: ++versionRef.current,
        teamVotes: nextVotes,
        updatedAt: Date.now(),
      });
    }
  };

  const handleLeaveRoom = (returnScreen: AppScreen = "HOME") => {
    emitLeaveNotice(screen === "STAGE" ? "GAME" : "LOBBY");
    teardownTransport();
    setInCustomRoom(false);
    setJoinStatus(null);
    setConnectedMembers([]);
    setChatMessages([]);
    setTeamVotes({});
    setEventBanner(null);
    setSyncedSnapshot(null);
    setScreen(returnScreen);
  };

  const launchLocal = (nextConfig: ChallengeConfig) => {
    teardownTransport();
    setRoomMode("LOCAL");
    setInCustomRoom(false);
    setConfig(nextConfig);
    setTeams(buildTeamsFromConfig(nextConfig, []));
    setDeck(nextConfig.poolMode === "FULL_165" ? ALL_PLAYERS : CURATED_CHALLENGE_PLAYERS);
    setUnsoldCount(0);
    setSessionId((s) => s + 1);
    setScreen("STAGE");
  };

  const launchHostedRoom = (nextConfig: ChallengeConfig) => {
    setRoomMode("HOST");
    setConfig(nextConfig);
    const builtTeams = buildTeamsFromConfig(nextConfig, connectedMembers);
    setTeams(builtTeams);
    setDeck(nextConfig.poolMode === "FULL_165" ? ALL_PLAYERS : CURATED_CHALLENGE_PLAYERS);
    setUnsoldCount(0);
    setSessionId((s) => s + 1);
    setScreen("STAGE");

    publishHostSnapshot({
      roomCode,
      hostClientId: clientId,
      version: ++versionRef.current,
      screen: "STAGE",
      config: nextConfig,
      members: connectedMembers,
      teams: builtTeams,
      chatMessages,
      teamVotes: {},
      lastEventBanner: null,
      lotIdx: 0,
      currentBidCr: null,
      highestBidderId: null,
      passedIds: [],
      turnIndex: 0,
      bidStepCount: 0,
      lotBidderIds: [],
      resolution: "BIDDING",
      unsoldCount: 0,
      updatedAt: Date.now(),
    });
  };

  const handleHostStagePublish = useCallback(
    (
      patch: Omit<
        RoomAuctionSnapshot,
        | "roomCode"
        | "hostClientId"
        | "version"
        | "screen"
        | "config"
        | "members"
        | "chatMessages"
        | "teamVotes"
        | "updatedAt"
      >,
    ) => {
      if (roomMode !== "HOST") return;
      publishHostSnapshot({
        roomCode,
        hostClientId: clientId,
        version: ++versionRef.current,
        screen: "STAGE",
        config: configRef.current,
        members: membersRef.current,
        chatMessages: chatRef.current,
        teamVotes: votesRef.current,
        lastEventBanner: snapshotRef.current?.lastEventBanner ?? null,
        ...patch,
        updatedAt: Date.now(),
      });
    },
    [roomMode, roomCode, clientId, publishHostSnapshot],
  );

  // Mode 2 Online Quick Match Room Handlers
  const handleCreateOnlineMatchRoom = (
    code: string,
    lineupA: MatchTeamLineup,
    pitch: PitchCondition,
    wicketRule: WicketRule,
  ) => {
    teardownQmTransport();
    const transport = createRealtimeTransport(`QM_${code}`);
    qmTransportRef.current = transport;
    setQmRoomCode(code);
    setQmIsHost(true);
    setQmLeftNotice(null);
    setQmStatus(`Share Code ${code} with your friend!`);

    const initialQm: OnlineQuickMatchSnapshot = {
      roomCode: code,
      hostClientId: clientId,
      guestClientId: null,
      hostName: currentUser?.username || "Host",
      guestName: null,
      pitch,
      wicketRule,
      stage: "WAITING",
      match: createMatchState(`qm_${code}`, lineupA, lineupA, {
        seed: Date.now(),
        pitch,
        wicketRule,
      }),
      pendingBowl: null,
      updatedAt: Date.now(),
    };
    qmSnapRef.current = initialQm;
    setQmSnapshot(initialQm);
    transport.send({ type: "QM_STATE", snapshot: initialQm });

    transport.subscribe((msg) => {
      if (msg.type === "QM_JOIN" && qmSnapRef.current) {
        const guestLineup = msg.lineup || qmSnapRef.current.match!.teamB;
        const nextMatch = createMatchState(
          `qm_${code}`,
          qmSnapRef.current.match!.teamA,
          guestLineup,
          { seed: Date.now(), pitch: qmSnapRef.current.pitch, wicketRule: qmSnapRef.current.wicketRule },
        );
        const updated: OnlineQuickMatchSnapshot = {
          ...qmSnapRef.current,
          guestClientId: msg.clientId,
          guestName: msg.username,
          match: nextMatch,
          updatedAt: Date.now(),
        };
        qmSnapRef.current = updated;
        setQmSnapshot(updated);
        setQmStatus(`${msg.username} joined! Press Start Toss & Match.`);
        transport.send({ type: "QM_STATE", snapshot: updated });
      } else if (msg.type === "QM_BOWL" && qmSnapRef.current) {
        const updated: OnlineQuickMatchSnapshot = {
          ...qmSnapRef.current,
          pendingBowl: {
            deliveryId: msg.deliveryId,
            length: msg.length,
            line: msg.line,
            releaseAccuracy: msg.releaseAccuracy,
          },
          updatedAt: Date.now(),
        };
        qmSnapRef.current = updated;
        setQmSnapshot(updated);
        transport.send({ type: "QM_STATE", snapshot: updated });
      } else if (msg.type === "QM_BAT" && qmSnapRef.current && qmSnapRef.current.match && qmSnapRef.current.pendingBowl) {
        const pb = qmSnapRef.current.pendingBowl;
        if (pb.deliveryId !== msg.deliveryId) return;
        const { match: nextMatch } = resolveDelivery(qmSnapRef.current.match, {
          length: pb.length,
          line: pb.line,
          releaseAccuracy: pb.releaseAccuracy,
          shotType: msg.shotType,
          timing: msg.timing,
          timingGrade: msg.timingGrade,
          lofted: msg.lofted,
          stepOut: msg.stepOut,
        });
        const updated: OnlineQuickMatchSnapshot = {
          ...qmSnapRef.current,
          match: nextMatch,
          pendingBowl: null,
          stage: nextMatch.phase === "COMPLETE" ? "COMPLETE" : "LIVE",
          updatedAt: Date.now(),
        };
        qmSnapRef.current = updated;
        setQmSnapshot(updated);
        setActiveMatch(nextMatch);
        transport.send({ type: "QM_STATE", snapshot: updated });
      } else if (msg.type === "LEAVE_ROOM") {
        setQmLeftNotice(`@${msg.username} left the game.`);
        setQmStatus(`⚠️ @${msg.username} left the match.`);
      } else if (msg.type === "REQUEST_SYNC" && qmSnapRef.current) {
        transport.send({ type: "QM_STATE", snapshot: qmSnapRef.current });
      }
    });
  };

  const handleJoinOnlineMatchRoom = (code: string, lineupB: MatchTeamLineup) => {
    teardownQmTransport();
    const clean = normalizeRoomCode(code);
    const transport = createRealtimeTransport(`QM_${clean}`);
    qmTransportRef.current = transport;
    setQmRoomCode(clean);
    setQmIsHost(false);
    setQmLeftNotice(null);
    setQmStatus(`Joining Match Room ${clean}…`);

    transport.subscribe((msg) => {
      if (msg.type === "QM_STATE") {
        const snap = msg.snapshot;
        qmSnapRef.current = snap;
        setQmSnapshot(snap);
        setQmStatus(null);
        if (snap.stage === "LIVE" && snap.match) {
          setActiveMatch(snap.match);
          setActiveMatchControl("ONLINE_FRIEND");
          setScreen("MATCH");
        } else if (snap.stage === "PREGAME" && snap.match) {
          setPendingPreGame({
            teamA: snap.match.teamA,
            teamB: snap.match.teamB,
            pitch: snap.pitch,
            wicketRule: snap.wicketRule,
            botDifficulty: "Medium",
            controlMode: "ONLINE_FRIEND",
          });
          setScreen("PREGAME");
        }
      } else if (msg.type === "LEAVE_ROOM") {
        setQmLeftNotice(`@${msg.username} left the game.`);
      }
    });

    transport.send({
      type: "QM_JOIN",
      clientId,
      username: currentUser?.username || "Friend",
      lineup: lineupB,
    });
    transport.send({ type: "REQUEST_SYNC", clientId });
  };

  const myRoomMember = connectedMembers.find((m) => m.clientId === clientId);
  const myTeamId =
    roomMode === "LOCAL"
      ? null
      : myRoomMember?.kitId
      ? `team-${myRoomMember.kitId}`
      : null;

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm font-bold text-amber-300">
        Loading Cricket Bid Wars…
      </div>
    );
  }

  if (!currentUser && !offlinePassPlayAllowed) {
    return (
      <EmailAuthPanel
        supabaseConfigured={supabaseConfigured}
        initialRoomCode={inviteCode}
        onAuthenticated={(user, directRoomCode) => {
          setCurrentUser(user);
          setOfflinePassPlayAllowed(false);
          const direct = normalizeRoomCode(directRoomCode || "");
          if (direct.length >= 4) {
            handleJoinRoom(direct, null, user);
          } else {
            setScreen("HOME");
          }
        }}
        onPlayOfflinePassAndPlay={() => {
          const guest = createGuestUser("LocalHost");
          if (guest.user) setCurrentUser(guest.user);
          setOfflinePassPlayAllowed(true);
          setLobbyTab("LOCAL");
          setRoomMode("LOCAL");
          setScreen("HOME");
        }}
      />
    );
  }

  // HOME MODE HUB (Mode 1: Auction & Play | Mode 2: Quick Match)
  if (screen === "HOME" && currentUser) {
    return (
      <HomeModeHub
        currentUser={currentUser}
        theme={theme}
        hasSavedTournament={Boolean(tournament)}
        hasSavedAuctionSquads={savedAuctionTeams.length > 0}
        onToggleTheme={toggleTheme}
        onCreateAuctionRoom={() => {
          const nextCode = generateRoomCode(6);
          setRoomCode(nextCode);
          setLobbyTab("CREATE");
          setRoomMode("HOST");
          setScreen("SETUP");
          connectAsHost(nextCode, config, currentUser, selectedKitId ?? "csk");
        }}
        onJoinAuctionRoom={(code) => handleJoinRoom(code, null, currentUser)}
        onPassAndPlayAuction={() => {
          setLobbyTab("LOCAL");
          setRoomMode("LOCAL");
          setInCustomRoom(false);
          setScreen("SETUP");
        }}
        onResumeTournament={() => {
          if (tournament) setScreen("TOURNAMENT");
        }}
        onOpenLineupHubFromSaved={() => {
          if (savedAuctionTeams.length > 0) {
            setDraftLineups(buildLineupsFromAuctionTeams(savedAuctionTeams, ALL_PLAYERS));
            setScreen("LINEUP_HUB");
          }
        }}
        onOpenQuickMatch={(sub) => {
          setQuickSubMode(sub);
          setQmRoomCode(null);
          setQmSnapshot(null);
          setQmStatus(null);
          setQmLeftNotice(null);
          setScreen("QUICK_SETUP");
        }}
        onSignOut={async () => {
          emitLeaveNotice("LOBBY");
          teardownTransport();
          teardownQmTransport();
          await signOutAuth();
          setCurrentUser(null);
          setInCustomRoom(false);
        }}
      />
    );
  }

  // MODE 1 STEP A: CUSTOM ROOM LOBBY OR PASS & PLAY SETUP
  if (screen === "SETUP") {
    if (currentUser && inCustomRoom && (lobbyTab === "CREATE" || lobbyTab === "JOIN")) {
      return (
        <CustomRoomLobby
          currentUser={currentUser}
          myClientId={clientId}
          isHost={roomMode === "HOST"}
          roomCode={roomCode}
          transportMode={transportMode}
          config={config}
          members={connectedMembers}
          chatMessages={chatMessages}
          eventBanner={eventBanner}
          joinStatus={joinStatus}
          onUpdateConfig={handleHostUpdateConfig}
          onRegenerateCode={() => {
            const nextCode = generateRoomCode(6);
            setRoomCode(nextCode);
            connectAsHost(nextCode, config, currentUser, selectedKitId ?? "csk");
          }}
          onSwitchTeam={handleSwitchTeam}
          onPromoteCaptain={handlePromoteCaptain}
          onSendChat={handleSendChat}
          onQuickJoinCode={(code) => handleJoinRoom(code, null)}
          onStartMatch={launchHostedRoom}
          onLeaveRoom={() => handleLeaveRoom("HOME")}
          onSignOut={async () => {
            emitLeaveNotice("LOBBY");
            teardownTransport();
            await signOutAuth();
            setCurrentUser(null);
            setInCustomRoom(false);
          }}
        />
      );
    }

    return (
      <SetupLobby
        currentUser={currentUser}
        initialConfig={config}
        initialJoinCode={inviteCode}
        activeTab={lobbyTab}
        transportMode={transportMode}
        selectedKitId={selectedKitId}
        joinStatus={joinStatus}
        onChangeTab={(tab) => handleChangeTab(tab)}
        onSelectKit={setSelectedKitId}
        onJoinRoom={(c, kit) => handleJoinRoom(c, kit)}
        onConfigChange={setConfig}
        onStartLocal={launchLocal}
        onOpenAuth={() => setOfflinePassPlayAllowed(false)}
        onSignOut={async () => {
          teardownTransport();
          await signOutAuth();
          setCurrentUser(null);
          setInCustomRoom(false);
          setOfflinePassPlayAllowed(false);
        }}
      />
    );
  }

  // MODE 1 STEP A: AUCTION STAGE
  if (screen === "STAGE") {
    return (
      <AuctionStage
        key={sessionId}
        config={config}
        initialTeams={teams}
        players={deck}
        roomMode={roomMode}
        roomCode={roomMode === "LOCAL" ? null : roomCode}
        transportMode={transportMode}
        myClientId={clientId}
        myUsername={currentUser?.username}
        connectedMembers={connectedMembers}
        myTeamId={myTeamId}
        teamVotes={teamVotes}
        chatMessages={chatMessages}
        eventBanner={eventBanner}
        syncedSnapshot={syncedSnapshot}
        incomingCommand={incomingCommand}
        onHostPublishState={handleHostStagePublish}
        onGuestBid={(teamId) => {
          transportRef.current?.send({ type: "REMOTE_BID", clientId, teamId });
        }}
        onGuestPass={(teamId) => {
          transportRef.current?.send({ type: "REMOTE_PASS", clientId, teamId });
        }}
        onCastVote={handleCastVote}
        onSendChat={handleSendChat}
        onFinishChallenge={(finalTeams, finalUnsold) => {
          setTeams(finalTeams);
          setSavedAuctionTeams(finalTeams);
          setUnsoldCount(finalUnsold);
          setScreen("SCORECARD");
          if (roomMode === "HOST" && snapshotRef.current) {
            publishHostSnapshot({
              ...snapshotRef.current,
              version: ++versionRef.current,
              screen: "SCORECARD",
              teams: finalTeams,
              unsoldCount: finalUnsold,
              updatedAt: Date.now(),
            });
          }
        }}
        onExitSetup={() => {
          if (roomMode === "GUEST") {
            handleLeaveRoom("HOME");
          } else {
            setScreen("SETUP");
            if (roomMode === "HOST" && snapshotRef.current) {
              publishHostSnapshot({
                ...snapshotRef.current,
                version: ++versionRef.current,
                screen: "LOBBY",
                teams: buildTeamsFromConfig(config, membersRef.current),
                updatedAt: Date.now(),
              });
            }
          }
        }}
      />
    );
  }

  // MODE 1 SCORECARD -> EXPORT TO LINEUP HUB
  if (screen === "SCORECARD") {
    return (
      <FinalScorecard
        teams={teams}
        config={config}
        unsoldCount={unsoldCount}
        onProceedToTournament={() => {
          setSavedAuctionTeams(teams);
          setDraftLineups(buildLineupsFromAuctionTeams(teams, ALL_PLAYERS));
          setScreen("LINEUP_HUB");
        }}
        onRematch={() => (roomMode === "HOST" ? launchHostedRoom(config) : launchLocal(config))}
        onBackToSetup={() => {
          if (roomMode === "GUEST") handleLeaveRoom("HOME");
          else setScreen("HOME");
        }}
      />
    );
  }

  // MODE 1 STEP B: SQUAD & LINEUP HUB
  if (screen === "LINEUP_HUB") {
    return (
      <SquadLineupHub
        initialLineups={draftLineups}
        onBack={() => setScreen(savedAuctionTeams.length > 0 ? "SCORECARD" : "HOME")}
        onStartTournament={(lineups, wicketRule) => {
          const nextTour = createTournament(lineups, wicketRule, Date.now());
          setTournament(nextTour);
          setScreen("TOURNAMENT");
        }}
      />
    );
  }

  // MODE 1 STEP C: 4-A-SIDE TOURNAMENT HUB
  if (screen === "TOURNAMENT" && tournament) {
    return (
      <TournamentHub
        tournament={tournament}
        onPlayFixture={(fx, mode) => {
          const tA = tournament.lineups.find((l) => l.teamId === fx.teamAId);
          const tB = tournament.lineups.find((l) => l.teamId === fx.teamBId);
          if (!tA || !tB) return;
          setActiveFixture(fx);
          if (mode === "WATCH_AI") {
            const m = createMatchState(fx.id, tA, tB, {
              seed: Date.now(),
              pitch: fx.pitch,
              wicketRule: tournament.wicketRule,
            });
            setActiveMatch(m);
            setActiveMatchControl("WATCH_AI");
            setScreen("MATCH");
          } else {
            setPendingPreGame({
              teamA: tA,
              teamB: tB,
              pitch: fx.pitch,
              wicketRule: tournament.wicketRule,
              botDifficulty: "Medium",
              controlMode: "VS_BOT",
              fixtureLabel: fx.label,
              fixtureId: fx.id,
            });
            setScreen("PREGAME");
          }
        }}
        onSimFixture={(fxId) => {
          setTournament((prev) => (prev ? simulateFixtureWithEngine(prev, fxId) : prev));
        }}
        onSimAllGroupMatches={() => {
          setTournament((prev) => {
            if (!prev) return prev;
            let cur = prev;
            for (const fx of cur.fixtures) {
              if (fx.stage === "GROUP" && !fx.completedMatch) {
                cur = simulateFixtureWithEngine(cur, fx.id);
              }
            }
            return cur;
          });
        }}
        onNewSeason={() => setScreen("LINEUP_HUB")}
        onBackHome={() => setScreen("HOME")}
      />
    );
  }

  // MODE 2: QUICK MATCH DRAFT
  if (screen === "QUICK_SETUP") {
    const names = qmSnapshot
      ? [qmSnapshot.hostName, ...(qmSnapshot.guestName ? [qmSnapshot.guestName] : [])]
      : [];
    return (
      <QuickMatchSetup
        initialSubMode={quickSubMode}
        onlineRoomCode={qmRoomCode}
        onlineConnectedNames={names}
        onlineWaitingStatus={qmStatus}
        onlineIsHost={qmIsHost}
        onCreateOnlineMatchRoom={handleCreateOnlineMatchRoom}
        onJoinOnlineMatchRoom={handleJoinOnlineMatchRoom}
        onStartOnlinePreGame={() => {
          if (!qmSnapshot?.match) return;
          const nextSnap: OnlineQuickMatchSnapshot = {
            ...qmSnapshot,
            stage: "PREGAME",
            updatedAt: Date.now(),
          };
          qmSnapRef.current = nextSnap;
          setQmSnapshot(nextSnap);
          qmTransportRef.current?.send({ type: "QM_STATE", snapshot: nextSnap });
          setPendingPreGame({
            teamA: qmSnapshot.match.teamA,
            teamB: qmSnapshot.match.teamB,
            pitch: qmSnapshot.pitch,
            wicketRule: qmSnapshot.wicketRule,
            botDifficulty: "Medium",
            controlMode: "ONLINE_FRIEND",
          });
          setScreen("PREGAME");
        }}
        onLaunchOfflineMatch={({ subMode, teamA, teamB, pitch, wicketRule, botDifficulty }) => {
          setActiveFixture(null);
          setPendingPreGame({
            teamA,
            teamB,
            pitch,
            wicketRule,
            botDifficulty,
            controlMode: subMode === "BOT" ? "VS_BOT" : "PASS_PLAY",
          });
          setScreen("PREGAME");
        }}
        onBack={() => {
          if (qmTransportRef.current) {
            emitLeaveNotice("GAME");
            teardownQmTransport();
          }
          setScreen("HOME");
        }}
      />
    );
  }

  // PRE-GAME VS SCREEN & COIN TOSS
  if (screen === "PREGAME" && pendingPreGame) {
    return (
      <MatchPreGame
        teamA={pendingPreGame.teamA}
        teamB={pendingPreGame.teamB}
        pitch={pendingPreGame.pitch}
        wicketRule={pendingPreGame.wicketRule}
        fixtureLabel={pendingPreGame.fixtureLabel}
        isTeamBBot={pendingPreGame.controlMode === "VS_BOT"}
        isOnlineGuest={pendingPreGame.controlMode === "ONLINE_FRIEND" && !qmIsHost}
        onStartMatch={(tossWinnerId, tossDecision) => {
          const cfg: MatchConfig = {
            seed: Date.now(),
            pitch: pendingPreGame.pitch,
            wicketRule: pendingPreGame.wicketRule,
            oversPerInnings: 6,
            botDifficulty: pendingPreGame.botDifficulty,
          };
          const m = createMatchState(
            pendingPreGame.fixtureId || `qm_${Date.now()}`,
            pendingPreGame.teamA,
            pendingPreGame.teamB,
            cfg,
            tossWinnerId,
            tossDecision,
          );
          setActiveMatch(m);
          setActiveMatchControl(pendingPreGame.controlMode);
          setActiveBotDifficulty(pendingPreGame.botDifficulty);
          setScreen("MATCH");

          if (pendingPreGame.controlMode === "ONLINE_FRIEND" && qmIsHost && qmSnapRef.current) {
            const liveSnap: OnlineQuickMatchSnapshot = {
              ...qmSnapRef.current,
              stage: "LIVE",
              match: m,
              pendingBowl: null,
              updatedAt: Date.now(),
            };
            qmSnapRef.current = liveSnap;
            setQmSnapshot(liveSnap);
            qmTransportRef.current?.send({ type: "QM_STATE", snapshot: liveSnap });
          }
        }}
        onBack={() => setScreen(activeFixture ? "TOURNAMENT" : "QUICK_SETUP")}
      />
    );
  }

  // WCC3 BROADCAST LIVE MATCH
  if (screen === "MATCH" && activeMatch) {
    const ptsTable = tournament
      ? computePointsTable(tournament.lineups, tournament.fixtures)
      : undefined;

    return (
      <BroadcastMatchView
        initialMatch={activeMatch}
        controlMode={activeMatchControl}
        botDifficulty={activeBotDifficulty}
        myOnlineTeamId={
          activeMatchControl === "ONLINE_FRIEND"
            ? qmIsHost
              ? activeMatch.teamA.teamId
              : activeMatch.teamB.teamId
            : null
        }
        onlinePendingBowl={qmSnapshot?.pendingBowl || null}
        onlineLeftNotice={qmLeftNotice}
        pointsTable={ptsTable}
        theme={theme}
        onToggleTheme={toggleTheme}
        onMatchStateChange={(updated) => {
          setActiveMatch(updated);
          if (activeMatchControl === "ONLINE_FRIEND" && qmIsHost && qmSnapRef.current) {
            const nextSnap: OnlineQuickMatchSnapshot = {
              ...qmSnapRef.current,
              match: updated,
              stage: updated.phase === "COMPLETE" ? "COMPLETE" : "LIVE",
              updatedAt: Date.now(),
            };
            qmSnapRef.current = nextSnap;
            qmTransportRef.current?.send({ type: "QM_STATE", snapshot: nextSnap });
          }
        }}
        onOnlineSubmitBowl={(length: BowlingLength, line: BowlingLine, releaseAccuracy: number) => {
          const deliveryId = `del_${Date.now()}`;
          if (qmIsHost && qmSnapRef.current) {
            const nextSnap: OnlineQuickMatchSnapshot = {
              ...qmSnapRef.current,
              pendingBowl: { deliveryId, length, line, releaseAccuracy },
              updatedAt: Date.now(),
            };
            qmSnapRef.current = nextSnap;
            setQmSnapshot(nextSnap);
            qmTransportRef.current?.send({ type: "QM_STATE", snapshot: nextSnap });
          } else {
            qmTransportRef.current?.send({
              type: "QM_BOWL",
              clientId,
              deliveryId,
              length,
              line,
              releaseAccuracy,
            });
          }
        }}
        onOnlineSubmitBat={(
          deliveryId: string,
          shotType: ShotType,
          timing: number,
          timingGrade: TimingGrade,
          lofted: boolean,
          stepOut: boolean,
        ) => {
          if (qmIsHost && qmSnapRef.current && qmSnapRef.current.match && qmSnapRef.current.pendingBowl) {
            const pb = qmSnapRef.current.pendingBowl;
            const { match: nextM } = resolveDelivery(qmSnapRef.current.match, {
              length: pb.length,
              line: pb.line,
              releaseAccuracy: pb.releaseAccuracy,
              shotType,
              timing,
              timingGrade,
              lofted,
              stepOut,
            });
            const nextSnap: OnlineQuickMatchSnapshot = {
              ...qmSnapRef.current,
              match: nextM,
              pendingBowl: null,
              stage: nextM.phase === "COMPLETE" ? "COMPLETE" : "LIVE",
              updatedAt: Date.now(),
            };
            qmSnapRef.current = nextSnap;
            setQmSnapshot(nextSnap);
            setActiveMatch(nextM);
            qmTransportRef.current?.send({ type: "QM_STATE", snapshot: nextSnap });
          } else {
            qmTransportRef.current?.send({
              type: "QM_BAT",
              clientId,
              deliveryId,
              shotType,
              timing,
              timingGrade,
              lofted,
              stepOut,
            });
          }
        }}
        onMatchComplete={(completed) => {
          if (activeFixture && tournament) {
            setTournament((prev) =>
              prev ? recordTournamentMatchResult(prev, activeFixture.id, completed) : prev,
            );
            setActiveFixture(null);
            setActiveMatch(null);
            setScreen("TOURNAMENT");
          } else {
            setActiveMatch(null);
            setScreen("HOME");
          }
        }}
        onExit={() => {
          if (activeMatchControl === "ONLINE_FRIEND") {
            emitLeaveNotice("GAME");
            teardownQmTransport();
          }
          setActiveMatch(null);
          setScreen(activeFixture ? "TOURNAMENT" : "HOME");
        }}
      />
    );
  }

  return null;
}

export default App;
