package com.hammertime.auction.data

import com.hammertime.auction.state.SoundCue
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.PI
import kotlin.math.exp
import kotlin.math.sin
import kotlin.random.Random

/**
 * Generates original 16-bit PCM mono WAV sound effects into cacheDir on first launch.
 */
object ToneSynth {
    private const val SAMPLE_RATE = 44100

    fun ensureSoundFiles(cacheDir: File): Map<SoundCue, File> {
        val dir = File(cacheDir, "synth_tones").apply { mkdirs() }
        val mapping = mapOf(
            SoundCue.TICK to "tick.wav",
            SoundCue.BID_PING to "bid_ping.wav",
            SoundCue.GOING_ONCE to "going_once.wav",
            SoundCue.GOING_TWICE to "going_twice.wav",
            SoundCue.GAVEL_HIT to "gavel_hit.wav",
            SoundCue.SOLD_FANFARE to "sold_fanfare.wav",
            SoundCue.UNSOLD_SIGH to "unsold_sigh.wav",
            SoundCue.RTM_STING to "rtm_sting.wav",
            SoundCue.HEARTBEAT_START to "heartbeat.wav",
            SoundCue.CROWD_MURMUR to "crowd_murmur.wav"
        )
        for ((cue, name) in mapping) {
            val file = File(dir, name)
            if (!file.exists() || file.length() <= 44L) {
                val samples = synthesizeCue(cue)
                writeWav16(file, samples)
            }
        }
        return mapping.mapValues { (_, name) -> File(dir, name) }
    }

    private fun synthesizeCue(cue: SoundCue): ShortArray = when (cue) {
        SoundCue.TICK -> buildSamples(0.06) { t, _ ->
            val env = exp(-t * 65.0)
            sin(2.0 * PI * 940.0 * t) * env * 0.45
        }

        SoundCue.BID_PING -> buildSamples(0.16) { t, dur ->
            val attack = (t / 0.008).coerceAtMost(1.0)
            val env = attack * exp(-t * 18.0)
            val f1 = sin(2.0 * PI * 660.0 * t)
            val f2 = sin(2.0 * PI * 990.0 * t) * 0.45
            (f1 + f2) * env * 0.45 * (1.0 - (t / dur) * 0.1)
        }

        SoundCue.GOING_ONCE -> buildSamples(0.28) { t, dur ->
            val freq = 440.0 + (t / dur) * 85.0
            val env = (t / 0.015).coerceAtMost(1.0) * exp(-t * 7.5)
            sin(2.0 * PI * freq * t) * env * 0.50
        }

        SoundCue.GOING_TWICE -> buildSamples(0.32) { t, dur ->
            val freq = 587.33 + (t / dur) * 152.0
            val env = (t / 0.015).coerceAtMost(1.0) * exp(-t * 6.5)
            (sin(2.0 * PI * freq * t) + 0.35 * sin(4.0 * PI * freq * t)) * env * 0.48
        }

        SoundCue.GAVEL_HIT -> {
            val rng = Random(101)
            buildSamples(0.24) { t, _ ->
                val thumpFreq = 145.0 * exp(-t * 18.0) + 52.0
                val thump = sin(2.0 * PI * thumpFreq * t) * exp(-t * 22.0)
                val crack = (rng.nextDouble() * 2.0 - 1.0) * exp(-t * 95.0) * 0.45
                (thump * 0.78 + crack) * 0.85
            }
        }

        SoundCue.SOLD_FANFARE -> {
            // Original 5-note rising major-9th arpeggio: C5, E5, G5, B5, D6
            val notes = listOf(523.25, 659.25, 783.99, 987.77, 1174.66)
            val noteOffsets = listOf(0.0, 0.09, 0.18, 0.27, 0.36)
            buildSamples(0.82) { t, _ ->
                var sum = 0.0
                for (i in notes.indices) {
                    val localT = t - noteOffsets[i]
                    if (localT >= 0.0) {
                        val env = (localT / 0.012).coerceAtMost(1.0) * exp(-localT * 4.8)
                        sum += sin(2.0 * PI * notes[i] * localT) * env * 0.28
                    }
                }
                sum.coerceIn(-0.95, 0.95)
            }
        }

        SoundCue.UNSOLD_SIGH -> buildSamples(0.42) { t, dur ->
            val freq = 392.0 - (t / dur) * 85.0
            val env = (t / 0.02).coerceAtMost(1.0) * exp(-t * 5.2)
            sin(2.0 * PI * freq * t) * env * 0.42
        }

        SoundCue.RTM_STING -> {
            // Suspense half-diminished broadcast chord: D4, F4, Ab4, C5
            val freqs = listOf(293.66, 349.23, 415.30, 523.25)
            buildSamples(0.62) { t, _ ->
                val env = (t / 0.025).coerceAtMost(1.0) * exp(-t * 3.8)
                var s = 0.0
                for (f in freqs) {
                    s += sin(2.0 * PI * f * t)
                }
                (s / freqs.size) * env * 0.65
            }
        }

        SoundCue.HEARTBEAT_START -> buildSamples(0.85) { t, _ ->
            // Lub (0.04s) + Dub (0.28s)
            val lubT = t - 0.04
            val dubT = t - 0.28
            var v = 0.0
            if (lubT >= 0.0 && lubT < 0.18) {
                v += sin(2.0 * PI * 68.0 * lubT) * (lubT / 0.015).coerceAtMost(1.0) * exp(-lubT * 24.0) * 0.72
            }
            if (dubT >= 0.0 && dubT < 0.18) {
                v += sin(2.0 * PI * 56.0 * dubT) * (dubT / 0.015).coerceAtMost(1.0) * exp(-dubT * 26.0) * 0.54
            }
            v
        }

        SoundCue.CROWD_MURMUR -> {
            val rng = Random(404)
            var lp1 = 0.0
            var lp2 = 0.0
            buildSamples(1.40) { t, dur ->
                val white = rng.nextDouble() * 2.0 - 1.0
                lp1 = lp1 * 0.94 + white * 0.06
                lp2 = lp2 * 0.92 + lp1 * 0.08
                val fadeIn = (t / 0.25).coerceIn(0.0, 1.0)
                val fadeOut = ((dur - t) / 0.35).coerceIn(0.0, 1.0)
                lp2 * fadeIn * fadeOut * 0.75
            }
        }

        SoundCue.HEARTBEAT_STOP -> ShortArray(0)
    }

