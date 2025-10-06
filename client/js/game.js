// Gestionnaire principal du jeu
class Game {
  constructor() {
    this.renderer = null;
    this.ui = null;
    this.currentGameState = null;
    this.isPlaying = false;
    this.mousePos = { x: 0, y: 0 };
  }

  async init() {
    console.log('Initialisation du jeu...');

    // Créer les managers
    this.ui = new UIManager();
    this.ui.init();

    // Connecter au serveur
    try {
      await network.connect();
      console.log('Connexion au serveur réussie');
    } catch (error) {
      console.error('Erreur de connexion:', error);
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
      this.ui.switchScreen('lobbyScreen');
      this.ui.updateLobby(data.room);
    });

    // Room rejointe
    network.on('roomJoined', (data) => {
      console.log('Room rejointe, passage au lobby');
      this.ui.switchScreen('lobbyScreen');
      this.ui.updateLobby(data.room);
    });

    // Joueur a rejoint
    network.on('playerJoined', (data) => {
      this.ui.updateLobby(data.room);
    });

    // Partie démarrée
    network.on('gameStarted', (data) => {
      console.log('Démarrage de la partie');
      this.startGame(data.room);
    });

    // État du jeu mis à jour
    network.on('gameState', (state) => {
      this.updateGameState(state);
    });
  }

  startGame(roomData) {
    this.isPlaying = true;
    this.currentGameState = roomData;

    // Passer à l'écran de jeu
    this.ui.switchScreen('gameScreen');

    // Initialiser le renderer
    if (!this.renderer) {
      this.renderer = new GameRenderer('gameCanvas');
      this.setupCanvasEvents();
    }

    // Démarrer la boucle de rendu
    this.gameLoop();
  }

  setupCanvasEvents() {
    const canvas = document.getElementById('gameCanvas');

    // Mouvement de la souris
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      this.mousePos.x = e.clientX - rect.left;
      this.mousePos.y = e.clientY - rect.top;

      // Détecter le territoire survolé
      if (this.currentGameState && this.currentGameState.territories) {
        const hoveredTerritory = this.renderer.getTerritoryAtPosition(
          this.mousePos.x,
          this.mousePos.y,
          this.currentGameState.territories
        );
        this.renderer.setHoveredTerritory(hoveredTerritory);

        // Changer le curseur
        canvas.style.cursor = hoveredTerritory ? 'pointer' : 'default';
      }
    });

    // Clic sur le canvas
    canvas.addEventListener('click', (e) => {
      if (!this.currentGameState || !this.currentGameState.territories) return;

      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const clickedTerritory = this.renderer.getTerritoryAtPosition(
        x,
        y,
        this.currentGameState.territories
      );

      if (clickedTerritory) {
        this.selectTerritory(clickedTerritory);
      } else {
        this.deselectTerritory();
      }
    });

    // Touche Echap pour déselectionner
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isPlaying) {
        this.deselectTerritory();
      }
    });
  }

  selectTerritory(territory) {
    console.log('Territoire sélectionné:', territory.name);
    this.renderer.setSelectedTerritory(territory);
    this.ui.showTerritoryPanel(territory, this.currentGameState);
  }

  deselectTerritory() {
    this.renderer.setSelectedTerritory(null);
    this.ui.hideTerritoryPanel();
  }

  updateGameState(state) {
    if (!state) return;

    this.currentGameState = state;

    // Mettre à jour le HUD
    const currentPlayer = state.players.find(p => p.id === network.playerId);
    if (currentPlayer) {
      this.ui.updateGameHUD(currentPlayer);
    }

    // Si un territoire est sélectionné, mettre à jour son panneau
    if (this.renderer.selectedTerritory) {
      const updatedTerritory = state.territories.find(
        t => t.id === this.renderer.selectedTerritory.id
      );
      if (updatedTerritory) {
        this.renderer.setSelectedTerritory(updatedTerritory);
        this.ui.showTerritoryPanel(updatedTerritory, state);
      }
    }

    // Vérifier la condition de victoire
    this.checkVictoryCondition(state);
  }

  checkVictoryCondition(state) {
    // Compter les territoires par joueur
    const territoryCounts = new Map();
    
    state.territories.forEach(territory => {
      if (territory.owner) {
        territoryCounts.set(
          territory.owner,
          (territoryCounts.get(territory.owner) || 0) + 1
        );
      }
    });

    // Vérifier si un joueur possède tous les territoires
    const totalTerritories = state.territories.length;
    for (let [playerId, count] of territoryCounts) {
      if (count === totalTerritories) {
        const winner = [...state.players, ...state.bots].find(p => p.id === playerId);
        if (winner) {
          this.onVictory(winner);
        }
      }
    }
  }

  onVictory(winner) {
    const isCurrentPlayer = winner.id === network.playerId;
    const message = isCurrentPlayer 
      ? `🎉 Félicitations ! Vous avez conquis le monde !`
      : `👑 ${winner.name} a conquis le monde !`;
    
    network.showNotification(message, isCurrentPlayer ? 'success' : 'info');
    
    // Afficher une modal de victoire
    setTimeout(() => {
      if (confirm(message + '\n\nVoulez-vous retourner au menu ?')) {
        this.ui.switchScreen('menuScreen');
        location.reload();
      }
    }, 2000);
  }

  gameLoop() {
    if (!this.isPlaying) return;

    // Rendu
    if (this.renderer && this.currentGameState) {
      this.renderer.render(this.currentGameState);
    }

    // Continuer la boucle
    requestAnimationFrame(() => this.gameLoop());
  }

  stop() {
    this.isPlaying = false;
  }
}

// Instance globale
const game = new Game();