// server/game/GameRoomOpenFront.js
const Player = require('./Player');
const Bot = require('./Bot');
const MapGrid = require('./MapGrid');

class GameRoomOpenFront {
  constructor(code, hostId, io) {
    this.code = code;
    this.hostId = hostId;
    this.io = io;
    this.players = new Map();
    this.bots = new Map();
    this.gameState = 'lobby'; // lobby, placement, playing, finished
    this.tickRate = 100; // 100ms par tick (10 ticks/seconde)
    this.gameLoop = null;
    this.startTime = null;
    this.tickCount = 0;
    
    // Carte de jeu
    this.mapGrid = new MapGrid(150, 100); // 150x100 cellules
    this.mapGrid.loadEuropeMap();
    
    // Suivi des placements
    this.playersPlaced = new Set();
    
    // État précédent pour détecter les changements
    this.previousGridState = null;
  }

  addPlayer(socketId, playerName) {
    const player = new Player(socketId, playerName);
    player.hasPlacedBase = false;
    player.baseX = null;
    player.baseY = null;
    this.players.set(socketId, player);
    console.log(`Joueur ${playerName} ajouté à la room ${this.code}`);
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      console.log(`Joueur ${player.name} retiré de la room ${this.code}`);
      this.players.delete(socketId);
      this.playersPlaced.delete(socketId);
      
      // Rendre les cellules du joueur neutres
      const playerCells = this.mapGrid.getPlayerCells(socketId);
      playerCells.forEach(({ x, y }) => {
        const cell = this.mapGrid.getCell(x, y);
        cell.owner = null;
        cell.troops = 0;
      });
    }
    
