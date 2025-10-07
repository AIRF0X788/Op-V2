// server/game/GameRoomOpenFront.js
const Player = require('./Player');
const MapGrid = require('./MapGrid');

class GameRoomOpenFront {
  constructor(code, hostId, io) {
    this.code = code;
    this.hostId = hostId;
    this.io = io;
    this.players = new Map();
    this.gameState = 'lobby'; // lobby, placement, playing, finished
    this.tickRate = 100; // 100ms par tick
    this.gameLoop = null;
    this.startTime = null;
    this.tickCount = 0;
    
    // Carte
    this.mapGrid = new MapGrid(150, 100);
    this.mapGrid.loadEuropeMap();
    
    // Suivi
    this.playersPlaced = new Set();
    this.previousGridState = null;
    
    // Configuration du jeu (style OpenFront)
    this.config = {
      expandCost: 5, // Troupes nécessaires pour étendre
      troopGeneration: 0.1, // Troupes générées par cellule/tick
      goldGeneration: 1, // Or par cellule/seconde
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
      victoryThreshold: 0.8 // 80% de la carte
    };
  }

  addPlayer(socketId, playerName) {
    const player = new Player(socketId, playerName);
    player.hasPlacedBase = false;
    player.baseX = null;
    player.baseY = null;
    player.gold = this.config.startingGold;
    this.players.set(socketId, player);
    console.log(`Joueur ${playerName} ajouté`);
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      this.players.delete(socketId);
      this.playersPlaced.delete(socketId);
      
      // Rendre les cellules neutres
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
    
    console.log(`Phase de placement démarrée`);
    return true;
  }

  placePlayerBase(playerId, x, y) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'Joueur non trouvé' };
    }

    if (player.hasPlacedBase) {
      return { success: false, reason: 'Base déjà placée' };
    }

    const cell = this.mapGrid.getCell(x, y);
    if (!cell || cell.type !== 'land') {
      return { success: false, reason: 'Position invalide' };
    }

    if (cell.owner) {
      return { success: false, reason: 'Position occupée' };
    }

    // Vérifier l'espace
    if (!this.mapGrid.checkAreaFree(x, y, 5)) {
      return { success: false, reason: 'Trop proche d\'un autre joueur' };
    }

    // Placer la base avec rayon de 2
    const placedCells = this.mapGrid.placePlayerBase(x, y, playerId, 2);
    
    // Donner les troupes initiales
    placedCells.forEach(pos => {
      const c = this.mapGrid.getCell(pos.x, pos.y);
      c.troops = this.config.startingTroops / placedCells.length;
    });
    
    player.hasPlacedBase = true;
    player.baseX = x;
    player.baseY = y;
    this.playersPlaced.add(playerId);

    // Tous placés ?
    if (this.playersPlaced.size === this.players.size) {
      this.startPlayingPhase();
    }

    return { success: true, placedCells };
  }

  startPlayingPhase() {
    this.gameState = 'playing';
    this.previousGridState = this.mapGrid.clone();
    this.gameLoop = setInterval(() => this.tick(), this.tickRate);
    
    console.log(`Phase de jeu démarrée`);
    this.io.to(this.code).emit('phaseChanged', { phase: 'playing' });
  }

  tick() {
    this.tickCount++;
    
    // Génération de ressources (tous les 10 ticks = 1 seconde)
    if (this.tickCount % 10 === 0) {
      this.generateResources();
    }
    
    // Vérifier victoire (tous les 5 secondes)
    if (this.tickCount % 50 === 0) {
      this.checkVictory();
    }
    
    // Broadcast changes
    this.broadcastChanges();
  }

  generateResources() {
    this.players.forEach(player => {
      const cells = this.mapGrid.getPlayerCells(player.id);
      
      let goldPerSecond = 0;
      let troopsPerSecond = 0;
      
      cells.forEach(({ cell }) => {
        // Or de base
        goldPerSecond += this.config.goldGeneration;
        
        // Troupes de base
        troopsPerSecond += this.config.troopGeneration;
        
        // Bonus des bâtiments
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
      
      // Distribuer les troupes sur les cellules
      const troopsPerCell = troopsPerSecond / cells.length;
      cells.forEach(({ cell }) => {
        cell.troops += troopsPerCell;
      });
      
      player.troops = this.mapGrid.calculatePlayerTroops(player.id);
    });
  }

  // Extension de territoire (gameplay OpenFront)
  expandTerritory(playerId, targetX, targetY) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'Joueur non trouvé' };
    }

    const targetCell = this.mapGrid.getCell(targetX, targetY);
    if (!targetCell || targetCell.type !== 'land') {
      return { success: false, reason: 'Position invalide' };
    }

    // Vérifier adjacence
    if (!this.mapGrid.isAdjacentToPlayer(targetX, targetY, playerId)) {
      return { success: false, reason: 'Doit être adjacent' };
    }

    // Cellule déjà possédée
    if (targetCell.owner === playerId) {
      return { success: false, reason: 'Déjà possédé' };
    }

    // Obtenir troupes adjacentes
    const adjacentTroops = this.getAdjacentTroops(targetX, targetY, playerId);
    const expandCost = this.config.expandCost;

    if (adjacentTroops < expandCost) {
      return { success: false, reason: 'Pas assez de troupes adjacentes' };
    }

    // Si occupé par un ennemi
    if (targetCell.owner && targetCell.owner !== playerId) {
      const defenderTroops = targetCell.troops;
      
      // Combat : attaquant doit avoir plus de troupes
      if (adjacentTroops - expandCost <= defenderTroops) {
        return { success: false, reason: 'Défense trop forte' };
      }

      // Victoire
      const survivingTroops = (adjacentTroops - expandCost) - defenderTroops;
      targetCell.owner = playerId;
      targetCell.troops = Math.max(1, survivingTroops * 0.7);
      targetCell.building = null; // Bâtiment détruit
      
      // Retirer les troupes utilisées
      this.distributeTroopCost(targetX, targetY, playerId, expandCost + defenderTroops * 0.5);
      
      player.conquests++;
      
      return { success: true, conquered: true };
    } else {
      // Cellule neutre
      targetCell.owner = playerId;
      targetCell.troops = expandCost * 0.5;
      
      // Retirer les troupes
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
    
    // Répartir proportionnellement
    const totalTroops = neighbors.reduce((sum, n) => sum + n.cell.troops, 0);
    
    neighbors.forEach(n => {
      const proportion = n.cell.troops / totalTroops;
      const cost = totalCost * proportion;
      n.cell.troops = Math.max(0, n.cell.troops - cost);
    });
  }

  // Construire un bâtiment
  buildBuilding(playerId, x, y, buildingType) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'Joueur non trouvé' };
    }

    const cell = this.mapGrid.getCell(x, y);
    if (!cell || cell.owner !== playerId) {
      return { success: false, reason: 'Pas votre territoire' };
    }

    if (cell.building) {
      return { success: false, reason: 'Bâtiment déjà présent' };
    }

    const cost = this.config.buildingCosts[buildingType];
    if (!cost) {
      return { success: false, reason: 'Type de bâtiment invalide' };
    }

    if (player.gold < cost) {
      return { success: false, reason: 'Or insuffisant' };
    }

    // Restrictions spécifiques
    if (buildingType === 'port' && !this.mapGrid.isCoastal(x, y)) {
      return { success: false, reason: 'Doit être côtier' };
    }

    // Construire
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

module.exports = GameRoomOpenFront;