// server/game/GameRoom.js (remplacer l'ancien)
const Player = require('./Player');
const Bot = require('./Bot');
const BotAI = require('./BotAI');
const MapGrid = require('./MapGrid');

class GameRoom {
  constructor(code, hostId, io) {
    this.code = code;
    this.hostId = hostId;
    this.io = io;
    this.players = new Map();
    this.bots = new Map();
    this.botAIs = new Map();
    this.gameState = 'lobby';
    this.tickRate = 100;
    this.gameLoop = null;
    this.startTime = null;
    this.tickCount = 0;
    this.mapGrid = new MapGrid(150, 100);
    this.mapGrid.loadEuropeMap();
    this.playersPlaced = new Set();
    this.previousGridState = null;
    this.alliances = new Map();
    this.allianceRequests = new Map();
    this.tradeOffers = new Map();
    this.nextTradeId = 1;
    this.config = {
      expandCost: 5,
      troopGeneration: 0.1,
      goldGeneration: 1,
      reinforceCostPerTroop: 10,
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
      victoryThreshold: 0.8,
      minBots: 3,
      maxBots: 6
    };
  }

  addPlayer(socketId, playerName) {
    const player = new Player(socketId, playerName);
    player.hasPlacedBase = false;
    player.baseX = null;
    player.baseY = null;
    player.gold = this.config.startingGold;
    this.players.set(socketId, player);
    this.alliances.set(socketId, new Set());
    return player;
  }

