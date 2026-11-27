interface ArenaBackdropSvgProps {
  spotlightColor: string;
  playerName: string;
  bidReadout: string;
  statusLabel: string;
}

export function ArenaBackdropSvg({
  spotlightColor,
  playerName,
  bidReadout,
  statusLabel,
}: ArenaBackdropSvgProps) {
  return (
    <svg
      viewBox="0 0 1000 420"
      preserveAspectRatio="xMidYMid slice"
      className="absolute inset-0 w-full h-full pointer-events-none select-none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="arenaWall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#081024" />
          <stop offset="55%" stopColor="#131B36" />
          <stop offset="100%" stopColor="#050811" />
        </linearGradient>
        <linearGradient id="spotConeLeft" x1="0.22" y1="0" x2="0.45" y2="1">
          <stop offset="0%" stopColor={spotlightColor} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="spotConeRight" x1="0.78" y1="0" x2="0.55" y2="1">
          <stop offset="0%" stopColor={spotlightColor} />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
        <radialGradient id="floorReflect" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={spotlightColor} />
          <stop offset="70%" stopColor="#1E293B" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#050811" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="arenaVignette" cx="50%" cy="48%" r="65%">
          <stop offset="55%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#03050C" stopOpacity="0.82" />
        </radialGradient>
      </defs>

      {/* Base Studio Backdrop */}
      <rect width="1000" height="420" fill="url(#arenaWall)" />

      {/* Architectural Rib Arches */}
      <path d="M60 280 Q500 20 940 280" stroke="#FACC15" strokeOpacity="0.12" strokeWidth="2" fill="none" />
      <path d="M140 280 Q500 70 860 280" stroke="#60A5FA" strokeOpacity="0.12" strokeWidth="1.5" fill="none" />

      {/* Ceiling Lighting Truss */}
      <rect x="80" y="14" width="840" height="10" rx="3" fill="#0F172A" stroke="#334155" strokeWidth="1.2" />
      {[180, 320, 500, 680, 820].map((x) => (
        <g key={x}>
          <rect x={x - 10} y="22" width="20" height="8" rx="2" fill="#1E293B" stroke="#FACC15" strokeWidth="1" />
          <circle cx={x} cy="28" r="3" fill="#FEF08A" />
        </g>
      ))}

      {/* Twin Glowing Arena LED Wall Screens */}
      <g>
        <rect x="52" y="54" width="246" height="114" rx="10" fill="#071226" stroke="#3B82F6" strokeOpacity="0.5" strokeWidth="2" />
        <text x="175" y="88" textAnchor="middle" fill="#93C5FD" fontSize="12" fontWeight="800" letterSpacing="2">
          ON THE BLOCK
        </text>
        <text x="175" y="124" textAnchor="middle" fill="#F8FAFC" fontSize="21" fontWeight="900">
          {playerName}
        </text>
        <line x1="88" y1="142" x2="262" y2="142" stroke="#FACC15" strokeOpacity="0.35" strokeWidth="1.5" />
      </g>

      <g>
        <rect x="702" y="54" width="246" height="114" rx="10" fill="#071226" stroke="#FACC15" strokeOpacity="0.55" strokeWidth="2" />
        <text x="825" y="88" textAnchor="middle" fill="#FDE68A" fontSize="12" fontWeight="800" letterSpacing="2">
          {statusLabel}
        </text>
        <text x="825" y="126" textAnchor="middle" fill="#FACC15" fontSize="22" fontWeight="900">
          {bidReadout}
        </text>
        <line x1="738" y1="142" x2="912" y2="142" stroke="#FACC15" strokeOpacity="0.35" strokeWidth="1.5" />
      </g>

      {/* Volumetric Spotlight Cones */}
      <polygon points="180,28 220,28 530,385 330,385" fill="url(#spotConeLeft)" />
      <polygon points="820,28 780,28 670,385 470,385" fill="url(#spotConeRight)" />

      {/* Polished Floor Horizon & Reflection */}
      <rect x="0" y="262" width="1000" height="158" fill="#070B16" fillOpacity="0.72" />
      <line x1="0" y1="262" x2="1000" y2="262" stroke="#FACC15" strokeOpacity="0.28" strokeWidth="1.5" />
      <ellipse cx="500" cy="342" rx="410" ry="62" fill="url(#floorReflect)" />

      {/* Dramatic Vignette Overlay */}
      <rect width="1000" height="420" fill="url(#arenaVignette)" />
    </svg>
  );
}
