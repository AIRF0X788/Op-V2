class MapGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = [];
    this.initializeGrid();
  }

  initializeGrid() {
    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x] = {
          x,
          y,
          type: 'water',
          owner: null,
          troops: 0,
          building: null
        };
      }
    }
  }

  loadEuropeMap() {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.isEuropeLand(x, y)) {
          this.grid[y][x].type = 'land';
        }
      }
    }
  }

  isEuropeLand(x, y) {
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    const dx = (x - centerX) / this.width;
    const dy = (y - centerY) / this.height;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    const noise = Math.sin(x * 0.15) * Math.cos(y * 0.15) * 0.2;
    const threshold = 0.55 + noise;
    
    if (dist > threshold) return false;
    
    if (y > this.height * 0.7 && x > this.width * 0.35 && x < this.width * 0.65) {
      return false;
    }
    
    if (y < this.height * 0.25 && x < this.width * 0.4) {
      const subDist = Math.sqrt(
        Math.pow((x - this.width * 0.25) / this.width, 2) +
        Math.pow((y - this.height * 0.15) / this.height, 2)
      );
      if (subDist < 0.15) return false;
    }
    
    return true;
  }

  getCell(x, y) {
    if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
      return this.grid[y][x];
    }
    return null;
  }

  getNeighbors(x, y, includeDiagonals = false) {
    const neighbors = [];
    const directions = includeDiagonals 
      ? [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
      : [[0,-1],[1,0],[0,1],[-1,0]];
    
    directions.forEach(([dx, dy]) => {
      const cell = this.getCell(x + dx, y + dy);
      if (cell) {
        neighbors.push({ x: x + dx, y: y + dy, cell });
      }
    });
    
    return neighbors;
  }

  isAdjacentToPlayer(x, y, playerId) {
    const neighbors = this.getNeighbors(x, y, false);
    return neighbors.some(n => n.cell.owner === playerId);
  }

  getPlayerCells(playerId) {
    const cells = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].owner === playerId) {
          cells.push({ x, y, cell: this.grid[y][x] });
        }
      }
    }
    return cells;
  }

  calculatePlayerTroops(playerId) {
    const cells = this.getPlayerCells(playerId);
    return cells.reduce((sum, c) => sum + c.cell.troops, 0);
  }

  checkAreaFree(centerX, centerY, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = this.getCell(centerX + dx, centerY + dy);
        if (cell && cell.owner) return false;
      }
    }
    return true;
  }

  placePlayerBase(x, y, playerId, radius = 5) {
    const placed = [];
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const cell = this.getCell(x + dx, y + dy);
          if (cell && cell.type === 'land') {
            cell.owner = playerId;
            cell.troops = 10;
            placed.push({ x: x + dx, y: y + dy });
          }
        }
      }
    }
    
    console.log(`Placed ${placed.length} cells for player ${playerId} at (${x}, ${y})`);
    return placed;
  }

  isCoastal(x, y) {
    const neighbors = this.getNeighbors(x, y, false);
    return neighbors.some(n => n.cell.type === 'water');
  }

  getCompressedData() {
    const data = {
      width: this.width,
      height: this.height,
      cells: []
    };
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        data.cells.push({
          x,
          y,
          t: cell.type === 'land' ? 'l' : 'w',
          o: cell.owner,
          tr: Math.floor(cell.troops),
          b: cell.building
        });
      }
    }
    
    return data;
  }

  getChanges(previousState) {
    const changes = [];
    
    if (!previousState) return changes;
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const current = this.grid[y][x];
        const previous = previousState[y][x];
        
        if (!previous || 
            current.owner !== previous.owner || 
            Math.abs(current.troops - previous.troops) > 0.5 ||
            current.building !== previous.building) {
          changes.push({
            x,
            y,
            owner: current.owner,
            troops: Math.floor(current.troops),
            building: current.building
          });
        }
      }
    }
    
    return changes;
  }

  clone() {
    const cloned = new MapGrid(this.width, this.height);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        cloned.grid[y][x] = { ...this.grid[y][x] };
      }
    }
    return cloned;
  }
}

module.exports = MapGrid;