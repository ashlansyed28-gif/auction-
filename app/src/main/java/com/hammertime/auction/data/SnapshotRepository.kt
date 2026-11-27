package com.hammertime.auction.data

import android.content.Context
import com.hammertime.auction.state.engine.AuctionSnapshot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

class SnapshotRepository(
    context: Context,
    private val json: Json = Json { ignoreUnknownKeys = true }
) {
    private val snapshotFile = File(context.applicationContext.filesDir, "auction_snapshot.json")

    suspend fun hasSnapshot(): Boolean = withContext(Dispatchers.IO) {
        snapshotFile.exists() && snapshotFile.length() > 0L
    }

    suspend fun saveSnapshot(snapshot: AuctionSnapshot) = withContext(Dispatchers.IO) {
        runCatching {
            val encoded = json.encodeToString(snapshot)
            snapshotFile.writeText(encoded)
        }
    }

    suspend fun loadSnapshot(): AuctionSnapshot? = withContext(Dispatchers.IO) {
        if (!snapshotFile.exists()) return@withContext null
        runCatching {
            val raw = snapshotFile.readText()
            json.decodeFromString<AuctionSnapshot>(raw)
        }.getOrNull()
    }

    suspend fun clearSnapshot() = withContext(Dispatchers.IO) {
        runCatching {
            if (snapshotFile.exists()) {
                snapshotFile.delete()
            }
        }
    }
}
