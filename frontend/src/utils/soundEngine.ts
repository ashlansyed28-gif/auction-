// Lightweight Web Audio API procedural sound engine (zero external audio files)
class SoundEngine {
  private ctx: AudioContext | null = null;
  private muted = false;
  private noiseBuffer: AudioBuffer | null = null;

  setMuted(muted: boolean) {
    this.muted = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  private ensureCtx(): AudioContext | null {
    if (this.muted || typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const len = Math.floor(ctx.sampleRate * 2.0);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Slightly pink-weighted noise for realistic stadium crowd & wood crack warmth
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.950 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.25) * 0.65;
    }
    this.noiseBuffer = buf;
    return buf;
  }

  private tone(
    freq: number,
    durationSec: number,
    type: OscillatorType = "triangle",
    gainVal = 0.1,
    delaySec = 0,
    endFreq?: number,
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq && endFreq > 0) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + durationSec);
    }
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainVal, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + durationSec + 0.02);
  }

  private filteredNoise(
    durationSec: number,
    centerFreq: number,
    q: number,
    peakGain: number,
    attackSec: number,
    delaySec = 0,
    filterType: BiquadFilterType = "bandpass",
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const t0 = ctx.currentTime + delaySec;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(centerFreq, t0);
    filter.Q.setValueAtTime(q, t0);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peakGain, t0 + attackSec);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + durationSec + 0.03);
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

  /** Leather ball bounce on mowed turf pitch */
  playPitchBounce(delaySec = 0) {
    this.tone(175, 0.055, "sine", 0.07, delaySec, 72);
    this.filteredNoise(0.04, 650, 1.8, 0.05, 0.005, delaySec);
  }

  /** Realistic wooden willow bat-hit crack */
  playBatCrack(intensity: "SOFT" | "CLEAN" | "SMASH" = "CLEAN", delaySec = 0) {
    const vol = intensity === "SMASH" ? 0.34 : intensity === "CLEAN" ? 0.24 : 0.13;
    // Sharp woody crack transient
    this.filteredNoise(0.065, intensity === "SMASH" ? 2100 : 1650, 1.4, vol, 0.004, delaySec);
    // Hollow willow resonance
    this.tone(intensity === "SMASH" ? 860 : 720, 0.065, "triangle", vol * 0.65, delaySec, 240);
    if (intensity === "SMASH") {
      this.tone(165, 0.09, "sine", 0.16, delaySec, 68);
    }
  }

  /** Three staggered wooden stump clatter impacts + metallic bail ping */
  playStumpClatter(delaySec = 0) {
    this.filteredNoise(0.08, 1950, 1.6, 0.32, 0.004, delaySec);
    this.tone(620, 0.08, "square", 0.12, delaySec, 210);
    this.filteredNoise(0.07, 1500, 1.8, 0.22, 0.004, delaySec + 0.06);
    this.tone(490, 0.07, "triangle", 0.11, delaySec + 0.06, 180);
    this.filteredNoise(0.09, 1200, 1.5, 0.16, 0.005, delaySec + 0.13);
    this.tone(2150, 0.16, "sine", 0.07, delaySec + 0.02, 1780); // bail spin ping
  }

  /** Stadium crowd cheer swell on boundaries (4 / 6) and wickets */
  playCrowdRoar(kind: "BOUNDARY" | "SIX" | "WICKET", delaySec = 0) {
    const dur = kind === "SIX" ? 1.75 : 1.35;
    const peak = kind === "SIX" ? 0.24 : 0.18;
    // Warm stadium low-mid body + cheering crowd upper shimmer
    this.filteredNoise(dur, 480, 0.9, peak, 0.18, delaySec);
    this.filteredNoise(dur * 0.92, 1350, 1.1, peak * 0.72, 0.22, delaySec + 0.04);

    if (kind === "SIX") {
      this.tone(523.25, 0.22, "triangle", 0.07, delaySec + 0.12);
      this.tone(659.25, 0.26, "triangle", 0.07, delaySec + 0.2);
      this.tone(783.99, 0.36, "triangle", 0.09, delaySec + 0.28);
    }
  }

  /** Full synced delivery SFX timeline: pitch bounce -> bat/stumps -> crowd roar */
  playDeliveryAudio(outcome: {
    runs: number;
    isWicket: boolean;
    wicketKind?: string;
    extraType: string;
  }) {
    if (outcome.extraType === "WIDE") {
      this.playPitchBounce(0.22);
      this.playPassTick();
      return;
    }

    this.playPitchBounce(0.24);

    if (outcome.isWicket) {
      if (outcome.wicketKind === "BOWLED" || outcome.wicketKind === "RUN_OUT") {
        this.playStumpClatter(0.42);
      } else {
        this.playBatCrack("SOFT", 0.41);
      }
      this.playCrowdRoar("WICKET", 0.48);
    } else if (outcome.runs === 6) {
      this.playBatCrack("SMASH", 0.42);
      this.playCrowdRoar("SIX", 0.5);
    } else if (outcome.runs === 4) {
      this.playBatCrack("CLEAN", 0.42);
      this.playCrowdRoar("BOUNDARY", 0.52);
    } else if (outcome.runs > 0) {
      this.playBatCrack("CLEAN", 0.42);
    } else {
      this.playBatCrack("SOFT", 0.42);
    }
  }

  /** Crisp Direct Throw release & target stumps hit / miss audio */
  playDirectThrowResult(quality: "PERFECT" | "GOOD" | "WAYWARD", isRunOut: boolean) {
    this.filteredNoise(0.08, 1200, 1.5, 0.12, 0.005, 0);
    if (quality === "PERFECT") {
      this.playStumpClatter(0.28);
      if (isRunOut) {
        this.playCrowdRoar("WICKET", 0.36);
      } else {
        this.tone(880, 0.14, "sine", 0.1, 0.28);
      }
    } else if (quality === "GOOD") {
      this.tone(420, 0.09, "triangle", 0.09, 0.28, 220);
    } else {
      this.tone(240, 0.14, "sine", 0.08, 0.25, 140);
    }
  }

  /** Bowler / fielder Caught Meter result SFX */
  playCatchResult(caught: boolean, isWicket: boolean) {
    if (caught) {
      this.filteredNoise(0.05, 900, 1.8, 0.18, 0.004);
      this.tone(540, 0.11, "triangle", 0.12, 0.03, 720);
      if (isWicket) this.playCrowdRoar("WICKET", 0.1);
    } else {
      this.filteredNoise(0.07, 450, 1.4, 0.14, 0.005);
      this.tone(190, 0.18, "sine", 0.09, 0.02, 110);
    }
  }

  /** Subtle TV broadcast chime when the umpire raises a post-ball callout */
  playUmpireSignal(isWicket: boolean, isBoundary: boolean) {
    if (isWicket) {
      this.tone(587.33, 0.16, "triangle", 0.09);
      this.tone(880, 0.22, "triangle", 0.09, 0.1);
    } else if (isBoundary) {
      this.tone(659.25, 0.12, "sine", 0.07);
      this.tone(987.77, 0.18, "sine", 0.07, 0.08);
    } else {
      this.tone(523.25, 0.09, "sine", 0.05);
    }
  }
}

export const soundEngine = new SoundEngine();
