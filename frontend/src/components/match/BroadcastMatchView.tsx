import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  BotDifficulty,
  BowlingLength,
  BowlingLine,
  MatchState,
  ShotType,
  TimingGrade,
} from "../../engine/matchEngine";
import {
  chooseBotDelivery,
  formatOvers,
  getActiveInnings,
  getEligibleBowlers,
  getLineupById,
  resolveDelivery,
  setInningsBowler,
  simulateFullMatch,
  startSecondInnings,
} from "../../engine/matchEngine";
import type { PointsTableRow } from "../../engine/tournamentEngine";
import type { ThemeMode } from "../../types/auction";
import { soundEngine } from "../../utils/soundEngine";
import { CricketJerseySvg } from "../illustrations/CricketJerseySvg";
import { FullscreenLandscapeButton } from "../LandscapeGuard";
import {
  FIELDER_SPOTS,
  StadiumCanvas,
  type DeliveryAnimationState,
} from "./StadiumCanvas";

export type MatchControlMode = "VS_BOT" | "PASS_PLAY" | "WATCH_AI" | "ONLINE_FRIEND";

interface StingerBanner {
  id: number;
  kind: "FOUR" | "SIX" | "WICKET" | "FREE_HIT" | "NEW_BATTER";
  title: string;
  subtitle: string;
}

interface BroadcastMatchViewProps {
  initialMatch: MatchState;
  controlMode: MatchControlMode;
  botDifficulty?: BotDifficulty;
  myOnlineTeamId?: string | null;
  onlinePendingBowl?: {
    deliveryId: string;
    length: BowlingLength;
    line: BowlingLine;
    releaseAccuracy: number;
  } | null;
  onlineLeftNotice?: string | null;
  pointsTable?: PointsTableRow[];
  theme: ThemeMode;
  onToggleTheme: () => void;
  onMatchStateChange?: (match: MatchState) => void;
  onOnlineSubmitBowl?: (length: BowlingLength, line: BowlingLine, releaseAccuracy: number) => void;
  onOnlineSubmitBat?: (
    deliveryId: string,
    shotType: ShotType,
    timing: number,
    timingGrade: TimingGrade,
    lofted: boolean,
    stepOut: boolean,
  ) => void;
  onMatchComplete: (completed: MatchState) => void;
  onExit: () => void;
}

const SHOTS: ShotType[] = ["Defend", "Rotate", "Drive", "Loft", "Slog"];

const BOWLING_DELIVERIES: Array<{
  label: string;
  length: BowlingLength;
  line: BowlingLine;
}> = [
  { label: "LEG CUTTER", length: "Good", line: "Leg" },
  { label: "OFF CUTTER", length: "Good", line: "Off" },
  { label: "YORKER", length: "Yorker", line: "Middle" },
  { label: "BOUNCER", length: "Short", line: "Middle" },
];

const SHOT_DIRECTIONS: Array<{ label: string; angleDeg: number }> = [
  { label: "↖", angleDeg: -45 },
  { label: "↑", angleDeg: 0 },
  { label: "↗", angleDeg: 45 },
  { label: "←", angleDeg: -90 },
  { label: "•", angleDeg: 0 },
  { label: "→", angleDeg: 90 },
  { label: "↙", angleDeg: -135 },
  { label: "↓", angleDeg: 180 },
  { label: "↘", angleDeg: 135 },
];

function timingGradeLabel(g: TimingGrade): string {
  if (g === "PERFECT") return "PERFECT";
  if (g === "GOOD_EARLY") return "GOOD - EARLY";
  if (g === "GOOD_LATE") return "GOOD - LATE";
  if (g === "TOO_EARLY") return "EARLY";
  if (g === "TOO_LATE") return "LATE";
  return "MISSED";
}

