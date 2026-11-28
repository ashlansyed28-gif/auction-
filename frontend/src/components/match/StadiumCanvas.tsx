import { useEffect, useRef } from "react";
import * as THREE from "three";
import type {
  BallOutcome,
  BowlingLength,
  BowlingLine,
  PitchCondition,
  ShotType,
} from "../../engine/matchEngine";
import type { AnimationPhase, ThrowTargetEnd, UmpireSignal } from "./deliveryStateMachine";

export interface DeliveryAnimationState {
  key: number;
  outcome: BallOutcome | null;
  phase: AnimationPhase;
  activeLength: BowlingLength;
  activeLine: BowlingLine;
  speedPreviewKmh?: number;
  throwTargetEnd?: ThrowTargetEnd;
  umpireSignal?: UmpireSignal;
}

export const FIELDER_SPOTS: Array<[number, number]> = [
  [-12, 16], // Point
  [-18, 2], // Cover
  [-13, -15], // Mid-off
  [13, -15], // Mid-on
  [18, 4], // Mid-wicket
  [12, 17], // Square leg
  [-34, -22], // Long-off
  [34, -22], // Long-on
  [26, 26], // Deep square
];

interface StadiumCanvasProps {
  pitch: PitchCondition;
  battingColor: string;
  bowlingColor: string;
  canPickTarget: boolean;
  isBowlingCamera?: boolean;
  battingCameraMode?: "BATSMAN_END" | "BOWLER_END";
  selectedLength: BowlingLength;
  selectedLine: BowlingLine;
  batterShiftX?: number; // -0.55 .. +0.55 (screen left/right in Batsman End)
  shotAimAngleDeg?: number; // -180..180 for WCC Pro-Control aim cone (0 = straight down ground -Z)
  showShotAimCone?: boolean;
  bowlerJerseyNumber?: number;
  onPickTarget: (length: BowlingLength, line: BowlingLine) => void;
  animation: DeliveryAnimationState;
}

interface ArticulatedPlayerRig {
  root: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  bat?: THREE.Group;
}

function makeJerseyBackTexture(jerseyHex: string, accentHex: string, numberText?: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = jerseyHex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 14, 128, 16);
  if (numberText) {
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 44px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(numberText, 64, 74);
  }
  return new THREE.CanvasTexture(c);
}

function buildCricketerRig(
  jerseyColor: string,
  accentColor: string,
  options: {
    isBatter?: boolean;
    isKeeper?: boolean;
    hasHelmet?: boolean;
    isUmpire?: boolean;
    jerseyNumber?: number;
  } = {},
): ArticulatedPlayerRig {
  const root = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc6865c, roughness: 0.65 });
  const backTex = makeJerseyBackTexture(
    options.isUmpire ? "#dc2626" : jerseyColor,
    options.isUmpire ? "#1e293b" : accentColor,
    options.jerseyNumber ? String(options.jerseyNumber) : undefined,
  );
  const jerseyMat = new THREE.MeshStandardMaterial({
    map: backTex,
    roughness: 0.55,
  });
  const accentMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.45 });
  const trouserMat = new THREE.MeshStandardMaterial({
    color: options.isUmpire ? "#1e293b" : jerseyColor,
    roughness: 0.65,
  });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });

  const shadowDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.38, depthWrite: false }),
  );
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.025;
  root.add(shadowDisc);

  const makeLeg = (xOff: number) => {
    const legPivot = new THREE.Group();
    legPivot.position.set(xOff, 0.88, 0);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.44, 10), trouserMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    legPivot.add(thigh);

    const shinMat = options.isBatter || options.isKeeper ? padMat : trouserMat;
    const shin = new THREE.Mesh(
      new THREE.CylinderGeometry(options.isBatter ? 0.115 : 0.088, 0.08, 0.42, 10),
      shinMat,
    );
    shin.position.y = -0.62;
    shin.castShadow = true;
    legPivot.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.26), shoeMat);
    shoe.position.set(0, -0.84, 0.05);
    legPivot.add(shoe);

    return legPivot;
  };

  const leftLeg = makeLeg(-0.14);
  const rightLeg = makeLeg(0.14);
  root.add(leftLeg, rightLeg);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.26), jerseyMat);
  torso.position.y = 1.18;
  torso.castShadow = true;
  root.add(torso);

  const head = new THREE.Group();
  head.position.y = 1.63;
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), skinMat);
  skull.castShadow = true;
  head.add(skull);

  if (options.isUmpire) {
    const brim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.3, 0.03, 18),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 }),
    );
    brim.position.y = 0.08;
    const hatTop = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.17, 0.12, 14),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 }),
    );
    hatTop.position.y = 0.15;
    head.add(brim, hatTop);
  } else if (options.hasHelmet) {
    const helmetShell = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.68),
      new THREE.MeshStandardMaterial({ color: jerseyColor, roughness: 0.45 }),
    );
    helmetShell.position.y = 0.02;
    head.add(helmetShell);

    const peak = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.025, 0.14), accentMat);
    peak.position.set(0, 0.05, 0.14);
    head.add(peak);

    const grille = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.012, 6, 12, Math.PI),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.7, roughness: 0.3 }),
    );
    grille.position.set(0, -0.04, 0.08);
    grille.rotation.x = Math.PI / 2;
    head.add(grille);
  } else {
    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.158, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.52),
      accentMat,
    );
    capDome.position.y = 0.02;
    head.add(capDome);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.12), accentMat);
    visor.position.set(0, 0.05, 0.13);
    head.add(visor);
  }
  root.add(head);

  const makeArm = (xOff: number) => {
    const armPivot = new THREE.Group();
    armPivot.position.set(xOff, 1.4, 0);
    const upper = new THREE.Mesh(
      new THREE.CylinderGeometry(0.072, 0.062, 0.34, 8),
      new THREE.MeshStandardMaterial({ color: options.isUmpire ? "#dc2626" : jerseyColor, roughness: 0.55 }),
    );
    upper.position.y = -0.16;
    upper.castShadow = true;
    armPivot.add(upper);

    const fore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.05, 0.3, 8),
      options.isBatter || options.isKeeper ? gloveMat : skinMat,
    );
    fore.position.y = -0.44;
    fore.castShadow = true;
    armPivot.add(fore);

    if (options.isKeeper || options.isBatter) {
      const glove = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.12, 0.11), gloveMat);
      glove.position.y = -0.58;
      armPivot.add(glove);
    }
    return armPivot;
  };

  const leftArm = makeArm(-0.3);
  const rightArm = makeArm(0.3);
  root.add(leftArm, rightArm);

  let bat: THREE.Group | undefined;
  if (options.isBatter) {
    bat = new THREE.Group();
    bat.position.set(0, -0.58, 0.04);

    const grip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.28, 8),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.7 }),
    );
    grip.position.y = -0.12;
    bat.add(grip);

    const blade = new THREE.Mesh(
      new THREE.BoxGeometry(0.118, 0.64, 0.045),
      new THREE.MeshStandardMaterial({ color: 0xe6c79c, roughness: 0.5 }),
    );
    blade.position.y = -0.56;
    blade.castShadow = true;
    bat.add(blade);

    rightArm.add(bat);
  }

  return { root, torso, head, leftArm, rightArm, leftLeg, rightLeg, bat };
}