  addBot(difficulty = 'medium') {
    const botNames = [
      'Napoleon', 'Caesar', 'Alexander', 'Genghis', 'Cleopatra',
      'Charlemagne', 'Hannibal', 'Sun Tzu', 'Bismarck', 'Churchill',
      'Catherine', 'Augustus', 'Saladin', 'Richard', 'Frederick',
      'Victoria', 'Peter', 'Louis XIV', 'Ivan', 'Suleiman'
    ];
    const availableNames = botNames.filter(name => 
      !Array.from(this.bots.values()).some(bot => bot.name === name)
    );
    if (availableNames.length === 0) return null;
    const botName = availableNames[Math.floor(Math.random() * availableNames.length)];
    const botId = `bot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const bot = new Bot(botId, botName, difficulty);
    bot.hasPlacedBase = false;
    bot.baseX = null;
    bot.baseY = null;
    this.bots.set(botId, bot);
    this.players.set(botId, bot);
    this.alliances.set(botId, new Set());
    const botAI = new BotAI(bot, this, difficulty);
    this.botAIs.set(botId, botAI);
    return bot;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      const playerCells = this.mapGrid.getPlayerCells(socketId);
      playerCells.forEach(({ x, y }) => {
        const cell = this.mapGrid.getCell(x, y);
        cell.owner = null;
        cell.troops = 0;
        cell.building = null;
      });
      this.alliances.delete(socketId);
      this.alliances.forEach(allies => allies.delete(socketId));
      this.players.delete(socketId);
      this.playersPlaced.delete(socketId);
      if (this.bots.has(socketId)) {
        this.bots.delete(socketId);
        this.botAIs.delete(socketId);
      }
    }
    return this.players.size === 0;
  }

  startGame() {
    if (this.gameState !== 'lobby') return false;
    const humanPlayers = Array.from(this.players.values()).filter(p => !p.isBot).length;
    const currentBots = this.bots.size;
    const totalPlayers = this.players.size;
    if (totalPlayers < this.config.minBots + humanPlayers) {
      const botsToAdd = Math.min(
        this.config.maxBots - currentBots,
        this.config.minBots + humanPlayers - totalPlayers
      );
      for (let i = 0; i < botsToAdd; i++) {
        const difficulties = ['easy', 'medium', 'hard'];
        const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
        this.addBot(difficulty);
      }
    }
    this.gameState = 'placement';
    this.startTime = Date.now();
    setTimeout(() => this.placeBotBases(), 1000);
    return true;
  }

  placeBotBases() {
    this.bots.forEach(bot => {
      if (!bot.hasPlacedBase) {
        let attempts = 0;
        let placed = false;
        while (!placed && attempts < 100) {
          const x = Math.floor(Math.random() * this.mapGrid.width);
          const y = Math.floor(Math.random() * this.mapGrid.height);
          const result = this.placePlayerBase(bot.id, x, y);
          if (result.success) {
            placed = true;
            console.log(`🤖 Bot ${bot.name} placed base at (${x}, ${y})`);
          }
          attempts++;
        }
      }
    });
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
      this.botAIs.forEach(botAI => botAI.think());
    }
    if (this.tickCount % 10 === 0) {
      this.generateResources();
    }
    if (this.tickCount % 50 === 0) {
      this.checkVictory();
    }
    if (this.tickCount % 100 === 0) {
      this.cleanupOldAllianceRequests();
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
      const allyCount = this.alliances.get(player.id)?.size || 0;
      const allianceBonus = 1 + (allyCount * 0.1);
      goldPerSecond *= allianceBonus;
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
    if (targetCell.owner && this.areAllied(playerId, targetCell.owner)) {
      return { success: false, reason: 'Cannot attack ally' };
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
      const defender = this.players.get(targetCell.owner);
      if (defender) {
        defender.kills++;
        this.io.to(this.code).emit('combatEvent', {
          attacker: player.name,
          defender: defender.name,
          x: targetX,
          y: targetY,
          result: 'captured'
        });
      }
      targetCell.owner = playerId;
      targetCell.troops = Math.max(1, survivingTroops * 0.7);
      targetCell.building = null;
      this.distributeTroopCost(targetX, targetY, playerId, expandCost + defenderTroops * 0.5);
      player.conquests++;
      return { success: true, conquered: true, message: `Conquered from ${defender?.name}!` };
    } else {
      targetCell.owner = playerId;
      targetCell.troops = expandCost * 0.5;
      this.distributeTroopCost(targetX, targetY, playerId, expandCost);
      return { success: true, conquered: false };
    }
  }

  reinforceCell(playerId, x, y, troopCount) {
    const player = this.players.get(playerId);
    if (!player) {
      return { success: false, reason: 'Player not found' };
    }
    const cell = this.mapGrid.getCell(x, y);
    if (!cell || cell.owner !== playerId) {
      return { success: false, reason: 'Not your territory' };
    }
    const cost = troopCount * this.config.reinforceCostPerTroop;
    if (player.gold < cost) {
      return { success: false, reason: 'Insufficient gold' };
    }
    cell.troops += troopCount;
    player.gold -= cost;
    return { success: true, message: `+${troopCount} troops deployed` };
  }

  getAdjacentTroops(x, y, playerId) {
    const neighbors = this.mapGrid.getNeighbors(x, y);
    let totalTroops = 0;
    neighbors.forEach(n => {
      if (n.cell.owner === playerId) {
        totalTroops += n.cell.troops;
      }
      else if (n.cell.owner && this.areAllied(playerId, n.cell.owner)) {
        totalTroops += n.cell.troops * 0.5;
      }
    });
    return totalTroops;
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
    return { success: true, message: `${buildingType} built!` };
  }

  proposeAlliance(fromId, toId) {
    if (fromId === toId) {
      return { success: false, reason: 'Cannot ally with yourself' };
    }
    if (this.areAllied(fromId, toId)) {
      return { success: false, reason: 'Already allied' };
    }
    if (!this.allianceRequests.has(fromId)) {
      this.allianceRequests.set(fromId, new Map());
    }
    this.allianceRequests.get(fromId).set(toId, Date.now());
    if (this.allianceRequests.has(toId) && this.allianceRequests.get(toId).has(fromId)) {
      this.createAlliance(fromId, toId);
      return { success: true, message: 'Alliance formed!' };
    }
    const fromPlayer = this.players.get(fromId);
    const toPlayer = this.players.get(toId);
    if (toPlayer && !toPlayer.isBot) {
      this.io.to(toId).emit('allianceProposal', {
        from: fromPlayer.name,
        fromId: fromId
      });
    }
    if (toPlayer && toPlayer.isBot) {
      const botAI = this.botAIs.get(toId);
      if (botAI && Math.random() < botAI.params.allianceProbability) {
        setTimeout(() => {
          this.proposeAlliance(toId, fromId);
        }, 2000);
      }
    }
    return { success: true, message: 'Alliance proposed' };
  }

  createAlliance(player1Id, player2Id) {
    this.alliances.get(player1Id).add(player2Id);
    this.alliances.get(player2Id).add(player1Id);
    const player1 = this.players.get(player1Id);
    const player2 = this.players.get(player2Id);
    if (player1 && player2) {
      player1.addAlliance(player2Id);
      player2.addAlliance(player1Id);
      this.io.to(this.code).emit('allianceFormed', {
        players: [player1.name, player2.name]
      });
    }
    if (this.allianceRequests.has(player1Id)) {
      this.allianceRequests.get(player1Id).delete(player2Id);
    }
    if (this.allianceRequests.has(player2Id)) {
      this.allianceRequests.get(player2Id).delete(player1Id);
    }
  }

  breakAlliance(player1Id, player2Id) {
    if (!this.areAllied(player1Id, player2Id)) {
      return { success: false, reason: 'Not allied' };
    }
    this.alliances.get(player1Id).delete(player2Id);
    this.alliances.get(player2Id).delete(player1Id);
    const player1 = this.players.get(player1Id);
    const player2 = this.players.get(player2Id);
    if (player1 && player2) {
      player1.removeAlliance(player2Id);
      player2.removeAlliance(player1Id);
      this.io.to(this.code).emit('allianceBroken', {
        players: [player1.name, player2.name]
      });
    }
    return { success: true, message: 'Alliance broken' };
  }

  areAllied(player1Id, player2Id) {
    return this.alliances.get(player1Id)?.has(player2Id) || false;
  }

  createTradeOffer(fromId, toId, offer) {
    const tradeId = this.nextTradeId++;
    const trade = {
      id: tradeId,
      from: fromId,
      to: toId,
      offerGold: offer.gold || 0,
      offerTroops: offer.troops || 0,
      requestGold: offer.requestGold || 0,
      requestTroops: offer.requestTroops || 0,
      timestamp: Date.now()
    };
    this.tradeOffers.set(tradeId, trade);
    const fromPlayer = this.players.get(fromId);
    const toPlayer = this.players.get(toId);
    if (toPlayer && !toPlayer.isBot) {
      this.io.to(toId).emit('tradeOffer', {
        ...trade,
        fromName: fromPlayer.name
      });
    }
    if (toPlayer && toPlayer.isBot) {
      setTimeout(() => {
        const accept = Math.random() < 0.5;
        if (accept) {
          this.acceptTrade(tradeId, toId);
        } else {
          this.rejectTrade(tradeId, toId);
        }
      }, 3000);
    }
    return { success: true, tradeId };
  }

  acceptTrade(tradeId, acceptingPlayerId) {
    const trade = this.tradeOffers.get(tradeId);
    if (!trade || trade.to !== acceptingPlayerId) {
      return { success: false, reason: 'Invalid trade' };
    }
    const fromPlayer = this.players.get(trade.from);
    const toPlayer = this.players.get(trade.to);
    if (fromPlayer.gold < trade.offerGold) {
      return { success: false, reason: 'Offerer insufficient gold' };
    }
    if (toPlayer.gold < trade.requestGold) {
      return { success: false, reason: 'Your insufficient gold' };
    }
    fromPlayer.gold -= trade.offerGold;
    fromPlayer.gold += trade.requestGold;
    toPlayer.gold += trade.offerGold;
    toPlayer.gold -= trade.requestGold;
    this.tradeOffers.delete(tradeId);
    this.io.to(this.code).emit('tradeCompleted', {
      between: [fromPlayer.name, toPlayer.name]
    });
    return { success: true, message: 'Trade completed' };
  }

  rejectTrade(tradeId, rejectingPlayerId) {
    const trade = this.tradeOffers.get(tradeId);
    if (!trade || trade.to !== rejectingPlayerId) {
      return { success: false, reason: 'Invalid trade' };
    }
    this.tradeOffers.delete(tradeId);
    return { success: true, message: 'Trade rejected' };
  }

  tradeSoldGold(fromId, toId, amount) {
    const fromPlayer = this.players.get(fromId);
    const toPlayer = this.players.get(toId);
    if (!fromPlayer || !toPlayer) {
      return { success: false, reason: 'Player not found' };
    }
    if (fromPlayer.gold < amount) {
      return { success: false, reason: 'Insufficient gold' };
    }
    fromPlayer.gold -= amount;
    toPlayer.gold += amount;
    return { success: true };
  }

  cleanupOldAllianceRequests() {
    const now = Date.now();
    const timeout = 60000;
    this.allianceRequests.forEach((requests, fromId) => {
      requests.forEach((timestamp, toId) => {
        if (now - timestamp > timeout) {
          requests.delete(toId);
        }
      });
    });
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
    const activePlayers = Array.from(playerCounts.keys());
    if (activePlayers.length === 1) {
      this.onVictory(activePlayers[0]);
    }
  }

  onVictory(winnerId) {
    this.stopGame();
    const winner = this.players.get(winnerId);
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
    return Array.from(this.players.values()).map(player => {
      const cells = this.mapGrid.getPlayerCells(player.id);
      const buildings = cells.filter(c => c.cell.building).length;
      return {
        id: player.id,
        name: player.name,
        isBot: player.isBot,
        cells: cells.length,
        troops: Math.floor(player.troops),
        gold: Math.floor(player.gold),
        income: Math.floor(player.income),
        buildings: buildings,
        conquests: player.conquests,
        kills: player.kills,
        allies: Array.from(this.alliances.get(player.id) || [])
          .map(id => this.players.get(id)?.name)
          .filter(Boolean)
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
      conquests: p.conquests,
      kills: p.kills,
      isBot: p.isBot,
      allies: Array.from(this.alliances.get(p.id) || [])
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