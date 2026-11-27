// Lightweight Web Audio API sound helper (zero external audio files)
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private ensureCtx(): AudioContext | null {
    if (this.muted || typeof window === "undefined") return null;
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(freq: number, durationSec: number, type: OscillatorType = "triangle", gainVal = 0.1, delaySec = 0) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainVal, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  }

  /** Crisp click + ascending tick on each paddle raise */
  playBidClick(stepCount = 1) {
    const lift = Math.min(360, stepCount * 28);
    this.tone(720 + lift, 0.055, "triangle", 0.1);
    this.tone(1080 + lift, 0.06, "sine", 0.06, 0.03);
  }

  /** Soft muted drop when a friend passes on the current lot */
  playPassTick() {
    this.tone(280, 0.07, "sine", 0.06);
  }

  /** Suspenseful rising pulse on Going Once / Going Twice final call */
  playFinalCall(stage: 1 | 2 = 1) {
    if (stage === 1) {
      this.tone(440, 0.16, "triangle", 0.09);
      this.tone(554.37, 0.18, "triangle", 0.07, 0.11);
    } else {
      this.tone(554.37, 0.15, "triangle", 0.11);
      this.tone(698.46, 0.22, "sawtooth", 0.06, 0.11);
    }
  }

  /** Deep wooden gavel thud + broadcast lock-in chord on SOLD */
  playGavelSold() {
    this.tone(95, 0.19, "triangle", 0.2);
    this.tone(150, 0.1, "square", 0.08);
    this.tone(523.25, 0.14, "triangle", 0.1, 0.08);
    this.tone(659.25, 0.16, "triangle", 0.1, 0.16);
    this.tone(783.99, 0.28, "triangle", 0.12, 0.24);
  }

  /** Low descending double-tone on UNSOLD */
  playUnsold() {
    this.tone(310, 0.14, "sine", 0.08);
    this.tone(220, 0.24, "sine", 0.08, 0.12);
  }
}

export const soundEngine = new SoundEngine();
