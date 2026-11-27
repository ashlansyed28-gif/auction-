import type { JerseyTheme } from "../../types/auction";

interface CricketJerseySvgProps {
  kit: JerseyTheme;
  size?: number;
  className?: string;
}

function CrestPath({ kitId, accent }: { kitId: JerseyTheme["id"]; accent: string }) {
  switch (kitId) {
    case "csk":
      return <path d="M56 35 L58.5 41 L65 41.5 L60 45.8 L61.5 52 L56 48.5 L50.5 52 L52 45.8 L47 41.5 L53.5 41 Z" fill={accent} />;
    case "mbi":
      return <path d="M48 48 L50 38 L55 43 L58 37 L61 43 L66 38 L68 48 Z" fill={accent} />;
    case "rcb":
      return <path d="M56 36 L49 45 H54 L52 53 L61 42 H56 Z" fill={accent} />;
    case "krc":
      return <path d="M56 35 L64 39 V45 C64 49 60.5 52.5 56 54 C51.5 52.5 48 49 48 45 V39 Z" fill={accent} />;
    case "ddc":
      return <path d="M56 35 C59 39 63 42 63 46 C63 50 60 53 56 54 C52 53 49 50 49 46 C49 43 51 40 53 38 C53 41 55 42 56 35 Z" fill={accent} />;
    case "srh":
      return <circle cx="56" cy="44" r="6.5" fill={accent} />;
    case "rrg":
      return <path d="M56 35 L64 44 L56 53 L48 44 Z" fill={accent} />;
    case "pbk":
      return <path d="M49 50 L60 36 L63 38 L52 52 Z" fill={accent} />;
    case "gpt":
      return <path d="M56 35 L63 39.5 V48.5 L56 53 L49 48.5 V39.5 Z" fill={accent} />;
    case "lsg":
      return <path d="M56 34 L58.5 41.5 L66 44 L58.5 46.5 L56 54 L53.5 46.5 L46 44 L53.5 41.5 Z" fill={accent} />;
  }
}

export function CricketJerseySvg({ kit, size = 56, className = "" }: CricketJerseySvgProps) {
  const gradId = `jersey-grad-${kit.id}`;
  const sheenId = `jersey-sheen-${kit.id}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={`${kit.label} cricket jersey`}
    >
      <defs>
        <linearGradient id={gradId} x1="16" y1="12" x2="80" y2="86" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor={kit.primary} />
          <stop offset="65%" stopColor={kit.stripe} />
          <stop offset="100%" stopColor={kit.secondary} />
        </linearGradient>
        <linearGradient id={sheenId} x1="24" y1="14" x2="66" y2="62" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.26" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Main torso & raglan sleeves */}
      <path
        d="M32 16 L10 29 L17 47 L28 42 V82 C28 84.5 30 86 32.5 86 H63.5 C66 86 68 84.5 68 82 V42 L79 47 L86 29 L64 16 L56 20 C51.5 22 44.5 22 40 20 Z"
        fill={`url(#${gradId})`}
        stroke={kit.accent}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />

      {/* Raglan shoulder panels */}
      <path
        d="M32 16 L10 29 L17 47 L28 42 L34 25 Z"
        fill={kit.secondary}
        fillOpacity="0.55"
      />
      <path
        d="M64 16 L86 29 L79 47 L68 42 L62 25 Z"
        fill={kit.secondary}
        fillOpacity="0.55"
      />

      {/* Sleeve cuff stripes */}
      <path d="M12 34 L19 45" stroke={kit.accent} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M84 34 L77 45" stroke={kit.accent} strokeWidth="2.4" strokeLinecap="round" />

      {/* Dynamic diagonal & vertical broadcast chest stripes */}
      <path d="M28 52 L68 38 V45 L28 59 Z" fill={kit.accent} fillOpacity="0.24" />
      <path d="M28 63 L68 49 V53 L28 67 Z" fill={kit.secondary} fillOpacity="0.48" />
      <rect x="28" y="80" width="40" height="4" rx="1" fill={kit.accent} fillOpacity="0.7" />

      {/* Tailored V-neck collar & inner neck shadow */}
      <path d="M36 16 Q48 26 60 16 L55 13 Q48 18 41 13 Z" fill={kit.secondary} />
      <path
        d="M35 16 L48 29 L61 16"
        stroke={kit.accent}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M40 16 L48 24 L56 16"
        fill="#070B16"
        fillOpacity="0.65"
      />

      {/* Fabric sheen */}
      <path
        d="M32 16 L64 16 L56 54 L28 54 Z"
        fill={`url(#${sheenId})`}
      />

      {/* Left-chest crest shield */}
      <g transform="translate(-10, -2)">
        <circle cx="56" cy="44" r="10.5" fill={kit.secondary} stroke={kit.accent} strokeWidth="1.5" />
        <CrestPath kitId={kit.id} accent={kit.accent} />
      </g>

      {/* Subtle sponsor-style chest band */}
      <rect x="35" y="61" width="26" height="6" rx="3" fill="#070B16" fillOpacity="0.55" />
      <text
        x="48"
        y="65.8"
        textAnchor="middle"
        fill={kit.accent}
        fontSize="4.6"
        fontWeight="900"
        letterSpacing="0.9"
      >
        {kit.code}
      </text>
    </svg>
  );
}
