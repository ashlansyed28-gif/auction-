import { useEffect, useRef } from "react";
import type {
  BallOutcome,
  BowlingLength,
  BowlingLine,
  PitchCondition,
} from "../../engine/matchEngine";

export interface DeliveryAnimationState {
  key: number;
  outcome: BallOutcome | null;
  phase: "IDLE" | "BOWLING" | "AWAITING_HIT" | "RESOLVING";
  activeLength: BowlingLength;
  activeLine: BowlingLine;
  speedPreviewKmh?: number;
}

interface StadiumCanvasProps {
  pitch: PitchCondition;
  battingColor: string;
  bowlingColor: string;
  canPickTarget: boolean;
  selectedLength: BowlingLength;
  selectedLine: BowlingLine;
  onPickTarget: (length: BowlingLength, line: BowlingLine) => void;
  animation: DeliveryAnimationState;
}

const LENGTHS: BowlingLength[] = ["Short", "Good", "Full", "Yorker"];
const LINES: BowlingLine[] = ["Off", "Middle", "Leg"];

function getTargetNormalizedCoords(length: BowlingLength, line: BowlingLine): { nx: number; ny: number } {
  // nx: -1 (Off) .. +1 (Leg) relative to pitch center; ny: 0 (bowler end) .. 1 (batter stumps)
  const nx = line === "Off" ? -0.34 : line === "Middle" ? 0 : 0.34;
  const ny =
    length === "Short"
      ? 0.44
      : length === "Good"
      ? 0.64
      : length === "Full"
      ? 0.80
      : 0.92;
  return { nx, ny };
}

