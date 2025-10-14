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
    this.tickRate = 50;
    this.gameLoop = null;
    this.startTime = null;
    this.tickCount = 0;
    this.mapGrid = new MapGrid(150, 100);
    this.mapGrid.loadEuropeMap();
    this.playersPlaced = new Set();
    this.previousGridState = null;
    this.alliances = new Map();
    this.expansionQueues = new Map();
    this.config = {
      troopGeneration: 0.05,
      goldGeneration: 0.02,
      startingGold: 1000,
      startingTroops: 100,
      baseRadius: 6,
      victoryThreshold: 0.8,
      minBots: 3,
      maxBots: 6,
      expansionRate: 0.5,
      troopCostPerCell: 0.5
    };
  }

  addPlayer(socketId, playerName) {
    const player = new Player(socketId, playerName);
    player.hasPlacedBase = false;
    player.baseX = null;
    player.baseY = null;
    player.gold = this.config.startingGold;
    player.troops = this.config.startingTroops;
    player.isExpanding = false;
    this.players.set(socketId, player);
    this.alliances.set(socketId, new Set());
    this.expansionQueues.set(socketId, { active: false, cells: [] });
    return player;
  }

  addBot(difficulty = 'medium') {
    const botNames = [
      'Napoleon', 'Caesar', 'Alexander', 'Genghis', 'Cleopatra',
      'Charlemagne', 'Hannibal', 'Sun Tzu', 'Bismarck', 'Churchill'
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
    bot.troops = this.config.startingTroops;
    bot.isExpanding = false;
    
    this.bots.set(botId, bot);
    this.players.set(botId, bot);
    this.alliances.set(botId, new Set());
    this.expansionQueues.set(botId, { active: false, cells: [] });
    
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
      });
      this.alliances.delete(socketId);
      this.alliances.forEach(allies => allies.delete(socketId));
      this.expansionQueues.delete(socketId);
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
          if (result.success) placed = true;
          attempts++;
        }
      }
    });
  }

  placePlayerBase(playerId, x, y) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'Player not found' };
    if (player.hasPlacedBase) return { success: false, reason: 'Base already placed' };
    
    const cell = this.mapGrid.getCell(x, y);
    if (!cell || cell.type !== 'land') return { success: false, reason: 'Invalid position' };
    if (cell.owner) return { success: false, reason: 'Position occupied' };
    if (!this.mapGrid.checkAreaFree(x, y, 15)) return { success: false, reason: 'Too close to another player' };
    
    const placedCells = this.mapGrid.placePlayerBase(x, y, playerId, this.config.baseRadius);
    
    player.hasPlacedBase = true;
    player.baseX = x;
    player.baseY = y;
    player.troops = this.config.startingTroops;
    this.playersPlaced.add(playerId);
    
    if (this.playersPlaced.size === this.players.size) {
      setTimeout(() => this.startPlayingPhase(), 1000);
    }
    
    return { success: true, placedCells };
  }

  startPlayingPhase() {
    this.gameState = 'playing';
    this.previousGridState = this.mapGrid.clone();
    this.gameLoop = setInterval(() => this.tick(), this.tickRate);
    this.io.to(this.code).emit('phaseChanged', { phase: 'playing' });
    
    console.log('Game started - sending full state');
    this.io.to(this.code).emit('fullState', this.getState());
  }

  tick() {
    this.tickCount++;
    
    if (this.tickCount % 100 === 0) {
      this.botAIs.forEach(botAI => botAI.think());
    }
    
    if (this.tickCount % 20 === 0) {
      this.generateResources();
    }
    
    this.processExpansions();
    
    if (this.tickCount % 200 === 0) {
      this.checkVictory();
    }
    
    this.broadcastChanges();
  }

  generateResources() {
    this.players.forEach(player => {
      const cells = this.mapGrid.getPlayerCells(player.id);
      const cellCount = cells.length;
      
      const goldPerTick = cellCount * this.config.goldGeneration;
      const troopsPerTick = cellCount * this.config.troopGeneration;
      
      player.gold += goldPerTick;
      player.troops += troopsPerTick;
      player.income = Math.floor(goldPerTick * 50);
    });
  }

  startExpansion(playerId) {
    const player = this.players.get(playerId);
    if (!player) return { success: false, reason: 'Player not found' };
    
    const queue = this.expansionQueues.get(playerId);
    if (queue.active) {
      queue.active = false;
      player.isExpanding = false;
      return { success: true, message: 'Expansion stopped' };
    }
    
    if (player.troops < 1) {
      return { success: false, reason: 'Not enough troops' };
    }
    
    queue.active = true;
    player.isExpanding = true;
    
    return { success: true, message: 'Expansion started!' };
  }

  processExpansions() {
    this.expansionQueues.forEach((queue, playerId) => {
      if (!queue.active) return;
      
      const player = this.players.get(playerId);
      if (!player || player.troops < this.config.troopCostPerCell) {
        queue.active = false;
        if (player) player.isExpanding = false;
        return;
      }
      
      const borderCells = this.mapGrid.getPlayerBorderCells(playerId);
      if (borderCells.length === 0) {
        queue.active = false;
        player.isExpanding = false;
        return;
      }
      
      const allies = Array.from(this.alliances.get(playerId) || []);
      const availableCells = [];
      const checked = new Set();
      
      borderCells.forEach(({ x, y }) => {
        const neighbors = this.mapGrid.getNeighbors(x, y, true);
        neighbors.forEach(n => {
          const key = `${n.x},${n.y}`;
          if (checked.has(key)) return;
          if (n.cell.type !== 'land') return;
          if (n.cell.owner === playerId) return;
          if (n.cell.owner && allies.includes(n.cell.owner)) return;
          
          checked.add(key);
          
          let priority = 0;
          if (!n.cell.owner) {
            priority = 10;
          } else {
            priority = 5;
          }
          
          availableCells.push({ 
            x: n.x, 
            y: n.y, 
            cell: n.cell,
            priority 
          });
        });
      });
      
      if (availableCells.length === 0) {
        queue.active = false;
        player.isExpanding = false;
        return;
      }
      
      availableCells.sort((a, b) => b.priority - a.priority);
      const topCells = availableCells.slice(0, Math.min(5, availableCells.length));
      const target = topCells[Math.floor(Math.random() * topCells.length)];
      
      const cost = target.cell.owner ? this.config.troopCostPerCell * 2 : this.config.troopCostPerCell;
      
      if (player.troops >= cost) {
        const previousOwner = target.cell.owner;
        target.cell.owner = playerId;
        target.cell.lastUpdate = Date.now();
        player.troops -= cost;
        
        if (previousOwner) {
          const enemy = this.players.get(previousOwner);
          if (enemy) {
            this.io.to(this.code).emit('combatEvent', {
              attacker: player.name,
              defender: enemy.name,
              x: target.x,
              y: target.y
            });
          }
        }
        
        this.queueChange({
          x: target.x,
          y: target.y,
          owner: playerId
        });
      }
    });
  }

  queueChange(change) {
    this.io.to(this.code).emit('gridUpdate', {
      changes: [change],
      players: this.getPlayersState()
    });
  }

  areAllied(player1Id, player2Id) {
    return this.alliances.get(player1Id)?.has(player2Id) || false;
  }

  proposeAlliance(fromId, toId) {
    if (fromId === toId) return { success: false, reason: 'Cannot ally with yourself' };
    if (this.areAllied(fromId, toId)) return { success: false, reason: 'Already allied' };
    
    this.createAlliance(fromId, toId);
    return { success: true, message: 'Alliance formed!' };
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
  }

  breakAlliance(player1Id, player2Id) {
    if (!this.areAllied(player1Id, player2Id)) return { success: false, reason: 'Not allied' };
    
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

  checkVictory() {
    let totalLand = 0;
    const playerCounts = new Map();
    
    for (let y = 0; y < this.mapGrid.height; y++) {
      for (let x = 0; x < this.mapGrid.width; x++) {
        const cell = this.mapGrid.grid[y][x];
        if (cell.type === 'land') {
          totalLand++;
          if (cell.owner) playerCounts.set(cell.owner, (playerCounts.get(cell.owner) || 0) + 1);
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
    if (activePlayers.length === 1) this.onVictory(activePlayers[0]);
  }

  onVictory(winnerId) {
    this.stopGame();
    const winner = this.players.get(winnerId);
    this.io.to(this.code).emit('gameOver', {
      winner: { id: winner.id, name: winner.name, isBot: winner.isBot },
      duration: Date.now() - this.startTime,
      stats: this.getGameStats()
    });
  }

  getGameStats() {
    return Array.from(this.players.values()).map(player => {
      const cells = this.mapGrid.getPlayerCells(player.id);
      return {
        id: player.id,
        name: player.name,
        isBot: player.isBot,
        cells: cells.length,
        troops: Math.floor(player.troops),
        gold: Math.floor(player.gold),
        income: Math.floor(player.income),
        allies: Array.from(this.alliances.get(player.id) || []).map(id => this.players.get(id)?.name).filter(Boolean)
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
      isBot: p.isBot,
      isExpanding: p.isExpanding || false,
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