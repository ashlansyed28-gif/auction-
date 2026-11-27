package com.hammertime.auction.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.preferencesDataStore
import com.hammertime.auction.model.UserSettings
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore: DataStore<Preferences> by preferencesDataStore(name = "hammer_settings")

class SettingsRepository(context: Context) {

    private val dataStore = context.applicationContext.settingsDataStore

    val settingsFlow: Flow<UserSettings> = dataStore.data.map { prefs ->
        UserSettings(
            isMuted = prefs[KEY_MUTED] ?: false,
            hapticsEnabled = prefs[KEY_HAPTICS] ?: true,
            reduceMotion = prefs[KEY_REDUCE_MOTION] ?: false,
            ttsEnabled = prefs[KEY_TTS] ?: false
        )
    }

    suspend fun updateSettings(transform: (UserSettings) -> UserSettings) {
        dataStore.edit { prefs ->
            val current = UserSettings(
                isMuted = prefs[KEY_MUTED] ?: false,
                hapticsEnabled = prefs[KEY_HAPTICS] ?: true,
                reduceMotion = prefs[KEY_REDUCE_MOTION] ?: false,
                ttsEnabled = prefs[KEY_TTS] ?: false
            )
            val updated = transform(current)
            prefs[KEY_MUTED] = updated.isMuted
            prefs[KEY_HAPTICS] = updated.hapticsEnabled
            prefs[KEY_REDUCE_MOTION] = updated.reduceMotion
            prefs[KEY_TTS] = updated.ttsEnabled
        }
    }

    private companion object {
        val KEY_MUTED = booleanPreferencesKey("is_muted")
        val KEY_HAPTICS = booleanPreferencesKey("haptics_enabled")
        val KEY_REDUCE_MOTION = booleanPreferencesKey("reduce_motion")
        val KEY_TTS = booleanPreferencesKey("tts_enabled")
    }
}
