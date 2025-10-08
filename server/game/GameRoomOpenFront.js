const Player = require('./Player');
const MapGrid = require('./MapGrid');

class GameRoom {
  constructor(code, hostId, io) {
    this.code = code;
    this.hostId = hostId;
    this.io = io;
    this.players = new Map();
    this.gameState = 'lobby';
    this.tickRate = 100;
    this.gameLoop = null;
    this.startTime = null;
    this.tickCount = 0;
    
    this.mapGrid = new MapGrid(150, 100);
    this.mapGrid.loadEuropeMap();
    
    this.playersPlaced = new Set();
    this.previousGridState = null;
    
    this.config = {
      expandCost: 5,
      troopGeneration: 0.1,
      goldGeneration: 1,
      buildingCosts: {
        city: 500,
        port: 300,
        outpost: 200,
        barracks: 400
      },
      buildingBonuses: {
        city: { gold: 5, troops: 2 },
        port: { gold: 3, troops: 1 },
        outpost: { gold: 1, troops: 3 },
        barracks: { gold: 0, troops: 5 }
      },
      startingGold: 1000,
      startingTroops: 50,
      victoryThreshold: 0.8
    };
  }

  addPlayer(socketId, playerName) {
    const player = new Player(socketId, playerName);
    player.hasPlacedBase = false;
    player.baseX = null;
    player.baseY = null;
    player.gold = this.config.startingGold;
    this.players.set(socketId, player);
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      this.players.delete(socketId);
      this.playersPlaced.delete(socketId);
      
      const playerCells = this.mapGrid.getPlayerCells(socketId);
      playerCells.forEach(({ x, y }) => {
        const cell = this.mapGrid.getCell(x, y);
        cell.owner = null;
        cell.troops = 0;
        cell.building = null;
      });
    }
    
