import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AuctionStage, type IncomingRoomCommand } from "./components/AuctionStage";
import { FinalScorecard } from "./components/FinalScorecard";
import { SetupLobby, type LobbyTab } from "./components/SetupLobby";
import { ALL_PLAYERS, CURATED_CHALLENGE_PLAYERS } from "./data/players";
import type {
  BroadcastPlayer,
  ChallengeConfig,
  ConnectedMember,
  FriendTeam,
  JerseyKitId,
  RoomAuctionSnapshot,
  RoomMode,
} from "./types/auction";
import { DEFAULT_TEAM_NAMES, JERSEY_THEMES, generateRoomCode } from "./utils/auctionRules";
import {
  createRealtimeTransport,
  getOrCreateClientId,
  normalizeRoomCode,
  type RealtimeRoomTransport,
  type RoomWireMessage,
} from "./utils/realtimeSync";

type AppScreen = "SETUP" | "STAGE" | "SCORECARD";

const INITIAL_CONFIG: ChallengeConfig = {
  teamCount: 10,
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
  return JERSEY_THEMES.slice(0, config.teamCount || 3).map((kit, idx) => {
    const member = safeMembers.find((m) => m.kitId === kit.id);
    return {
      id: `team-${kit.id}`,
      name: safeNames[idx] || kit.franchiseName || DEFAULT_TEAM_NAMES[idx],
      ownerName: member?.friendName,
      clientId: member?.clientId,
      connected: Boolean(member),
      kit,
      purseRemainingCr: config.purseCr,
      initialPurseCr: config.purseCr,
      squad: [],
    };
  });
}

