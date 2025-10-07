// client/js/placement.js

class PlacementManager {
  constructor() {
    this.canvas = null;
    this.renderer = null;
    this.hasPlaced = false;
    this.mapData = null;
    this.gameState = null;
  }

  init(mapData, initialGameState) {
    this.canvas = document.getElementById('placementCanvas');
    this.mapData = mapData;
    this.gameState = initialGameState || { players: [] };
    
    // Créer le renderer pour la phase de placement
    this.renderer = new MapRenderer('placementCanvas');
    this.renderer.loadMapData(mapData);
    
    // Configurer les événements de clic
    this.setupEvents();
    
    // Démarrer le rendu
    this.startRenderLoop();
  }

  setupEvents() {
    this.canvas.addEventListener('click', (e) => {
      if (this.hasPlaced) {
        network.showNotification('Vous avez déjà placé votre base', 'warning');
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = this.renderer.getCellAtPosition(x, y);
      
      if (cell) {
        this.attemptPlaceBase(cell.x, cell.y);
      }
    });

    // Afficher un aperçu lors du survol
    this.canvas.addEventListener('mousemove', (e) => {
      if (this.hasPlaced) return;

      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const cell = this.renderer.getCellAtPosition(x, y);
      
      if (cell) {
        this.showPlacementPreview(cell.x, cell.y);
      }
    });
  }

  attemptPlaceBase(x, y) {
    // Envoyer la requête au serveur
    network.socket.emit('placeBase', {
      roomCode: network.currentRoom,
      x,
      y
    });
  }

  showPlacementPreview(x, y) {
    // Mettre en évidence la zone où la base sera placée
    this.renderer.setSelectedCell({ x, y });
  }

  onBasePlaced(data) {
    if (data.playerId === network.playerId) {
      this.hasPlaced = true;
    }
    
    if (data.success) {
      if (data.playerId === network.playerId) {
        network.showNotification('Base placée avec succès !', 'success');
        
        // Centrer la caméra sur la base
        if (data.baseX !== undefined && data.baseY !== undefined) {
          this.renderer.centerOnBase(data.baseX, data.baseY);
        }
      }
      
      // Mettre à jour les bases placées
      if (data.playerId && data.baseX !== undefined && data.baseY !== undefined) {
        const playerInState = this.gameState.players.find(p => p.id === data.playerId);
        if (playerInState) {
          playerInState.baseX = data.baseX;
          playerInState.baseY = data.baseY;
        }
      }
    } else {
      if (data.playerId === network.playerId) {
        this.hasPlaced = false;
        network.showNotification(data.reason || 'Impossible de placer la base', 'error');
      }
    }
  }

  updatePlacementInfo(playersPlaced, totalPlayers) {
    document.getElementById('playersPlaced').textContent = playersPlaced;
    document.getElementById('totalPlayers').textContent = totalPlayers;
    
    if (playersPlaced === totalPlayers && playersPlaced > 0) {
      network.showNotification('Tous les joueurs ont placé leur base ! La partie commence...', 'success');
    }
  }

  updateGameState(gameState) {
    this.gameState = gameState;
  }

  startRenderLoop() {
    const render = () => {
      if (this.renderer && this.mapData && this.gameState) {
        this.renderer.render(this.gameState);
      }
      requestAnimationFrame(render);
    };
    
    render();
  }

  cleanup() {
    // Nettoyer si nécessaire
    this.hasPlaced = false;
    this.renderer = null;
  }
}