class Game {
  constructor() {
    this.renderer = null;
    this.placementManager = null;
    this.ui = null;
    this.currentGameState = null;
    this.currentPhase = 'menu';
    this.mapData = null;
    this.selectedCell = null;
    this.cellMap = new Map();
    this.isExpanding = false;
  }

  async init() {
    this.ui = new UIManager();
    this.ui.init();

    try {
      await network.connect();
    } catch (error) {
      network.showNotification('Cannot connect to server', 'error');
      return;
    }

    this.setupNetworkEvents();
  }

  setupNetworkEvents() {
    network.on('roomCreated', (data) => {
      this.currentPhase = 'lobby';
      this.ui.switchScreen('lobbyScreen');
      this.ui.updateLobby(data.room);
    });

    network.on('roomJoined', (data) => {
      this.currentPhase = 'lobby';
      this.ui.switchScreen('lobbyScreen');
      this.ui.updateLobby(data.room);
    });

    network.on('playerJoined', (data) => {
      this.ui.updateLobby(data.room);
    });

    network.on('gameStarted', (data) => {
      this.startPlacementPhase(data.room);
    });

    network.on('fullState', (state) => {
      this.handleFullState(state);
    });

    network.on('gridUpdate', (data) => {
      this.handleGridUpdate(data);
    });

    network.on('phaseChanged', (data) => {
      if (data.phase === 'playing') {
        this.startPlayingPhase();
      }
    });

    network.on('basePlaced', (data) => {
      if (this.placementManager) {
        this.placementManager.onBasePlaced(data);
      }
    });

    network.on('placementUpdate', (data) => {
      if (this.placementManager) {
        this.placementManager.updatePlacementInfo(data.playersPlaced, data.totalPlayers);
      }
    });

    network.on('actionResult', (data) => {
      if (!data.success) {
        network.showNotification(data.reason || 'Action failed', 'error');
      } else if (data.message) {
        network.showNotification(data.message, 'success');
      }
    });

    network.on('gameOver', (data) => {
      this.onGameOver(data);
    });

    network.on('combatEvent', (data) => {
      network.showNotification(`⚔️ ${data.attacker} attacks ${data.defender}!`, 'warning');
    });
  }

  startPlacementPhase(roomData) {
    this.currentPhase = 'placement';
    this.currentGameState = roomData;
    this.mapData = roomData.mapData;
    this.buildCellMap();

    this.ui.switchScreen('placementScreen');

    this.placementManager = new PlacementManager();
    this.placementManager.init(this.mapData);

    document.getElementById('totalPlayers').textContent = roomData.players.length;
    document.getElementById('playersPlaced').textContent = roomData.playersPlaced?.length || 0;
  }

  buildCellMap() {
    this.cellMap.clear();
    if (this.mapData && this.mapData.cells) {
      this.mapData.cells.forEach(cell => {
        const key = `${cell.x},${cell.y}`;
        this.cellMap.set(key, cell);
      });
    }
  }

  handleFullState(state) {
    this.currentGameState = state;
    this.mapData = state.mapData;
    this.buildCellMap();

    if (typeof allianceSystem !== 'undefined') {
      allianceSystem.updateFromGameState(state);
    }

    if (state.gameState === 'placement') {
      this.startPlacementPhase(state);
    } else if (state.gameState === 'playing') {
      if (this.currentPhase !== 'playing') {
        this.startPlayingPhase();
      } else {
        if (this.renderer) {
          this.renderer.loadMapData(this.mapData);
          this.renderer.cellCache.clear();
        }
      }
      this.updateGameState(state);
    }
  }

  startPlayingPhase() {
    this.currentPhase = 'playing';

    if (this.placementManager) {
      this.placementManager.cleanup();
      this.placementManager = null;
    }

    this.ui.switchScreen('gameScreen');

    if (!this.renderer) {
      this.renderer = new MapRenderer('gameCanvas');
      this.renderer.loadMapData(this.mapData);
      this.setupGameEvents();
    }

    const currentPlayer = this.currentGameState?.players?.find(p => p.id === network.playerId);
    if (currentPlayer && currentPlayer.baseX !== null) {
      this.renderer.centerOnBase(currentPlayer.baseX, currentPlayer.baseY);
    }

    this.startGameLoop();
  }

