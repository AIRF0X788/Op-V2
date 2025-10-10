class MapRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    
    this.camera = { x: 0, y: 0 };
    this.zoom = 1;
    this.minZoom = 0.5;
    this.maxZoom = 3;
    
    this.baseCellSize = 8;
    
    this.mapData = null;
    this.gridWidth = 0;
    this.gridHeight = 0;
    
    this.hoveredCell = null;
    this.selectedCell = null;
    
    this.colors = {
      water: '#1e3a5f',
      land: '#7cb342',
      landDark: '#558b2f',
      hover: 'rgba(255, 255, 255, 0.3)',
      selected: 'rgba(52, 152, 219, 0.5)'
    };
    
    this.lastRender = 0;
    this.fps = 60;
    this.frameTime = 1000 / this.fps;
    
    this.cellCache = new Map();
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
    
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

    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 2) {
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

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = this.zoom * delta;
      
      if (newZoom >= this.minZoom && newZoom <= this.maxZoom) {
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

  getCellData(x, y) {
    const key = `${x},${y}`;
    if (this.cellCache.has(key)) {
      return this.cellCache.get(key);
    }
    
    let cellData = this.mapData?.cells?.find(c => c.x === x && c.y === y);
    
    if (cellData) {
      this.cellCache.set(key, cellData);
      return cellData;
    }
    
    return null;
  }

  loadMapData(mapData) {
    this.mapData = mapData;
    this.gridWidth = mapData.width;
    this.gridHeight = mapData.height;
    
    this.cellCache.clear();
    
    this.camera.x = this.gridWidth / 2 - (this.width / (2 * this.baseCellSize * this.zoom));
    this.camera.y = this.gridHeight / 2 - (this.height / (2 * this.baseCellSize * this.zoom));
  }

  render(gameState, now = Date.now()) {
    if (now - this.lastRender < this.frameTime) return;
    this.lastRender = now;

    if (!this.mapData || !gameState) return;

    this.ctx.fillStyle = this.colors.water;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const cellSize = this.baseCellSize * this.zoom;
    
    const startX = Math.max(0, Math.floor(this.camera.x));
    const startY = Math.max(0, Math.floor(this.camera.y));
    const endX = Math.min(this.gridWidth, Math.ceil(this.camera.x + this.width / cellSize));
    const endY = Math.min(this.gridHeight, Math.ceil(this.camera.y + this.height / cellSize));

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        this.renderCell(x, y, gameState.players, cellSize);
      }
    }

    gameState.players.forEach(player => {
      if (player.baseX !== null && player.baseY !== null) {
        this.renderPlayerBase(player, cellSize);
      }
    });

    if (this.hoveredCell) {
      this.highlightCell(this.hoveredCell.x, this.hoveredCell.y, this.colors.hover, cellSize);
    }

    if (this.selectedCell) {
      this.highlightCell(this.selectedCell.x, this.selectedCell.y, this.colors.selected, cellSize);
    }

    this.renderMinimap(gameState);
  }

  renderCell(x, y, players, cellSize) {
    const screenX = (x - this.camera.x) * cellSize;
    const screenY = (y - this.camera.y) * cellSize;
    
    const cellData = this.getCellData(x, y);
    
    if (!cellData) return;
    
    let color = this.colors.water;
    
    if (cellData.t === 'l') {
      if (cellData.o) {
        const player = players.find(p => p.id === cellData.o);
        color = player ? player.color : this.colors.land;
      } else {
        color = this.colors.land;
      }
    }

    this.ctx.fillStyle = color;
    this.ctx.fillRect(screenX, screenY, cellSize, cellSize);

    if (cellData.o && cellSize > 4) {
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(screenX, screenY, cellSize, cellSize);
    }

    if (cellData.tr > 0 && this.zoom > 1.5) {
      this.ctx.fillStyle = 'white';
      this.ctx.font = `${Math.floor(cellSize * 0.6)}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        Math.floor(cellData.tr),
        screenX + cellSize / 2,
        screenY + cellSize / 2
      );
    }

    if (cellData.b && this.zoom > 1.2) {
      const icons = { city: '🏛️', port: '⚓', outpost: '🏰', barracks: '⚔️' };
      this.ctx.font = `${Math.floor(cellSize * 0.8)}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(
        icons[cellData.b] || '',
        screenX + cellSize / 2,
        screenY + cellSize / 2
      );
    }
  }

  renderPlayerBase(player, cellSize) {
    const screenX = (player.baseX - this.camera.x) * cellSize;
    const screenY = (player.baseY - this.camera.y) * cellSize;
    
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
    
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
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
    const minimapCanvas = document.getElementById('minimapCanvas');
    if (!minimapCanvas) return;

    const ctx = minimapCanvas.getContext('2d');
    const width = minimapCanvas.width = 180;
    const height = minimapCanvas.height = 140;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    const scaleX = width / this.gridWidth;
    const scaleY = height / this.gridHeight;

    if (this.mapData && this.mapData.cells) {
      this.mapData.cells.forEach(cell => {
        if (cell.t === 'l') {
          const px = cell.x * scaleX;
          const py = cell.y * scaleY;

          if (cell.o) {
            const player = gameState.players.find(p => p.id === cell.o);
            ctx.fillStyle = player ? player.color : this.colors.landDark;
          } else {
            ctx.fillStyle = this.colors.landDark;
          }

          ctx.fillRect(px, py, Math.max(1, scaleX), Math.max(1, scaleY));
        }
      });
    }

    const viewX = this.camera.x * scaleX;
    const viewY = this.camera.y * scaleY;
    const viewW = (this.width / (this.baseCellSize * this.zoom)) * scaleX;
    const viewH = (this.height / (this.baseCellSize * this.zoom)) * scaleY;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(viewX, viewY, viewW, viewH);
  }

  centerOnBase(baseX, baseY) {
    this.camera.x = baseX - (this.width / (2 * this.baseCellSize * this.zoom));
    this.camera.y = baseY - (this.height / (2 * this.baseCellSize * this.zoom));
  }

  setSelectedCell(cell) {
    this.selectedCell = cell;
  }
}