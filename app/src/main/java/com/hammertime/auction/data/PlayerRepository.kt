package com.hammertime.auction.data

import android.content.Context
import com.hammertime.auction.model.Player
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

interface PlayerRepository {
    suspend fun loadValidatedPool(): List<Player>
}

class AssetPlayerRepository(
    context: Context,
    private val json: Json = DefaultJson
) : PlayerRepository {

    private val appContext = context.applicationContext

    @Volatile
    private var cachedPool: List<Player>? = null

    override suspend fun loadValidatedPool(): List<Player> {
        cachedPool?.let { return it }
        return withContext(Dispatchers.IO) {
            cachedPool?.let { return@withContext it }
            val merged = mutableListOf<Player>()
            for (fileName in SET_FILES) {
                val raw = appContext.assets
                    .open("$ASSETS_DIR/$fileName")
                    .bufferedReader()
                    .use { it.readText() }
                val setPlayers = json.decodeFromString<List<Player>>(raw)
                merged += setPlayers
            }
            PlayerPoolValidator.validateOrThrow(merged)
            val frozen = merged.toList()
            cachedPool = frozen
            frozen
        }
    }

    companion object {
        const val ASSETS_DIR = "players"
        val SET_FILES = listOf(
            "set1_marquee.json",
            "set2_power_batters.json",
            "set3_allrounders.json",
            "set4_spinners.json",
            "set5_pace_death.json",
            "set6_uncapped_wildcard.json",
            "set7_legends.json"
        )

        val DefaultJson = Json {
            ignoreUnknownKeys = false
            isLenient = false
        }
    }
}
