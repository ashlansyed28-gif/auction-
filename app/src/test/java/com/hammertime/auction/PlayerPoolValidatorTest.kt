package com.hammertime.auction

import com.hammertime.auction.data.PlayerPoolValidationException
import com.hammertime.auction.data.PlayerPoolValidator
import com.hammertime.auction.data.AssetPlayerRepository
import com.hammertime.auction.model.Player
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class PlayerPoolValidatorTest {

    private val json = Json {
        ignoreUnknownKeys = false
        isLenient = false
    }

    private fun locateAssetsDir(): File {
        val candidates = listOf(
            File("src/main/assets/players"),
            File("app/src/main/assets/players")
        )
        return candidates.firstOrNull { it.exists() && it.isDirectory }
            ?: error("Could not locate assets/players directory from ${File(".").absolutePath}")
    }

    private fun loadAllAssetPlayers(): List<Player> {
        val dir = locateAssetsDir()
        val merged = mutableListOf<Player>()
        for (fileName in AssetPlayerRepository.SET_FILES) {
            val file = File(dir, fileName)
            assertTrue("Missing asset file: ${file.absolutePath}", file.exists())
            merged += json.decodeFromString<List<Player>>(file.readText())
        }
        return merged
    }

    @Test
    fun `actual 7 asset json files load and pass full validation`() {
        val players = loadAllAssetPlayers()
        assertEquals(165, players.size)
        PlayerPoolValidator.validateOrThrow(players)

        val overseasRatio = players.count { it.overseas }.toDouble() / players.size
        assertTrue("Overseas ratio $overseasRatio should be ~30%", overseasRatio in 0.25..0.36)

        val formerTeamRatio = players.count { it.formerTeam != null }.toDouble() / players.size
        assertTrue("Former team ratio $formerTeamRatio should be ~35%", formerTeamRatio in 0.28..0.42)
    }

    @Test(expected = PlayerPoolValidationException::class)
    fun `validator fails loudly when duplicate player ids exist`() {
        val players = loadAllAssetPlayers().toMutableList()
        players[1] = players[1].copy(id = players[0].id)
        PlayerPoolValidator.validateOrThrow(players)
    }

    @Test(expected = PlayerPoolValidationException::class)
    fun `validator fails loudly when set counts are altered`() {
        val players = loadAllAssetPlayers().toMutableList()
        players.removeAt(0)
        PlayerPoolValidator.validateOrThrow(players)
    }
}
