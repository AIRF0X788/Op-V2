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
    
    this.renderer = new MapRenderer('placementCanvas');
    this.renderer.loadMapData(mapData);
    
    this.setupEvents();
    this.startRenderLoop();
  }

  setupEvents() {
    this.canvas.addEventListener('click', (e) => {
      if (this.hasPlaced) {
        network.showNotification('Base already placed', 'warning');
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
    network.socket.emit('placeBase', {
      roomCode: network.currentRoom,
      x,
      y
    });
  }

  showPlacementPreview(x, y) {
    this.renderer.setSelectedCell({ x, y });
  }

  onBasePlaced(data) {
    if (data.playerId === network.playerId) {
      this.hasPlaced = true;
    }
    
    if (data.success) {
      if (data.playerId === network.playerId) {
        network.showNotification('Base placed successfully!', 'success');
        
        if (data.baseX !== undefined && data.baseY !== undefined) {
          this.renderer.centerOnBase(data.baseX, data.baseY);
        }
      }
      
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
        network.showNotification(data.reason || 'Cannot place base', 'error');
      }
    }
  }

  updatePlacementInfo(playersPlaced, totalPlayers) {
    document.getElementById('playersPlaced').textContent = playersPlaced;
    document.getElementById('totalPlayers').textContent = totalPlayers;
    
    if (playersPlaced === totalPlayers && playersPlaced > 0) {
      network.showNotification('All players ready! Starting...', 'success');
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
    this.hasPlaced = false;
    this.renderer = null;
  }
}