function buildStumpsRig() {
  const group = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.45 });
  const bailMat = new THREE.MeshStandardMaterial({
    color: 0xff5722,
    emissive: 0xff3d00,
    emissiveIntensity: 0.65,
    roughness: 0.3,
  });

  const stumps: THREE.Mesh[] = [];
  for (const x of [-0.11, 0, 0.11]) {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.025, 0.73, 10), woodMat);
    s.position.set(x, 0.365, 0);
    s.castShadow = true;
    group.add(s);
    stumps.push(s);
  }

  const bails: THREE.Mesh[] = [];
  for (const bx of [-0.055, 0.055]) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), bailMat);
    b.rotation.z = Math.PI / 2;
    b.position.set(bx, 0.74, 0);
    group.add(b);
    bails.push(b);
  }

  return { group, stumps, bails };
}

function makeCrowdTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 512, 128);
  const colors = ["#ef4444", "#3b82f6", "#facc15", "#f8fafc", "#22c55e", "#f97316", "#a855f7"];
  for (let y = 6; y < 124; y += 10) {
    for (let x = 4; x < 508; x += 8) {
      ctx.fillStyle = colors[(x * 7 + y * 13) % colors.length];
      ctx.fillRect(x, y, 5, 6);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(8, 1);
  return tex;
}

function getBounceWorldCoords(length: BowlingLength, line: BowlingLine): { x: number; z: number } {
  const x = line === "Off" ? -0.58 : line === "Middle" ? 0 : 0.56;
  const z =
    length === "Short" ? 1.6 : length === "Good" ? 4.8 : length === "Full" ? 7.4 : 9.2;
  return { x, z };
}

function mapWorldPitchToTarget(x: number, z: number): { length: BowlingLength; line: BowlingLine } {
  const line: BowlingLine = x < -0.25 ? "Off" : x > 0.25 ? "Leg" : "Middle";
  const length: BowlingLength =
    z < 3.2 ? "Short" : z < 6.2 ? "Good" : z < 8.4 ? "Full" : "Yorker";
  return { length, line };
}

function getShotSwingDir(
  shot: ShotType,
  line: BowlingLine,
  aimAngleDeg?: number,
  battingCameraMode: "BATSMAN_END" | "BOWLER_END" = "BATSMAN_END",
): { dirX: number; dirZ: number } {
  if (typeof aimAngleDeg === "number" && Number.isFinite(aimAngleDeg)) {
    const rad = (aimAngleDeg * Math.PI) / 180;
    // In BATSMAN_END (+Z looking -Z toward bowler):
    // 0° (Up/Forward) -> -Z; 180° (Down/Backward) -> +Z; -90° (Left) -> -X; +90° (Right) -> +X.
    if (battingCameraMode === "BOWLER_END") {
      // In BOWLER_END (-Z looking +Z), screen Up is +Z and screen Left is +X,
      // wait: in cricket "Forward/Straight" should still go toward the outfield/bowler-or-cover;
      // keeping screen-relative mapping in BOWLER_END ensures Up goes down-screen-up (+Z) or straight.
      // Actually in BOWLER_END camera, world -Z is TOWARD camera (screen down), +Z is screen up, +X is screen left, -X is screen right.
      return { dirX: -Math.sin(rad), dirZ: Math.cos(rad) };
    }
    return { dirX: Math.sin(rad), dirZ: -Math.cos(rad) };
  }
  if (shot === "Defend") return { dirX: 0.1, dirZ: -1 };
  if (shot === "Rotate") return { dirX: line === "Off" ? 0.7 : -0.7, dirZ: -0.7 };
  if (shot === "Drive") return { dirX: 0.55, dirZ: -0.85 };
  if (shot === "Loft") return { dirX: 0.15, dirZ: -0.98 };
  return { dirX: -0.72, dirZ: -0.68 };
}

export function StadiumCanvas({
  pitch,
  battingColor,
  bowlingColor,
  canPickTarget,
  isBowlingCamera = false,
  battingCameraMode = "BATSMAN_END",
  selectedLength,
  selectedLine,
  batterShiftX = 0,
  shotAimAngleDeg = 0,
  showShotAimCone = false,
  bowlerJerseyNumber = 19,
  onPickTarget,
  animation,
}: StadiumCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  const propsRef = useRef({
    pitch,
    battingColor,
    bowlingColor,
    canPickTarget,
    isBowlingCamera,
    battingCameraMode,
    selectedLength,
    selectedLine,
    batterShiftX,
    shotAimAngleDeg,
    showShotAimCone,
    bowlerJerseyNumber,
    onPickTarget,
    animation,
  });
  propsRef.current = {
    pitch,
    battingColor,
    bowlingColor,
    canPickTarget,
    isBowlingCamera,
    battingCameraMode,
    selectedLength,
    selectedLine,
    batterShiftX,
    shotAimAngleDeg,
    showShotAimCone,
    bowlerJerseyNumber,
    onPickTarget,
    animation,
  };

  const animStartRef = useRef<number>(performance.now());
  useEffect(() => {
    animStartRef.current = performance.now();
  }, [animation.key, animation.phase]);

  const pitchPlaneRef = useRef<THREE.Mesh | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      return;
    }

    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b162c);
    scene.fog = new THREE.FogExp2(0x0d1b38, 0.0034);

    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.3, 280);
    camera.position.set(1.3, 3.9, -19.2);
    camera.lookAt(0, 1.0, 9.2);
    cameraRef.current = camera;

    const hemi = new THREE.HemisphereLight(0xcbd5e1, 0x14532d, 1.05);
    scene.add(hemi);

    const mainSun = new THREE.DirectionalLight(0xfffbeb, 1.95);
    mainSun.position.set(28, 48, -22);
    mainSun.castShadow = true;
    mainSun.shadow.mapSize.set(1024, 1024);
    mainSun.shadow.camera.near = 10;
    mainSun.shadow.camera.far = 140;
    mainSun.shadow.camera.left = -45;
    mainSun.shadow.camera.right = 45;
    mainSun.shadow.camera.top = 45;
    mainSun.shadow.camera.bottom = -45;
    scene.add(mainSun);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.75);
    rimLight.position.set(-30, 32, 30);
    scene.add(rimLight);

    // Vivid WCC-style Checkered Outfield Grass Texture
    const turfCanvas = document.createElement("canvas");
    turfCanvas.width = 512;
    turfCanvas.height = 512;
    const tCtx = turfCanvas.getContext("2d")!;
    const sq = 32;
    for (let r = 0; r < 16; r++) {
      for (let c = 0; c < 16; c++) {
        tCtx.fillStyle = (r + c) % 2 === 0 ? "#2f7d22" : "#226118";
        tCtx.fillRect(c * sq, r * sq, sq, sq);
      }
    }
    const turfTex = new THREE.CanvasTexture(turfCanvas);
    turfTex.wrapS = THREE.RepeatWrapping;
    turfTex.wrapT = THREE.RepeatWrapping;
    turfTex.repeat.set(4, 4);

    const outfield = new THREE.Mesh(
      new THREE.CircleGeometry(72, 64),
      new THREE.MeshStandardMaterial({ map: turfTex, roughness: 0.85 }),
    );
    outfield.rotation.x = -Math.PI / 2;
    outfield.receiveShadow = true;
    scene.add(outfield);

    // Crisp White Boundary Rope & Perimeter Sponsorship LED Ring
    const boundaryRope = new THREE.Mesh(
      new THREE.TorusGeometry(64, 0.24, 10, 96),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35 }),
    );
    boundaryRope.rotation.x = Math.PI / 2;
    boundaryRope.position.y = 0.16;
    scene.add(boundaryRope);

    const ledBoard = new THREE.Mesh(
      new THREE.CylinderGeometry(67.2, 67.2, 1.4, 64, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        emissive: 0x1d4ed8,
        emissiveIntensity: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    ledBoard.position.y = 0.7;
    scene.add(ledBoard);

    // 30-yard Inner Circle
    const circlePts: THREE.Vector3[] = [];
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      circlePts.push(new THREE.Vector3(Math.cos(a) * 26, 0.04, Math.sin(a) * 28));
    }
    const innerRing = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(circlePts),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.65 }),
    );
    scene.add(innerRing);

    // Crowd-Packed Tiered Stadium Stands
    const crowdTex = makeCrowdTexture();
    for (let tier = 0; tier < 3; tier++) {
      const rIn = 69 + tier * 5.8;
      const rOut = rIn + 5.2;
      const stand = new THREE.Mesh(
        new THREE.CylinderGeometry(rOut, rIn, 4.4, 48, 1, true),
        new THREE.MeshStandardMaterial({
          map: crowdTex,
          side: THREE.DoubleSide,
          roughness: 0.85,
        }),
      );
      stand.position.y = 2.2 + tier * 4.0;
      scene.add(stand);
    }

    // 4 Stadium Floodlight Towers
    [
      [56, 56],
      [-56, 56],
      [56, -56],
      [-56, -56],
    ].forEach(([tx, tz]) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.45, 0.8, 34, 8),
        new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.5 }),
      );
      pole.position.set(tx, 17, tz);
      scene.add(pole);

      const lightHead = new THREE.Mesh(
        new THREE.BoxGeometry(6.5, 2.6, 1.2),
        new THREE.MeshBasicMaterial({ color: 0xfef9c3 }),
      );
      lightHead.position.set(tx, 34, tz);
      lightHead.lookAt(0, 0, 0);
      scene.add(lightHead);
    });

    // 22-Yard Pitch Strip
    const pitchMat = new THREE.MeshStandardMaterial({
      color: pitch === "Green" ? 0xa3b165 : pitch === "Dusty" ? 0xd6b888 : 0xc8b99d,
      roughness: 0.9,
    });
    const pitchStrip = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 23.2), pitchMat);
    pitchStrip.rotation.x = -Math.PI / 2;
    pitchStrip.position.y = 0.025;
    pitchStrip.receiveShadow = true;
    scene.add(pitchStrip);
    pitchPlaneRef.current = pitchStrip;

    // White Popping & Bowling Crease Lines
    const addLine = (wLen: number, x: number, z: number, rotY = 0) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(wLen, 0.065),
        new THREE.MeshBasicMaterial({ color: 0xffffff }),
      );
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = rotY;
      m.position.set(x, 0.032, z);
      scene.add(m);
    };
    addLine(3.2, 0, 10);
    addLine(3.6, 0, 8.8);
    addLine(3.2, 0, -10);
    addLine(3.6, 0, -8.8);
    addLine(2.6, -1.32, 9.4, Math.PI / 2);
    addLine(2.6, 1.32, 9.4, Math.PI / 2);

    // Subtle Run-Up Arrow behind Bowler Stumps (like WCC screenshot)
    const runArrow = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 1.1, 3),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }),
    );
    runArrow.rotation.x = Math.PI / 2;
    runArrow.position.set(0.45, 0.04, -14.2);
    scene.add(runArrow);

    // 3D Stumps & LED Bails
    const batterStumps = buildStumpsRig();
    batterStumps.group.position.set(0, 0, 10);
    scene.add(batterStumps.group);

    const bowlerStumps = buildStumpsRig();
    bowlerStumps.group.position.set(0, 0, -10);
    scene.add(bowlerStumps.group);

    // Blue/Gold Pitch Bounce Ring (matching WCC screenshot) + Swing Curve
    const targetRing = new THREE.Group();
    const outerTarget = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.34, 24),
      new THREE.MeshBasicMaterial({ color: 0x2563eb, side: THREE.DoubleSide }),
    );
    outerTarget.rotation.x = -Math.PI / 2;
    const innerTarget = new THREE.Mesh(
      new THREE.CircleGeometry(0.16, 20),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 }),
    );
    innerTarget.rotation.x = -Math.PI / 2;
    targetRing.add(outerTarget, innerTarget);
    targetRing.position.set(0, 0.045, 4.8);
    scene.add(targetRing);

    const swingCurveLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({ color: 0xfde047, dashSize: 0.45, gapSize: 0.25, transparent: true, opacity: 0.72 }),
    );
    scene.add(swingCurveLine);

    // Batting Shot Direction Aim Cone on Pitch (XZ plane, +0° = toward bowler -Z)
    const shotAimGroup = new THREE.Group();
    const coneRadius = 4.4;
    const coneHalfSpread = Math.PI / 11;
    const coneVerts: number[] = [];
    const segs = 14;
    for (let s = 0; s < segs; s++) {
      const a0 = -coneHalfSpread + (s / segs) * coneHalfSpread * 2;
      const a1 = -coneHalfSpread + ((s + 1) / segs) * coneHalfSpread * 2;
      coneVerts.push(0, 0, 0);
      coneVerts.push(Math.sin(a0) * coneRadius, 0, -Math.cos(a0) * coneRadius);
      coneVerts.push(Math.sin(a1) * coneRadius, 0, -Math.cos(a1) * coneRadius);
    }
    const coneGeo = new THREE.BufferGeometry();
    coneGeo.setAttribute("position", new THREE.Float32BufferAttribute(coneVerts, 3));
    const shotAimMesh = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.34, side: THREE.DoubleSide, depthWrite: false }),
    );
    const shotAimSpine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.01, 0),
        new THREE.Vector3(0, 0.01, -coneRadius * 1.18),
      ]),
      new THREE.LineBasicMaterial({ color: 0xfef08a, transparent: true, opacity: 0.9 }),
    );
    shotAimGroup.add(shotAimMesh, shotAimSpine);
    shotAimGroup.position.set(0, 0.044, 9.15);
    shotAimGroup.visible = false;
    scene.add(shotAimGroup);

    const rippleMesh = new THREE.Mesh(
      new THREE.RingGeometry(0.14, 0.24, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    rippleMesh.rotation.x = -Math.PI / 2;
    rippleMesh.position.y = 0.045;
    scene.add(rippleMesh);

    // Articulated Players + Classic Red-Shirt Umpire
    const strikerRig = buildCricketerRig(battingColor, "#fde047", { isBatter: true, hasHelmet: true });
    strikerRig.root.position.set(-0.32, 0, 9.15);
    strikerRig.root.rotation.y = Math.PI * 0.52;
    strikerRig.head.rotation.y = Math.PI * 0.44;
    scene.add(strikerRig.root);

    const nonStrikerRig = buildCricketerRig(battingColor, "#fde047", { isBatter: true, hasHelmet: true });
    nonStrikerRig.root.position.set(1.25, 0, -9.2);
    nonStrikerRig.root.rotation.y = Math.PI;
    scene.add(nonStrikerRig.root);

    const bowlerRig = buildCricketerRig(bowlingColor, "#38bdf8", { jerseyNumber: bowlerJerseyNumber });
    bowlerRig.root.position.set(0.45, 0, -20);
    bowlerRig.root.rotation.y = 0;
    scene.add(bowlerRig.root);

    const umpireRig = buildCricketerRig("#dc2626", "#0f172a", { isUmpire: true });
    umpireRig.root.position.set(0, 0, -12.6);
    umpireRig.root.rotation.y = 0;
    scene.add(umpireRig.root);

    const keeperRig = buildCricketerRig(bowlingColor, "#38bdf8", { isKeeper: true, hasHelmet: false });
    keeperRig.root.position.set(0, 0, 13.4);
    keeperRig.root.rotation.y = Math.PI;
    scene.add(keeperRig.root);

    const fielderRigs = FIELDER_SPOTS.map(([fx, fz], idx) => {
      const f = buildCricketerRig(bowlingColor, "#38bdf8", { jerseyNumber: 4 + idx });
      f.root.position.set(fx, 0, fz);
      f.root.lookAt(0, 0, 9);
      scene.add(f.root);
      return { rig: f, homeX: fx, homeZ: fz };
    });

    const ballMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.11, 16, 14),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, emissive: 0x334155 }),
    );
    ballMesh.castShadow = true;
    ballMesh.visible = false;
    scene.add(ballMesh);

    const ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.13, 14),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }),
    );
    ballShadow.rotation.x = -Math.PI / 2;
    ballShadow.visible = false;
    scene.add(ballShadow);

    const tracerPoints: THREE.Vector3[] = [];
    const tracerLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 2 }),
    );
    scene.add(tracerLine);

    const updateSize = () => {
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 360;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    let rafId = 0;

    const animate = (now: number) => {
      const {
        pitch: curPitch,
        canPickTarget: allowPick,
        isBowlingCamera: bowlCam,
        battingCameraMode: batCamMode,
        selectedLength: selLen,
        selectedLine: selLine,
        batterShiftX: shiftX,
        shotAimAngleDeg: aimDeg,
        showShotAimCone: showCone,
        animation: anim,
      } = propsRef.current;

      const worldShiftX = !bowlCam && batCamMode === "BOWLER_END" ? -shiftX : shiftX;

      pitchMat.color.setHex(
        curPitch === "Green" ? 0xa3b165 : curPitch === "Dusty" ? 0xd6b888 : 0xc8b99d,
      );

      const elapsedMs = now - animStartRef.current;
      const effectiveMs =
        anim.phase === "RESOLVING" && elapsedMs >= 440 && elapsedMs <= 480 ? 440 : elapsedMs;

      const activeLen = anim.phase === "IDLE" ? selLen : anim.activeLength;
      const activeLn = anim.phase === "IDLE" ? selLine : anim.activeLine;
      const bounceCoords = getBounceWorldCoords(activeLen, activeLn);

      targetRing.visible = allowPick || anim.phase !== "IDLE";
      targetRing.position.set(bounceCoords.x, 0.048, bounceCoords.z);
      const pulseScale = 1 + 0.14 * Math.sin(now * 0.006);
      targetRing.scale.set(pulseScale, pulseScale, 1);

      runArrow.visible = allowPick;

      if (targetRing.visible) {
        const swingMidX =
          bounceCoords.x + (curPitch === "Green" ? -0.45 : curPitch === "Dusty" ? 0.42 : 0.1);
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(0.42, 2.05, -10.1),
          new THREE.Vector3(swingMidX, 1.1, (bounceCoords.z - 10) * 0.5),
          new THREE.Vector3(bounceCoords.x, 0.08, bounceCoords.z),
        );
        swingCurveLine.geometry.setFromPoints(curve.getPoints(20));
        swingCurveLine.computeLineDistances();
        swingCurveLine.visible = true;
      } else {
        swingCurveLine.visible = false;
      }

      // Shot Direction Aim Cone on pitch while batting (always matches exact ball hit vector)
      shotAimGroup.visible =
        showCone &&
        (anim.phase === "IDLE" || anim.phase === "BOWLING" || anim.phase === "AWAITING_HIT");
      if (shotAimGroup.visible) {
        const coneDir = getShotSwingDir("Drive", activeLn, aimDeg, batCamMode);
        shotAimGroup.position.set(-0.32 + worldShiftX, 0.044, 9.15);
        shotAimGroup.rotation.y = -Math.atan2(coneDir.dirX, -coneDir.dirZ);
      }

      if (anim.phase !== "RESOLVING") {
        batterStumps.stumps.forEach((s, i) => {
          s.position.set([-0.11, 0, 0.11][i], 0.365, 0);
          s.rotation.set(0, 0, 0);
        });
        batterStumps.bails.forEach((b, i) => {
          b.position.set([-0.055, 0.055][i], 0.74, 0);
          b.rotation.set(0, 0, Math.PI / 2);
        });
        bowlerStumps.stumps.forEach((s, i) => {
          s.position.set([-0.11, 0, 0.11][i], 0.365, 0);
          s.rotation.set(0, 0, 0);
        });
        bowlerStumps.bails.forEach((b, i) => {
          b.position.set([-0.055, 0.055][i], 0.74, 0);
          b.rotation.set(0, 0, Math.PI / 2);
        });
        tracerPoints.length = 0;
        tracerLine.geometry.setFromPoints([]);
        rippleMesh.material.opacity = 0;
      }

      // Red-Shirt Umpire Signals
      if (anim.phase === "UMPIRE_SIGNAL") {
        const sig = anim.umpireSignal ?? "DOT";
        const wave = Math.sin(elapsedMs * 0.022);
        if (sig === "OUT") {
          umpireRig.rightArm.rotation.set(-Math.PI * 0.96, 0, 0.08);
          umpireRig.leftArm.rotation.set(0, 0, 0);
        } else if (sig === "SIX") {
          umpireRig.rightArm.rotation.set(-Math.PI * 0.94, 0, -0.15);
          umpireRig.leftArm.rotation.set(-Math.PI * 0.94, 0, 0.15);
        } else if (sig === "FOUR") {
          umpireRig.rightArm.rotation.set(-0.9, 0, -0.9 + wave * 0.45);
          umpireRig.leftArm.rotation.set(0, 0, 0);
        } else if (sig === "WIDE") {
          umpireRig.rightArm.rotation.set(0, 0, -Math.PI * 0.48);
          umpireRig.leftArm.rotation.set(0, 0, Math.PI * 0.48);
        } else if (sig === "NO_BALL") {
          umpireRig.rightArm.rotation.set(0, 0, -Math.PI * 0.48);
          umpireRig.leftArm.rotation.set(0, 0, 0);
        } else {
          const chestT = Math.sin(Math.min(1, elapsedMs / 450) * Math.PI);
          umpireRig.rightArm.rotation.set(-0.85 * chestT, 0, 0);
          umpireRig.leftArm.rotation.set(0, 0, 0);
        }
      } else {
        umpireRig.rightArm.rotation.set(0, 0, 0);
        umpireRig.leftArm.rotation.set(0, 0, 0);
      }

      // Striker position & stance
      strikerRig.root.position.x = -0.32 + worldShiftX;
      if (anim.phase === "RESOLVING" && anim.outcome && effectiveMs >= 320) {
        const swingT = Math.min(1, (effectiveMs - 320) / 260);
        const shot = anim.outcome.shotType;
        if (shot === "Defend") {
          strikerRig.torso.rotation.x = 0.28 * Math.sin(swingT * Math.PI);
          strikerRig.rightArm.rotation.x = -0.65 * Math.sin(swingT * Math.PI);
        } else if (shot === "Loft" || shot === "Slog") {
          strikerRig.torso.rotation.y = -0.75 * Math.sin(swingT * Math.PI * 0.85);
          strikerRig.rightArm.rotation.x = -1.75 * Math.sin(swingT * Math.PI * 0.85);
          strikerRig.leftArm.rotation.x = -1.45 * Math.sin(swingT * Math.PI * 0.85);
        } else {
          strikerRig.torso.rotation.y = -0.5 * Math.sin(swingT * Math.PI * 0.9);
          strikerRig.rightArm.rotation.x = -1.35 * Math.sin(swingT * Math.PI * 0.9);
          strikerRig.leftArm.rotation.x = -1.1 * Math.sin(swingT * Math.PI * 0.9);
        }
      } else {
        const tap = Math.sin(now * 0.0055);
        strikerRig.torso.rotation.set(0.14, 0, 0);
        strikerRig.leftLeg.rotation.x = -0.14;
        strikerRig.rightLeg.rotation.x = 0.14;
        strikerRig.rightArm.rotation.set(-0.55 + tap * 0.12, 0, -0.2);
        strikerRig.leftArm.rotation.set(-0.55 + tap * 0.12, 0, 0.2);
      }

      const keeperRise =
        anim.phase === "RESOLVING" && effectiveMs > 380
          ? Math.min(1, (effectiveMs - 380) / 250) * 0.25
          : 0;
      keeperRig.root.position.y = keeperRise;
      keeperRig.torso.rotation.x = 0.45 - keeperRise;
      keeperRig.leftArm.rotation.x = -0.8;
      keeperRig.rightArm.rotation.x = -0.8;

      if (anim.phase === "BOWLING") {
        const runT = Math.min(1, elapsedMs / 650);
        bowlerRig.root.position.set(0.45, Math.sin(runT * Math.PI) * 0.18, -20 + runT * 9.8);
        const stride = Math.sin(now * 0.022);
        bowlerRig.leftLeg.rotation.x = stride * 0.65;
        bowlerRig.rightLeg.rotation.x = -stride * 0.65;
        bowlerRig.leftArm.rotation.x = -stride * 0.7;
        bowlerRig.rightArm.rotation.x = runT > 0.78 ? -(runT - 0.78) * 14 : stride * 0.7;
      } else if (anim.phase === "AWAITING_HIT") {
        const relT = Math.min(1, elapsedMs / 280);
        bowlerRig.root.position.set(0.45, Math.sin((1 - relT) * Math.PI * 0.4) * 0.12, -10.2 + relT * 1.4);
        bowlerRig.rightArm.rotation.x = -Math.PI * 1.4 - relT * 0.8;
        bowlerRig.torso.rotation.x = 0.24 * (1 - relT);
      } else if (anim.phase === "RESOLVING") {
        const ft = Math.min(1, effectiveMs / 350);
        bowlerRig.root.position.set(0.45, 0, -10.2 + ft * 2.4);
        bowlerRig.rightArm.rotation.x = -Math.PI * 1.4 - ft * 1.2;
        bowlerRig.torso.rotation.x = 0.28 * (1 - ft);
      } else {
        bowlerRig.root.position.set(0.45, 0, -20);
        bowlerRig.leftLeg.rotation.x = 0;
        bowlerRig.rightLeg.rotation.x = 0;
        bowlerRig.leftArm.rotation.x = 0;
        bowlerRig.rightArm.rotation.x = 0;
      }

      let targetCamPos = bowlCam
        ? new THREE.Vector3(0, 4.4, -27.5)
        : batCamMode === "BOWLER_END"
        ? new THREE.Vector3(1.3, 3.8, -19.0)
        : new THREE.Vector3(0.95, 2.95, 14.9);
      let targetCamLook = bowlCam
        ? new THREE.Vector3(0, 1.0, 8.5)
        : batCamMode === "BOWLER_END"
        ? new THREE.Vector3(0, 1.05, 9.2)
        : new THREE.Vector3(0, 0.95, -7.5);

      const releasePos = new THREE.Vector3(0.45, 2.08, -10.0);
      const bouncePos = new THREE.Vector3(bounceCoords.x, 0.11, bounceCoords.z);
      const batContactPos = new THREE.Vector3(bounceCoords.x * 0.45 + worldShiftX * 0.4, 0.85, 9.2);

      if (anim.phase === "BOWLING") {
        // Show ball cleanly in the bowler's hand during run-up
        const runT = Math.min(1, elapsedMs / 650);
        ballMesh.visible = true;
        ballShadow.visible = true;
        ballMesh.position.set(0.74, 1.35 + runT * 0.68, bowlerRig.root.position.z + 0.18);
        ballShadow.position.set(ballMesh.position.x, 0.035, ballMesh.position.z);
        ballShadow.scale.setScalar(0.8);
      } else if (anim.phase === "AWAITING_HIT") {
        // Continuous visible ball released down the pitch straight to the batsman
        ballMesh.visible = true;
        ballShadow.visible = true;
        const cycleU = (elapsedMs % 950) / 950;
        if (cycleU < 0.65) {
          const p = cycleU / 0.65;
          const swingX = Math.sin(p * Math.PI) * (curPitch === "Green" ? -0.35 : curPitch === "Dusty" ? 0.3 : 0.08);
          ballMesh.position.lerpVectors(releasePos, bouncePos, p);
          ballMesh.position.x += swingX;
          ballMesh.position.y += Math.sin(p * Math.PI) * 0.45;
          rippleMesh.material.opacity = 0;
        } else {
          const p = (cycleU - 0.65) / 0.35;
          ballMesh.position.lerpVectors(bouncePos, batContactPos, p);
          ballMesh.position.y += Math.sin(p * Math.PI * 0.5) * 0.25;
          rippleMesh.position.set(bouncePos.x, 0.045, bouncePos.z);
          rippleMesh.scale.setScalar(1 + p * 3.0);
          rippleMesh.material.opacity = 0.75 * (1 - p);
        }
        ballShadow.position.set(ballMesh.position.x, 0.035, ballMesh.position.z);
        ballShadow.scale.setScalar(Math.max(0.45, 1 - ballMesh.position.y * 0.04));
      } else if (anim.phase === "BALL_CAUGHT_CHANCE") {
        // Ball pops up / back toward bowler & infielder ready to catch
        const catchU = (elapsedMs % 1100) / 1100;
        const cPos = new THREE.Vector3(0.45, 1.45, -8.5);
        ballMesh.visible = true;
        ballShadow.visible = true;
        ballMesh.position.lerpVectors(batContactPos, cPos, catchU);
        ballMesh.position.y += Math.sin(catchU * Math.PI) * 3.2;
        ballShadow.position.set(ballMesh.position.x, 0.035, ballMesh.position.z);
        ballShadow.scale.setScalar(Math.max(0.45, 1 - ballMesh.position.y * 0.04));

        bowlerRig.root.position.set(0.45, 0, -8.8);
        bowlerRig.rightArm.rotation.x = -2.15;
        bowlerRig.leftArm.rotation.x = -2.15;
        targetCamPos = new THREE.Vector3(2.4, 3.6, -15.5);
        targetCamLook = cPos;
      } else if (anim.phase === "AWAITING_THROW" && anim.outcome) {
        // Ball has reached outfielder — fielder holds/preps Direct Throw toward selected end
        const out = anim.outcome;
        const { dirX, dirZ } = getShotSwingDir(
          out.shotType,
          out.line,
          showCone ? aimDeg : undefined,
          batCamMode,
        );
        const distMeters = out.runs === 2 ? 34 : 24;
        const destX = batContactPos.x + dirX * distMeters;
        const destZ = batContactPos.z + dirZ * distMeters;

        let nearestIdx = 0;
        let bestDist = Infinity;
        fielderRigs.forEach((fr, idx) => {
          const d = Math.hypot(fr.homeX - destX, fr.homeZ - destZ);
          if (d < bestDist) {
            bestDist = d;
            nearestIdx = idx;
          }
        });

        const stumpsZ = anim.throwTargetEnd === "NON_STRIKER" ? -10.1 : 10.1;
        fielderRigs.forEach((fr, idx) => {
          if (idx === nearestIdx) {
            fr.rig.root.position.set(
              fr.homeX + (destX - fr.homeX) * 0.78,
              0,
              fr.homeZ + (destZ - fr.homeZ) * 0.78,
            );
            fr.rig.root.lookAt(0, 0, stumpsZ);
            fr.rig.rightArm.rotation.x = -1.65 + Math.sin(now * 0.008) * 0.15;
          } else {
            fr.rig.root.position.set(fr.homeX, 0, fr.homeZ);
          }
        });

        const activeFielder = fielderRigs[nearestIdx];
        ballMesh.visible = true;
        ballShadow.visible = true;
        ballMesh.position.set(
          activeFielder.rig.root.position.x + 0.25,
          1.15,
          activeFielder.rig.root.position.z,
        );
        ballShadow.position.set(ballMesh.position.x, 0.035, ballMesh.position.z);
        ballShadow.scale.setScalar(0.8);

        targetCamPos = new THREE.Vector3(
          ballMesh.position.x * 0.55 + 4,
          7.5,
          ballMesh.position.z * 0.55 + (bowlCam ? -10 : 10),
        );
        targetCamLook = new THREE.Vector3(0, 0.8, stumpsZ * 0.4);
      } else if (anim.phase === "UMPIRE_SIGNAL") {
        ballMesh.visible = false;
        ballShadow.visible = false;
        fielderRigs.forEach((fr) => {
          fr.rig.root.position.set(fr.homeX, 0, fr.homeZ);
          fr.rig.root.rotation.x = 0;
          fr.rig.leftLeg.rotation.x = 0;
          fr.rig.rightLeg.rotation.x = 0;
          fr.rig.rightArm.rotation.x = 0;
        });
        targetCamPos = new THREE.Vector3(1.1, 2.55, -17.2);
        targetCamLook = new THREE.Vector3(0, 1.35, -12.6);
      } else if (anim.phase === "RESOLVING" && anim.outcome) {
        const out = anim.outcome;
        ballMesh.visible = true;
        ballShadow.visible = true;

        const flightDuration = 1480;
        const t = Math.min(1, effectiveMs / flightDuration);

        if (t < 0.28) {
          const u = t / 0.28;
          if (u < 0.65) {
            const p = u / 0.65;
            const swingX = Math.sin(p * Math.PI) * (curPitch === "Green" ? -0.35 : curPitch === "Dusty" ? 0.3 : 0.08);
            ballMesh.position.lerpVectors(releasePos, bouncePos, p);
            ballMesh.position.x += swingX;
            ballMesh.position.y += Math.sin(p * Math.PI) * 0.45;
          } else {
            const p = (u - 0.65) / 0.35;
            ballMesh.position.lerpVectors(bouncePos, batContactPos, p);
            ballMesh.position.y += Math.sin(p * Math.PI * 0.5) * 0.25;

            rippleMesh.position.set(bouncePos.x, 0.045, bouncePos.z);
            rippleMesh.scale.setScalar(1 + p * 3.2);
            rippleMesh.material.opacity = 0.8 * (1 - p);
          }
        } else {
          const u = (t - 0.28) / 0.72;
          if (
            out.isWicket &&
            (out.wicketKind === "BOWLED" || out.wicketKind === "LBW" || out.wicketKind === "RUN_OUT")
          ) {
            ballMesh.position.lerpVectors(batContactPos, new THREE.Vector3(0.05, 0.48, 10.6), Math.min(1, u * 2.2));
            const wt = Math.min(1, u * 1.8);
            batterStumps.stumps[1].rotation.x = wt * 1.25;
            batterStumps.stumps[1].position.z = wt * 0.45;
            batterStumps.stumps[2].rotation.z = -wt * 0.75;
            batterStumps.bails.forEach((b, i) => {
              b.position.set((i === 0 ? -0.3 : 0.3) * wt, 0.74 + Math.sin(wt * Math.PI) * 1.4, wt * 0.9);
              b.rotation.y = wt * 8;
            });
          } else {
            const { dirX, dirZ } = getShotSwingDir(
              out.shotType,
              out.line,
              showCone ? aimDeg : undefined,
              batCamMode,
            );
            const distMeters =
              out.runs === 6
                ? 68
                : out.runs === 4
                ? 62
                : out.runs === 2
                ? 34
                : out.runs === 1
                ? 24
                : 7;
            const destX = batContactPos.x + dirX * distMeters;
            const destZ = batContactPos.z + dirZ * distMeters;
            const maxHeight = out.runs === 6 ? 14.5 : out.runs === 4 ? 2.4 : 1.5;

            const hasDirectThrow =
              out.runs === 1 || out.runs === 2 || (out.isWicket && out.wicketKind === "RUN_OUT");
            const hitEndU = hasDirectThrow ? 0.55 : 1.0;
            const targetStumpsZ = anim.throwTargetEnd === "NON_STRIKER" ? -10.1 : 10.1;

            let nearestIdx = 0;
            let bestDist = Infinity;
            fielderRigs.forEach((fr, idx) => {
              const d = Math.hypot(fr.homeX - destX, fr.homeZ - destZ);
              if (d < bestDist) {
                bestDist = d;
                nearestIdx = idx;
              }
            });

            if (u <= hitEndU) {
              const hu = u / hitEndU;
              ballMesh.position.x = batContactPos.x + (destX - batContactPos.x) * hu;
              ballMesh.position.z = batContactPos.z + (destZ - batContactPos.z) * hu;
              ballMesh.position.y =
                out.runs === 6
                  ? 0.85 + Math.sin(hu * Math.PI) * maxHeight
                  : Math.max(0.11, 0.85 * (1 - hu) + Math.abs(Math.sin(hu * Math.PI * 2)) * maxHeight * (1 - hu * 0.5));
            } else {
              // Direct throw back from intercepting fielder to the target stumps!
              const tu = (u - hitEndU) / (1 - hitEndU);
              const pickupPos = new THREE.Vector3(destX * 0.88, 0.85, destZ * 0.88);
              const stumpsPos = new THREE.Vector3(0, 0.65, targetStumpsZ);
              ballMesh.position.lerpVectors(pickupPos, stumpsPos, tu);
              ballMesh.position.y += Math.sin(tu * Math.PI) * 1.45;
              if (out.isWicket && out.wicketKind === "RUN_OUT" && tu > 0.72) {
                const wt = Math.min(1, (tu - 0.72) / 0.28);
                const targetSet = anim.throwTargetEnd === "NON_STRIKER" ? bowlerStumps : batterStumps;
                targetSet.stumps[1].rotation.x = wt * 1.25;
                targetSet.stumps[1].position.z = wt * 0.45;
                targetSet.stumps[2].rotation.z = -wt * 0.75;
                targetSet.bails.forEach((b, i) => {
                  b.position.set((i === 0 ? -0.3 : 0.3) * wt, 0.74 + Math.sin(wt * Math.PI) * 1.4, wt * 0.9);
                  b.rotation.y = wt * 8;
                });
              }
            }

            if (tracerPoints.length < 52 && u <= hitEndU) {
              tracerPoints.push(ballMesh.position.clone());
              tracerLine.geometry.setFromPoints(tracerPoints);
            }

            if (out.runs >= 1 || (out.isWicket && out.wicketKind === "RUN_OUT")) {
              if (hasDirectThrow && u > 0.65) {
                const stumpsTarget = new THREE.Vector3(0, 0.85, targetStumpsZ * 0.92);
                targetCamPos = !bowlCam && batCamMode === "BATSMAN_END"
                  ? new THREE.Vector3(1.1, 3.2, 15.2)
                  : new THREE.Vector3(1.3, 3.8, -19.0);
                targetCamLook = stumpsTarget;
              } else {
                targetCamPos = !bowlCam && batCamMode === "BATSMAN_END"
                  ? new THREE.Vector3(
                      ballMesh.position.x * 0.42 + 4.5,
                      9.5 + out.runs * 1.1,
                      Math.max(-18, ballMesh.position.z * 0.45 + 14.5),
                    )
                  : new THREE.Vector3(
                      ballMesh.position.x * 0.45 + 6,
                      11 + out.runs * 1.2,
                      ballMesh.position.z * 0.4 - 14,
                    );
                targetCamLook = ballMesh.position.clone();
              }
            }

            fielderRigs.forEach((fr, idx) => {
              if (idx === nearestIdx && hasDirectThrow) {
                const moveU = Math.min(1, u / hitEndU);
                fr.rig.root.position.x = fr.homeX + (destX - fr.homeX) * moveU * 0.78;
                fr.rig.root.position.z = fr.homeZ + (destZ - fr.homeZ) * moveU * 0.78;
                if (u > hitEndU) {
                  fr.rig.root.lookAt(0, 0, targetStumpsZ);
                  const throwT = (u - hitEndU) / (1 - hitEndU);
                  fr.rig.rightArm.rotation.x = -Math.PI * 1.2 * Math.sin(throwT * Math.PI);
                  fr.rig.leftLeg.rotation.x = 0;
                  fr.rig.rightLeg.rotation.x = 0;
                } else {
                  fr.rig.root.lookAt(destX, 0, destZ);
                  const runCycle = Math.sin(now * 0.025);
                  fr.rig.leftLeg.rotation.x = runCycle * 0.6;
                  fr.rig.rightLeg.rotation.x = -runCycle * 0.6;
                  fr.rig.rightArm.rotation.x = 0;
                }
              } else if (idx === nearestIdx && out.runs > 0) {
                const moveU = Math.min(1, u / 0.85);
                fr.rig.root.position.x = fr.homeX + (destX - fr.homeX) * moveU * 0.78;
                fr.rig.root.position.z = fr.homeZ + (destZ - fr.homeZ) * moveU * 0.78;
                fr.rig.root.lookAt(destX, 0, destZ);
                const runCycle = Math.sin(now * 0.025);
                fr.rig.leftLeg.rotation.x = runCycle * 0.6;
                fr.rig.rightLeg.rotation.x = -runCycle * 0.6;
                fr.rig.rightArm.rotation.x = 0;
                if (u > 0.78 && out.runs === 4) {
                  fr.rig.root.rotation.x = 0.65;
                }
              } else {
                fr.rig.root.position.set(fr.homeX, 0, fr.homeZ);
                fr.rig.root.rotation.x = 0;
                fr.rig.rightArm.rotation.x = 0;
              }
            });
          }
        }

        ballShadow.position.set(ballMesh.position.x, 0.035, ballMesh.position.z);
        const sScale = Math.max(0.45, 1 - ballMesh.position.y * 0.04);
        ballShadow.scale.setScalar(sScale);
      } else {
        ballMesh.visible = false;
        ballShadow.visible = false;
        fielderRigs.forEach((fr) => {
          fr.rig.root.position.set(fr.homeX, 0, fr.homeZ);
          fr.rig.root.rotation.x = 0;
          fr.rig.leftLeg.rotation.x = 0;
          fr.rig.rightLeg.rotation.x = 0;
          fr.rig.rightArm.rotation.x = 0;
        });
      }

      camera.position.lerp(targetCamPos, anim.phase === "IDLE" ? 0.2 : 0.14);
      camera.lookAt(targetCamLook);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [battingColor, bowlingColor, bowlerJerseyNumber]);

  const handlePitchPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canPickTarget || !mountRef.current || !cameraRef.current || !pitchPlaneRef.current) return;
    const rect = mountRef.current.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, cameraRef.current);
    const hits = raycaster.intersectObject(pitchPlaneRef.current);
    if (hits.length > 0) {
      const pt = hits[0].point;
      const mapped = mapWorldPitchToTarget(pt.x, pt.z);
      onPickTarget(mapped.length, mapped.line);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#0b162c] preserve-dark">
      <div
        ref={mountRef}
        onPointerDown={handlePitchPointer}
        onPointerMove={(e) => {
          if (e.buttons === 1) handlePitchPointer(e);
        }}
        className={`w-full h-full ${canPickTarget ? "cursor-crosshair" : "cursor-default"}`}
      />
    </div>
  );
}
