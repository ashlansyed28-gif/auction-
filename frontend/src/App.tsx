import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuctionStage, type IncomingRoomCommand } from "./components/AuctionStage";
import { CustomRoomLobby } from "./components/CustomRoomLobby";
import { EmailAuthPanel } from "./components/EmailAuthPanel";
import { FinalScorecard } from "./components/FinalScorecard";
import { SetupLobby, type LobbyTab } from "./components/SetupLobby";
import { ALL_PLAYERS, CURATED_CHALLENGE_PLAYERS } from "./data/players";
import type {
  AuthenticatedUser,
  BroadcastPlayer,
  ChallengeConfig,
  ConnectedMember,
  FriendTeam,
  JerseyKitId,
  RoomAuctionSnapshot,
  RoomChatMessage,
  RoomMode,
  TeamBidVote,
  TeamVoteChoice,
} from "./types/auction";
import { DEFAULT_TEAM_NAMES, JERSEY_THEMES, generateRoomCode } from "./utils/auctionRules";
import {
  getCurrentAuthUser,
  getSupabaseClient,
  onAuthStateChanged,
  signOutAuth,
} from "./utils/authService";
import {
  createRealtimeTransport,
  getOrCreateClientId,
  normalizeRoomCode,
  type RealtimeRoomTransport,
  type RoomWireMessage,
} from "./utils/realtimeSync";
import {
  assignMemberToTeam,
  transferTeamCaptain,
} from "./utils/teamRoomHelpers";

type AppScreen = "SETUP" | "STAGE" | "SCORECARD";

const INITIAL_CONFIG: ChallengeConfig = {
  roomTitle: "CRICKET BID WARS • T20 ARENA",
  teamCount: 10,
  membersPerTeam: 4,
  purseCr: 80,
  minSquadSize: 5,
  maxSquadSize: 11,
  maxOverseas: 4,
  poolMode: "CURATED_24",
  teamNames: [...DEFAULT_TEAM_NAMES],
};

