// client/js/mapRenderer.js

class MapRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    
    // Caméra et zoom
    this.camera = { x: 0, y: 0 };
    this.zoom = 1;
    this.minZoom = 0.5;
    this.maxZoom = 3;
    
    // Taille des cellules
    this.baseCellSize = 8; // pixels
    
    // Grille de carte
    this.mapData = null;
    this.gridWidth = 0;
    this.gridHeight = 0;
    
    // Interaction
    this.hoveredCell = null;
    this.selectedCell = null;
    
    // Couleurs
    this.colors = {
      water: '#1e3a5f',
      land: '#7cb342',
      landDark: '#558b2f',
      hover: 'rgba(255, 255, 255, 0.3)',
      selected: 'rgba(52, 152, 219, 0.5)',
      grid: 'rgba(0, 0, 0, 0.1)'
    };
    
    // Performance
    this.lastRender = 0;
    this.fps = 60;
    this.frameTime = 1000 / this.fps;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
    // Contrôles
    this.setupControls();
  }

  resize() {
    this.width = this.canvas.width = this.canvas.offsetWidth;
    this.height = this.canvas.height = this.canvas.offsetHeight;
  }

  setupControls() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    // Déplacement de la caméra
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) { // Clic droit
        isDragging = true;
        lastX = e.clientX;
        lastY = e.clientY;
        e.preventDefault();
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        
        this.camera.x -= dx / (this.baseCellSize * this.zoom);
        this.camera.y -= dy / (this.baseCellSize * this.zoom);
        
        lastX = e.clientX;
        lastY = e.clientY;
      } else {
        // Détection de la cellule survolée
        this.updateHoveredCell(e);
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      isDragging = false;
    });

    this.canvas.addEventListener('mouseleave', () => {
      isDragging = false;
      this.hoveredCell = null;
    });

    // Zoom avec la molette
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = this.zoom * delta;
      
      if (newZoom >= this.minZoom && newZoom <= this.maxZoom) {
        // Zoomer vers la position de la souris
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldX = (mouseX / (this.baseCellSize * this.zoom)) + this.camera.x;
        const worldY = (mouseY / (this.baseCellSize * this.zoom)) + this.camera.y;
        
        this.zoom = newZoom;
        
        this.camera.x = worldX - (mouseX / (this.baseCellSize * this.zoom));
        this.camera.y = worldY - (mouseY / (this.baseCellSize * this.zoom));
      }
    });

    // Désactiver le menu contextuel
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  updateHoveredCell(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const gridX = Math.floor((mouseX / (this.baseCellSize * this.zoom)) + this.camera.x);
    const gridY = Math.floor((mouseY / (this.baseCellSize * this.zoom)) + this.camera.y);
    
    if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
      this.hoveredCell = { x: gridX, y: gridY };
    } else {
      this.hoveredCell = null;
    }
  }

  getCellAtPosition(screenX, screenY) {
    const gridX = Math.floor((screenX / (this.baseCellSize * this.zoom)) + this.camera.x);
    const gridY = Math.floor((screenY / (this.baseCellSize * this.zoom)) + this.camera.y);
    
    if (gridX >= 0 && gridX < this.gridWidth && gridY >= 0 && gridY < this.gridHeight) {
      return { x: gridX, y: gridY };
    }
    return null;
  }

  loadMapData(mapData) {
    this.mapData = mapData;
    this.gridWidth = mapData.width;
    this.gridHeight = mapData.height;
    
    // Centrer la caméra sur la carte
    this.camera.x = this.gridWidth / 2 - (this.width / (2 * this.baseCellSize * this.zoom));
    this.camera.y = this.gridHeight / 2 - (this.height / (2 * this.baseCellSize * this.zoom));
  }

  render(gameState, now = Date.now()) {
    // Limiter le framerate
    if (now - this.lastRender < this.frameTime) {
      return;
    }
    this.lastRender = now;

    if (!this.mapData || !gameState) return;

    // Effacer le canvas
    this.ctx.fillStyle = this.colors.water;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const cellSize = this.baseCellSize * this.zoom;
    
    // Calculer les cellules visibles
    const startX = Math.max(0, Math.floor(this.camera.x));
    const startY = Math.max(0, Math.floor(this.camera.y));
    const endX = Math.min(this.gridWidth, Math.ceil(this.camera.x + this.width / cellSize));
    const endY = Math.min(this.gridHeight, Math.ceil(this.camera.y + this.height / cellSize));

    // Dessiner les cellules
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        this.renderCell(x, y, gameState.players, cellSize);
      }
    }

    // Dessiner les bases des joueurs
    gameState.players.forEach(player => {
      if (player.baseX !== null && player.baseY !== null) {
        this.renderPlayerBase(player, cellSize);
      }
    });

    // Dessiner la cellule survolée
    if (this.hoveredCell) {
      this.highlightCell(this.hoveredCell.x, this.hoveredCell.y, this.colors.hover, cellSize);
    }

    // Dessiner la cellule sélectionnée
    if (this.selectedCell) {
      this.highlightCell(this.selectedCell.x, this.selectedCell.y, this.colors.selected, cellSize);
    }

    // Dessiner la minimap
    this.renderMinimap(gameState);
  }

  renderCell(x, y, players, cellSize) {
    const screenX = (x - this.camera.x) * cellSize;
    const screenY = (y - this.camera.y) * cellSize;
    
    // Trouver les données de la cellule
    const cellData = this.mapData.cells.find(c => c.x === x && c.y === y);
    
    if (!cellData) return;

    let color = this.colors.water;
    
    if (cellData.t === 'l') { // land
      if (cellData.o) { // owned
        const player = players.find(p => p.id === cellData.o);
        color = player ? player.color : this.colors.land;
      } else {
        color = this.colors.land;
      }
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(screenX, screenY, cellSize, cellSize);

    // Bordure pour les cellules occupées
    if (cellData.o && cellSize > 4) {
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(screenX, screenY, cellSize, cellSize);
    }

    // Afficher les troupes si assez de zoom
    if (cellData.tr > 0 && this.zoom > 1.5) {
      this.ctx.fillStyle = 'white';
      this.ctx.font = `${Math.floor(cellSize * 0.6)}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        cellData.tr,
        screenX + cellSize / 2,
        screenY + cellSize / 2
      );
    }
  }

  renderPlayerBase(player, cellSize) {
    const screenX = (player.baseX - this.camera.x) * cellSize;
    const screenY = (player.baseY - this.camera.y) * cellSize;
    
    // Dessiner un cercle pour la base
    const baseRadius = cellSize * 2;
    this.ctx.fillStyle = player.color;
    this.ctx.beginPath();
    this.ctx.arc(
      screenX + cellSize / 2,
      screenY + cellSize / 2,
      baseRadius,
      0,
      Math.PI * 2
    );
    this.ctx.fill();
    
    // Bordure
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Nom du joueur si assez de zoom
    if (this.zoom > 1) {
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.fillText(
        player.name,
        screenX + cellSize / 2,
        screenY - baseRadius - 5
      );
    }
  }

  highlightCell(x, y, color, cellSize) {
    const screenX = (x - this.camera.x) * cellSize;
    const screenY = (y - this.camera.y) * cellSize;
    
    this.ctx.fillStyle = color;
    this.ctx.fillRect(screenX, screenY, cellSize, cellSize);
    
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(screenX, screenY, cellSize, cellSize);
  }

  renderMinimap(gameState) {
    const minimapSize = 150;
    const minimapX = this.width - minimapSize - 10;
    const minimapY = 10;
    
    // Fond de la minimap
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(minimapX, minimapY, minimapSize, minimapSize);
    
    // Bordure
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(minimapX, minimapY, minimapSize, minimapSize);
    
    // Dessiner une version simplifiée de la carte
    const scaleX = minimapSize / this.gridWidth;
    const scaleY = minimapSize / this.gridHeight;
    
    this.mapData.cells.forEach(cell => {
      if (cell.t === 'l') {
        const x = minimapX + cell.x * scaleX;
        const y = minimapY + cell.y * scaleY;
        
        if (cell.o) {
          const player = gameState.players.find(p => p.id === cell.o);
          this.ctx.fillStyle = player ? player.color : this.colors.land;
        } else {
          this.ctx.fillStyle = this.colors.landDark;
        }
        
        this.ctx.fillRect(x, y, Math.max(1, scaleX), Math.max(1, scaleY));
      }
    });
    
    // Dessiner la vue actuelle
    const viewX = minimapX + this.camera.x * scaleX;
    const viewY = minimapY + this.camera.y * scaleY;
    const viewW = (this.width / (this.baseCellSize * this.zoom)) * scaleX;
    const viewH = (this.height / (this.baseCellSize * this.zoom)) * scaleY;
    
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(viewX, viewY, viewW, viewH);
  }

  centerOnBase(baseX, baseY) {
    this.camera.x = baseX - (this.width / (2 * this.baseCellSize * this.zoom));
    this.camera.y = baseY - (this.height / (2 * this.baseCellSize * this.zoom));
  }

  setSelectedCell(cell) {
    this.selectedCell = cell;
  }

  getHoveredCell() {
    return this.hoveredCell;
  }
}