    private inline fun buildSamples(
        durationSec: Double,
        sampleAt: (tSec: Double, totalSec: Double) -> Double
    ): ShortArray {
        val count = (SAMPLE_RATE * durationSec).toInt().coerceAtLeast(1)
        val out = ShortArray(count)
        for (i in 0 until count) {
            val t = i.toDouble() / SAMPLE_RATE
            val v = sampleAt(t, durationSec).coerceIn(-1.0, 1.0)
            out[i] = (v * Short.MAX_VALUE).toInt().toShort()
        }
        return out
    }

    private fun writeWav16(file: File, samples: ShortArray) {
        val byteCount = samples.size * 2
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
            put("RIFF".toByteArray(Charsets.US_ASCII))
            putInt(36 + byteCount)
            put("WAVE".toByteArray(Charsets.US_ASCII))
            put("fmt ".toByteArray(Charsets.US_ASCII))
            putInt(16) // PCM chunk size
            putShort(1) // AudioFormat = 1 (PCM)
            putShort(1) // NumChannels = 1 (Mono)
            putInt(SAMPLE_RATE)
            putInt(SAMPLE_RATE * 2) // ByteRate
            putShort(2) // BlockAlign
            putShort(16) // BitsPerSample
            put("data".toByteArray(Charsets.US_ASCII))
            putInt(byteCount)
        }

        val pcmBuffer = ByteBuffer.allocate(byteCount).order(ByteOrder.LITTLE_ENDIAN)
        for (s in samples) {
            pcmBuffer.putShort(s)
        }

        FileOutputStream(file).use { out ->
            out.write(header.array())
            out.write(pcmBuffer.array())
        }
    }
}
