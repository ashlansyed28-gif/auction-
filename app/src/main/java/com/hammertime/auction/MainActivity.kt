package com.hammertime.auction

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.ViewModelProvider
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.hammertime.auction.data.AssetPlayerRepository
import com.hammertime.auction.data.AuctionAudioManager
import com.hammertime.auction.data.SettingsRepository
import com.hammertime.auction.data.SnapshotRepository
import com.hammertime.auction.state.AuctionIntent
import com.hammertime.auction.state.AuctionViewModel
import com.hammertime.auction.state.AuctionViewModelFactory
import com.hammertime.auction.state.Screen
import com.hammertime.auction.state.UiEffect
import com.hammertime.auction.ui.recap.RecapCardRenderer
import com.hammertime.auction.ui.screens.AuctionStageScreen
import com.hammertime.auction.ui.screens.HomeScreen
import com.hammertime.auction.ui.screens.RecapScreen
import com.hammertime.auction.ui.screens.RoomSetupScreen
import com.hammertime.auction.ui.theme.HammerTheme
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private val audioManager: AuctionAudioManager by lazy {
        AuctionAudioManager(applicationContext)
    }

    private val viewModel: AuctionViewModel by lazy {
        ViewModelProvider(
            this,
            AuctionViewModelFactory(
                playerRepository = AssetPlayerRepository(applicationContext),
                settingsRepository = SettingsRepository(applicationContext),
                snapshotRepository = SnapshotRepository(applicationContext)
            )
        )[AuctionViewModel::class.java]
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            val uiState by viewModel.uiState.collectAsStateWithLifecycle()
            val snackbarHostState = remember { SnackbarHostState() }

            LaunchedEffect(Unit) {
                viewModel.effects.collect { effect ->
                    val currentSettings = viewModel.uiState.value.settings
                    when (effect) {
                        is UiEffect.PlaySound -> audioManager.playSound(effect.cue, currentSettings)
                        is UiEffect.TriggerHaptic -> audioManager.triggerHaptic(effect.cue, currentSettings)
                        is UiEffect.SpeakCommentary -> audioManager.speakCommentary(effect.text, currentSettings)
                        is UiEffect.ShowMessage -> snackbarHostState.showSnackbar(effect.message)
                        is UiEffect.ShareRecapBitmap -> {
                            withContext(Dispatchers.IO) {
                                RecapCardRenderer.shareRecapBitmap(this@MainActivity, effect.summary)
                            }
                        }
                        is UiEffect.SaveRecapBitmapToGallery -> {
                            val ok = withContext(Dispatchers.IO) {
                                RecapCardRenderer.saveRecapBitmapToGallery(this@MainActivity, effect.summary)
                            }
                            snackbarHostState.showSnackbar(
                                if (ok) "Recap card saved to Pictures/HammerTime" else "Failed to save recap card"
                            )
                        }
                    }
                }
            }

            HammerTheme(reduceMotion = uiState.settings.reduceMotion) {
                Scaffold(
                    containerColor = HammerTheme.colors.obsidian,
                    snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
                    modifier = Modifier.fillMaxSize()
                ) { innerPadding ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(innerPadding)
                            .safeDrawingPadding()
                    ) {
                        AnimatedContent(
                            targetState = uiState.screen,
                            contentKey = { it::class },
                            transitionSpec = {
                                val duration = if (uiState.settings.reduceMotion) 120 else 240
                                fadeIn(tween(duration)) togetherWith fadeOut(tween(duration))
                            },
                            label = "screen_router"
                        ) { screen ->
                            when (screen) {
                                Screen.Home -> HomeScreen(
                                    settings = uiState.settings,
                                    hasSavedSnapshot = uiState.hasSavedSnapshot,
                                    isPoolReady = uiState.isPoolReady,
                                    poolError = uiState.poolError,
                                    onIntent = viewModel::onIntent
                                )
                                Screen.RoomSetup -> RoomSetupScreen(
                                    config = uiState.setupConfig,
                                    onIntent = viewModel::onIntent
                                )
                                Screen.AuctionStage -> AuctionStageScreen(
                                    uiState = uiState,
                                    onIntent = viewModel::onIntent
                                )
                                Screen.Recap -> RecapScreen(
                                    summaries = uiState.recapSummaries,
                                    selectedTeamCode = uiState.selectedRecapTeam,
                                    onIntent = viewModel::onIntent
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    override fun onStop() {
        super.onStop()
        audioManager.stopHeartbeat()
        viewModel.onIntent(AuctionIntent.OnAppBackground)
    }

    override fun onDestroy() {
        super.onDestroy()
        audioManager.release()
    }
}