    return this.players.size === 0;
  }

  startGame() {
    if (this.gameState !== 'lobby') {
      console.log('La partie a déjà commencé');
      return false;
    }
    
    // Passer en phase de placement
    this.gameState = 'placement';
    this.startTime = Date.now();
    
    console.log(`Phase de placement démarrée dans la room ${this.code}`);
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
    if (!cell) {
      return { success: false, reason: 'Position invalide' };
    }

    if (cell.type !== 'land') {
      return { success: false, reason: 'Doit être sur la terre' };
    }

    if (cell.owner) {
      return { success: false, reason: 'Position occupée' };
    }

    // Vérifier qu'il y a assez d'espace
    if (!this.mapGrid.checkAreaFree(x, y, 5)) {
      return { success: false, reason: 'Trop proche d\'un autre joueur' };
    }

    // Placer la base
    const placedCells = this.mapGrid.placePlayerBase(x, y, playerId, 3);
    
    player.hasPlacedBase = true;
    player.baseX = x;
    player.baseY = y;
    this.playersPlaced.add(playerId);

    console.log(`${player.name} a placé sa base en (${x}, ${y})`);

    // Vérifier si tous les joueurs ont placé
    if (this.playersPlaced.size === this.players.size) {
      this.startPlayingPhase();
    }

    return { success: true, placedCells };
  }

  startPlayingPhase() {
    this.gameState = 'playing';
    this.previousGridState = this.mapGrid.clone();
    this.gameLoop = setInterval(() => this.tick(), this.tickRate);
    
    console.log(`Phase de jeu démarrée dans la room ${this.code}`);
    this.io.to(this.code).emit('phaseChanged', { phase: 'playing' });
  }

  tick() {
    this.tickCount++;
    
    // Génération de revenus (tous les 10 ticks = 1 seconde)
    if (this.tickCount % 10 === 0) {
      this.generateIncome();
    }
    
    // IA des bots (moins fréquent)
    if (this.tickCount % 30 === 0) {
      this.updateBots();
    }
    
    // Vérifier la condition de victoire
    if (this.tickCount % 50 === 0) {
      this.checkVictory();
    }
    
    // Envoyer uniquement les changements
    this.broadcastChanges();
  }

  generateIncome() {
    const allPlayers = [
      ...Array.from(this.players.values()),
      ...Array.from(this.bots.values())
    ];
    
    allPlayers.forEach(player => {
      const income = this.mapGrid.calculatePlayerIncome(player.id);
      const troops = this.mapGrid.calculatePlayerTroops(player.id);
      
      player.gold += income / 10; // Revenu par seconde / 10 ticks
      player.income = income;
      player.troops = troops;
    });
  }

  updateBots() {
    // TODO: Implémenter l'IA des bots pour le système de grille
  }

  expandTerritory(playerId, targetX, targetY) {
    const player = this.players.get(playerId) || this.bots.get(playerId);
    if (!player) {
      return { success: false, reason: 'Joueur non trouvé' };
    }

    const targetCell = this.mapGrid.getCell(targetX, targetY);
    if (!targetCell) {
      return { success: false, reason: 'Position invalide' };
    }

    if (targetCell.type !== 'land') {
      return { success: false, reason: 'Doit être sur la terre' };
    }

    // Vérifier l'adjacence
    if (!this.mapGrid.isAdjacentToPlayer(targetX, targetY, playerId)) {
      return { success: false, reason: 'Doit être adjacent à votre territoire' };
    }

    // Coût d'expansion
    const cost = 50;
    if (player.gold < cost) {
      return { success: false, reason: 'Or insuffisant' };
    }

    // Si la cellule appartient à quelqu'un d'autre
    if (targetCell.owner && targetCell.owner !== playerId) {
      // Combat nécessaire
      const attackerPower = this.getAdjacentTroops(targetX, targetY, playerId);
      const defenderPower = targetCell.troops;

      if (attackerPower <= defenderPower) {
        return { success: false, reason: 'Pas assez de troupes adjacentes' };
      }

      // Victoire - prendre la cellule
      const losses = Math.floor(defenderPower * 0.7);
      targetCell.owner = playerId;
      targetCell.troops = Math.floor((attackerPower - defenderPower) * 0.5);
      
      // Retirer les pertes des cellules adjacentes
      this.distributeLosses(targetX, targetY, playerId, losses);

      player.gold -= cost;
      player.conquests++;

      return { success: true, conquered: true };
    } else {
      // Cellule neutre ou vide
      targetCell.owner = playerId;
      targetCell.troops = 5;
      player.gold -= cost;

      return { success: true, conquered: false };
    }
  }

  getAdjacentTroops(x, y, playerId) {
    const neighbors = this.mapGrid.getNeighbors(x, y);
    return neighbors
      .filter(n => n.cell.owner === playerId)
      .reduce((sum, n) => sum + n.cell.troops, 0);
  }

  distributeLosses(x, y, playerId, totalLosses) {
    const neighbors = this.mapGrid.getNeighbors(x, y)
      .filter(n => n.cell.owner === playerId && n.cell.troops > 0);
    
    if (neighbors.length === 0) return;
    
    const lossPerCell = Math.floor(totalLosses / neighbors.length);
    neighbors.forEach(n => {
      n.cell.troops = Math.max(0, n.cell.troops - lossPerCell);
    });
  }

  reinforceCell(playerId, x, y, troopCount) {
    const player = this.players.get(playerId) || this.bots.get(playerId);
    if (!player) {
      return { success: false, reason: 'Joueur non trouvé' };
    }

    const cell = this.mapGrid.getCell(x, y);
    if (!cell || cell.owner !== playerId) {
      return { success: false, reason: 'Pas votre territoire' };
    }

    const cost = troopCount * 10;
    if (player.gold < cost) {
      return { success: false, reason: 'Or insuffisant' };
    }

    cell.troops += troopCount;
    player.gold -= cost;

    return { success: true };
  }

  checkVictory() {
    const playerCounts = new Map();
    
    for (let y = 0; y < this.mapGrid.height; y++) {
      for (let x = 0; x < this.mapGrid.width; x++) {
        const cell = this.mapGrid.grid[y][x];
        if (cell.type === 'land' && cell.owner) {
          playerCounts.set(
            cell.owner,
            (playerCounts.get(cell.owner) || 0) + 1
          );
        }
      }
    }

    // Compter le total de terres disponibles
    let totalLandCells = 0;
    for (let y = 0; y < this.mapGrid.height; y++) {
      for (let x = 0; x < this.mapGrid.width; x++) {
        if (this.mapGrid.grid[y][x].type === 'land') {
          totalLandCells++;
        }
      }
    }

    // Victoire si un joueur possède > 80% des terres
    const victoryThreshold = totalLandCells * 0.8;
    
    for (let [playerId, count] of playerCounts) {
      if (count >= victoryThreshold) {
        this.onVictory(playerId);
        return;
      }
    }
  }

  onVictory(winnerId) {
    this.stopGame();
    
    const winner = this.players.get(winnerId) || this.bots.get(winnerId);
    
    console.log(`🏆 ${winner.name} a gagné la partie dans la room ${this.code}!`);
    
    this.io.to(this.code).emit('gameOver', {
      winner: {
        id: winner.id,
        name: winner.name,
        isBot: winner.isBot
      },
      duration: Date.now() - this.startTime,
      stats: this.getGameStats()
    });
  }

  getGameStats() {
    const allPlayers = [
      ...Array.from(this.players.values()),
      ...Array.from(this.bots.values())
    ];
    
    return allPlayers.map(player => {
      const cellsOwned = this.mapGrid.getPlayerCells(player.id).length;
      
      return {
        id: player.id,
        name: player.name,
        cells: cellsOwned,
        troops: player.troops,
        gold: Math.floor(player.gold),
        income: Math.floor(player.income),
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
    console.log(`Partie terminée dans la room ${this.code}`);
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

  broadcastFullState() {
    const state = this.getState();
    this.io.to(this.code).emit('fullState', state);
  }

  getPlayersState() {
    return Array.from(this.players.values()).map(p => p.toJSON());
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