// client/js/game.js - Gestionnaire principal du jeu style OpenFront

class Game {
  constructor() {
    this.renderer = null;
    this.placementManager = null;
    this.ui = null;
    this.currentGameState = null;
    this.currentPhase = 'menu'; // menu, lobby, placement, playing
    this.mapData = null;
    this.placedBases = new Map();
  }

  async init() {
    console.log('🎮 Initialisation du jeu WorldConquest.io...');

    // Créer les managers
    this.ui = new UIManager();
    this.ui.init();

    // Connecter au serveur
    try {
      await network.connect();
      console.log('✅ Connexion au serveur réussie');
    } catch (error) {
      console.error('❌ Erreur de connexion:', error);
      network.showNotification('Impossible de se connecter au serveur', 'error');
      return;
    }

    // Configurer les événements réseau
    this.setupNetworkEvents();
  }

  setupNetworkEvents() {
    // Room créée
    network.on('roomCreated', (data) => {
      console.log('Room créée, passage au lobby');
      this.currentPhase = 'lobby';
      this.ui.switchScreen('lobbyScreen');
      this.ui.updateLobby(data.room);
    });

    // Room rejointe
    network.on('roomJoined', (data) => {
      console.log('Room rejointe, passage au lobby');
      this.currentPhase = 'lobby';
      this.ui.switchScreen('lobbyScreen');
      this.ui.updateLobby(data.room);
    });

    // Joueur a rejoint
    network.on('playerJoined', (data) => {
      this.ui.updateLobby(data.room);
    });

    // Phase de placement démarrée
    network.on('gameStarted', (data) => {
      console.log('🎯 Phase de placement démarrée');
      this.startPlacementPhase(data.room);
    });

    // État complet reçu
    network.on('fullState', (state) => {
      console.log('📦 État complet reçu', state);
      this.handleFullState(state);
    });

    // Mise à jour de la grille (delta)
    network.on('gridUpdate', (data) => {
      this.handleGridUpdate(data);
    });

    // Changement de phase
    network.on('phaseChanged', (data) => {
      console.log('📍 Changement de phase:', data.phase);
      if (data.phase === 'playing') {
        this.startPlayingPhase();
      }
    });

    // Base placée
    network.on('basePlaced', (data) => {
      if (this.placementManager) {
        this.placementManager.onBasePlaced(data);
      }
      
      // Enregistrer les bases placées
      if (data.playerId && data.baseX && data.baseY) {
        this.placedBases.set(data.playerId, { x: data.baseX, y: data.baseY });
      }
    });

    // Mise à jour des placements
    network.on('placementUpdate', (data) => {
      if (this.placementManager) {
        this.placementManager.updatePlacementInfo(data.playersPlaced, data.totalPlayers);
      }
    });

    // Résultat d'action
    network.on('actionResult', (data) => {
      if (!data.success) {
        network.showNotification(data.reason || 'Action impossible', 'error');
      } else if (data.message) {
        network.showNotification(data.message, 'success');
      }
    });

    // Fin de partie
    network.on('gameOver', (data) => {
      this.onGameOver(data);
    });
  }

  startPlacementPhase(roomData) {
    this.currentPhase = 'placement';
    this.currentGameState = roomData;
    this.mapData = roomData.mapData;

    // Passer à l'écran de placement
    this.ui.switchScreen('placementScreen');

    // Initialiser le gestionnaire de placement
    this.placementManager = new PlacementManager();
    this.placementManager.init(this.mapData);

    // Mettre à jour les compteurs
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

    // Nettoyer le placement manager
    if (this.placementManager) {
      this.placementManager.cleanup();
      this.placementManager = null;
    }

    // Passer à l'écran de jeu
    this.ui.switchScreen('gameScreen');

    // Initialiser le renderer de jeu
    if (!this.renderer) {
      this.renderer = new MapRenderer('gameCanvas');
      this.renderer.loadMapData(this.mapData);
      this.setupGameEvents();
    }

    // Centrer sur la base du joueur
    const currentPlayer = this.currentGameState?.players?.find(p => p.id === network.playerId);
    if (currentPlayer && currentPlayer.baseX !== null) {
      this.renderer.centerOnBase(currentPlayer.baseX, currentPlayer.baseY);
    }

    // Démarrer la boucle de rendu
    this.startGameLoop();
  }

  setupGameEvents() {
    const canvas = document.getElementById('gameCanvas');

    // Clic pour sélectionner une cellule
    canvas.addEventListener('click', (e) => {
      if (this.currentPhase !== 'playing') return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = this.renderer.getCellAtPosition(x, y);
      
      if (cell) {
        this.selectCell(cell.x, cell.y);
      }
    });

    // Touche Echap pour déselectionner
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.currentPhase === 'playing') {
        this.deselectCell();
      }
    });
  }

  selectCell(x, y) {
    console.log(`Cellule sélectionnée: (${x}, ${y})`);
    this.renderer.setSelectedCell({ x, y });
    this.ui.showCellPanel(x, y, this.mapData, this.currentGameState);
  }

  deselectCell() {
    this.renderer.setSelectedCell(null);
    this.ui.hideCellPanel();
  }

  handleGridUpdate(data) {
    if (!this.currentGameState) return;

    // Appliquer les changements
    data.changes.forEach(change => {
      // Trouver et mettre à jour la cellule dans mapData
      const cellIndex = this.mapData.cells.findIndex(c => c.x === change.x && c.y === change.y);
      if (cellIndex !== -1) {
        this.mapData.cells[cellIndex].o = change.owner;
        this.mapData.cells[cellIndex].tr = change.troops;
      } else if (change.owner) {
        // Nouvelle cellule conquise
        this.mapData.cells.push({
          x: change.x,
          y: change.y,
          t: 'l',
          o: change.owner,
          tr: change.troops
        });
      }
    });

    // Mettre à jour les joueurs
    if (data.players) {
      this.currentGameState.players = data.players;
      
      // Mettre à jour le HUD
      const currentPlayer = data.players.find(p => p.id === network.playerId);
      if (currentPlayer) {
        this.ui.updateGameHUD(currentPlayer);
      }
    }
  }

  updateGameState(state) {
    if (!state) return;

    this.currentGameState = state;

    // Mettre à jour le HUD
    const currentPlayer = state.players.find(p => p.id === network.playerId);
    if (currentPlayer) {
      this.ui.updateGameHUD(currentPlayer);
    }

    // Si une cellule est sélectionnée, mettre à jour son panneau
    if (this.renderer && this.renderer.selectedCell) {
      const { x, y } = this.renderer.selectedCell;
      this.ui.showCellPanel(x, y, this.mapData, state);
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
      ? `🎉 Félicitations ! Vous avez conquis l'Europe !`
      : `👑 ${data.winner.name} a conquis l'Europe !`;
    
    network.showNotification(message, isWinner ? 'success' : 'info');
    
    // Afficher les stats finales
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

  reinforceCell(x, y, count) {
    network.socket.emit('reinforceCell', {
      roomCode: network.currentRoom,
      x,
      y,
      count
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

// Instance globale
const game = new Game();