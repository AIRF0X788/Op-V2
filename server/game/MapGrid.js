// server/game/MapGrid.js

class MapGrid {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.grid = [];
    this.cellSize = 10; // Taille d'une cellule en pixels d'affichage
    
    // Initialiser la grille
    this.initializeGrid();
  }

  initializeGrid() {
    for (let y = 0; y < this.height; y++) {
      this.grid[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.grid[y][x] = {
          x,
          y,
          type: 'water', // water, land, mountain
          owner: null,
          troops: 0,
          income: 1 // Revenu de base par cellule
        };
      }
    }
  }

  // Charger une carte simplifiée d'Europe
  loadEuropeMap() {
    // Simuler les contours de l'Europe (version simplifiée)
    // Dans une vraie implémentation, on chargerait une image ou des données GeoJSON
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // Zone de l'Europe approximative
        if (this.isEuropeLand(x, y)) {
          this.grid[y][x].type = 'land';
        }
      }
    }
  }

  isEuropeLand(x, y) {
    // Approximation simple des terres européennes
    // Dans une vraie implémentation, utiliser des données géographiques réelles
    
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // Forme grossière de l'Europe
    const distFromCenter = Math.sqrt(
      Math.pow((x - centerX) / this.width * 2, 2) + 
      Math.pow((y - centerY) / this.height * 2, 2)
    );
    
    // Créer une forme irrégulière
    const noise = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.3;
    
    // Europe approximative : zone centrale avec côtes irrégulières
    if (distFromCenter < 0.6 + noise) {
      // Exclure certaines zones (mer Méditerranée, etc.)
      if (y > this.height * 0.7 && x > this.width * 0.4 && x < this.width * 0.6) {
        return false; // Méditerranée
      }
      return true;
    }
    
    return false;
  }

  getCell(x, y) {
    if (y >= 0 && y < this.height && x >= 0 && x < this.width) {
      return this.grid[y][x];
    }
    return null;
  }

  setOwner(x, y, playerId) {
    const cell = this.getCell(x, y);
    if (cell && cell.type === 'land') {
      cell.owner = playerId;
    }
  }

  addTroops(x, y, count) {
    const cell = this.getCell(x, y);
    if (cell) {
      cell.troops += count;
    }
  }

  getNeighbors(x, y, includeDiagonals = true) {
    const neighbors = [];
    const directions = includeDiagonals 
      ? [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]]
      : [[-1, 0], [1, 0], [0, -1], [0, 1]];
    
    directions.forEach(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      const cell = this.getCell(nx, ny);
      if (cell) {
        neighbors.push({ x: nx, y: ny, cell });
      }
    });
    
    return neighbors;
  }

  // Vérifier si une cellule est adjacente à un territoire du joueur
  isAdjacentToPlayer(x, y, playerId) {
    const neighbors = this.getNeighbors(x, y);
    return neighbors.some(n => n.cell.owner === playerId);
  }

  // Obtenir toutes les cellules d'un joueur
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

  // Calculer le revenu total d'un joueur
  calculatePlayerIncome(playerId) {
    const cells = this.getPlayerCells(playerId);
    return cells.reduce((sum, c) => sum + c.cell.income, 0);
  }

  // Calculer les troupes totales d'un joueur
  calculatePlayerTroops(playerId) {
    const cells = this.getPlayerCells(playerId);
    return cells.reduce((sum, c) => sum + c.cell.troops, 0);
  }

  // Trouver une position de départ valide
  findValidStartPosition() {
    const attempts = 100;
    for (let i = 0; i < attempts; i++) {
      const x = Math.floor(Math.random() * this.width);
      const y = Math.floor(Math.random() * this.height);
      const cell = this.getCell(x, y);
      
      if (cell && cell.type === 'land' && !cell.owner) {
        // Vérifier qu'il y a assez d'espace autour
        const hasSpace = this.checkAreaFree(x, y, 5);
        if (hasSpace) {
          return { x, y };
        }
      }
    }
    return null;
  }

  checkAreaFree(centerX, centerY, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const cell = this.getCell(centerX + dx, centerY + dy);
        if (cell && cell.owner) {
          return false;
        }
      }
    }
    return true;
  }

  // Placer la base d'un joueur
  placePlayerBase(x, y, playerId, baseSize = 3) {
    const placed = [];
    
    for (let dy = -baseSize; dy <= baseSize; dy++) {
      for (let dx = -baseSize; dx <= baseSize; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        const cell = this.getCell(nx, ny);
        
        if (cell && cell.type === 'land') {
          cell.owner = playerId;
          cell.troops = 10; // Troupes de départ
          placed.push({ x: nx, y: ny });
        }
      }
    }
    
    return placed;
  }

  // Obtenir les données compressées pour l'envoi réseau
  getCompressedData() {
    const data = {
      width: this.width,
      height: this.height,
      cells: []
    };
    
    // N'envoyer que les cellules importantes (terres + occupées)
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.grid[y][x];
        if (cell.type !== 'water' || cell.owner) {
          data.cells.push({
            x,
            y,
            t: cell.type === 'land' ? 'l' : 'w',
            o: cell.owner,
            tr: cell.troops
          });
        }
      }
    }
    
    return data;
  }

  // Obtenir les changements depuis le dernier état
  getChanges(previousState) {
    const changes = [];
    
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const current = this.grid[y][x];
        const previous = previousState?.[y]?.[x];
        
        if (!previous || 
            current.owner !== previous.owner || 
            current.troops !== previous.troops) {
          changes.push({
            x,
            y,
            owner: current.owner,
            troops: current.troops
          });
        }
      }
    }
    
    return changes;
  }

  // Sérialiser l'état complet
  toJSON() {
    return {
      width: this.width,
      height: this.height,
      grid: this.grid
    };
  }

  // Copier l'état actuel
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