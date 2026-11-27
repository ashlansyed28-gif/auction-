import type { RefObject } from "react";

interface AuctioneerPodiumSvgProps {
  gavelRef: RefObject<SVGGElement | null>;
  isFinalCall: boolean;
  isSold: boolean;
}

export function AuctioneerPodiumSvg({ gavelRef, isFinalCall, isSold }: AuctioneerPodiumSvgProps) {
  return (
    <svg
      viewBox="0 0 240 190"
      className="w-full max-w-[230px] h-auto drop-shadow-[0_18px_28px_rgba(0,0,0,0.65)]"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Auctioneer podium with wooden gavel"
    >
      <defs>
        <linearGradient id="podiumWood" x1="40" y1="90" x2="200" y2="180" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="50%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#070B16" />
        </linearGradient>
        <linearGradient id="brassTrim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FEF08A" />
          <stop offset="50%" stopColor="#FACC15" />
          <stop offset="100%" stopColor="#A16207" />
        </linearGradient>
        <linearGradient id="mahogany" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#7C2D12" />
          <stop offset="55%" stopColor="#B45309" />
          <stop offset="100%" stopColor="#451A03" />
        </linearGradient>
        <radialGradient id="podiumGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={isSold ? "#FACC15" : isFinalCall ? "#F43F5E" : "#38BDF8"} stopOpacity="0.45" />
          <stop offset="100%" stopColor="#070B16" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Halo behind auctioneer */}
      <ellipse cx="120" cy="84" rx="82" ry="52" fill="url(#podiumGlow)" />

      {/* Auctioneer figure behind lectern */}
      <g>
        {/* Shoulders & charcoal jacket */}
        <path
          d="M72 104 C74 78, 92 70, 120 70 C148 70, 166 78, 168 104 Z"
          fill="#1E293B"
          stroke="#475569"
          strokeWidth="1.4"
        />
        {/* Crisp white shirt V & gold tie */}
        <path d="M107 71 L120 96 L133 71 Z" fill="#F8FAFC" />
        <path d="M120 74 L116 92 L120 99 L124 92 Z" fill="url(#brassTrim)" />
        {/* Lapels */}
        <path d="M104 71 L114 96 L101 88 Z" fill="#0F172A" />
        <path d="M136 71 L126 96 L139 88 Z" fill="#0F172A" />

        {/* Neck & Head */}
        <rect x="112" y="57" width="16" height="14" rx="5" fill="#DDA97E" />
        <ellipse cx="120" cy="43" rx="17" ry="20" fill="#E3B38B" />
        {/* Hair */}
        <path d="M103 40 C103 20, 137 20, 137 40 C131 28, 109 28, 103 40 Z" fill="#1E1B18" />
        {/* Glasses & headset mic */}
        <rect x="108" y="39" width="9" height="6" rx="2" fill="#0F172A" stroke="#CBD5E1" strokeWidth="1" />
        <rect x="123" y="39" width="9" height="6" rx="2" fill="#0F172A" stroke="#CBD5E1" strokeWidth="1" />
        <line x1="117" y1="42" x2="123" y2="42" stroke="#CBD5E1" strokeWidth="1.2" />
        <path d="M103 44 Q103 54 115 54" stroke="#94A3B8" strokeWidth="1.4" fill="none" />
        <circle cx="116" cy="54" r="2" fill="#FACC15" />
      </g>

      {/* Raised Wooden Gavel Arm (GSAP animated pivot at 158, 92) */}
      <g ref={gavelRef} style={{ transformOrigin: "158px 92px" }}>
        {/* Forearm */}
        <path d="M158 94 L182 70" stroke="#1E293B" strokeWidth="10" strokeLinecap="round" />
        <circle cx="183" cy="69" r="5" fill="#DDA97E" />
        {/* Wooden handle */}
        <line x1="181" y1="71" x2="205" y2="44" stroke="url(#mahogany)" strokeWidth="5.5" strokeLinecap="round" />
        {/* Gavel mallet head with brass bands */}
        <g transform="translate(205, 44) rotate(-42)">
          <rect x="-15" y="-8" width="30" height="16" rx="4" fill="url(#mahogany)" stroke="#451A03" strokeWidth="1.2" />
          <rect x="-12" y="-8.5" width="4" height="17" rx="1" fill="url(#brassTrim)" />
          <rect x="8" y="-8.5" width="4" height="17" rx="1" fill="url(#brassTrim)" />
        </g>
      </g>

      {/* Sounding block on podium top */}
      <ellipse cx="164" cy="96" rx="14" ry="4.5" fill="url(#mahogany)" stroke="url(#brassTrim)" strokeWidth="1.2" />

      {/* Gooseneck podium microphone */}
      <path d="M78 96 Q74 72 90 66" stroke="#94A3B8" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <ellipse cx="92" cy="65" rx="4.5" ry="3" fill="#334155" stroke="#FACC15" strokeWidth="0.9" />

      {/* Tiered Podium Top Slab */}
      <path d="M46 96 H194 L186 108 H54 Z" fill="url(#brassTrim)" />
      <path d="M52 108 H188 L178 176 H62 Z" fill="url(#podiumWood)" stroke="url(#brassTrim)" strokeWidth="2" />

      {/* Side vertical brass accents */}
      <rect x="64" y="114" width="4" height="54" rx="2" fill="url(#brassTrim)" fillOpacity="0.65" />
      <rect x="172" y="114" width="4" height="54" rx="2" fill="url(#brassTrim)" fillOpacity="0.65" />

      {/* Podium Illuminated Center Shield */}
      <path
        d="M120 116 L142 124 V142 C142 155 132 164 120 168 C108 164 98 155 98 142 V124 Z"
        fill="#0F172A"
        stroke="url(#brassTrim)"
        strokeWidth="2.2"
      />
      <text x="120" y="145" textAnchor="middle" fill="#FACC15" fontSize="13" fontWeight="900" letterSpacing="1">
        HT
      </text>

      {/* Podium Floor Plinth */}
      <rect x="44" y="176" width="152" height="10" rx="4" fill="#1E293B" stroke="url(#brassTrim)" strokeWidth="1.4" />
    </svg>
  );
}