function buildTeamsFromConfig(config: ChallengeConfig, members: ConnectedMember[]): FriendTeam[] {
  const safeNames = Array.isArray(config?.teamNames) ? config.teamNames : DEFAULT_TEAM_NAMES;
  const safeMembers = Array.isArray(members) ? members : [];
  return JERSEY_THEMES.slice(0, config.teamCount || 10).map((kit, idx) => {
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

export function App() {
  const clientId = useMemo(() => getOrCreateClientId(), []);
  const inviteCode = useMemo(() => getInviteRoomFromUrl(), []);
  const supabaseConfigured = Boolean(getSupabaseClient());

  const [authLoading, setAuthLoading] = useState(supabaseConfigured);
  const [currentUser, setCurrentUser] = useState<AuthenticatedUser | null>(null);
  const [offlinePassPlayAllowed, setOfflinePassPlayAllowed] = useState(false);

  const [screen, setScreen] = useState<AppScreen>("SETUP");
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

  const [teams, setTeams] = useState<FriendTeam[]>(() => buildTeamsFromConfig(INITIAL_CONFIG, []));
  const [deck, setDeck] = useState<BroadcastPlayer[]>(CURATED_CHALLENGE_PLAYERS);
  const [unsoldCount, setUnsoldCount] = useState(0);
  const [sessionId, setSessionId] = useState(1);

  const [syncedSnapshot, setSyncedSnapshot] = useState<RoomAuctionSnapshot | null>(null);
  const [incomingCommand, setIncomingCommand] = useState<IncomingRoomCommand | null>(null);

  const transportRef = useRef<RealtimeRoomTransport | null>(null);
  const versionRef = useRef(1);
  const cmdSeqRef = useRef(1);
  const snapshotRef = useRef<RoomAuctionSnapshot | null>(null);
  const membersRef = useRef<ConnectedMember[]>([]);
  const chatRef = useRef<RoomChatMessage[]>([]);
  const votesRef = useRef<Record<string, Record<string, TeamBidVote>>>({});
  const configRef = useRef<ChallengeConfig>(INITIAL_CONFIG);

  configRef.current = config;

  // Load Supabase Email Auth session on startup
  useEffect(() => {
    if (!supabaseConfigured) {
      setAuthLoading(false);
      return;
    }
    let mounted = true;
    getCurrentAuthUser().then((user) => {
      if (!mounted) return;
      setCurrentUser(user);
      setAuthLoading(false);
    });
    const unsub = onAuthStateChanged((user) => {
      if (!mounted) return;
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, [supabaseConfigured]);

  const transportMode = transportRef.current?.mode || "local";

  const teardownTransport = useCallback(() => {
    transportRef.current?.destroy();
    transportRef.current = null;
  }, []);

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
          text: `@${authUser.username} created Room ${code}. Teams accept 2-${hostCfg.membersPerTeam ?? 4} members (1 Captain each).`,
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
              : `@${msg.friendName} entered Observe (pick an open team slot).`;
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
    [clientId, publishHostSnapshot, teardownTransport, appendSystemChat],
  );

  // Auto-open Host Custom Room if authenticated and on CREATE tab without active room
  useEffect(() => {
    if (currentUser && screen === "SETUP" && lobbyTab === "CREATE" && !inCustomRoom) {
      setRoomMode("HOST");
      connectAsHost(roomCode, config, currentUser, selectedKitId ?? "csk");
    }
  }, [currentUser, screen, lobbyTab, inCustomRoom, roomCode, config, selectedKitId, connectAsHost]);

  // Periodic heartbeat ping + Guest initial sync retry until first STATE_SYNC arrives
  useEffect(() => {
    if (!inCustomRoom && screen === "SETUP") return;
    if (roomMode === "LOCAL") return;
    const timer = setInterval(() => {
      transportRef.current?.send({
        type: "PING",
        clientId,
        kitId: selectedKitId,
        ts: Date.now(),
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
    }, 2500);
    return () => clearInterval(timer);
  }, [inCustomRoom, screen, roomMode, joinStatus, currentUser, clientId, selectedKitId]);

  useEffect(() => () => teardownTransport(), [teardownTransport]);

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
      setJoinStatus("Sign in with your email or continue as Guest before joining a room.");
      return;
    }
    const code = normalizeRoomCode(rawCode);
    if (code.length !== 6) {
      setJoinStatus("Enter a valid 6-character room code.");
      return;
    }
    teardownTransport();
    setRoomCode(code);
    setRoomMode("GUEST");
    setLobbyTab("JOIN");
    setSelectedKitId(kitId);
    setInCustomRoom(true);
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
      setDeck(safeCfg.poolMode === "FULL_165" ? ALL_PLAYERS : CURATED_CHALLENGE_PLAYERS);
      setJoinStatus(null);

      if (snap.screen === "STAGE") {
        setScreen("STAGE");
      } else if (snap.screen === "SCORECARD") {
        setTeams(safeTeams);
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

  const handleLeaveRoom = () => {
    teardownTransport();
    setInCustomRoom(false);
    setJoinStatus(null);
    setConnectedMembers([]);
    setChatMessages([]);
    setTeamVotes({});
    setSyncedSnapshot(null);
    setLobbyTab("JOIN");
    setScreen("SETUP");
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
        "roomCode" | "hostClientId" | "version" | "screen" | "config" | "members" | "chatMessages" | "teamVotes" | "updatedAt"
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
        ...patch,
        updatedAt: Date.now(),
      });
    },
    [roomMode, roomCode, clientId, publishHostSnapshot],
  );

  // Dynamic myTeamId based on my current team slot inside the room
  const myRoomMember = connectedMembers.find((m) => m.clientId === clientId);
  const myTeamId =
    roomMode === "LOCAL"
      ? null
      : myRoomMember?.kitId
      ? `team-${myRoomMember.kitId}`
      : null;

  // Loading auth session
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm font-bold text-amber-300">
        Verifying secure email session…
      </div>
    );
  }

  // Require Guest or Email Auth for multiplayer rooms (or allow offline Pass & Play)
  if (!currentUser && !offlinePassPlayAllowed) {
    return (
      <EmailAuthPanel
        supabaseConfigured={supabaseConfigured}
        initialRoomCode={inviteCode}
        onAuthenticated={(user, directRoomCode) => {
          setCurrentUser(user);
          setOfflinePassPlayAllowed(false);
          const direct = normalizeRoomCode(directRoomCode || "");
          if (direct.length === 6) {
            handleJoinRoom(direct, null, user);
          } else {
            setLobbyTab(inviteCode ? "JOIN" : "CREATE");
          }
        }}
        onPlayOfflinePassAndPlay={() => {
          setOfflinePassPlayAllowed(true);
          setLobbyTab("LOCAL");
          setRoomMode("LOCAL");
        }}
      />
    );
  }

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
          onLeaveRoom={handleLeaveRoom}
          onSignOut={async () => {
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
        onChangeTab={(tab) => {
          if ((tab === "CREATE" || tab === "JOIN") && !currentUser) {
            setOfflinePassPlayAllowed(false);
            return;
          }
          handleChangeTab(tab);
        }}
        onSelectKit={setSelectedKitId}
        onJoinRoom={handleJoinRoom}
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
          setScreen("SETUP");
          if (roomMode === "HOST" && snapshotRef.current) {
            publishHostSnapshot({
              ...snapshotRef.current,
              version: ++versionRef.current,
              screen: "LOBBY",
              teams: buildTeamsFromConfig(config, membersRef.current),
              updatedAt: Date.now(),
            });
          } else if (roomMode === "GUEST") {
            handleLeaveRoom();
          }
        }}
      />
    );
  }

  return (
    <FinalScorecard
      teams={teams}
      config={config}
      unsoldCount={unsoldCount}
      onRematch={() => (roomMode === "HOST" ? launchHostedRoom(config) : launchLocal(config))}
      onBackToSetup={() => {
        setScreen("SETUP");
        if (roomMode === "HOST" && snapshotRef.current) {
          publishHostSnapshot({
            ...snapshotRef.current,
            version: ++versionRef.current,
            screen: "LOBBY",
            teams: buildTeamsFromConfig(config, membersRef.current),
            updatedAt: Date.now(),
          });
        } else if (roomMode === "GUEST") {
          handleLeaveRoom();
        }
      }}
    />
  );
}

export default App;
