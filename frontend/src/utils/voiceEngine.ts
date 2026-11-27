import type { BroadcastPlayer, FriendTeam } from "../types/auction";
import { formatLakhsCrores } from "./auctionRules";

const PREFERRED_IN_VOICES = [
  "ravi",
  "prabhat",
  "neeraj",
  "rishi",
  "heera",
  "en-in",
  "india",
  "daniel",
  "george",
  "ryan",
  "male",
];

function sanitizeName(name: string): string {
  return name.replace(/\./g, " ").replace(/\s+/g, " ").trim();
}

export function formatSpokenBroadcastAmount(amountCr: number): string {
  return formatLakhsCrores(amountCr);
}

class FriendChallengeVoiceEngine {
  private enabled = true;
  private muted = false;
  private voice: SpeechSynthesisVoice | null = null;
  private lastBidSpokenMs = 0;

  constructor() {
    this.selectBestVoice();
  }

  private hasSpeech(): boolean {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    );
  }

  private selectBestVoice() {
    if (!this.hasSpeech()) return;
    const pick = () => {
      try {
        const voices = window.speechSynthesis.getVoices() || [];
        if (!voices.length) return;
        let best: SpeechSynthesisVoice | null = null;
        let bestScore = -1;
        for (const v of voices) {
          const lang = (v.lang || "").toLowerCase();
          const name = (v.name || "").toLowerCase();
          if (!lang.startsWith("en")) continue;
          let score = 10;
          if (lang === "en-in" || lang === "en_in") score += 65;
          else if (lang.startsWith("en-gb")) score += 25;
          for (let i = 0; i < PREFERRED_IN_VOICES.length; i++) {
            if (name.includes(PREFERRED_IN_VOICES[i]) || lang.includes(PREFERRED_IN_VOICES[i])) {
              score += 28 - i;
            }
          }
          if (name.includes("natural") || name.includes("online")) score += 12;
          if (score > bestScore) {
            bestScore = score;
            best = v;
          }
        }
        this.voice = best || voices[0];
      } catch {}
    };
    pick();
    try {
      window.speechSynthesis.addEventListener?.("voiceschanged", pick);
    } catch {}
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (muted) this.stop();
  }

  unlock() {
    if (!this.hasSpeech()) return;
    this.selectBestVoice();
    if (window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
  }

  stop() {
    if (!this.hasSpeech()) return;
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }

  private speak(text: string, pitch: number, rate: number, interrupt = true) {
    if (!this.enabled || this.muted || !this.hasSpeech() || !text) return;
    const synth = window.speechSynthesis;
    if (interrupt) {
      try {
        synth.cancel();
      } catch {}
    }
    const utt = new SpeechSynthesisUtterance(text);
    if (this.voice) utt.voice = this.voice;
    utt.lang = this.voice?.lang || "en-IN";
    utt.pitch = Math.max(0.75, Math.min(1.35, pitch));
    utt.rate = Math.max(0.88, Math.min(1.4, rate));
    utt.volume = 0.95;
    try {
      synth.speak(utt);
    } catch {}
  }

  announceBid(team: FriendTeam, amountCr: number, bidStepCount: number) {
    const now = performance.now();
    if (now - this.lastBidSpokenMs < 220 && bidStepCount > 1) return;
    this.lastBidSpokenMs = now;

    const amt = formatSpokenBroadcastAmount(amountCr);
    const pitchLift = Math.min(0.18, Math.max(0, (bidStepCount - 1) * 0.025));
    this.speak(`${team.name}, ${amt}, bid ${bidStepCount}`, 0.96 + pitchLift, 1.14, true);
  }

  announceSold(player: BroadcastPlayer, team: FriendTeam) {
    const pName = sanitizeName(player.name);
    this.speak(`Congratulations ${team.name}, you got ${pName}!`, 0.92, 1.04, true);
  }
}

export const voiceEngine = new FriendChallengeVoiceEngine();