export function App() {
  const clientId = useMemo(() => getOrCreateClientId(), []);

  const [screen, setScreen] = useState<AppScreen>("SETUP");
  const [lobbyTab, setLobbyTab] = useState<LobbyTab>("LOCAL");
  const [roomMode, setRoomMode] = useState<RoomMode>("LOCAL");
  const [roomCode, setRoomCode] = useState<string>(() => generateRoomCode(6));
  const [friendName, setFriendName] = useState<string>("Host Captain");
  const [selectedKitId, setSelectedKitId] = useState<JerseyKitId>("csk");
  const [config, setConfig] = useState<ChallengeConfig>(INITIAL_CONFIG);
  const [connectedMembers, setConnectedMembers] = useState<ConnectedMember[]>([]);
  const [joinStatus, setJoinStatus] = useState<string | null>(null);
  const [isJoinedWaiting, setIsJoinedWaiting] = useState(false);

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

  const transportMode = transportRef.current?.mode || "local";

  const teardownTransport = useCallback(() => {
    transportRef.current?.destroy();
    transportRef.current = null;
  }, []);

  // Host publishes updated RoomAuctionSnapshot to all connected friends
  const publishHostSnapshot = useCallback(
    (nextSnap: RoomAuctionSnapshot) => {
      snapshotRef.current = nextSnap;
      transportRef.current?.send({
        type: "STATE_SYNC",
        snapshot: nextSnap,
        senderId: clientId,
      });
    },
    [clientId],
  );

  // Initialize Host Room channel whenever user enters "CREATE" tab
  const connectAsHost = useCallback(
    (code: string, hostCfg: ChallengeConfig, hostName: string, hostKit: JerseyKitId) => {
      teardownTransport();
      const transport = createRealtimeTransport(code);
      transportRef.current = transport;

      const hostMember: ConnectedMember = {
        clientId,
        friendName: hostName.trim() || "Host Captain",
        kitId: hostKit,
        isHost: true,
        lastSeenAt: Date.now(),
      };
      setConnectedMembers([hostMember]);

      const initialSnap: RoomAuctionSnapshot = {
        roomCode: code,
        hostClientId: clientId,
        version: ++versionRef.current,
        screen: "LOBBY",
        config: hostCfg,
        members: [hostMember],
        teams: buildTeamsFromConfig(hostCfg, [hostMember]),
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
          setConnectedMembers((prev) => {
            const others = prev.filter((m) => m.clientId !== msg.clientId);
            const updated = [
              ...others,
              {
                clientId: msg.clientId,
                friendName: msg.friendName,
                kitId: msg.kitId,
                isHost: false,
                lastSeenAt: Date.now(),
              },
            ];
            if (snapshotRef.current) {
              const patched: RoomAuctionSnapshot = {
                ...snapshotRef.current,
                version: ++versionRef.current,
                members: updated,
                teams: snapshotRef.current.teams.map((t) => {
                  const m = updated.find((u) => u.kitId === t.kit.id);
                  return m ? { ...t, ownerName: m.friendName, clientId: m.clientId, connected: true } : t;
                }),
                updatedAt: Date.now(),
              };
              publishHostSnapshot(patched);
            }
            return updated;
          });
        } else if (msg.type === "REQUEST_SYNC") {
          if (snapshotRef.current) {
            publishHostSnapshot({
              ...snapshotRef.current,
              version: ++versionRef.current,
              updatedAt: Date.now(),
            });
          }
        } else if (msg.type === "REMOTE_BID") {
          setIncomingCommand({ seq: cmdSeqRef.current++, type: "BID", teamId: msg.teamId });
        } else if (msg.type === "REMOTE_PASS") {
          setIncomingCommand({ seq: cmdSeqRef.current++, type: "PASS", teamId: msg.teamId });
        } else if (msg.type === "PING") {
          setConnectedMembers((prev) =>
            prev.map((m) => (m.clientId === msg.clientId ? { ...m, lastSeenAt: msg.ts } : m)),
          );
        }
      });
    },
    [clientId, publishHostSnapshot, teardownTransport],
  );

  // Sync host lobby config / name / kit updates while on CREATE tab
  useEffect(() => {
    if (screen === "SETUP" && lobbyTab === "CREATE") {
      if (!transportRef.current || transportRef.current.roomCode !== roomCode) {
        connectAsHost(roomCode, config, friendName, selectedKitId);
      } else if (snapshotRef.current) {
        const updatedMembers = connectedMembers.map((m) =>
          m.clientId === clientId
            ? { ...m, friendName: friendName.trim() || "Host Captain", kitId: selectedKitId, lastSeenAt: Date.now() }
            : m,
        );
        if (JSON.stringify(updatedMembers) !== JSON.stringify(connectedMembers)) {
          setConnectedMembers(updatedMembers);
        }
        publishHostSnapshot({
          ...snapshotRef.current,
          version: ++versionRef.current,
          config,
          members: updatedMembers,
          teams: buildTeamsFromConfig(config, updatedMembers),
          updatedAt: Date.now(),
        });
      }
    }
  }, [screen, lobbyTab, roomCode, config, friendName, selectedKitId]);

  // Periodic heartbeat ping for connected peers
  useEffect(() => {
    if (roomMode === "LOCAL" && lobbyTab === "LOCAL") return;
    const timer = setInterval(() => {
      transportRef.current?.send({
        type: "PING",
        clientId,
        kitId: selectedKitId,
        ts: Date.now(),
      });
    }, 3000);
    return () => clearInterval(timer);
  }, [roomMode, lobbyTab, clientId, selectedKitId]);

  useEffect(() => () => teardownTransport(), [teardownTransport]);

  const handleChangeTab = (tab: LobbyTab) => {
    setLobbyTab(tab);
    setJoinStatus(null);
    setIsJoinedWaiting(false);
    if (tab === "LOCAL") {
      setRoomMode("LOCAL");
      teardownTransport();
    } else if (tab === "CREATE") {
      setRoomMode("HOST");
      connectAsHost(roomCode, config, friendName, selectedKitId);
    } else {
      setRoomMode("GUEST");
      teardownTransport();
    }
  };

  const handleJoinRoom = (rawCode: string, name: string, kitId: JerseyKitId) => {
    const code = normalizeRoomCode(rawCode);
    if (code.length !== 6) {
      setJoinStatus("Enter a valid 6-character room code.");
      return;
    }
    teardownTransport();
    setRoomCode(code);
    setRoomMode("GUEST");
    setSelectedKitId(kitId);
    setFriendName(name);

    const transport = createRealtimeTransport(code);
    transportRef.current = transport;

    const cached = transport.readCachedSnapshot();
    if (cached) {
      const safeCfg: ChallengeConfig = {
        ...INITIAL_CONFIG,
        ...cached.config,
        teamNames: Array.isArray(cached.config?.teamNames) ? cached.config.teamNames : [...DEFAULT_TEAM_NAMES],
      };
      const safeMembers = Array.isArray(cached.members) ? cached.members : [];
      const safeTeams = Array.isArray(cached.teams) ? cached.teams : buildTeamsFromConfig(safeCfg, safeMembers);
      setSyncedSnapshot({ ...cached, config: safeCfg, members: safeMembers, teams: safeTeams });
      setConfig(safeCfg);
      setConnectedMembers(safeMembers);
      setDeck(safeCfg.poolMode === "FULL_165" ? ALL_PLAYERS : CURATED_CHALLENGE_PLAYERS);
      if (cached.screen === "STAGE") {
        setScreen("STAGE");
      } else if (cached.screen === "SCORECARD") {
        setTeams(safeTeams);
        setUnsoldCount(cached.unsoldCount || 0);
        setScreen("SCORECARD");
      } else {
        setIsJoinedWaiting(true);
        setJoinStatus(`Connected to Room ${code}! Waiting for host to launch stage…`);
      }
    } else {
      setIsJoinedWaiting(true);
      setJoinStatus(`Connecting to Room ${code}… waiting for host response.`);
    }

    transport.subscribe((msg: RoomWireMessage) => {
      if (msg.type === "STATE_SYNC") {
        const snap = msg.snapshot;
        if (!snap || !snap.config) return;
        const safeCfg: ChallengeConfig = {
          ...INITIAL_CONFIG,
          ...snap.config,
          teamNames: Array.isArray(snap.config?.teamNames) ? snap.config.teamNames : [...DEFAULT_TEAM_NAMES],
        };
        const safeMembers = Array.isArray(snap.members) ? snap.members : [];
        const safeTeams = Array.isArray(snap.teams) ? snap.teams : buildTeamsFromConfig(safeCfg, safeMembers);
        setSyncedSnapshot({ ...snap, config: safeCfg, members: safeMembers, teams: safeTeams });
        setConfig(safeCfg);
        setConnectedMembers(safeMembers);
        setDeck(safeCfg.poolMode === "FULL_165" ? ALL_PLAYERS : CURATED_CHALLENGE_PLAYERS);
        if (snap.screen === "STAGE") {
          setIsJoinedWaiting(false);
          setScreen("STAGE");
        } else if (snap.screen === "SCORECARD") {
          setTeams(safeTeams);
          setUnsoldCount(snap.unsoldCount || 0);
          setScreen("SCORECARD");
        } else {
          setIsJoinedWaiting(true);
          setJoinStatus(`Connected to Room ${code}! Waiting for host to launch stage…`);
        }
      }
    });

    transport.send({ type: "JOIN_REQUEST", clientId, friendName: name, kitId });
    transport.send({ type: "REQUEST_SYNC", clientId });
  };

  const handleLeaveRoom = () => {
    teardownTransport();
    setIsJoinedWaiting(false);
    setJoinStatus(null);
    setConnectedMembers([]);
    setSyncedSnapshot(null);
    setScreen("SETUP");
  };

  const launchLocal = (nextConfig: ChallengeConfig) => {
    teardownTransport();
    setRoomMode("LOCAL");
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
        "roomCode" | "hostClientId" | "version" | "screen" | "config" | "members" | "updatedAt"
      >,
    ) => {
      if (roomMode !== "HOST") return;
      publishHostSnapshot({
        roomCode,
        hostClientId: clientId,
        version: ++versionRef.current,
        screen: "STAGE",
        config,
        members: connectedMembers,
        ...patch,
        updatedAt: Date.now(),
      });
    },
    [roomMode, roomCode, clientId, config, connectedMembers, publishHostSnapshot],
  );

  const myTeamId = roomMode === "LOCAL" ? null : `team-${selectedKitId}`;

  if (screen === "SETUP") {
    return (
      <SetupLobby
        initialConfig={config}
        activeTab={lobbyTab}
        roomCode={roomCode}
        transportMode={transportMode}
        friendName={friendName}
        selectedKitId={selectedKitId}
        connectedMembers={connectedMembers}
        joinStatus={joinStatus}
        isJoinedWaiting={isJoinedWaiting}
        onChangeTab={handleChangeTab}
        onFriendNameChange={setFriendName}
        onSelectKit={setSelectedKitId}
        onRegenerateCode={() => {
          const nextCode = generateRoomCode(6);
          setRoomCode(nextCode);
          connectAsHost(nextCode, config, friendName, selectedKitId);
        }}
        onJoinRoom={handleJoinRoom}
        onLeaveRoom={handleLeaveRoom}
        onConfigChange={setConfig}
        onStartLocal={launchLocal}
        onStartHostedRoom={launchHostedRoom}
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
        connectedMembers={connectedMembers}
        myTeamId={myTeamId}
        syncedSnapshot={syncedSnapshot}
        incomingCommand={incomingCommand}
        onHostPublishState={handleHostStagePublish}
        onGuestBid={(teamId) => {
          transportRef.current?.send({ type: "REMOTE_BID", clientId, teamId });
        }}
        onGuestPass={(teamId) => {
          transportRef.current?.send({ type: "REMOTE_PASS", clientId, teamId });
        }}
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
          if (roomMode === "GUEST") handleLeaveRoom();
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
        if (roomMode === "GUEST") handleLeaveRoom();
      }}
    />
  );
}

export default App;
