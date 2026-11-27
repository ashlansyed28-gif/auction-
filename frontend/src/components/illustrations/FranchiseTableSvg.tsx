import type { RefObject } from "react";
import type { FriendTeam } from "../../types/auction";

interface FranchiseTableSvgProps {
  team: FriendTeam;
  isLeading: boolean;
  isActiveTurn: boolean;
  hasPassed: boolean;
  paddleRef: RefObject<SVGGElement | null>;
}

export function FranchiseTableSvg({
  team,
  isLeading,
  isActiveTurn,
  hasPassed,
  paddleRef,
}: FranchiseTableSvgProps) {
  const { kit } = team;
  const clothId = `cloth-${team.id}`;
  const tableGlow = isLeading ? kit.accent : isActiveTurn ? "#FACC15" : "rgba(255,255,255,0.18)";

  return (
    <svg
      viewBox="0 0 280 150"
      className="w-full h-auto overflow-visible"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`${team.name} bidding desk`}
    >
      <defs>
        <linearGradient id={clothId} x1="20" y1="68" x2="260" y2="144" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={kit.primary} />
          <stop offset="55%" stopColor={kit.stripe} />
          <stop offset="100%" stopColor={kit.secondary} />
        </linearGradient>
      </defs>

      {/* Two Franchise Representatives seated behind the table */}
      <g opacity={hasPassed ? 0.45 : 1}>
        {/* Rep 1 (Left - holds paddle) */}
        <path
          d="M52 80 C54 58, 70 54, 86 54 C102 54, 118 58, 120 80 Z"
          fill={kit.secondary}
          stroke={kit.accent}
          strokeWidth="1.2"
        />
        <path d="M77 54 L86 68 L95 54" stroke={kit.accent} strokeWidth="2" fill="none" />
        <ellipse cx="86" cy="39" rx="12" ry="14" fill="#DDA97E" />
        <path d="M74 36 C74 22, 98 22, 98 36 C92 28, 80 28, 74 36 Z" fill="#1C1917" />

        {/* Rep 2 (Right - analyst at laptop) */}
        <path
          d="M158 80 C160 58, 176 54, 192 54 C208 54, 224 58, 226 80 Z"
          fill={kit.primary}
          stroke={kit.accent}
          strokeWidth="1.2"
        />
        <ellipse cx="192" cy="40" rx="11.5" ry="13.5" fill="#C68B63" />
        <path d="M180 37 C180 23, 204 23, 204 37 C198 29, 186 29, 180 37 Z" fill="#0F172A" />
      </g>

      {/* GSAP-Animated Bidding Paddle (pivots at 50, 74) */}
      <g ref={paddleRef} style={{ transformOrigin: "50px 74px" }}>
        {/* Arm & handle */}
        <line x1="60" y1="74" x2="38" y2="54" stroke={kit.secondary} strokeWidth="7" strokeLinecap="round" />
        <rect x="33" y="34" width="5" height="22" rx="2" fill="#92400E" />
        {/* Paddle Head */}
        <circle
          cx="35.5"
          cy="24"
          r="18"
          fill={isLeading ? kit.accent : kit.primary}
          stroke="#FFFFFF"
          strokeWidth="2.4"
        />
        <circle cx="35.5" cy="24" r="13.5" fill={kit.secondary} />
        <text
          x="35.5"
          y="27.5"
          textAnchor="middle"
          fill={kit.accent}
          fontSize="9"
          fontWeight="900"
          letterSpacing="0.5"
        >
          {kit.code}
        </text>
      </g>

      {/* Table Top Surface */}
      <path
        d="M22 76 L258 76 L268 88 L12 88 Z"
        fill="#1E293B"
        stroke={tableGlow}
        strokeWidth={isLeading ? "2.2" : "1.2"}
      />

      {/* Props on Desk: Brass Table Flag, Open Laptop, Water Bottles */}
      {/* Flagpole & waving banner */}
      <rect x="132" y="72" width="16" height="5" rx="2" fill="#FACC15" />
      <line x1="140" y1="72" x2="140" y2="28" stroke="#FACC15" strokeWidth="2.2" />
      <g className="flag-wave">
        <path d="M141 29 L176 34 L173 48 L141 47 Z" fill={kit.primary} stroke={kit.accent} strokeWidth="1" />
        <text x="157" y="42" textAnchor="middle" fill="#FFFFFF" fontSize="8" fontWeight="900">
          {kit.code}
        </text>
      </g>

      {/* Silver Open Laptop */}
      <polygon points="184,78 214,78 220,62 190,62" fill="#CBD5E1" stroke="#475569" strokeWidth="1" />
      <polygon points="188,76 211,76 216,64 193,64" fill="#1D4ED8" fillOpacity="0.85" />
      <rect x="180" y="78" width="38" height="4" rx="1.5" fill="#94A3B8" />

      {/* Mineral Water Bottles */}
      <g transform="translate(88, 60)">
        <rect x="0" y="4" width="8" height="15" rx="2" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="0.8" />
        <rect x="1.5" y="1" width="5" height="3" rx="1" fill="#0284C7" />
        <rect x="0" y="10" width="8" height="4" fill="#0284C7" />
      </g>
      <g transform="translate(101, 61)">
        <rect x="0" y="4" width="8" height="14" rx="2" fill="#E0F2FE" stroke="#7DD3FC" strokeWidth="0.8" />
        <rect x="1.5" y="1" width="5" height="3" rx="1" fill="#0284C7" />
        <rect x="0" y="9" width="8" height="4" fill="#0284C7" />
      </g>

      {/* Draped Table Apron */}
      <path
        d="M12 88 H268 L256 142 H24 Z"
        fill={`url(#${clothId})`}
        stroke={tableGlow}
        strokeWidth={isLeading ? "2.4" : "1.2"}
      />

      {/* Gold Horizontal Piping & Nameplate */}
      <line x1="16" y1="96" x2="264" y2="96" stroke={kit.accent} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="82" y="105" width="116" height="24" rx="6" fill="#070B16" fillOpacity="0.78" stroke={kit.accent} strokeWidth="1.2" />
      <text x="140" y="121" textAnchor="middle" fill="#F8FAFC" fontSize="11" fontWeight="900" letterSpacing="1.2">
        {kit.code} • {kit.label.toUpperCase()}
      </text>
    </svg>
  );
}
