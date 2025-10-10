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

  requestFullStateUpdate() {
    if (network.currentRoom) {
      network.socket.emit('requestFullState', network.currentRoom);
    }
  }

  setupGameEvents() {
    const canvas = document.getElementById('gameCanvas');

    canvas.addEventListener('click', (e) => {
      if (this.currentPhase !== 'playing') return;
      if (radialMenu.isOpen) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = this.renderer.getCellAtPosition(x, y);

      if (cell) {
        const key = `${cell.x},${cell.y}`;
        const cellData = this.cellMap.get(key);
        
        if (cellData && cellData.t === 'l') {
          radialMenu.open(e.clientX, e.clientY, cellData, this.currentGameState);
        }
      }
    });

    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (radialMenu.isOpen) {
        radialMenu.close();
      }
    });

    canvas.addEventListener('mousemove', (e) => {
      if (this.currentPhase !== 'playing' || radialMenu.isOpen) {
        this.ui.hideCellTooltip();
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = this.renderer.getCellAtPosition(x, y);

      if (cell) {
        this.ui.showCellTooltip(e.clientX, e.clientY, cell.x, cell.y, this.mapData, this.currentGameState);
      } else {
        this.ui.hideCellTooltip();
      }
    });

    canvas.addEventListener('mouseleave', () => {
      this.ui.hideCellTooltip();
    });
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
        cellData.tr = change.troops;
        cellData.b = change.building;
      } else {
        cellData = {
          x: change.x,
          y: change.y,
          t: 'l',
          o: change.owner,
          tr: change.troops,
          b: change.building
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

  reinforceCell(x, y, troops) {
    network.socket.emit('reinforceCell', {
      roomCode: network.currentRoom,
      x,
      y,
      troops
    });
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

  expandToCell(x, y) {
    network.socket.emit('expandTerritory', {
      roomCode: network.currentRoom,
      x,
      y
    });
  }

  buildBuilding(x, y, buildingType) {
    network.socket.emit('buildBuilding', {
      roomCode: network.currentRoom,
      x,
      y,
      buildingType
    });
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