export function StadiumCanvas({
  pitch,
  battingColor,
  bowlingColor,
  canPickTarget,
  selectedLength,
  selectedLine,
  onPickTarget,
  animation,
}: StadiumCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animStartRef = useRef<number>(0);

  useEffect(() => {
    animStartRef.current = performance.now();
  }, [animation.key, animation.phase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;

    const render = (now: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(320, Math.round(rect.width * dpr));
      const h = Math.max(180, Math.round(rect.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const elapsedMs = now - animStartRef.current;
      // 40ms impact hit-stop pause around 380ms during resolving
      let animT = Math.min(1, elapsedMs / 1050);
      if (animation.phase === "RESOLVING" && elapsedMs >= 370 && elapsedMs <= 410) {
        animT = 370 / 1050; // 40ms freeze frame right at bat-ball impact!
      }

      ctx.save();
      ctx.clearRect(0, 0, w, h);

      // Broadcast camera pan when ball travels to outfield
      let camOffsetX = 0;
      let camOffsetY = 0;
      let camZoom = 1;
      if (animation.phase === "RESOLVING" && animation.outcome && animT > 0.38) {
        const flyT = Math.min(1, (animT - 0.38) / 0.55);
        const dirAngle =
          animation.outcome.line === "Off"
            ? -0.9
            : animation.outcome.line === "Leg"
            ? 0.9
            : 0.25;
        const reach =
          animation.outcome.runs === 6
            ? 0.12
            : animation.outcome.runs === 4
            ? 0.09
            : animation.outcome.runs > 0
            ? 0.05
            : 0.01;
        camOffsetX = -Math.sin(dirAngle) * w * reach * flyT;
        camOffsetY = -Math.cos(dirAngle) * h * reach * flyT;
        camZoom = 1 + 0.05 * Math.sin(flyT * Math.PI);
      }

      // Sky & Stadium Floodlights Backdrop
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, "#050a18");
      skyGrad.addColorStop(0.35, "#0d1b3e");
      skyGrad.addColorStop(1, "#071a14");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Subtle crowd bleachers rim
      ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
      ctx.beginPath();
      ctx.ellipse(w / 2, h * 0.54, w * 0.49, h * 0.46, 0, 0, Math.PI * 2);
      ctx.fill();

      // Floodlight cones
      for (const fx of [w * 0.16, w * 0.84]) {
        const cone = ctx.createRadialGradient(fx, h * 0.08, 4, fx, h * 0.45, w * 0.35);
        cone.addColorStop(0, "rgba(255, 250, 220, 0.25)");
        cone.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = cone;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(fx, h * 0.07, 4 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.translate(w / 2 + camOffsetX, h * 0.56 + camOffsetY);
      ctx.scale(camZoom, camZoom);

      const rx = w * 0.44;
      const ry = h * 0.41;

      // Outfield base + Checkered mowed turf stripes
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();

      const turfBase = ctx.createRadialGradient(0, 0, ry * 0.1, 0, 0, rx);
      turfBase.addColorStop(0, "#15803d");
      turfBase.addColorStop(1, "#064e3b");
      ctx.fillStyle = turfBase;
      ctx.fillRect(-rx, -ry, rx * 2, ry * 2);

      // Alternating horizontal & vertical checkered bands
      const stripeCount = 12;
      const stripeH = (ry * 2) / stripeCount;
      for (let i = 0; i < stripeCount; i++) {
        if (i % 2 === 0) {
          ctx.fillStyle = "rgba(34, 197, 94, 0.12)";
          ctx.fillRect(-rx, -ry + i * stripeH, rx * 2, stripeH);
        }
      }
      const colCount = 14;
      const colW = (rx * 2) / colCount;
      for (let i = 0; i < colCount; i++) {
        if (i % 2 === 1) {
          ctx.fillStyle = "rgba(16, 185, 129, 0.08)";
          ctx.fillRect(-rx + i * colW, -ry, colW, ry * 2);
        }
      }
      ctx.restore();

      // Crisp White Boundary Rope
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 2.6 * dpr;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();

      // 30-yard Inner Circle (Powerplay ring)
      ctx.save();
      ctx.setLineDash([6 * dpr, 5 * dpr]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.48)";
      ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx * 0.56, ry * 0.58, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Central 2.5D Trapezoid Pitch Strip
      const pitchTopW = w * 0.085;
      const pitchBotW = w * 0.165;
      const pitchTopY = -ry * 0.55;
      const pitchBotY = ry * 0.52;
      const pitchColor =
        pitch === "Green" ? "#a3b165" : pitch === "Dusty" ? "#d6b888" : "#c8b99d";

      ctx.fillStyle = pitchColor;
      ctx.beginPath();
      ctx.moveTo(-pitchTopW / 2, pitchTopY);
      ctx.lineTo(pitchTopW / 2, pitchTopY);
      ctx.lineTo(pitchBotW / 2, pitchBotY);
      ctx.lineTo(-pitchBotW / 2, pitchBotY);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();

      // Crease lines
      const batCreaseY = pitchBotY - (pitchBotY - pitchTopY) * 0.14;
      const bowlCreaseY = pitchTopY + (pitchBotY - pitchTopY) * 0.14;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.6 * dpr;
      ctx.beginPath();
      ctx.moveTo(-pitchBotW * 0.44, batCreaseY);
      ctx.lineTo(pitchBotW * 0.44, batCreaseY);
      ctx.moveTo(-pitchTopW * 0.44, bowlCreaseY);
      ctx.lineTo(pitchTopW * 0.44, bowlCreaseY);
      ctx.stroke();

      // Helper mapping pitch normalized (nx, ny) -> canvas coords
      const mapPitch = (nx: number, ny: number) => {
        const y = pitchTopY + ny * (pitchBotY - pitchTopY);
        const halfW = (pitchTopW + ny * (pitchBotW - pitchTopW)) / 2;
        return { x: nx * halfW, y };
      };

      // Swing / Spin Curve Preview + Glowing Bounce Marker
      const { nx, ny } = getTargetNormalizedCoords(animation.activeLength, animation.activeLine);
      const bouncePt = mapPitch(nx, ny);

      if (canPickTarget || animation.phase !== "IDLE") {
        // Subtle swing/spin curve preview from bowler release to bouncePt
        const relPt = { x: -pitchTopW * 0.22, y: pitchTopY - 8 * dpr };
        const curveCtrlX = bouncePt.x + (pitch === "Green" ? -18 * dpr : pitch === "Dusty" ? 16 * dpr : 4 * dpr);
        ctx.save();
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.strokeStyle = "rgba(250, 204, 21, 0.58)";
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        ctx.moveTo(relPt.x, relPt.y);
        ctx.quadraticCurveTo(curveCtrlX, (relPt.y + bouncePt.y) / 2, bouncePt.x, bouncePt.y);
        ctx.stroke();
        ctx.restore();

        // Target pulse ring
        const pulse = 1 + 0.18 * Math.sin(now / 180);
        const targetGlow = ctx.createRadialGradient(
          bouncePt.x,
          bouncePt.y,
          1,
          bouncePt.x,
          bouncePt.y,
          12 * dpr * pulse,
        );
        targetGlow.addColorStop(0, "rgba(250, 204, 21, 0.9)");
        targetGlow.addColorStop(1, "rgba(250, 204, 21, 0)");
        ctx.fillStyle = targetGlow;
        ctx.beginPath();
        ctx.arc(bouncePt.x, bouncePt.y, 12 * dpr * pulse, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "#fde047";
        ctx.lineWidth = 1.6 * dpr;
        ctx.beginPath();
        ctx.ellipse(bouncePt.x, bouncePt.y, 7 * dpr, 4.2 * dpr, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Stumps (Bowler end + Batter end with flying bails on BOWLED!)
      const drawStumps = (x: number, y: number, scale: number, broken: boolean, breakT: number) => {
        ctx.save();
        ctx.translate(x, y);
        const hStump = 13 * dpr * scale;
        const gap = 3.2 * dpr * scale;
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 1.8 * dpr * scale;
        for (let i = -1; i <= 1; i++) {
          ctx.save();
          if (broken) {
            const fly = breakT * 26 * dpr;
            ctx.translate(i * fly * 0.7, -fly * 0.4);
            ctx.rotate(i * breakT * 1.4);
          }
          ctx.beginPath();
          ctx.moveTo(i * gap, 0);
          ctx.lineTo(i * gap, -hStump);
          ctx.stroke();
          ctx.restore();
        }
        ctx.restore();
      };

      const isBowledAnim =
        animation.phase === "RESOLVING" &&
        animation.outcome?.isWicket &&
        animation.outcome.wicketKind === "BOWLED" &&
        animT > 0.36;
      const breakT = isBowledAnim ? Math.min(1, (animT - 0.36) / 0.35) : 0;

      drawStumps(0, pitchTopY + 3 * dpr, 0.75, false, 0);
      drawStumps(0, pitchBotY - 2 * dpr, 1.0, Boolean(isBowledAnim), breakT);

      // Static & Moving Fielders inside oval
      const fielderAngles = [0.35, 1.15, 2.25, 3.8, 5.15];
      fielderAngles.forEach((ang, idx) => {
        let fx = Math.cos(ang) * rx * (idx % 2 === 0 ? 0.5 : 0.78);
        let fy = Math.sin(ang) * ry * (idx % 2 === 0 ? 0.5 : 0.78);

        // Nearest fielder chases during boundary shot
        if (
          animation.phase === "RESOLVING" &&
          animation.outcome &&
          animation.outcome.runs >= 2 &&
          idx === 0 &&
          animT > 0.42
        ) {
          const chaseT = Math.min(1, (animT - 0.42) / 0.5);
          const dir = animation.outcome.line === "Off" ? -0.85 : 0.85;
          const destX = Math.sin(dir) * rx * 0.88;
          const destY = -Math.cos(dir) * ry * 0.75;
          fx = fx + (destX - fx) * chaseT;
          fy = fy + (destY - fy) * chaseT;
        }

        ctx.fillStyle = bowlingColor;
        ctx.beginPath();
        ctx.arc(fx, fy, 4.5 * dpr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.1 * dpr;
        ctx.stroke();
      });

      // Bowler Run-up + Batter Silhouette
      const bowlerRunOffset =
        animation.phase === "BOWLING"
          ? -28 * dpr * (1 - Math.min(1, elapsedMs / 420))
          : 0;
      ctx.fillStyle = bowlingColor;
      ctx.beginPath();
      ctx.arc(-pitchTopW * 0.22, pitchTopY - 10 * dpr + bowlerRunOffset, 5.5 * dpr, 0, Math.PI * 2);
      ctx.fill();

      // Batter at crease
      ctx.fillStyle = battingColor;
      ctx.beginPath();
      ctx.arc(-5 * dpr, batCreaseY + 2 * dpr, 6 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();

      // Ball Flight Arc + Ground Shadow + Bounce Ripple + Tracer
      if (animation.phase === "RESOLVING" && animation.outcome) {
        const out = animation.outcome;
        const releasePt = { x: -pitchTopW * 0.22, y: pitchTopY - 6 * dpr };
        const batHitPt = mapPitch(nx * 0.55, 0.92);

        if (animT < 0.36) {
          // Incoming ball to batter
          const u = animT / 0.36;
          let bx: number;
          let by: number;
          let heightOffset: number;

          if (u < 0.68) {
            const p = u / 0.68;
            bx = releasePt.x + (bouncePt.x - releasePt.x) * p;
            by = releasePt.y + (bouncePt.y - releasePt.y) * p;
            heightOffset = Math.sin(p * Math.PI) * 14 * dpr;
          } else {
            const p = (u - 0.68) / 0.32;
            bx = bouncePt.x + (batHitPt.x - bouncePt.x) * p;
            by = bouncePt.y + (batHitPt.y - bouncePt.y) * p;
            heightOffset = Math.sin(p * Math.PI) * 8 * dpr;

            // Pitch bounce ripple!
            ctx.strokeStyle = `rgba(255, 255, 255, ${1 - p})`;
            ctx.lineWidth = 1.5 * dpr;
            ctx.beginPath();
            ctx.ellipse(bouncePt.x, bouncePt.y, (6 + p * 12) * dpr, (3 + p * 7) * dpr, 0, 0, Math.PI * 2);
            ctx.stroke();
          }

          // Dynamic ground shadow
          ctx.fillStyle = "rgba(0,0,0,0.4)";
          ctx.beginPath();
          ctx.ellipse(bx, by + 2 * dpr, 3.8 * dpr, 2 * dpr, 0, 0, Math.PI * 2);
          ctx.fill();

          // White leather ball
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(bx, by - heightOffset, 3.8 * dpr, 0, Math.PI * 2);
          ctx.fill();
        } else if (!out.isWicket || out.wicketKind === "CAUGHT") {
          // Outgoing ball tracer after bat impact!
          const u = Math.min(1, (animT - 0.36) / 0.6);
          const dir = out.line === "Off" ? -0.9 : out.line === "Leg" ? 0.9 : 0.25;
          const distFactor =
            out.runs === 6 ? 1.08 : out.runs === 4 ? 0.98 : out.runs === 2 ? 0.68 : out.runs === 1 ? 0.45 : 0.16;
          const destX = Math.sin(dir) * rx * distFactor;
          const destY = -Math.cos(dir) * ry * distFactor;

          const curX = batHitPt.x + (destX - batHitPt.x) * u;
          const curY = batHitPt.y + (destY - batHitPt.y) * u;
          const loftH = out.runs === 6 ? Math.sin(u * Math.PI) * 52 * dpr : Math.sin(u * Math.PI) * 14 * dpr;

          // Glowing tracer trail
          const tracerColor = out.runs === 6 ? "#facc15" : out.runs === 4 ? "#38bdf8" : "#f8fafc";
          ctx.strokeStyle = tracerColor;
          ctx.lineWidth = (out.runs >= 4 ? 3 : 1.8) * dpr;
          ctx.beginPath();
          ctx.moveTo(batHitPt.x, batHitPt.y);
          ctx.quadraticCurveTo(
            (batHitPt.x + curX) / 2,
            (batHitPt.y + curY) / 2 - loftH,
            curX,
            curY - loftH * 0.4,
          );
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(curX, curY - loftH * 0.4, 4.2 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.restore();

      // Speed Badge (km/h) overlay top-right inside canvas
      const speed = animation.outcome?.ballSpeedKmh ?? animation.speedPreviewKmh;
      if (speed) {
        ctx.save();
        const label = `${speed} km/h`;
        ctx.font = `900 ${11 * dpr}px system-ui, sans-serif`;
        const padX = 10 * dpr;
        const tw = ctx.measureText(label).width + padX * 2;
        ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
        ctx.strokeStyle = "rgba(250, 204, 21, 0.65)";
        ctx.lineWidth = 1.2 * dpr;
        ctx.beginPath();
        ctx.roundRect(w - tw - 10 * dpr, 10 * dpr, tw, 24 * dpr, 8 * dpr);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#fde047";
        ctx.fillText(label, w - tw - 10 * dpr + padX, 26 * dpr);
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafId);
  }, [pitch, battingColor, bowlingColor, canPickTarget, selectedLength, selectedLine, animation]);

  // Interactive tap/drag on center pitch region when bowling
  const handlePointerPick = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canPickTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    const line: BowlingLine = nx < 0.46 ? "Off" : nx > 0.54 ? "Leg" : "Middle";
    const length: BowlingLength =
      ny < 0.45 ? "Short" : ny < 0.58 ? "Good" : ny < 0.68 ? "Full" : "Yorker";
    onPickTarget(length, line);
  };

  return (
    <div className="relative w-full h-full min-h-[210px] sm:min-h-[270px] rounded-2xl overflow-hidden border border-white/15 bg-[#070B16] preserve-dark shadow-2xl">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerPick}
        onPointerMove={(e) => {
          if (e.buttons === 1) handlePointerPick(e);
        }}
        className={`w-full h-full block ${canPickTarget ? "cursor-crosshair" : "cursor-default"}`}
      />

      {/* Interactive Pitch Target Grid Quick Pills (shown only when bowling) */}
      {canPickTarget && (
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 bg-slate-950/85 backdrop-blur-md border border-amber-400/35 rounded-xl p-1.5 text-[10px]">
          <div className="font-black uppercase tracking-wider text-amber-300 px-1">
            Tap Pitch Target ({selectedLength} • {selectedLine})
          </div>
          <div className="flex gap-1">
            {LENGTHS.map((len) => (
              <button
                key={len}
                type="button"
                onClick={() => onPickTarget(len, selectedLine)}
                className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                  selectedLength === len
                    ? "bg-amber-400 text-slate-950"
                    : "bg-slate-800 text-slate-200"
                }`}
              >
                {len}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {LINES.map((ln) => (
              <button
                key={ln}
                type="button"
                onClick={() => onPickTarget(selectedLength, ln)}
                className={`flex-1 px-2 py-0.5 rounded font-bold cursor-pointer ${
                  selectedLine === ln
                    ? "bg-sky-400 text-slate-950"
                    : "bg-slate-800 text-slate-200"
                }`}
              >
                {ln}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
