package com.hammertime.auction.state

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.hammertime.auction.data.PlayerRepository
import com.hammertime.auction.data.SettingsRepository
import com.hammertime.auction.data.SnapshotRepository
import com.hammertime.auction.model.AuctionPhase
import com.hammertime.auction.model.BotStyle
import com.hammertime.auction.model.Player
import com.hammertime.auction.model.PlayerSetCatalog
import com.hammertime.auction.model.TeamCode
import com.hammertime.auction.state.engine.AuctionEngine
import com.hammertime.auction.state.engine.EngineEvent
import com.hammertime.auction.state.engine.RecapEvaluator
import kotlinx.collections.immutable.toImmutableList
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class AuctionViewModel(
    private val playerRepository: PlayerRepository,
    private val settingsRepository: SettingsRepository,
    private val snapshotRepository: SnapshotRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuctionUiState())
    val uiState: StateFlow<AuctionUiState> = _uiState.asStateFlow()

    private val _effects = MutableSharedFlow<UiEffect>(extraBufferCapacity = 32)
    val effects: SharedFlow<UiEffect> = _effects.asSharedFlow()

    private var cachedPool: List<Player> = emptyList()
    private var engine: AuctionEngine? = null
    private var tickerJob: Job? = null
    private var heartbeatActive: Boolean = false
    private var lastSecondTickPlayed: Int = -1

    init {
        viewModelScope.launch {
            settingsRepository.settingsFlow.collect { settings ->
                _uiState.update { it.copy(settings = settings) }
            }
        }
        viewModelScope.launch {
            val hasSnapshot = snapshotRepository.hasSnapshot()
            runCatching {
                playerRepository.loadValidatedPool()
            }.onSuccess { pool ->
                cachedPool = pool
                _uiState.update {
                    it.copy(
                        isPoolReady = true,
                        hasSavedSnapshot = hasSnapshot,
                        poolError = null
                    )
                }
            }.onFailure { err ->
                _uiState.update {
                    it.copy(
                        isPoolReady = false,
                        hasSavedSnapshot = hasSnapshot,
                        poolError = err.message ?: "Failed to load player pool"
                    )
                }
            }
        }
    }

    fun onIntent(intent: AuctionIntent) {
        when (intent) {
            AuctionIntent.StartNewAuctionSetup -> {
                _uiState.update { it.copy(screen = Screen.RoomSetup) }
            }
            AuctionIntent.ResumeSavedAuction -> resumeFromDisk()
            AuctionIntent.BackToHome -> {
                stopTicker()
                _uiState.update { it.copy(screen = Screen.Home) }
            }
            AuctionIntent.ToggleMute -> updateSettings { it.copy(isMuted = !it.isMuted) }
            AuctionIntent.ToggleHaptics -> updateSettings { it.copy(hapticsEnabled = !it.hapticsEnabled) }
            AuctionIntent.ToggleReduceMotion -> updateSettings { it.copy(reduceMotion = !it.reduceMotion) }
            AuctionIntent.ToggleTts -> updateSettings { it.copy(ttsEnabled = !it.ttsEnabled) }

            is AuctionIntent.SelectPurseTier -> {
                _uiState.update {
                    it.copy(setupConfig = it.setupConfig.copy(purseCr = intent.tier.purseCr))
                }
            }
            is AuctionIntent.UpdateSquadLimits -> {
                val min = intent.minSize.coerceIn(12, 20)
                val max = intent.maxSize.coerceIn(min, 25)
                _uiState.update {
                    it.copy(setupConfig = it.setupConfig.copy(minSquadSize = min, maxSquadSize = max))
                }
            }
            is AuctionIntent.UpdateMaxOverseas -> {
                val capped = intent.maxOverseas.coerceIn(2, 8)
                _uiState.update {
                    it.copy(setupConfig = it.setupConfig.copy(maxOverseas = capped))
                }
            }
            is AuctionIntent.UpdateRtmCards -> {
                val capped = intent.rtmCards.coerceIn(0, 3)
                _uiState.update {
                    it.copy(setupConfig = it.setupConfig.copy(rtmCardsPerTeam = capped))
                }
            }
            is AuctionIntent.SelectSetOrderMode -> {
                _uiState.update {
                    it.copy(setupConfig = it.setupConfig.copy(setOrderMode = intent.mode))
                }
            }
            is AuctionIntent.MoveCustomSet -> {
                val current = _uiState.value.setupConfig.customSetOrder.toMutableList()
                if (intent.fromIndex in current.indices && intent.toIndex in current.indices) {
                    val item = current.removeAt(intent.fromIndex)
                    current.add(intent.toIndex, item)
                    _uiState.update {
                        it.copy(setupConfig = it.setupConfig.copy(customSetOrder = current))
                    }
                }
            }
            is AuctionIntent.ToggleTeamHuman -> {
                _uiState.update { state ->
                    val currentHumans = state.setupConfig.teamAssignments.count { it.isHuman }
                    val target = state.setupConfig.teamAssignments.firstOrNull { it.teamCode == intent.teamCode }
                        ?: return@update state
                    // Allow 1 to 3 human hot-seat teams (or 0? Keep 1..3 per spec: "1 to 3 hot-seat human teams")
                    if (target.isHuman && currentHumans <= 1) {
                        _effects.tryEmit(UiEffect.ShowMessage("At least 1 human franchise is required"))
                        return@update state
                    }
                    if (!target.isHuman && currentHumans >= 3) {
                        _effects.tryEmit(UiEffect.ShowMessage("Maximum 3 hot-seat human teams"))
                        return@update state
                    }
                    val updated = state.setupConfig.teamAssignments.map { a ->
                        if (a.teamCode == intent.teamCode) a.copy(isHuman = !a.isHuman) else a
                    }
                    state.copy(setupConfig = state.setupConfig.copy(teamAssignments = updated))
                }
            }
            is AuctionIntent.CycleBotStyle -> {
                _uiState.update { state ->
                    val styles = BotStyle.entries
                    val updated = state.setupConfig.teamAssignments.map { a ->
                        if (a.teamCode == intent.teamCode) {
                            val next = styles[(a.botStyle.ordinal + 1) % styles.size]
                            a.copy(botStyle = next)
                        } else {
                            a
                        }
                    }
                    state.copy(setupConfig = state.setupConfig.copy(teamAssignments = updated))
                }
            }
            is AuctionIntent.UpdateSeed -> {
                _uiState.update {
                    it.copy(setupConfig = it.setupConfig.copy(seed = intent.seed))
                }
            }
            AuctionIntent.LaunchAuction -> launchFreshAuction()

            is AuctionIntent.SelectActiveHumanTeam -> {
                _uiState.update { it.copy(activeHumanTeam = intent.teamCode) }
                syncStateFromEngine()
            }
            AuctionIntent.PlaceHumanBid -> {
                val eng = engine ?: return
                val activeTeam = _uiState.value.activeHumanTeam
                if (eng.placeHumanBid(activeTeam)) {
                    processEngineEvents(eng)
                    syncStateFromEngine()
                }
            }
            AuctionIntent.HostSkipStage -> {
                val eng = engine ?: return
                eng.hostSkipCurrentStage()
                processEngineEvents(eng)
                syncStateFromEngine()
            }
            is AuctionIntent.SubmitRtmDecision -> {
                val eng = engine ?: return
                if (eng.submitRtmDecision(intent.useRtm)) {
                    processEngineEvents(eng)
                    syncStateFromEngine()
                }
            }
            is AuctionIntent.SubmitRtmCounterRaise -> {
                val eng = engine ?: return
                if (eng.submitRtmCounterRaise(intent.raisePrice)) {
                    processEngineEvents(eng)
                    syncStateFromEngine()
                }
            }
            is AuctionIntent.SubmitRtmFinalMatch -> {
                val eng = engine ?: return
                if (eng.submitRtmFinalMatch(intent.matchRaise)) {
                    processEngineEvents(eng)
                    syncStateFromEngine()
                }
            }
            is AuctionIntent.OpenSquadSheet -> {
                _uiState.update { it.copy(showSquadSheetForTeam = intent.teamCode) }
            }
            AuctionIntent.CloseSquadSheet -> {
                _uiState.update { it.copy(showSquadSheetForTeam = null) }
            }
            is AuctionIntent.ToggleUnsoldTray -> {
                _uiState.update { it.copy(showUnsoldTray = intent.open) }
            }
            AuctionIntent.OnAppBackground -> persistCurrentSnapshot()
            AuctionIntent.ProceedToRecap -> openRecapScreen()

            is AuctionIntent.SelectRecapTeam -> {
                _uiState.update { it.copy(selectedRecapTeam = intent.teamCode) }
            }
            is AuctionIntent.ShareRecapCard -> {
                val summary = _uiState.value.recapSummaries.firstOrNull { it.team.code == intent.teamCode }
                if (summary != null) {
                    _effects.tryEmit(UiEffect.ShareRecapBitmap(summary))
                }
            }
            is AuctionIntent.SaveRecapCardToGallery -> {
                val summary = _uiState.value.recapSummaries.firstOrNull { it.team.code == intent.teamCode }
                if (summary != null) {
                    _effects.tryEmit(UiEffect.SaveRecapBitmapToGallery(summary))
                }
            }
            AuctionIntent.FinishToHome -> {
                stopTicker()
                engine = null
                viewModelScope.launch {
                    snapshotRepository.clearSnapshot()
                    _uiState.update { it.copy(screen = Screen.Home, hasSavedSnapshot = false) }
                }
            }
        }
    }

    private fun updateSettings(transform: (com.hammertime.auction.model.UserSettings) -> com.hammertime.auction.model.UserSettings) {
        viewModelScope.launch {
            settingsRepository.updateSettings(transform)
        }
    }

    private fun launchFreshAuction() {
        if (cachedPool.isEmpty()) return
        val cfg = _uiState.value.setupConfig
        val newEngine = AuctionEngine(cachedPool, cfg)
        engine = newEngine
        heartbeatActive = false
        lastSecondTickPlayed = -1

        viewModelScope.launch {
            snapshotRepository.clearSnapshot()
        }

        val firstHuman = cfg.humanTeamCodes.firstOrNull() ?: TeamCode.CSK
        _uiState.update {
            it.copy(
                screen = Screen.AuctionStage,
                activeConfig = cfg,
                activeHumanTeam = firstHuman,
                hasSavedSnapshot = false,
                lastSoldRecord = null,
                showSquadSheetForTeam = null,
                showUnsoldTray = false
            )
        }
        processEngineEvents(newEngine)
        syncStateFromEngine()
        startTicker()
    }

    private fun resumeFromDisk() {
        if (cachedPool.isEmpty()) return
        viewModelScope.launch {
            val snap = snapshotRepository.loadSnapshot()
            if (snap == null) {
                _effects.tryEmit(UiEffect.ShowMessage("No saved auction found"))
                _uiState.update { it.copy(hasSavedSnapshot = false) }
                return@launch
            }
            val resumedEngine = AuctionEngine(cachedPool, snap.config)
            resumedEngine.restoreFromSnapshot(snap)
            engine = resumedEngine
            heartbeatActive = false
            lastSecondTickPlayed = -1

            val firstHuman = snap.config.humanTeamCodes.firstOrNull() ?: TeamCode.CSK
            _uiState.update {
                it.copy(
                    screen = if (snap.phase == AuctionPhase.COMPLETED) Screen.Recap else Screen.AuctionStage,
                    activeConfig = snap.config,
                    activeHumanTeam = firstHuman
                )
            }
            syncStateFromEngine()
            if (snap.phase == AuctionPhase.COMPLETED) {
                openRecapScreen()
            } else {
                startTicker()
            }
        }
    }

    private fun startTicker() {
        tickerJob?.cancel()
        tickerJob = viewModelScope.launch {
            while (true) {
                delay(50L)
                val eng = engine ?: break
                if (_uiState.value.screen != Screen.AuctionStage) continue
                eng.tick()
                processEngineEvents(eng)
                syncStateFromEngine()

                if (eng.phase == AuctionPhase.BIDDING) {
                    val sec = ((eng.bidRemainingMs() + 999L) / 1000L).toInt()
                    if (sec in 1..10 && sec != lastSecondTickPlayed) {
                        lastSecondTickPlayed = sec
                        _effects.tryEmit(UiEffect.PlaySound(SoundCue.TICK))
                    }
                } else {
                    lastSecondTickPlayed = -1
                }

                if (eng.phase == AuctionPhase.COMPLETED) {
                    stopHeartbeat()
                    break
                }
            }
        }
    }

    private fun stopTicker() {
        tickerJob?.cancel()
        tickerJob = null
        stopHeartbeat()
    }

    private fun stopHeartbeat() {
        if (heartbeatActive) {
            heartbeatActive = false
            _effects.tryEmit(UiEffect.PlaySound(SoundCue.HEARTBEAT_STOP))
        }
    }

    private fun processEngineEvents(eng: AuctionEngine) {
        val events = eng.drainEvents()
        for (ev in events) {
            when (ev) {
                is EngineEvent.SetIntroStarted -> {
                    stopHeartbeat()
                    _effects.tryEmit(UiEffect.PlaySound(SoundCue.CROWD_MURMUR))
                }
                is EngineEvent.LotRevealed -> {
                    stopHeartbeat()
                    val text = eng.latestCommentary?.text
                    if (text != null && _uiState.value.settings.ttsEnabled) {
                        _effects.tryEmit(UiEffect.SpeakCommentary(text))
                    }
                }
                is EngineEvent.BidAccepted -> {
                    _effects.tryEmit(UiEffect.PlaySound(SoundCue.BID_PING))
                    _effects.tryEmit(UiEffect.TriggerHaptic(HapticCue.LIGHT_TICK))
                    if (ev.isDuel && !heartbeatActive) {
                        heartbeatActive = true
                        _effects.tryEmit(UiEffect.PlaySound(SoundCue.HEARTBEAT_START))
                    }
                }
                is EngineEvent.FinalCallEscalated -> {
                    val cue = if (ev.stage == 1) SoundCue.GOING_ONCE else SoundCue.GOING_TWICE
                    _effects.tryEmit(UiEffect.PlaySound(cue))
                }
                is EngineEvent.HammerSold -> {
                    stopHeartbeat()
                    _effects.tryEmit(UiEffect.PlaySound(SoundCue.GAVEL_HIT))
                    _effects.tryEmit(UiEffect.PlaySound(SoundCue.SOLD_FANFARE))
                    _effects.tryEmit(UiEffect.TriggerHaptic(HapticCue.HAMMER_IMPACT))
                    _uiState.update { it.copy(lastSoldRecord = ev.record) }
                    persistCurrentSnapshot()
                }
                is EngineEvent.HammerUnsold -> {
                    stopHeartbeat()
                    _effects.tryEmit(UiEffect.PlaySound(SoundCue.UNSOLD_SIGH))
                    persistCurrentSnapshot()
                }
                is EngineEvent.RtmPrompted -> {
                    stopHeartbeat()
                    _effects.tryEmit(UiEffect.PlaySound(SoundCue.RTM_STING))
                }
                is EngineEvent.RtmResolved -> Unit
                is EngineEvent.AuctionCompleted -> {
                    stopHeartbeat()
                    persistCurrentSnapshot()
                }
            }
        }
    }

    private fun syncStateFromEngine() {
        val eng = engine ?: return
        val player = eng.currentPlayerOrNull()
        val setNum = if (eng.isAcceleratedRound) 0 else (player?.set ?: 1)
        val setDesc = PlayerSetCatalog.descriptorFor(setNum)
        val humans = eng.config.humanTeamCodes.toImmutableList()
        val activeHuman = _uiState.value.activeHumanTeam.takeIf { it in humans }
            ?: humans.firstOrNull()
            ?: TeamCode.CSK

        val duelPair = eng.currentDuelTeams()
        val duelList = if (duelPair != null) {
            listOf(duelPair.first, duelPair.second).toImmutableList()
        } else {
            kotlinx.collections.immutable.persistentListOf()
        }

        val totalWindow = if (eng.isAcceleratedRound) {
            AuctionEngine.ACCELERATED_INITIAL_BID_MS
        } else {
            AuctionEngine.STANDARD_INITIAL_BID_MS
        }

        _uiState.update {
            it.copy(
                phase = eng.phase,
                currentSetNumber = setNum,
                currentSetTitle = setDesc.title,
                currentSetSubtitle = setDesc.subtitle,
                currentSetPlayerCount = if (eng.isAcceleratedRound) eng.activeQueueSize() else setDesc.expectedCount,
                isAcceleratedRound = eng.isAcceleratedRound,
                lotNumber = eng.currentLotNumber(),
                totalLotsInRound = eng.activeQueueSize(),
                currentPlayer = player,
                effectiveBasePriceCr = eng.currentEffectiveBasePriceCr(),
                currentBidCr = eng.currentBidCr,
                highestBidder = eng.highestBidder,
                nextBidCr = eng.nextBidAmountCr(),
                bidRemainingMs = eng.bidRemainingMs(),
                bidTotalWindowMs = totalWindow,
                phaseRemainingMs = eng.phaseRemainingMs(),
                teams = eng.teamStates().toImmutableList(),
                humanTeamCodes = humans,
                activeHumanTeam = activeHuman,
                activeBidEligibility = eng.checkBidEligibility(activeHuman),
                isDuelActive = eng.currentDuelCount() >= 3 && duelPair != null,
                duelTeams = duelList,
                consecutiveDuelCount = eng.currentDuelCount(),
                rtmState = eng.rtmState,
                unsoldPlayers = eng.unsoldPlayers().toImmutableList(),
                soldHistory = eng.soldHistory().toImmutableList(),
                latestCommentary = eng.latestCommentary,
                commentaryHistory = eng.commentaryHistory.toImmutableList()
            )
        }
    }

    private fun openRecapScreen() {
        val eng = engine ?: return
        stopTicker()
        val summaries = eng.teamStates().map { teamState ->
            RecapEvaluator.evaluateTeam(
                teamState = teamState,
                purseCr = eng.config.purseCr,
                minSquadSize = eng.config.minSquadSize
            )
        }.toImmutableList()
        val defaultTeam = eng.config.humanTeamCodes.firstOrNull() ?: TeamCode.CSK
        _uiState.update {
            it.copy(
                screen = Screen.Recap,
                recapSummaries = summaries,
                selectedRecapTeam = defaultTeam
            )
        }
    }

    private fun persistCurrentSnapshot() {
        val eng = engine ?: return
        val snap = eng.toSnapshot()
        viewModelScope.launch {
            snapshotRepository.saveSnapshot(snap)
            _uiState.update { it.copy(hasSavedSnapshot = true) }
        }
    }

    override fun onCleared() {
        super.onCleared()
        stopTicker()
    }
}

class AuctionViewModelFactory(
    private val playerRepository: PlayerRepository,
    private val settingsRepository: SettingsRepository,
    private val snapshotRepository: SnapshotRepository
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(AuctionViewModel::class.java)) {
            return AuctionViewModel(playerRepository, settingsRepository, snapshotRepository) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class: ${modelClass.name}")
    }
}
