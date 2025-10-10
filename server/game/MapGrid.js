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

  getNeighbors(x, y, includeDiagonals = true) {
    const neighbors = [];
    const directions = includeDiagonals 
      ? [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]
      : [[-1,0],[1,0],[0,-1],[0,1]];
    
    directions.forEach(([dx, dy]) => {
      const cell = this.getCell(x + dx, y + dy);
      if (cell) {
        neighbors.push({ x: x + dx, y: y + dy, cell });
      }
    });
    
    return neighbors;
  }

  organicExpansion(targetX, targetY, playerId, troopCost) {
    const cell = this.getCell(targetX, targetY);
    if (!cell || cell.type !== 'land') return { success: false, reason: 'Invalid position' };
    if (cell.owner && cell.owner !== playerId) return { success: false, reason: 'Enemy territory' };
    
    const playerBorder = this.findClosestBorder(targetX, targetY, playerId);
    if (!playerBorder) return { success: false, reason: 'Not connected to your territory' };
    
    const expansionRadius = Math.floor(Math.sqrt(troopCost / 10));
    const expandedCells = this.floodFillExpansion(targetX, targetY, playerId, expansionRadius, troopCost);
    
    return { 
      success: true, 
      expandedCells,
      troopCost
    };
  }

  findClosestBorder(targetX, targetY, playerId) {
    const playerCells = this.getPlayerCells(playerId);
    if (playerCells.length === 0) return null;
    
    let closest = null;
    let minDist = Infinity;
    
    playerCells.forEach(({ x, y }) => {
      const dist = Math.abs(x - targetX) + Math.abs(y - targetY);
      if (dist < minDist) {
        minDist = dist;
        closest = { x, y, distance: dist };
      }
    });
    
    return closest;
  }

  floodFillExpansion(startX, startY, playerId, maxRadius, troopBudget) {
    const expanded = [];
    const visited = new Set();
    const queue = [{ x: startX, y: startY, dist: 0 }];
    visited.add(`${startX},${startY}`);
    
    let remainingBudget = troopBudget;
    
    while (queue.length > 0 && remainingBudget > 0) {
      const { x, y, dist } = queue.shift();
      
      const cell = this.getCell(x, y);
      if (!cell || cell.type !== 'land') continue;
      if (dist > maxRadius) continue;
      
      if (!cell.owner || cell.owner === playerId) {
        const cost = 1;
        
        if (remainingBudget >= cost) {
          if (!cell.owner) {
            cell.owner = playerId;
            cell.troops = 1;
            expanded.push({ x, y });
            remainingBudget -= cost;
          }
          
          const neighbors = this.getNeighbors(x, y, false);
          neighbors.forEach(n => {
            const key = `${n.x},${n.y}`;
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({ x: n.x, y: n.y, dist: dist + 1 });
            }
          });
        }
      }
    }
    
    return expanded;
  }

  isConnectedToTerritory(targetX, targetY, playerId) {
    const playerCells = this.getPlayerCells(playerId);
    if (playerCells.length === 0) return false;
    
    const visited = new Set();
    const queue = [{ x: targetX, y: targetY }];
    visited.add(`${targetX},${targetY}`);
    
    while (queue.length > 0) {
      const { x, y } = queue.shift();
      
      const cell = this.getCell(x, y);
      if (!cell) continue;
      
      if (cell.owner === playerId) return true;
      
      if (cell.type === 'land' && !cell.owner) {
        const neighbors = this.getNeighbors(x, y, false);
        neighbors.forEach(n => {
          const key = `${n.x},${n.y}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ x: n.x, y: n.y });
          }
        });
      }
    }
    
    return false;
  }

  isAdjacentToPlayer(x, y, playerId) {
    const neighbors = this.getNeighbors(x, y);
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

  placePlayerBase(x, y, playerId, radius = 3) {
    const placed = [];
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const cell = this.getCell(x + dx, y + dy);
          if (cell && cell.type === 'land') {
            cell.owner = playerId;
            cell.troops = 10; // Troupes de départ
            placed.push({ x: x + dx, y: y + dy });
          }
        }
      }
    }
    
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
        if (cell.type === 'land' || cell.owner) {
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
            Math.abs(current.troops - previous.troops) > 0.1 ||
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