    return this.players.size === 0;
  }

  startGame() {
    if (this.gameState !== 'lobby') return false;
    
    this.gameState = 'placement';
    this.startTime = Date.now();
    
    return true;
  }

  placePlayerBase(playerId, x, y) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    if (player.hasPlacedBase) {
      return { success: false, reason: 'Base already placed' };
    }

    const cell = this.mapGrid.getCell(x, y);
    if (!cell || cell.type !== 'land') {
      return { success: false, reason: 'Invalid position' };
    }

    if (cell.owner) {
      return { success: false, reason: 'Position occupied' };
    }

    if (!this.mapGrid.checkAreaFree(x, y, 5)) {
      return { success: false, reason: 'Too close to another player' };
    }

    const placedCells = this.mapGrid.placePlayerBase(x, y, playerId, 2);
    
    placedCells.forEach(pos => {
      const c = this.mapGrid.getCell(pos.x, pos.y);
      c.troops = this.config.startingTroops / placedCells.length;
    });
    
    player.hasPlacedBase = true;
    player.baseX = x;
    player.baseY = y;
    this.playersPlaced.add(playerId);

    if (this.playersPlaced.size === this.players.size) {
      this.startPlayingPhase();
    }

    return { success: true, placedCells };
  }

  startPlayingPhase() {
    this.gameState = 'playing';
    this.previousGridState = this.mapGrid.clone();
    this.gameLoop = setInterval(() => this.tick(), this.tickRate);
    
    this.io.to(this.code).emit('phaseChanged', { phase: 'playing' });
  }

  tick() {
    this.tickCount++;
    
    if (this.tickCount % 10 === 0) {
      this.generateResources();
    }
    
    if (this.tickCount % 50 === 0) {
      this.checkVictory();
    }
    
    this.broadcastChanges();
  }

  generateResources() {
    this.players.forEach(player => {
      const cells = this.mapGrid.getPlayerCells(player.id);
      
      let goldPerSecond = 0;
      let troopsPerSecond = 0;
      
      cells.forEach(({ cell }) => {
        goldPerSecond += this.config.goldGeneration;
        troopsPerSecond += this.config.troopGeneration;
        
        if (cell.building) {
          const bonus = this.config.buildingBonuses[cell.building];
          if (bonus) {
            goldPerSecond += bonus.gold;
            troopsPerSecond += bonus.troops;
          }
        }
      });
      
      player.gold += goldPerSecond;
      player.income = goldPerSecond;
      
      const troopsPerCell = troopsPerSecond / cells.length;
      cells.forEach(({ cell }) => {
        cell.troops += troopsPerCell;
      });
      
      player.troops = this.mapGrid.calculatePlayerTroops(player.id);
    });
  }

  expandTerritory(playerId, targetX, targetY) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    const targetCell = this.mapGrid.getCell(targetX, targetY);
    if (!targetCell || targetCell.type !== 'land') {
      return { success: false, reason: 'Invalid position' };
    }

    if (!this.mapGrid.isAdjacentToPlayer(targetX, targetY, playerId)) {
      return { success: false, reason: 'Must be adjacent' };
    }

    if (targetCell.owner === playerId) {
      return { success: false, reason: 'Already owned' };
    }

    const adjacentTroops = this.getAdjacentTroops(targetX, targetY, playerId);
    const expandCost = this.config.expandCost;

    if (adjacentTroops < expandCost) {
      return { success: false, reason: 'Not enough adjacent troops' };
    }

    if (targetCell.owner && targetCell.owner !== playerId) {
      const defenderTroops = targetCell.troops;
      
      if (adjacentTroops - expandCost <= defenderTroops) {
        return { success: false, reason: 'Defense too strong' };
      }

      const survivingTroops = (adjacentTroops - expandCost) - defenderTroops;
      targetCell.owner = playerId;
      targetCell.troops = Math.max(1, survivingTroops * 0.7);
      targetCell.building = null;
      
      this.distributeTroopCost(targetX, targetY, playerId, expandCost + defenderTroops * 0.5);
      
      player.conquests++;
      
      return { success: true, conquered: true };
    } else {
      targetCell.owner = playerId;
      targetCell.troops = expandCost * 0.5;
      
      this.distributeTroopCost(targetX, targetY, playerId, expandCost);
      
      return { success: true, conquered: false };
    }
  }

  getAdjacentTroops(x, y, playerId) {
    const neighbors = this.mapGrid.getNeighbors(x, y);
    return neighbors
      .filter(n => n.cell.owner === playerId)
      .reduce((sum, n) => sum + n.cell.troops, 0);
  }

  distributeTroopCost(x, y, playerId, totalCost) {
    const neighbors = this.mapGrid.getNeighbors(x, y)
      .filter(n => n.cell.owner === playerId && n.cell.troops > 0);
    
    if (neighbors.length === 0) return;
    
    const totalTroops = neighbors.reduce((sum, n) => sum + n.cell.troops, 0);
    
    neighbors.forEach(n => {
      const proportion = n.cell.troops / totalTroops;
      const cost = totalCost * proportion;
      n.cell.troops = Math.max(0, n.cell.troops - cost);
    });
  }

  buildBuilding(playerId, x, y, buildingType) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }

    const cell = this.mapGrid.getCell(x, y);
    if (!cell || cell.owner !== playerId) {
      return { success: false, reason: 'Not your territory' };
    }

    if (cell.building) {
      return { success: false, reason: 'Building already exists' };
    }

    const cost = this.config.buildingCosts[buildingType];
    if (!cost) {
      return { success: false, reason: 'Invalid building type' };
    }

    if (player.gold < cost) {
      return { success: false, reason: 'Insufficient gold' };
    }

    if (buildingType === 'port' && !this.mapGrid.isCoastal(x, y)) {
      return { success: false, reason: 'Must be coastal' };
    }

    cell.building = buildingType;
    player.gold -= cost;

    return { success: true };
  }

  checkVictory() {
    let totalLand = 0;
    const playerCounts = new Map();
    
    for (let y = 0; y < this.mapGrid.height; y++) {
      for (let x = 0; x < this.mapGrid.width; x++) {
        const cell = this.mapGrid.grid[y][x];
        if (cell.type === 'land') {
          totalLand++;
          if (cell.owner) {
            playerCounts.set(
              cell.owner,
              (playerCounts.get(cell.owner) || 0) + 1
            );
          }
        }
      }
    }

    const victoryThreshold = totalLand * this.config.victoryThreshold;
    
    for (let [playerId, count] of playerCounts) {
      if (count >= victoryThreshold) {
        this.onVictory(playerId);
        return;
      }
    }
  }

  onVictory(winnerId) {
    this.stopGame();
    
    const winner = this.players.get(winnerId);
    
    this.io.to(this.code).emit('gameOver', {
      winner: {
        id: winner.id,
        name: winner.name
      },
      duration: Date.now() - this.startTime,
      stats: this.getGameStats()
    });
  }

  getGameStats() {
    return Array.from(this.players.values()).map(player => {
      const cells = this.mapGrid.getPlayerCells(player.id);
      const buildings = cells.filter(c => c.cell.building).length;
      
      return {
        id: player.id,
        name: player.name,
        cells: cells.length,
        troops: Math.floor(player.troops),
        gold: Math.floor(player.gold),
        income: Math.floor(player.income),
        buildings: buildings,
        conquests: player.conquests
      };
    }).sort((a, b) => b.cells - a.cells);
  }

  stopGame() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    this.gameState = 'finished';
  }

  broadcastChanges() {
    const changes = this.mapGrid.getChanges(this.previousGridState?.grid);
    
    if (changes.length > 0) {
      this.io.to(this.code).emit('gridUpdate', {
        changes,
        players: this.getPlayersState()
      });
      
      this.previousGridState = this.mapGrid.clone();
    }
  }

  getPlayersState() {
    return Array.from(this.players.values()).map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      gold: Math.floor(p.gold),
      income: Math.floor(p.income),
      troops: Math.floor(p.troops),
      baseX: p.baseX,
      baseY: p.baseY,
      conquests: p.conquests
    }));
  }

  getState() {
    return {
      code: this.code,
      hostId: this.hostId,
      gameState: this.gameState,
      tickCount: this.tickCount,
      players: this.getPlayersState(),
      mapData: this.mapGrid.getCompressedData(),
      playersPlaced: Array.from(this.playersPlaced)
    };
  }
}

module.exports = GameRoom;