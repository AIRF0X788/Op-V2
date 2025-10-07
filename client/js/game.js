// client/js/game.js

class Game {
  constructor() {
    this.renderer = null;
    this.placementManager = null;
    this.ui = null;
    this.currentGameState = null;
    this.currentPhase = 'menu';
    this.mapData = null;
    this.selectedCell = null;
  }

  async init() {
    console.log('🎮 Initialisation WorldConquest.io...');

    this.ui = new UIManager();
    this.ui.init();

    try {
      await network.connect();
      console.log('✅ Connecté au serveur');
    } catch (error) {
      console.error('❌ Erreur connexion:', error);
      network.showNotification('Impossible de se connecter', 'error');
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
      console.log('🎯 Phase de placement');
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
        network.showNotification(data.reason || 'Action impossible', 'error');
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

    this.ui.switchScreen('placementScreen');

    this.placementManager = new PlacementManager();
    this.placementManager.init(this.mapData);

    document.getElementById('totalPlayers').textContent = roomData.players.length;
    document.getElementById('playersPlaced').textContent = roomData.playersPlaced?.length || 0;
  }

  handleFullState(state) {
    this.currentGameState = state;
    this.mapData = state.mapData;

    if (state.gameState === 'placement') {
      this.startPlacementPhase(state);
    } else if (state.gameState === 'playing') {
      if (this.currentPhase !== 'playing') {
        this.startPlayingPhase();
      }
      this.updateGameState(state);
    }
  }

  startPlayingPhase() {
    console.log('🎮 Phase de jeu démarrée');
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

    canvas.addEventListener('click', (e) => {
      if (this.currentPhase !== 'playing') return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = this.renderer.getCellAtPosition(x, y);
      
      if (cell) {
        this.onCellClick(cell.x, cell.y);
      }
    });

    // Hover pour tooltip
    canvas.addEventListener('mousemove', (e) => {
      if (this.currentPhase !== 'playing') return;

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

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentPhase === 'playing') {
        this.deselectCell();
      }
    });
  }

  onCellClick(x, y) {
    const cell = this.mapData.cells.find(c => c.x === x && c.y === y);
    if (!cell || cell.t !== 'l') return;

    // Si c'est notre territoire, sélectionner
    if (cell.o === network.playerId) {
      this.selectCell(x, y);
    } 
    // Si c'est adjacent, tenter d'étendre
    else if (this.isAdjacentToPlayer(x, y)) {
      this.expandToCell(x, y);
    }
    // Sinon, juste sélectionner pour voir les infos
    else {
      this.selectCell(x, y);
    }
  }

  isAdjacentToPlayer(x, y) {
    const directions = [
      [-1,-1],[0,-1],[1,-1],
      [-1,0],[1,0],
      [-1,1],[0,1],[1,1]
    ];

    return directions.some(([dx, dy]) => {
      const neighbor = this.mapData.cells.find(c => c.x === x + dx && c.y === y + dy);
      return neighbor && neighbor.o === network.playerId;
    });
  }

  selectCell(x, y) {
    this.selectedCell = { x, y };
    this.renderer.setSelectedCell({ x, y });
    this.ui.showCellPanel(x, y, this.mapData, this.currentGameState);
  }

  deselectCell() {
    this.selectedCell = null;
    this.renderer.setSelectedCell(null);
    this.ui.hideCellPanel();
  }

  handleGridUpdate(data) {
    if (!this.currentGameState) return;

    data.changes.forEach(change => {
      const cellIndex = this.mapData.cells.findIndex(c => c.x === change.x && c.y === change.y);
      if (cellIndex !== -1) {
        this.mapData.cells[cellIndex].o = change.owner;
        this.mapData.cells[cellIndex].tr = change.troops;
        this.mapData.cells[cellIndex].b = change.building;
      } else if (change.owner) {
        this.mapData.cells.push({
          x: change.x,
          y: change.y,
          t: 'l',
          o: change.owner,
          tr: change.troops,
          b: change.building
        });
      }
    });

    if (data.players) {
      this.currentGameState.players = data.players;
      
      const currentPlayer = data.players.find(p => p.id === network.playerId);
      if (currentPlayer) {
        this.ui.updateGameHUD(currentPlayer, this.mapData);
      }
      
      // Mettre à jour le leaderboard
      this.ui.updateLeaderboard(data.players, this.mapData);
    }

    // Mettre à jour le panneau si une cellule est sélectionnée
    if (this.selectedCell) {
      this.ui.showCellPanel(this.selectedCell.x, this.selectedCell.y, this.mapData, this.currentGameState);
    }
  }

  updateGameState(state) {
    if (!state) return;

    this.currentGameState = state;

    const currentPlayer = state.players.find(p => p.id === network.playerId);
    if (currentPlayer) {
      this.ui.updateGameHUD(currentPlayer, this.mapData);
    }

    if (this.selectedCell) {
      this.ui.showCellPanel(this.selectedCell.x, this.selectedCell.y, this.mapData, state);
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
      ? `🎉 Victoire ! Vous avez conquis l'Europe !`
      : `👑 ${data.winner.name} a conquis l'Europe !`;
    
    network.showNotification(message, isWinner ? 'success' : 'info');
    
    setTimeout(() => {
      this.ui.showGameOverModal(data);
    }, 2000);
  }

  // Actions du joueur
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
      network.showNotification('Centré sur votre base', 'info');
    }
  }

  stop() {
    this.currentPhase = 'menu';
  }
}

const game = new Game();