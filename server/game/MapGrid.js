class MapGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.pixelSize = 4; // Taille d'un "pixel" de terrain
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
          lastUpdate: 0
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
    x = Math.floor(x);
    y = Math.floor(y);
    if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
      return this.grid[y][x];
    }
    return null;
  }

  getNeighbors(x, y, includeDiagonals = true) {
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
    const neighbors = this.getNeighbors(x, y, true);
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

  getPlayerBorderCells(playerId) {
    const cells = [];
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.grid[y][x].owner === playerId) {
          const neighbors = this.getNeighbors(x, y, true);
          const isBorder = neighbors.some(n => 
            n.cell.type === 'land' && n.cell.owner !== playerId
          );
          if (isBorder) {
            cells.push({ x, y, cell: this.grid[y][x] });
          }
        }
      }
    }
    return cells;
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
            cell.lastUpdate = Date.now();
            placed.push({ x: x + dx, y: y + dy });
          }
        }
      }
    }
    
    return placed;
  }

  // Expansion continue basée sur les troupes
  expandTerritory(playerId, targetX, targetY, troops, excludeAllies = []) {
    const startCell = this.getCell(targetX, targetY);
    if (!startCell || startCell.type !== 'land') {
      return { success: false, reason: 'Invalid target', captured: [] };
    }

    // Si c'est un territoire ennemi
    if (startCell.owner && startCell.owner !== playerId) {
      if (excludeAllies.includes(startCell.owner)) {
        return { success: false, reason: 'Cannot attack ally', captured: [] };
      }
    }

    const captured = [];
    const queue = [{ x: targetX, y: targetY }];
    const visited = new Set([`${targetX},${targetY}`]);
    let remainingTroops = troops;

    while (queue.length > 0 && remainingTroops > 0) {
      const current = queue.shift();
      const cell = this.getCell(current.x, current.y);

      if (!cell || cell.type !== 'land') continue;

      // Si déjà à nous, on continue
      if (cell.owner === playerId) {
        const neighbors = this.getNeighbors(current.x, current.y, true);
        neighbors.forEach(n => {
          const key = `${n.x},${n.y}`;
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ x: n.x, y: n.y });
          }
        });
        continue;
      }

      // Si c'est un territoire ennemi ou allié (protégé)
      if (cell.owner) {
        if (excludeAllies.includes(cell.owner)) {
          continue; // On ne peut pas conquérir un allié
        }
        // Combat - coûte plus de troupes
        const cost = 2;
        if (remainingTroops >= cost) {
          remainingTroops -= cost;
        } else {
          continue;
        }
      } else {
        // Territoire neutre - coûte 1 troupe
        remainingTroops -= 1;
      }

      // Capture
      const previousOwner = cell.owner;
      cell.owner = playerId;
      cell.lastUpdate = Date.now();
      captured.push({ 
        x: current.x, 
        y: current.y, 
        previousOwner 
      });

      // Ajouter les voisins à la queue
      const neighbors = this.getNeighbors(current.x, current.y, true);
      neighbors.forEach(n => {
        const key = `${n.x},${n.y}`;
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ x: n.x, y: n.y });
        }
      });
    }

    return { 
      success: captured.length > 0, 
      captured,
      troopsUsed: troops - remainingTroops,
      remainingTroops
    };
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
          o: cell.owner
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
        
        if (!previous || current.owner !== previous.owner) {
          changes.push({
            x,
            y,
            owner: current.owner
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