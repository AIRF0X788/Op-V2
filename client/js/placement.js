// client/js/placement.js

class PlacementManager {
  constructor() {
    this.canvas = null;
    this.renderer = null;
    this.hasPlaced = false;
    this.mapData = null;
  }

  init(mapData) {
    this.canvas = document.getElementById('placementCanvas');
    this.mapData = mapData;
    
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
    this.hasPlaced = true;
    
    if (data.success) {
      network.showNotification('Base placée avec succès !', 'success');
      
      // Mettre à jour les informations
      document.getElementById('playersPlaced').textContent = data.playersPlaced;
      
      // Centrer la caméra sur la base
      if (data.baseX && data.baseY) {
        this.renderer.centerOnBase(data.baseX, data.baseY);
      }
    } else {
      this.hasPlaced = false;
      network.showNotification(data.reason || 'Impossible de placer la base', 'error');
    }
  }

  updatePlacementInfo(playersPlaced, totalPlayers) {
    document.getElementById('playersPlaced').textContent = playersPlaced;
    document.getElementById('totalPlayers').textContent = totalPlayers;
    
    if (playersPlaced === totalPlayers && playersPlaced > 0) {
      network.showNotification('Tous les joueurs ont placé leur base ! La partie commence...', 'success');
    }
  }

  startRenderLoop() {
    const render = () => {
      if (this.renderer && this.mapData) {
        // Créer un gameState minimal pour le rendu
        const placementState = {
          players: Array.from(game.placedBases || []).map(([id, pos]) => {
            return {
              id,
              baseX: pos.x,
              baseY: pos.y,
              color: '#3498db', // Couleur temporaire
              name: 'Joueur'
            };
          })
        };
        
        this.renderer.render(placementState);
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