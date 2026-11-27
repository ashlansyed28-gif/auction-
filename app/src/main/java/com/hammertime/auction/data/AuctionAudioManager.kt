package com.hammertime.auction.data

import android.content.Context
import android.media.AudioAttributes
import android.media.SoundPool
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.speech.tts.TextToSpeech
import com.hammertime.auction.model.UserSettings
import com.hammertime.auction.state.HapticCue
import com.hammertime.auction.state.SoundCue
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.util.Locale

class AuctionAudioManager(context: Context) {

    private val appContext = context.applicationContext
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val soundPool: SoundPool = SoundPool.Builder()
        .setMaxStreams(6)
        .setAudioAttributes(
            AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_GAME)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
        )
        .build()

    private val soundIds = HashMap<SoundCue, Int>()
    private var heartbeatStreamId: Int = 0

    @Volatile
    private var isReady: Boolean = false

    private var tts: TextToSpeech? = null
    private var ttsReady: Boolean = false

    private val vibrator: Vibrator? = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = appContext.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
        manager?.defaultVibrator
    } else {
        @Suppress("DEPRECATION")
        appContext.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
    }

    init {
        scope.launch {
            runCatching {
                val files = ToneSynth.ensureSoundFiles(appContext.cacheDir)
                for ((cue, file) in files) {
                    val id = soundPool.load(file.absolutePath, 1)
                    soundIds[cue] = id
                }
                isReady = true
            }
        }
    }

    fun playSound(cue: SoundCue, settings: UserSettings) {
        if (cue == SoundCue.HEARTBEAT_STOP) {
            stopHeartbeat()
            return
        }
        if (settings.isMuted || !isReady) return

        val soundId = soundIds[cue] ?: return
        when (cue) {
            SoundCue.HEARTBEAT_START -> {
                if (heartbeatStreamId == 0) {
                    heartbeatStreamId = soundPool.play(soundId, 0.55f, 0.55f, 1, -1, 1f)
                }
            }
            SoundCue.CROWD_MURMUR -> {
                soundPool.play(soundId, 0.28f, 0.28f, 0, 0, 1f)
            }
            SoundCue.TICK -> {
                soundPool.play(soundId, 0.35f, 0.35f, 0, 0, 1f)
            }
            else -> {
                soundPool.play(soundId, 0.85f, 0.85f, 1, 0, 1f)
            }
        }
    }

    fun stopHeartbeat() {
        if (heartbeatStreamId != 0) {
            soundPool.stop(heartbeatStreamId)
            heartbeatStreamId = 0
        }
    }

    fun triggerHaptic(cue: HapticCue, settings: UserSettings) {
        if (!settings.hapticsEnabled) return
        val vib = vibrator ?: return
        if (!vib.hasVibrator()) return

        val effect = when (cue) {
            HapticCue.LIGHT_TICK -> VibrationEffect.createOneShot(18L, 90)
            HapticCue.HAMMER_IMPACT -> VibrationEffect.createOneShot(95L, 230)
        }
        vib.vibrate(effect)
    }

    fun speakCommentary(text: String, settings: UserSettings) {
        if (!settings.ttsEnabled || settings.isMuted) return
        if (tts == null) {
            tts = TextToSpeech(appContext) { status ->
                if (status == TextToSpeech.SUCCESS) {
                    tts?.language = Locale.UK
                    tts?.setSpeechRate(1.08f)
                    ttsReady = true
                    tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "lot_${System.currentTimeMillis()}")
                }
            }
        } else if (ttsReady) {
            tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "lot_${System.currentTimeMillis()}")
        }
    }

    fun release() {
        stopHeartbeat()
        soundPool.release()
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
