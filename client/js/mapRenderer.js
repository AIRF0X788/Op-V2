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
    
    this.colors = {
      water: '#1a2332',
      land: '#4a5f3a',
      landDark: '#3a4f2a',
      hover: 'rgba(255, 255, 255, 0.2)',
      border: 'rgba(0, 0, 0, 0.3)'
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

    // Fond
    this.ctx.fillStyle = this.colors.water;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const cellSize = this.baseCellSize * this.zoom;
    
    const startX = Math.max(0, Math.floor(this.camera.x));
    const startY = Math.max(0, Math.floor(this.camera.y));
    const endX = Math.min(this.gridWidth, Math.ceil(this.camera.x + this.width / cellSize));
    const endY = Math.min(this.gridHeight, Math.ceil(this.camera.y + this.height / cellSize));

    // Rendu des cellules par territoire
    const territoryGroups = new Map();

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const cellData = this.getCellData(x, y);
        if (!cellData || cellData.t !== 'l') continue;

        const owner = cellData.o || 'neutral';
        if (!territoryGroups.has(owner)) {
          territoryGroups.set(owner, []);
        }
        territoryGroups.get(owner).push({ x, y, cellData });
      }
    }

    // Dessiner chaque territoire
    territoryGroups.forEach((cells, owner) => {
      let color = this.colors.land;
      
      if (owner !== 'neutral') {
        const player = gameState.players.find(p => p.id === owner);
        color = player ? player.color : this.colors.land;
      }

      this.ctx.fillStyle = color;

      cells.forEach(({ x, y }) => {
        const screenX = (x - this.camera.x) * cellSize;
        const screenY = (y - this.camera.y) * cellSize;
        this.ctx.fillRect(screenX, screenY, cellSize, cellSize);
      });

      // Dessiner les bordures entre territoires
      if (cellSize > 2) {
        this.ctx.strokeStyle = this.colors.border;
        this.ctx.lineWidth = Math.max(1, cellSize * 0.1);

        cells.forEach(({ x, y }) => {
          const neighbors = this.getNeighborsQuick(x, y);
          neighbors.forEach(([nx, ny, direction]) => {
            const nCell = this.getCellData(nx, ny);
            if (!nCell || nCell.o !== owner) {
              const screenX = (x - this.camera.x) * cellSize;
              const screenY = (y - this.camera.y) * cellSize;
              
              this.ctx.beginPath();
              switch (direction) {
                case 'top':
                  this.ctx.moveTo(screenX, screenY);
                  this.ctx.lineTo(screenX + cellSize, screenY);
                  break;
                case 'right':
                  this.ctx.moveTo(screenX + cellSize, screenY);
                  this.ctx.lineTo(screenX + cellSize, screenY + cellSize);
                  break;
                case 'bottom':
                  this.ctx.moveTo(screenX, screenY + cellSize);
                  this.ctx.lineTo(screenX + cellSize, screenY + cellSize);
                  break;
                case 'left':
                  this.ctx.moveTo(screenX, screenY);
                  this.ctx.lineTo(screenX, screenY + cellSize);
                  break;
              }
              this.ctx.stroke();
            }
          });
        });
      }
    });

    // Dessiner les bases des joueurs
    gameState.players.forEach(player => {
      if (player.baseX !== null && player.baseY !== null) {
        this.renderPlayerBase(player, cellSize);
      }
    });

    // Rendu de la minimap
    this.renderMinimap(gameState);
  }

  getNeighborsQuick(x, y) {
    return [
      [x, y - 1, 'top'],
      [x + 1, y, 'right'],
      [x, y + 1, 'bottom'],
      [x - 1, y, 'left']
    ];
  }

  renderPlayerBase(player, cellSize) {
    const screenX = (player.baseX - this.camera.x) * cellSize;
    const screenY = (player.baseY - this.camera.y) * cellSize;
    
    const baseRadius = cellSize * 1.5;
    
    // Cercle extérieur
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
    
    // Bordure blanche
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    
    // Nom du joueur
    if (this.zoom > 0.8) {
      this.ctx.fillStyle = 'white';
      this.ctx.font = 'bold 12px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
      this.ctx.shadowBlur = 4;
      this.ctx.fillText(
        player.name,
        screenX + cellSize / 2,
        screenY - baseRadius - 5
      );
      this.ctx.shadowBlur = 0;
    }
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

    // Rectangle de la vue
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
}