  setupGameEvents() {
    const canvas = document.getElementById('gameCanvas');

    // Clic gauche pour activer/désactiver l'expansion
    canvas.addEventListener('click', (e) => {
      if (this.currentPhase !== 'playing') return;

      // Toggle expansion
      this.toggleExpansion();
    });

    // Clic droit pour déplacer la caméra
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        
        this.renderer.camera.x -= dx / (this.renderer.baseCellSize * this.renderer.zoom);
        this.renderer.camera.y -= dy / (this.renderer.baseCellSize * this.renderer.zoom);
        
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        // Afficher le tooltip
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const cell = this.renderer.getCellAtPosition(x, y);

        if (cell) {
          this.ui.showCellTooltip(e.clientX, e.clientY, cell.x, cell.y, this.mapData, this.currentGameState);
        } else {
          this.ui.hideCellTooltip();
        }
      }
    });

    canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    canvas.addEventListener('mouseleave', () => {
      isDragging = false;
      this.ui.hideCellTooltip();
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  handleGridUpdate(data) {
    if (!this.currentGameState) return;

    if (!this.mapData) {
      this.mapData = { cells: [], width: 150, height: 100 };
    }

    data.changes.forEach(change => {
      const key = `${change.x},${change.y}`;
      let cellData = this.cellMap.get(key);
      
      if (cellData) {
        cellData.o = change.owner;
      } else {
        cellData = {
          x: change.x,
          y: change.y,
          t: 'l',
          o: change.owner
        };
        this.mapData.cells.push(cellData);
        this.cellMap.set(key, cellData);
      }
      
      if (this.renderer) {
        this.renderer.cellCache.delete(key);
      }
    });

    if (data.players) {
      this.currentGameState.players = data.players;

      if (typeof allianceSystem !== 'undefined') {
        allianceSystem.updateFromGameState(this.currentGameState);
      }

      const currentPlayer = data.players.find(p => p.id === network.playerId);
      if (currentPlayer) {
        this.ui.updateGameHUD(currentPlayer, this.mapData);
      }
    }
  }

  updateGameState(state) {
    if (!state) return;

    this.currentGameState = state;

    const currentPlayer = state.players.find(p => p.id === network.playerId);
    if (currentPlayer) {
      this.ui.updateGameHUD(currentPlayer, this.mapData);
    }
  }

  startGameLoop() {
    const loop = (timestamp) => {
      if (this.currentPhase === 'playing' && this.renderer) {
        this.renderer.render(this.currentGameState, timestamp);
      }
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  onGameOver(data) {
    const isWinner = data.winner.id === network.playerId;
    const message = isWinner
      ? `Victory! You conquered Europe!`
      : `${data.winner.name} conquered Europe!`;

    network.showNotification(message, isWinner ? 'success' : 'info');

    setTimeout(() => {
      this.ui.showGameOverModal(data);
    }, 2000);
  }

  // Expansion continue vers une cellule
  expandToCell(x, y) {
    if (this.isExpanding) return;
    
    const key = `${x},${y}`;
    const cellData = this.cellMap.get(key);
    
    if (!cellData || cellData.t !== 'l') {
      network.showNotification('Cannot expand to water', 'error');
      return;
    }

    // Si c'est déjà notre territoire, ne rien faire
    if (cellData.o === network.playerId) {
      return;
    }

    this.isExpanding = true;

    // Envoyer la commande d'expansion
    network.socket.emit('expandTerritory', {
      roomCode: network.currentRoom,
      x,
      y
    });

    // Débloquer après un court délai
    setTimeout(() => {
      this.isExpanding = false;
    }, 100);
  }

  centerOnBase() {
    const currentPlayer = this.currentGameState?.players?.find(p => p.id === network.playerId);
    if (currentPlayer && currentPlayer.baseX !== null && this.renderer) {
      this.renderer.centerOnBase(currentPlayer.baseX, currentPlayer.baseY);
      network.showNotification('Centered on your base', 'info');
    }
  }
}

const game = new Game();