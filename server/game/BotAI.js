class BotAI {
  constructor(bot, gameRoom, difficulty = 'medium') {
    this.bot = bot;
    this.gameRoom = gameRoom;
    this.difficulty = difficulty;
    this.lastActionTime = Date.now();
    this.params = this.getDifficultyParams();
    this.actionInterval = this.getActionInterval();
  }

  getDifficultyParams() {
    const params = {
      easy: { 
        actionInterval: 3000, 
        aggressiveness: 0.2, 
        allianceProbability: 0.1,
        troopReserve: 0.5
      },
      medium: { 
        actionInterval: 2000, 
        aggressiveness: 0.4, 
        allianceProbability: 0.3,
        troopReserve: 0.3
      },
      hard: { 
        actionInterval: 1000, 
        aggressiveness: 0.6, 
        allianceProbability: 0.5,
        troopReserve: 0.2
      },
      insane: { 
        actionInterval: 500, 
        aggressiveness: 0.8, 
        allianceProbability: 0.7,
        troopReserve: 0.1
      }
    };
    return params[this.difficulty] || params.medium;
  }

  getActionInterval() {
    return this.params.actionInterval + Math.random() * 1000;
  }

  async think() {
    const now = Date.now();
    if (now - this.lastActionTime < this.actionInterval) return;
    
    this.lastActionTime = now;
    this.actionInterval = this.getActionInterval();
    
    if (this.bot.troops < 10) return;

    const situation = this.analyzeSituation();
    await this.makeDecision(situation);
  }

  analyzeSituation() {
    const myTerritories = this.gameRoom.mapGrid.getPlayerCells(this.bot.id);
    const borderCells = this.gameRoom.mapGrid.getPlayerBorderCells(this.bot.id);
    const neighbors = this.analyzeNeighbors(borderCells);
    
    return {
      myTerritories,
      borderCells,
      neighbors,
      troops: this.bot.troops,
      gold: this.bot.gold
    };
  }

  analyzeNeighbors(borderCells) {
    const neighbors = {
      neutral: [],
      enemies: [],
      allies: []
    };

    const checked = new Set();

    borderCells.forEach(({ x, y }) => {
      const adjacentCells = this.gameRoom.mapGrid.getNeighbors(x, y, true);
      
      adjacentCells.forEach(adj => {
        const key = `${adj.x},${adj.y}`;
        if (checked.has(key)) return;
        if (adj.cell.type !== 'land') return;
        
        checked.add(key);

        if (!adj.cell.owner) {
          neighbors.neutral.push({ x: adj.x, y: adj.y, cell: adj.cell });
        } else if (adj.cell.owner !== this.bot.id) {
          const isAlly = this.bot.isAlliedWith(adj.cell.owner);
          if (isAlly) {
            neighbors.allies.push({ x: adj.x, y: adj.y, cell: adj.cell, owner: adj.cell.owner });
          } else {
            neighbors.enemies.push({ x: adj.x, y: adj.y, cell: adj.cell, owner: adj.cell.owner });
          }
        }
      });
    });

    return neighbors;
  }

  async makeDecision(situation) {
    const random = Math.random();

    // 70% du temps : gérer l'expansion
    if (random < 0.7) {
      await this.manageExpansion(situation);
    }
    // 15% du temps : alliance
    else if (random < 0.85 && Math.random() < this.params.allianceProbability) {
      await this.tryAlliance();
    }
    // 15% du temps : décision stratégique
    else {
      await this.strategicDecision(situation);
    }
  }

  async manageExpansion(situation) {
    const queue = this.gameRoom.expansionQueues.get(this.bot.id);
    
    // Si on a beaucoup de troupes et qu'on n'est pas en expansion, démarrer
    if (!queue.active && this.bot.troops > 50) {
      this.gameRoom.startExpansion(this.bot.id);
    }
    // Si on manque de troupes et qu'on est en expansion, arrêter
    else if (queue.active && this.bot.troops < 20) {
      this.gameRoom.startExpansion(this.bot.id);
    }
    // Comportement aléatoire pour varier
    else if (Math.random() < 0.05) {
      this.gameRoom.startExpansion(this.bot.id);
    }
  }

  async strategicDecision(situation) {
    const { enemies } = situation.neighbors;
    
    // Si on a beaucoup d'ennemis autour, être plus agressif
    if (enemies.length > 5 && this.bot.troops > 100) {
      const queue = this.gameRoom.expansionQueues.get(this.bot.id);
      if (!queue.active) {
        this.gameRoom.startExpansion(this.bot.id);
      }
    }
  }

  async tryAlliance() {
    const players = Array.from(this.gameRoom.players.values())
      .filter(p => 
        p.id !== this.bot.id && 
        !p.isBot && 
        !this.bot.isAlliedWith(p.id)
      );

    if (players.length === 0) return;

    const target = players[Math.floor(Math.random() * players.length)];
    this.gameRoom.proposeAlliance(this.bot.id, target.id);
  }
}

module.exports = BotAI;