export function BroadcastMatchView({
  initialMatch,
  controlMode,
  botDifficulty = "Medium",
  myOnlineTeamId,
  onlinePendingBowl,
  onlineLeftNotice,
  pointsTable,
  theme,
  onToggleTheme,
  onMatchStateChange,
  onOnlineSubmitBowl,
  onOnlineSubmitBat,
  onMatchComplete,
  onExit,
}: BroadcastMatchViewProps) {
  const [match, setMatch] = useState<MatchState>(initialMatch);
  const [watchAiMode, setWatchAiMode] = useState(controlMode === "WATCH_AI");
  const [aiSpeedMs, setAiSpeedMs] = useState<number>(1150);

  // Bowling & Batting WCC Pro-Control States
  const [selectedLength, setSelectedLength] = useState<BowlingLength>("Good");
  const [selectedLine, setSelectedLine] = useState<BowlingLine>("Off");
  const [selectedShot, setSelectedShot] = useState<ShotType>("Drive");
  const [loftToggle, setLoftToggle] = useState(false);
  const [stepOutToggle, setStepOutToggle] = useState(false);
  const [batterShiftX, setBatterShiftX] = useState(0);
  const [shotAimAngleDeg, setShotAimAngleDeg] = useState(0);
  const [battingCameraMode, setBattingCameraMode] = useState<"BATSMAN_END" | "BOWLER_END">("BATSMAN_END");

  const [meterPos, setMeterPos] = useState(0.5);
  const [phaseGate, setPhaseGate] = useState<"READY" | "BOWL_METER" | "BAT_TIMING" | "ANIMATING">("READY");
  const [lockedBowl, setLockedBowl] = useState<{
    length: BowlingLength;
    line: BowlingLine;
    releaseAccuracy: number;
  } | null>(null);
  const [timingCallout, setTimingCallout] = useState<TimingGrade | null>(null);
  const [lastSpeedKmh, setLastSpeedKmh] = useState<number | null>(null);
  const [lastSixDistM, setLastSixDistM] = useState<number | null>(null);
  const [stinger, setStinger] = useState<StingerBanner | null>(null);
  const [isMuted, setIsMuted] = useState(soundEngine.isMuted());
  const [scorebugExpanded, setScorebugExpanded] = useState(true);
  const [drawer, setDrawer] = useState<"NONE" | "MENU" | "SCORECARD" | "COMMENTARY" | "POINTS">("NONE");
  const [animation, setAnimation] = useState<DeliveryAnimationState>({
    key: 1,
    outcome: null,
    phase: "IDLE",
    activeLength: "Good",
    activeLine: "Off",
  });

  const stingerSeq = useRef(1);
  const prevStrikerIdRef = useRef<number | null>(null);
  const lastRemoteBallCountRef = useRef<number>(0);

  const showStinger = useCallback(
    (kind: StingerBanner["kind"], title: string, subtitle: string) => {
      const id = stingerSeq.current++;
      setStinger({ id, kind, title, subtitle });
      setTimeout(() => {
        setStinger((cur) => (cur?.id === id ? null : cur));
      }, 1250);
    },
    [],
  );

  // Sync external updates in Online Friend mode
  useEffect(() => {
    if (controlMode !== "ONLINE_FRIEND") return;
    setMatch(initialMatch);
    const totalBalls =
      initialMatch.innings1.ballLog.length +
      (initialMatch.innings2?.ballLog.length ?? 0) +
      (initialMatch.superOver1?.ballLog.length ?? 0) +
      (initialMatch.superOver2?.ballLog.length ?? 0);
    if (totalBalls > lastRemoteBallCountRef.current) {
      lastRemoteBallCountRef.current = totalBalls;
      const curInn = getActiveInnings(initialMatch) || initialMatch.innings2 || initialMatch.innings1;
      const latest = curInn.ballLog[curInn.ballLog.length - 1];
      if (latest) {
        soundEngine.playDeliveryAudio(latest);
        setLastSpeedKmh(latest.ballSpeedKmh);
        setLastSixDistM(latest.runs === 6 ? latest.shotDistanceM ?? 92 : null);
        setTimingCallout(latest.timingGrade);
        setPhaseGate("ANIMATING");
        setAnimation({
          key: Date.now(),
          outcome: latest,
          phase: "RESOLVING",
          activeLength: latest.length,
          activeLine: latest.line,
          speedPreviewKmh: latest.ballSpeedKmh,
        });
        setTimeout(() => {
          setPhaseGate("READY");
        }, 1100);
      }
    }
  }, [controlMode, initialMatch]);

  const active = getActiveInnings(match);
  const battingLineup = active ? getLineupById(match, active.battingTeamId) : match.teamA;
  const bowlingLineup = active ? getLineupById(match, active.bowlingTeamId) : match.teamB;

  const striker = active
    ? battingLineup.players.find((p) => p.id === active.strikerId) || battingLineup.players[0]
    : null;
  const nonStriker =
    active && active.nonStrikerId
      ? battingLineup.players.find((p) => p.id === active.nonStrikerId) || null
      : null;
  const currentBowler = active
    ? bowlingLineup.players.find((p) => p.id === active.currentBowlerId) || bowlingLineup.players[0]
    : null;

  const eligibleBowlers = useMemo(
    () => (active ? getEligibleBowlers(bowlingLineup, active) : []),
    [active, bowlingLineup],
  );

  const isStartOfOver = Boolean(active && active.legalBalls % 6 === 0 && !active.completed);

  const userControlsBatting = (() => {
    if (!active || watchAiMode) return false;
    if (controlMode === "PASS_PLAY") return true;
    if (controlMode === "VS_BOT") return active.battingTeamId === match.teamA.teamId;
    if (controlMode === "ONLINE_FRIEND") return active.battingTeamId === myOnlineTeamId;
    return false;
  })();

  const userControlsBowling = (() => {
    if (!active || watchAiMode) return false;
    if (controlMode === "PASS_PLAY") return true;
    if (controlMode === "VS_BOT") return active.bowlingTeamId === match.teamA.teamId;
    if (controlMode === "ONLINE_FRIEND") return active.bowlingTeamId === myOnlineTeamId;
    return false;
  })();

  useEffect(() => {
    if (!active || !striker) return;
    if (prevStrikerIdRef.current !== null && prevStrikerIdRef.current !== striker.id) {
      const prevStat = active.batterStats[prevStrikerIdRef.current];
      if (prevStat?.isOut) {
        showStinger(
          "NEW_BATTER",
          `NEW BATTER: ${striker.name}`,
          `${striker.role} • BAT ${striker.batOvr} • PWR ${striker.power}`,
        );
      }
    }
    prevStrikerIdRef.current = striker.id;
  }, [active, striker, showStinger]);

  useEffect(() => {
    if (phaseGate !== "BOWL_METER" && phaseGate !== "BAT_TIMING") return;
    let rafId = 0;
    const start = performance.now();
    const speed = phaseGate === "BAT_TIMING" ? 0.0028 : 0.0024;
    const tick = (now: number) => {
      const t = (now - start) * speed;
      const mod = t % 2;
      const val = mod <= 1 ? mod : 2 - mod;
      setMeterPos(val);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [phaseGate]);

  const executeAndAnimateBall = useCallback(
    (
      length: BowlingLength,
      line: BowlingLine,
      releaseAccuracy: number,
      shotType: ShotType,
      timing: number,
      timingGrade: TimingGrade,
      lofted = false,
      stepOut = false,
    ) => {
      const { match: nextM, outcome } = resolveDelivery(match, {
        length,
        line,
        releaseAccuracy,
        shotType,
        timing,
        timingGrade,
        lofted,
        stepOut,
      });

      setTimingCallout(timingGrade);
      setLastSpeedKmh(outcome.ballSpeedKmh);
      setLastSixDistM(outcome.runs === 6 ? outcome.shotDistanceM ?? 92 : null);
      setPhaseGate("ANIMATING");
      setAnimation({
        key: Date.now(),
        outcome,
        phase: "RESOLVING",
        activeLength: length,
        activeLine: line,
        speedPreviewKmh: outcome.ballSpeedKmh,
      });

      soundEngine.playDeliveryAudio(outcome);

      if (outcome.isWicket) {
        showStinger(
          "WICKET",
          outcome.wicketKind === "BOWLED"
            ? "BOWLED HIM!"
            : outcome.wicketKind === "RUN_OUT"
            ? "RUN OUT!"
            : "WICKET!",
          `${outcome.batterName} ${outcome.wicketKind} b ${outcome.bowlerName}`,
        );
      } else if (outcome.runs === 6) {
        showStinger("SIX", `SIX DISTANCE : ${outcome.shotDistanceM ?? 88}m`, outcome.batterName);
      } else if (outcome.runs === 4) {
        showStinger("FOUR", "CRACKING FOUR!", `${outcome.batterName} • ${outcome.shotType}`);
      } else if (outcome.isFreeHitNext) {
        showStinger("FREE_HIT", "NO BALL • FREE HIT!", "Next delivery is a Free Hit");
      }

      setTimeout(() => {
        setMatch(nextM);
        onMatchStateChange?.(nextM);
        setPhaseGate("READY");
        setLockedBowl(null);
      }, 1150);
    },
    [match, onMatchStateChange, showStinger],
  );

  const handleBowlRelease = useCallback(() => {
    if (!active || phaseGate !== "BOWL_METER") return;
    const dist = Math.abs(meterPos - 0.5);
    const releaseAccuracy = Math.max(0.2, Math.min(1, 1 - dist * 1.85));

    if (controlMode === "ONLINE_FRIEND" && !userControlsBatting) {
      onOnlineSubmitBowl?.(selectedLength, selectedLine, releaseAccuracy);
      setPhaseGate("ANIMATING");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "BOWLING",
        activeLength: selectedLength,
        activeLine: selectedLine,
      });
      return;
    }

    if (!userControlsBatting) {
      const botBat = chooseBotDelivery(active, botDifficulty, match.rngState, false, true);
      executeAndAnimateBall(
        selectedLength,
        selectedLine,
        releaseAccuracy,
        botBat.input.shotType,
        botBat.input.timing,
        botBat.input.timingGrade ?? "GOOD_LATE",
        Boolean(botBat.input.lofted),
        false,
      );
    } else {
      setLockedBowl({ length: selectedLength, line: selectedLine, releaseAccuracy });
      setPhaseGate("BAT_TIMING");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "AWAITING_HIT",
        activeLength: selectedLength,
        activeLine: selectedLine,
      });
    }
  }, [
    active,
    phaseGate,
    meterPos,
    controlMode,
    userControlsBatting,
    selectedLength,
    selectedLine,
    onOnlineSubmitBowl,
    botDifficulty,
    match.rngState,
    executeAndAnimateBall,
  ]);

  const handleBatHit = useCallback(
    (forceDefend = false) => {
      if (!active || phaseGate !== "BAT_TIMING") return;
      const offset = meterPos - 0.5;
      const dist = Math.abs(offset);
      const timing = forceDefend ? 0.85 : Math.max(0.12, Math.min(1, 1 - dist * 1.9));
      const grade: TimingGrade = forceDefend
        ? "GOOD_LATE"
        : dist <= 0.08
        ? "PERFECT"
        : dist <= 0.2
        ? offset < 0
          ? "GOOD_EARLY"
          : "GOOD_LATE"
        : dist <= 0.35
        ? offset < 0
          ? "TOO_EARLY"
          : "TOO_LATE"
        : "MISSED";

      const effectiveShot: ShotType = forceDefend
        ? "Defend"
        : loftToggle && (selectedShot === "Defend" || selectedShot === "Rotate")
        ? "Loft"
        : selectedShot;

      if (controlMode === "ONLINE_FRIEND" && onlinePendingBowl) {
        onOnlineSubmitBat?.(
          onlinePendingBowl.deliveryId,
          effectiveShot,
          timing,
          grade,
          forceDefend ? false : loftToggle,
          forceDefend ? false : stepOutToggle,
        );
        setTimingCallout(grade);
        setPhaseGate("ANIMATING");
        return;
      }

      const bowl =
        lockedBowl ||
        chooseBotDelivery(active, botDifficulty, match.rngState, true, false).input;

      executeAndAnimateBall(
        bowl.length,
        bowl.line,
        bowl.releaseAccuracy,
        effectiveShot,
        timing,
        grade,
        forceDefend ? false : loftToggle,
        forceDefend ? false : stepOutToggle,
      );
    },
    [
      active,
      phaseGate,
      meterPos,
      loftToggle,
      selectedShot,
      controlMode,
      onlinePendingBowl,
      onOnlineSubmitBat,
      stepOutToggle,
      lockedBowl,
      botDifficulty,
      match.rngState,
      executeAndAnimateBall,
    ],
  );

  const handleStartBall = useCallback(() => {
    if (!active || phaseGate !== "READY") return;
    if (userControlsBowling) {
      setPhaseGate("BOWL_METER");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "BOWLING",
        activeLength: selectedLength,
        activeLine: selectedLine,
      });
    } else if (userControlsBatting) {
      const botBowl = chooseBotDelivery(active, botDifficulty, match.rngState, true, false).input;
      setLockedBowl({
        length: botBowl.length,
        line: botBowl.line,
        releaseAccuracy: botBowl.releaseAccuracy,
      });
      setPhaseGate("BAT_TIMING");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "AWAITING_HIT",
        activeLength: botBowl.length,
        activeLine: botBowl.line,
      });
    }
  }, [active, phaseGate, userControlsBowling, userControlsBatting, selectedLength, selectedLine, botDifficulty, match.rngState]);

  useEffect(() => {
    if (
      controlMode === "ONLINE_FRIEND" &&
      userControlsBatting &&
      onlinePendingBowl &&
      phaseGate === "READY"
    ) {
      setLockedBowl({
        length: onlinePendingBowl.length,
        line: onlinePendingBowl.line,
        releaseAccuracy: onlinePendingBowl.releaseAccuracy,
      });
      setPhaseGate("BAT_TIMING");
      setAnimation({
        key: Date.now(),
        outcome: null,
        phase: "AWAITING_HIT",
        activeLength: onlinePendingBowl.length,
        activeLine: onlinePendingBowl.line,
      });
    }
  }, [controlMode, userControlsBatting, onlinePendingBowl, phaseGate]);

  useEffect(() => {
    if (!watchAiMode || match.phase === "COMPLETE" || match.phase === "INNINGS_BREAK") return;
    if (!active || phaseGate !== "READY") return;
    const timer = setTimeout(() => {
      const { input } = chooseBotDelivery(active, botDifficulty, match.rngState, true, true);
      executeAndAnimateBall(
        input.length,
        input.line,
        input.releaseAccuracy,
        input.shotType,
        input.timing,
        input.timingGrade ?? "GOOD_LATE",
        Boolean(input.lofted),
        false,
      );
    }, aiSpeedMs);
    return () => clearTimeout(timer);
  }, [watchAiMode, match.phase, match.rngState, active, phaseGate, botDifficulty, aiSpeedMs, executeAndAnimateBall]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.code === "Space") {
        e.preventDefault();
        if (phaseGate === "BOWL_METER") handleBowlRelease();
        else if (phaseGate === "BAT_TIMING") handleBatHit();
        else if (phaseGate === "READY") handleStartBall();
      } else if (e.code === "ArrowLeft" && userControlsBatting) {
        setBatterShiftX((x) => Math.max(-0.55, x - 0.15));
      } else if (e.code === "ArrowRight" && userControlsBatting) {
        setBatterShiftX((x) => Math.min(0.55, x + 0.15));
      } else if (e.code === "KeyW" && userControlsBatting) {
        setShotAimAngleDeg(0);
      } else if (e.code === "KeyS" && userControlsBatting) {
        setShotAimAngleDeg(180);
      } else if (e.code === "KeyA" && userControlsBatting) {
        setShotAimAngleDeg(-90);
      } else if (e.code === "KeyD" && userControlsBatting) {
        setShotAimAngleDeg(90);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phaseGate, handleBowlRelease, handleBatHit, handleStartBall, userControlsBatting]);

  const handleInstantSim = () => {
    const simmed = simulateFullMatch(match, botDifficulty);
    setMatch(simmed);
    onMatchStateChange?.(simmed);
    setDrawer("NONE");
  };

  const chaseInfo = useMemo(() => {
    if (!active || active.targetRuns === null) return null;
    const needed = Math.max(0, active.targetRuns - active.runs);
    const ballsLeft = Math.max(1, active.maxOvers * 6 - active.legalBalls);
    const rrr = ((needed / ballsLeft) * 6).toFixed(2);
    return { needed, ballsLeft, rrr };
  }, [active]);

  const inSweetSpot = meterPos >= 0.36 && meterPos <= 0.64;

  const isBowlerMode = Boolean(userControlsBowling && phaseGate !== "BAT_TIMING");
  const isBatterMode = Boolean(userControlsBatting && (!userControlsBowling || phaseGate === "BAT_TIMING"));

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden bg-[#060B18] text-white select-none">
      {/* FULL-BLEED 3D THREE.JS STADIUM */}
      <div className="absolute inset-0">
        <StadiumCanvas
          pitch={match.config.pitch}
          battingColor={battingLineup.kit.primary}
          bowlingColor={bowlingLineup.kit.primary}
          canPickTarget={Boolean(isBowlerMode && (phaseGate === "READY" || phaseGate === "BOWL_METER"))}
          isBowlingCamera={isBowlerMode}
          battingCameraMode={battingCameraMode}
          selectedLength={selectedLength}
          selectedLine={selectedLine}
          batterShiftX={batterShiftX}
          shotAimAngleDeg={shotAimAngleDeg}
          showShotAimCone={isBatterMode}
          bowlerJerseyNumber={currentBowler ? (currentBowler.id % 89) + 10 : 19}
          onPickTarget={(len, ln) => {
            setSelectedLength(len);
            setSelectedLine(ln);
          }}
          animation={animation}
        />
      </div>

      {/* TOP-LEFT: WCC CIRCULAR FIELD RADAR MINI-MAP WITH LIVE AIM WEDGE */}
      <div className="absolute top-2.5 left-2.5 z-20 flex items-start gap-2 pointer-events-none">
        <svg
          viewBox="0 0 100 100"
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-950/70 border-2 border-emerald-300/65 backdrop-blur-sm shadow-xl"
        >
          {/* 30-yard circle */}
          <circle cx="50" cy="50" r="22" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="0.9" strokeDasharray="2.5 2" />
          {/* Pitch strip */}
          <rect x="46.5" y="40" width="7" height="20" rx="1" fill="#d6b888" opacity="0.9" />
          {/* Live Shot Aim Sector Wedge (matches 3D shotAimGroup!) */}
          {isBatterMode && (() => {
            const bx = 50;
            const by = 56;
            const r = 42;
            const baseDeg = battingCameraMode === "BOWLER_END" ? shotAimAngleDeg + 180 : shotAimAngleDeg;
            const rad0 = ((baseDeg - 20) * Math.PI) / 180;
            const rad1 = ((baseDeg + 20) * Math.PI) / 180;
            const x1 = bx + Math.sin(rad0) * r;
            const y1 = by - Math.cos(rad0) * r;
            const x2 = bx + Math.sin(rad1) * r;
            const y2 = by - Math.cos(rad1) * r;
            return (
              <path
                d={`M ${bx} ${by} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`}
                fill="rgba(250, 204, 21, 0.36)"
                stroke="#facc15"
                strokeWidth="0.9"
              />
            );
          })()}
          {/* Stumps dots */}
          <circle cx="50" cy="42" r="1.2" fill="#ef4444" />
          <circle cx="50" cy="58" r="1.2" fill="#ef4444" />
          {/* 9 Fielder Yellow Dots */}
          {FIELDER_SPOTS.map(([fx, fz], i) => {
            const rx = 50 + (fx / 70) * 44;
            const ry = 50 + (fz / 70) * 44;
            return <circle key={i} cx={rx} cy={ry} r="2.2" fill="#facc15" stroke="#0f172a" strokeWidth="0.5" />;
          })}
          {/* Keeper dot */}
          <circle cx="50" cy="63" r="2.2" fill="#38bdf8" />
        </svg>

        <div className="hidden sm:flex flex-col gap-1 pt-1">
          <span className="px-2 py-0.5 rounded bg-slate-950/75 border border-white/15 text-[10px] font-black uppercase text-emerald-300">
            {match.config.pitch} Pitch
          </span>
          {active?.isFreeHit && (
            <span className="px-2 py-0.5 rounded bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse">
              ★ FREE HIT
            </span>
          )}
          {!active?.isSuperOver && active && Math.floor(active.legalBalls / 6) < 2 && (
            <span className="px-2 py-0.5 rounded bg-sky-500/80 text-white text-[9px] font-black">
              POWERPLAY
            </span>
          )}
        </div>
      </div>

      {/* TOP-RIGHT: WCC PAUSE BUTTON + DELIVERY TYPE CIRCLES (WHEN BOWLING) */}
      <div className="absolute top-2.5 right-2.5 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5">
          {watchAiMode && (
            <div className="flex items-center gap-1 bg-slate-950/85 border border-amber-400/40 rounded-full px-2.5 py-1 text-[10px]">
              <span className="font-black text-amber-300">AI vs AI</span>
              <button
                type="button"
                onClick={() => setAiSpeedMs(1200)}
                className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${aiSpeedMs === 1200 ? "bg-amber-400 text-slate-950" : ""}`}
              >
                1x
              </button>
              <button
                type="button"
                onClick={() => setAiSpeedMs(500)}
                className={`px-1.5 py-0.5 rounded font-bold cursor-pointer ${aiSpeedMs === 500 ? "bg-amber-400 text-slate-950" : ""}`}
              >
                2x
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !isMuted;
              setIsMuted(next);
              soundEngine.setMuted(next);
            }}
            className="w-9 h-9 rounded-full bg-slate-950/80 border border-white/25 flex items-center justify-center text-sm shadow-lg cursor-pointer"
          >
            {isMuted ? "🔇" : "🔊"}
          </button>
          <button
            type="button"
            onClick={() => setDrawer((d) => (d === "NONE" ? "MENU" : "NONE"))}
            title="Match Menu / Scorecard / Commentary"
            className="w-10 h-10 rounded-full bg-sky-600/90 hover:bg-sky-500 border-2 border-white/80 flex items-center justify-center font-black text-white text-sm shadow-xl cursor-pointer"
          >
            ⏸
          </button>
        </div>

        {/* WCC Horizontal Top-Right Batting Timing Meter (Red-Orange-Green-Orange-Red) */}
        {isBatterMode && !watchAiMode && (phaseGate === "BAT_TIMING" || (phaseGate === "ANIMATING" && timingCallout)) && (
          <div className="flex flex-col items-end gap-0.5 bg-slate-950/80 backdrop-blur-sm border border-white/15 rounded-xl px-2.5 py-1.5 shadow-xl">
            <div className="relative w-32 sm:w-40 h-3 rounded-full overflow-hidden border border-white/30 bg-gradient-to-r from-rose-600 via-amber-400 to-rose-600">
              <div className="absolute inset-y-0 left-[36%] w-[28%] bg-emerald-500 border-x border-white/80" />
              <div
                className="absolute -top-0.5 w-2 h-4 bg-white border border-slate-950 rounded-sm shadow"
                style={{ left: `calc(${Math.max(4, Math.min(96, meterPos * 100))}% - 4px)` }}
              />
            </div>
            <div className="text-[10px] font-black tracking-wider uppercase text-amber-300">
              {timingCallout && phaseGate === "ANIMATING" ? timingGradeLabel(timingCallout) : "TIMING BAR"}
            </div>
          </div>
        )}

        {/* WCC Circular Delivery Buttons when Bowling */}
        {isBowlerMode && (phaseGate === "READY" || phaseGate === "BOWL_METER") && (
          <div className="grid grid-cols-2 gap-1.5 bg-slate-950/55 backdrop-blur-sm rounded-2xl p-1.5 border border-white/10">
            {BOWLING_DELIVERIES.map((del) => {
              const activeDel = selectedLength === del.length && selectedLine === del.line;
              return (
                <button
                  key={del.label}
                  type="button"
                  onClick={() => {
                    setSelectedLength(del.length);
                    setSelectedLine(del.line);
                  }}
                  className={`flex flex-col items-center justify-center w-16 h-12 rounded-xl border text-[9px] font-black leading-tight cursor-pointer transition ${
                    activeDel
                      ? "bg-amber-400 text-slate-950 border-white shadow-lg"
                      : "bg-slate-900/80 text-white border-white/20 hover:border-amber-300"
                  }`}
                >
                  <span className="text-xs">⚾</span>
                  <span>{del.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* PLAYER LEFT BANNER */}
      {onlineLeftNotice && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-rose-600/95 border border-white/30 text-white px-4 py-1.5 rounded-full text-xs font-black shadow-xl">
          ⚠️ {onlineLeftNotice}
        </div>
      )}

      {/* BOWLER CHOICE AT START OF OVER */}
      {isStartOfOver && userControlsBowling && phaseGate === "READY" && !watchAiMode && (
        <div className="absolute top-28 left-2.5 z-20 max-w-[260px] rounded-xl bg-slate-950/85 border border-sky-400/45 p-2 space-y-1 shadow-xl">
          <div className="text-[10px] font-black uppercase text-sky-300">Select Bowler (Over {Math.floor((active?.legalBalls ?? 0) / 6) + 1})</div>
          <div className="flex flex-wrap gap-1">
            {eligibleBowlers.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setMatch((m) => setInningsBowler(m, b.id))}
                className={`px-2 py-1 rounded text-[10px] font-black cursor-pointer border ${
                  currentBowler?.id === b.id
                    ? "bg-sky-400 text-slate-950 border-white"
                    : "bg-slate-800 text-slate-200 border-white/15"
                }`}
              >
                {b.name.split(" ").slice(-1)[0]} ({b.bowlOvr})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* WCC PRO-CONTROL BATTING LEFT CLUSTER: LOFT/ADVANCE + SHOT COMPASS + CREASE FOOTWORK */}
      {isBatterMode && !watchAiMode && (phaseGate === "READY" || phaseGate === "BAT_TIMING") && (
        <div className="absolute bottom-[74px] sm:bottom-[82px] left-2.5 z-20 flex flex-col gap-1.5">
          {/* LOFT % Ring + ADVANCE Circular Buttons (WCC Pro-Control Left Stack) */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setLoftToggle((v) => !v)}
              className={`w-11 h-11 rounded-full border-2 flex flex-col items-center justify-center text-[8px] font-black shadow-xl cursor-pointer transition ${
                loftToggle
                  ? "bg-gradient-to-b from-amber-300 to-amber-500 border-white text-slate-950 scale-105"
                  : "bg-slate-950/80 border-cyan-400/80 text-cyan-200 hover:border-amber-300"
              }`}
              title="Toggle Lofted Shot"
            >
              <span className="text-[10px] leading-none">{loftToggle ? "100%" : "LOFT"}</span>
              <span className="text-[7px] opacity-85">{loftToggle ? "LOFT ON" : "GROUND"}</span>
            </button>

            <button
              type="button"
              onClick={() => setStepOutToggle((v) => !v)}
              className={`w-11 h-11 rounded-full border-2 flex flex-col items-center justify-center text-[8px] font-black shadow-xl cursor-pointer transition ${
                stepOutToggle
                  ? "bg-amber-400 border-white text-slate-950 scale-105"
                  : "bg-slate-950/80 border-amber-300/70 text-amber-200 hover:border-white"
              }`}
              title="Advance Down Pitch"
            >
              <span className="text-xs leading-none">👣</span>
              <span>ADV</span>
            </button>
          </div>

          <div className="flex items-end gap-1.5">
            {/* 8-Way Shot Direction Compass */}
            <div className="rounded-2xl bg-slate-950/75 backdrop-blur-sm border border-amber-400/40 p-1.5 shadow-xl">
              <div className="text-[8px] font-black uppercase text-center text-amber-300 mb-0.5">
                Shot Aim
              </div>
              <div className="grid grid-cols-3 gap-0.5">
                {SHOT_DIRECTIONS.map((d) => {
                  const isCenter = d.label === "•";
                  const isSelected = !isCenter && shotAimAngleDeg === d.angleDeg;
                  return (
                    <button
                      key={d.label}
                      type="button"
                      onClick={() => {
                        if (!isCenter) setShotAimAngleDeg(d.angleDeg);
                      }}
                      className={`w-6 h-6 rounded flex items-center justify-center text-xs font-black cursor-pointer ${
                        isCenter
                          ? "bg-slate-800 text-slate-400 cursor-default"
                          : isSelected
                          ? "bg-amber-400 text-slate-950 shadow"
                          : "bg-slate-900/90 text-amber-200 hover:bg-slate-800"
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Crease Footwork Box (Left/Right Stance Shift) */}
            <div className="flex flex-col gap-1 bg-slate-950/75 border border-white/15 rounded-xl p-1.5">
              <span className="text-[8px] font-bold uppercase text-center text-slate-300">Crease</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBatterShiftX((x) => Math.max(-0.55, x - 0.15))}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-black text-amber-300 cursor-pointer"
                >
                  ◀
                </button>
                <button
                  type="button"
                  onClick={() => setBatterShiftX((x) => Math.min(0.55, x + 0.15))}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs font-black text-amber-300 cursor-pointer"
                >
                  ▶
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* WCC BOWLING LINE PAD LEFT (ABOVE SCOREBUG) */}
      {isBowlerMode && !watchAiMode && (phaseGate === "READY" || phaseGate === "BOWL_METER") && (
        <div className="absolute bottom-[74px] sm:bottom-[82px] left-2.5 z-20 flex items-center gap-1.5 rounded-2xl bg-slate-950/75 border border-white/15 p-2 shadow-xl">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-black uppercase text-sky-300">Line</span>
            <div className="flex gap-1">
              {(["Off", "Middle", "Leg"] as const).map((ln) => (
                <button
                  key={ln}
                  type="button"
                  onClick={() => setSelectedLine(ln)}
                  className={`px-2 py-1 rounded text-[10px] font-black cursor-pointer ${
                    selectedLine === ln ? "bg-sky-400 text-slate-950" : "bg-slate-800 text-slate-200"
                  }`}
                >
                  {ln}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RIGHT-SIDE WCC BOWLING METER OR BATTING LEAVE + SHOT TYPE + CURVED BAT ACTION */}
      {active && match.phase !== "COMPLETE" && match.phase !== "INNINGS_BREAK" && !watchAiMode && (
        <div className="absolute bottom-[74px] sm:bottom-[82px] right-2.5 z-20 flex items-end gap-2">
          {/* BATTING: Shot Pills + LEAVE Circle + Main BAT Swing Arc */}
          {isBatterMode && (
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex flex-wrap justify-end gap-1 bg-slate-950/70 backdrop-blur-sm rounded-xl p-1 border border-white/15">
                {SHOTS.map((sh) => (
                  <button
                    key={sh}
                    type="button"
                    onClick={() => setSelectedShot(sh)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                      selectedShot === sh
                        ? "bg-amber-400 text-slate-950"
                        : "bg-slate-800 text-slate-200"
                    }`}
                  >
                    {sh}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {phaseGate === "BAT_TIMING" && (
                  <button
                    type="button"
                    onClick={() => handleBatHit(true)}
                    className="w-11 h-11 rounded-full bg-slate-900/90 border-2 border-amber-300/75 text-amber-200 hover:text-white flex flex-col items-center justify-center text-[8px] font-black shadow-xl cursor-pointer"
                    title="Leave / Defensive Block"
                  >
                    <span className="text-xs leading-none">🛡</span>
                    <span>LEAVE</span>
                  </button>
                )}

                {phaseGate === "READY" ? (
                  <button
                    type="button"
                    onClick={handleStartBall}
                    className="px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl cursor-pointer border-2 border-white/60"
                  >
                    🏏 Face Ball (Space)
                  </button>
                ) : phaseGate === "BAT_TIMING" ? (
                  <button
                    type="button"
                    onClick={() => handleBatHit(false)}
                    className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-400 via-lime-400 to-amber-400 text-slate-950 font-black text-sm uppercase tracking-wider shadow-xl cursor-pointer border-2 border-white animate-pulse"
                  >
                    🏏 BAT! (Space)
                  </button>
                ) : (
                  <span className="px-3 py-2 rounded-xl bg-slate-950/75 text-[11px] font-bold text-slate-300">
                    {controlMode === "ONLINE_FRIEND" && !onlinePendingBowl ? "Waiting…" : "Shot…"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* BOWLING: WCC Curved Speed/Release Meter + Ball */}
          {isBowlerMode && (
            <div className="flex flex-col items-center gap-1.5 bg-slate-950/80 backdrop-blur-sm border border-white/15 rounded-2xl p-2.5 shadow-2xl">
              {/* Curved Red-Orange-Green-Orange-Red Arc */}
              <svg viewBox="0 0 120 44" className="w-28 h-10">
                <path d="M 10 38 Q 60 2 110 38" fill="none" stroke="#dc2626" strokeWidth="8" strokeLinecap="round" />
                <path d="M 26 24 Q 60 4 94 24" fill="none" stroke="#f59e0b" strokeWidth="8" strokeLinecap="round" />
                <path d="M 46 15 Q 60 9 74 15" fill="none" stroke="#22c55e" strokeWidth="8" strokeLinecap="round" />
                {(() => {
                  const activePos = phaseGate === "BOWL_METER" ? meterPos : 0.5;
                  const x = 10 + activePos * 100;
                  const y = 38 - Math.sin(activePos * Math.PI) * 20;
                  return (
                    <circle
                      cx={x}
                      cy={y}
                      r="6"
                      fill={inSweetSpot ? "#fde047" : "#ffffff"}
                      stroke="#0f172a"
                      strokeWidth="2"
                    />
                  );
                })()}
              </svg>

              {phaseGate === "READY" ? (
                <button
                  type="button"
                  onClick={handleStartBall}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg"
                >
                  ⚾ Bowl (Space)
                </button>
              ) : phaseGate === "BOWL_METER" ? (
                <button
                  type="button"
                  onClick={handleBowlRelease}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-300 to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer shadow-lg animate-pulse"
                >
                  RELEASE!
                </button>
              ) : (
                <span className="text-[10px] font-bold text-slate-300">Delivering…</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* KINETIC TV STINGERS */}
      {stinger && (
        <div className="absolute inset-x-0 top-16 flex justify-center pointer-events-none z-30 px-4">
          <div
            className={`px-6 py-2.5 rounded-2xl border-2 backdrop-blur-md shadow-2xl text-center preserve-dark ${
              stinger.kind === "WICKET"
                ? "bg-rose-950/95 border-rose-400 text-white"
                : stinger.kind === "SIX"
                ? "bg-amber-950/95 border-amber-300 text-amber-200"
                : stinger.kind === "FOUR"
                ? "bg-sky-950/95 border-sky-400 text-sky-200"
                : "bg-slate-950/95 border-emerald-400 text-emerald-200"
            }`}
          >
            <div className="text-lg sm:text-2xl font-black tracking-widest uppercase">
              {stinger.kind === "WICKET" && "🏏💥 "}
              {stinger.title}
            </div>
            <div className="text-xs font-bold text-slate-200">{stinger.subtitle}</div>
          </div>
        </div>
      )}

      {/* INNINGS BREAK & MATCH COMPLETE MODALS */}
      {match.phase === "INNINGS_BREAK" && (
        <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl bg-slate-900 border border-amber-400/50 p-5 text-center space-y-3 shadow-2xl">
            <div className="text-xs font-black uppercase tracking-widest text-amber-300">End of 1st Innings</div>
            <div className="text-2xl font-black text-white tnum">
              {getLineupById(match, match.innings1.battingTeamId).name}:{" "}
              <span className="text-amber-300">
                {match.innings1.runs}/{match.innings1.wickets}
              </span>{" "}
              ({formatOvers(match.innings1.legalBalls)})
            </div>
            <div className="text-sm font-bold text-emerald-300">
              Target to Win: {match.innings1.runs + 1} runs in 6.0 overs
            </div>
            <button
              type="button"
              onClick={() => {
                const started = startSecondInnings(match);
                setMatch(started);
                onMatchStateChange?.(started);
              }}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-300 to-yellow-500 text-slate-950 font-black text-xs uppercase tracking-wider cursor-pointer"
            >
              Start 2nd Innings Chase →
            </button>
          </div>
        </div>
      )}

      {match.phase === "COMPLETE" && (
        <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-3xl bg-slate-900 border-2 border-amber-400 p-6 text-center space-y-4 shadow-2xl">
            <div className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">🏆 MATCH RESULT</div>
            <h2 className="text-xl sm:text-2xl font-black text-white">{match.resultText}</h2>
            <div className="grid grid-cols-2 gap-2 text-xs tnum">
              <div className="rounded-xl bg-slate-950/80 border border-white/10 p-2.5">
                <div className="font-bold text-slate-400">
                  {getLineupById(match, match.innings1.battingTeamId).code}
                </div>
                <div className="text-lg font-black text-white">
                  {match.innings1.runs}/{match.innings1.wickets}
                </div>
                <div className="text-[10px] text-slate-400">{formatOvers(match.innings1.legalBalls)} ov</div>
              </div>
              {match.innings2 && (
                <div className="rounded-xl bg-slate-950/80 border border-white/10 p-2.5">
                  <div className="font-bold text-slate-400">
                    {getLineupById(match, match.innings2.battingTeamId).code}
                  </div>
                  <div className="text-lg font-black text-white">
                    {match.innings2.runs}/{match.innings2.wickets}
                  </div>
                  <div className="text-[10px] text-slate-400">{formatOvers(match.innings2.legalBalls)} ov</div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onMatchComplete(match)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500 text-slate-950 font-black text-xs sm:text-sm uppercase tracking-wider cursor-pointer shadow-lg"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {/* WCC FULL-WIDTH BOTTOM TWO-ROW TV BROADCAST SCOREBUG */}
      {active && (
        <footer className="absolute inset-x-0 bottom-0 z-20 preserve-dark">
          {/* Top Team-Colored Strip */}
          <div
            className="flex items-center justify-between px-2.5 sm:px-5 py-1 border-t border-white/25 text-white shadow-lg"
            style={{
              background: `linear-gradient(90deg, ${battingLineup.kit.secondary}, ${battingLineup.kit.primary}, ${battingLineup.kit.secondary})`,
            }}
          >
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 tnum">
              <div className="-mt-4 shrink-0">
                <CricketJerseySvg kit={battingLineup.kit} size={38} />
              </div>
              <span className="text-sm sm:text-base font-black tracking-wider">{battingLineup.code}</span>
              <span className="px-2.5 py-0.5 rounded bg-slate-950/65 text-sm sm:text-base font-black">
                {active.runs}/{active.wickets}
              </span>
              <span className="text-xs sm:text-sm font-extrabold">
                {formatOvers(active.legalBalls)} <span className="opacity-80">({active.maxOvers})</span>
              </span>
              {lastSixDistM ? (
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded bg-rose-600 text-[11px] font-black">
                  Six Distance : {lastSixDistM} m
                </span>
              ) : chaseInfo ? (
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded bg-slate-950/60 text-[11px] font-black text-amber-300">
                  Need {chaseInfo.needed} ({chaseInfo.ballsLeft}b) • RRR {chaseInfo.rrr}
                </span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setScorebugExpanded((s) => !s)}
              className="px-2 py-0.5 rounded bg-slate-950/50 text-xs font-black cursor-pointer"
            >
              {scorebugExpanded ? "▼" : "▲"}
            </button>
          </div>

          {/* Bottom Dark Info Sub-Strip */}
          {scorebugExpanded && (
            <div className="bg-slate-950/95 border-t border-white/10 px-2.5 sm:px-5 py-1 flex flex-wrap items-center justify-between gap-2 text-[11px] tnum">
              <div className="flex items-center gap-3 text-slate-200">
                {striker && (
                  <span className="font-extrabold">
                    <span className="text-emerald-400">▶</span> {striker.name.toUpperCase()}{" "}
                    <strong className="text-white">
                      {active.batterStats[striker.id]?.runs ?? 0} ({active.batterStats[striker.id]?.balls ?? 0})
                    </strong>
                  </span>
                )}
                {nonStriker && (
                  <span className="hidden sm:inline text-slate-300">
                    {nonStriker.name.toUpperCase()}{" "}
                    <strong>
                      {active.batterStats[nonStriker.id]?.runs ?? 0} ({active.batterStats[nonStriker.id]?.balls ?? 0})
                    </strong>
                  </span>
                )}
              </div>

              {/* 6-Ball Square Chips */}
              <div className="flex items-center gap-1">
                {Array.from({ length: 6 }).map((_, idx) => {
                  const ball = active.currentOverBalls[idx];
                  return (
                    <span
                      key={idx}
                      className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black border ${
                        !ball
                          ? "border-white/15 bg-slate-900 text-slate-600"
                          : ball.isWicket
                          ? "bg-rose-600 border-rose-400 text-white"
                          : ball.runs === 6
                          ? "bg-amber-400 border-amber-300 text-slate-950"
                          : ball.runs === 4
                          ? "bg-sky-400 border-sky-300 text-slate-950"
                          : ball.extraType !== "NONE"
                          ? "bg-rose-900 border-rose-400 text-rose-200"
                          : "bg-slate-800 border-white/20 text-white"
                      }`}
                    >
                      {!ball
                        ? ""
                        : ball.isWicket
                        ? "W"
                        : ball.extraType === "WIDE"
                        ? "Wd"
                        : ball.extraType === "NO_BALL"
                        ? "Nb"
                        : ball.runs}
                    </span>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-slate-200">
                {currentBowler && (
                  <span>
                    <strong className="text-white">{currentBowler.name.split(" ").slice(-1)[0].toUpperCase()}</strong>{" "}
                    <span className="text-sky-300 font-bold">
                      {active.bowlerStats[currentBowler.id]?.wickets ?? 0}-
                      {active.bowlerStats[currentBowler.id]?.runsConceded ?? 0}
                    </span>{" "}
                    ({formatOvers(active.bowlerStats[currentBowler.id]?.legalBalls ?? 0)})
                  </span>
                )}
                {lastSpeedKmh && (
                  <span className="hidden md:inline font-black text-amber-300">
                    BALL SPEED : {lastSpeedKmh} kmph
                  </span>
                )}
              </div>
            </div>
          )}
        </footer>
      )}

      {/* SLIDE-UP PAUSE MENU & DRAWERS (Scorecard / Commentary / Points / Settings) */}
      {drawer !== "NONE" && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-2 sm:p-4"
          onClick={() => setDrawer("NONE")}
        >
          <div
            className="w-full max-w-3xl max-h-[82dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-slate-900 border border-white/15 p-4 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {(["MENU", "SCORECARD", "COMMENTARY", ...(pointsTable?.length ? ["POINTS"] : [])] as const).map(
                  (tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setDrawer(tab as typeof drawer)}
                      className={`px-3 py-1 rounded-lg text-xs font-black cursor-pointer ${
                        drawer === tab ? "bg-amber-400 text-slate-950" : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {tab}
                    </button>
                  ),
                )}
              </div>
              <button
                type="button"
                onClick={() => setDrawer("NONE")}
                className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-bold cursor-pointer"
              >
                Resume ▶
              </button>
            </div>

            {drawer === "MENU" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    setBattingCameraMode((c) => (c === "BATSMAN_END" ? "BOWLER_END" : "BATSMAN_END"))
                  }
                  className="p-3 rounded-xl bg-slate-950 border border-sky-400/40 font-black text-sky-300 cursor-pointer"
                >
                  🎥 Batting Cam: {battingCameraMode === "BATSMAN_END" ? "Batsman End (Pro)" : "Bowler End"}
                </button>
                {controlMode !== "ONLINE_FRIEND" && match.phase !== "COMPLETE" && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setWatchAiMode((w) => !w);
                        setDrawer("NONE");
                      }}
                      className="p-3 rounded-xl bg-slate-950 border border-white/15 font-black text-amber-300 cursor-pointer"
                    >
                      {watchAiMode ? "🎮 Switch to Manual Play" : "👁 Watch AI vs AI"}
                    </button>
                    <button
                      type="button"
                      onClick={handleInstantSim}
                      className="p-3 rounded-xl bg-slate-950 border border-amber-400/40 font-black text-emerald-300 cursor-pointer"
                    >
                      ⏩ Instant Sim Rest of Match
                    </button>
                  </>
                )}
                <FullscreenLandscapeButton className="justify-center py-3" />
                <button
                  type="button"
                  onClick={onToggleTheme}
                  className="p-3 rounded-xl bg-slate-950 border border-white/15 font-bold text-slate-200 cursor-pointer"
                >
                  {theme === "dark" ? "☀️ Switch to Light Theme" : "🌙 Switch to Dark Theme"}
                </button>
                <button
                  type="button"
                  onClick={onExit}
                  className="sm:col-span-2 p-3 rounded-xl bg-rose-600/80 text-white font-black uppercase tracking-wider cursor-pointer"
                >
                  ✕ Quit Match
                </button>
              </div>
            )}

            {drawer === "SCORECARD" && (
              <div className="space-y-4 text-xs">
                {[match.innings1, match.innings2].filter(Boolean).map((inn) => {
                  if (!inn) return null;
                  const batTeam = getLineupById(match, inn.battingTeamId);
                  return (
                    <div key={inn.inningsNumber} className="space-y-2">
                      <div className="font-black text-amber-300">
                        Innings {inn.inningsNumber}: {batTeam.name} — {inn.runs}/{inn.wickets} (
                        {formatOvers(inn.legalBalls)})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="rounded-xl bg-slate-950/75 p-2.5 space-y-1 tnum">
                          <div className="text-[10px] font-bold uppercase text-slate-400">Batting</div>
                          {Object.values(inn.batterStats).map((b) => (
                            <div key={b.playerId} className="flex justify-between gap-2">
                              <span className="truncate">
                                {b.name} {b.isOut ? "(out)" : ""}
                              </span>
                              <span className="font-bold text-white shrink-0">
                                {b.runs} ({b.balls}) • {b.fours}x4 {b.sixes}x6
                              </span>
                            </div>
                          ))}
                        </div>
                        <div className="rounded-xl bg-slate-950/75 p-2.5 space-y-1 tnum">
                          <div className="text-[10px] font-bold uppercase text-slate-400">Bowling</div>
                          {Object.values(inn.bowlerStats).map((bw) => (
                            <div key={bw.playerId} className="flex justify-between gap-2">
                              <span className="truncate">{bw.name}</span>
                              <span className="font-bold text-sky-300 shrink-0">
                                {formatOvers(bw.legalBalls)}-{bw.runsConceded}-{bw.wickets}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {drawer === "COMMENTARY" && (
              <div className="space-y-1.5 text-xs">
                {(active?.ballLog || [])
                  .slice()
                  .reverse()
                  .map((b, i) => (
                    <div
                      key={`${b.overNumber}_${b.ballNumberInOver}_${i}`}
                      className="rounded-lg bg-slate-950/75 border border-white/10 px-3 py-2 flex items-start gap-2.5"
                    >
                      <span className="font-black text-amber-300 tnum shrink-0">
                        {b.overNumber - 1}.{b.ballNumberInOver}
                      </span>
                      <span className="text-slate-200">{b.commentary}</span>
                    </div>
                  ))}
              </div>
            )}

            {drawer === "POINTS" && pointsTable && (
              <div className="overflow-x-auto text-xs tnum">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-slate-400 border-b border-white/10">
                      <th className="py-1.5">Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>L</th>
                      <th>Pts</th>
                      <th>NRR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pointsTable.map((r) => (
                      <tr key={r.teamId} className="border-b border-white/5">
                        <td className="py-1.5 font-bold text-white">
                          {r.code} • {r.name}
                        </td>
                        <td>{r.played}</td>
                        <td>{r.won}</td>
                        <td>{r.lost}</td>
                        <td className="font-black text-amber-300">{r.points}</td>
                        <td>{r.nrr >= 0 ? `+${r.nrr.toFixed(3)}` : r.nrr.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
