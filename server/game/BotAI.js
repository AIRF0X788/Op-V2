const Bot = require('./Bot');

class BotAI {
constructor(bot, gameRoom, difficulty = 'medium') {
    this.bot = bot;
    this.gameRoom = gameRoom;
    this.difficulty = difficulty;
    this.lastActionTime = Date.now();
    
    this.params = this.getDifficultyParams(); 
    this.actionInterval = this.getActionInterval();
    
    this.targetPlayer = null;
    this.expansionTargets = [];
    this.defenseMode = false;
}

  getDifficultyParams() {
    const params = {
      easy: {
        actionInterval: 3000,
        aggressiveness: 0.2,
        expansionRate: 0.3,
        troopEfficiency: 0.6,
        allianceProbability: 0.1,
        mistakeRate: 0.3
      },
      medium: {
        actionInterval: 2000,
        aggressiveness: 0.4,
        expansionRate: 0.5,
        troopEfficiency: 0.8,
        allianceProbability: 0.3,
        mistakeRate: 0.15
      },
      hard: {
        actionInterval: 1000,
        aggressiveness: 0.6,
        expansionRate: 0.7,
        troopEfficiency: 0.95,
        allianceProbability: 0.5,
        mistakeRate: 0.05
      },
      insane: {
        actionInterval: 500,
        aggressiveness: 0.8,
        expansionRate: 0.9,
        troopEfficiency: 1.0,
        allianceProbability: 0.7,
        mistakeRate: 0
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
    
    const situation = this.analyzeSituation();
    
    const strategy = this.selectStrategy(situation);
    
    await this.executeStrategy(strategy, situation);
  }

  analyzeSituation() {
    const myTerritories = this.gameRoom.mapGrid.getPlayerCells(this.bot.id);
    const totalTerritories = this.countAllLandCells();
    const controlPercentage = myTerritories.length / totalTerritories;
    
    const threats = this.detectThreats(myTerritories);
    
    const opportunities = this.findOpportunities(myTerritories);
    
    const militaryStrength = this.calculateMilitaryStrength();
    
    const playerAnalysis = this.analyzeOtherPlayers();
    
    return {
      myTerritories,
      totalTerritories,
      controlPercentage,
      threats,
      opportunities,
      militaryStrength,
      playerAnalysis,
      gold: this.bot.gold,
      income: this.bot.income,
      troops: this.bot.troops
    };
  }

  detectThreats(myTerritories) {
    const threats = [];
    
    myTerritories.forEach(({ x, y, cell }) => {
      const neighbors = this.gameRoom.mapGrid.getNeighbors(x, y);
      
      neighbors.forEach(neighbor => {
        if (neighbor.cell.owner && 
            neighbor.cell.owner !== this.bot.id && 
            !this.bot.isAlliedWith(neighbor.cell.owner)) {
          
          const threatLevel = this.calculateThreatLevel(cell, neighbor.cell);
          
          if (threatLevel > 0.5) {
            threats.push({
              x: neighbor.x,
              y: neighbor.y,
              owner: neighbor.cell.owner,
              threatLevel,
              troops: neighbor.cell.troops
            });
          }
        }
      });
    });
    
    return threats.sort((a, b) => b.threatLevel - a.threatLevel);
  }

  calculateThreatLevel(myCell, enemyCell) {
    const troopRatio = enemyCell.troops / (myCell.troops + 1);
    const hasBuilding = myCell.building ? 0.8 : 1.0;
    
    return Math.min(1, troopRatio * hasBuilding);
  }

  findOpportunities(myTerritories) {
    const opportunities = [];
    const visited = new Set();
    
    myTerritories.forEach(({ x, y }) => {
      const neighbors = this.gameRoom.mapGrid.getNeighbors(x, y);
      
      neighbors.forEach(neighbor => {
        const key = `${neighbor.x},${neighbor.y}`;
        
        if (!visited.has(key) && neighbor.cell.type === 'land') {
          visited.add(key);
          
          const opportunity = this.evaluateExpansionOpportunity(neighbor);
          if (opportunity.value > 0) {
            opportunities.push(opportunity);
          }
        }
      });
    });
    
    return opportunities.sort((a, b) => b.value - a.value);
  }

  evaluateExpansionOpportunity(neighbor) {
    let value = 0;
    
    if (!neighbor.cell.owner) {
      value = 1.0;
      
      if (this.gameRoom.mapGrid.isCoastal(neighbor.x, neighbor.y)) {
        value += 0.3;
      }
      
      if (this.wouldConnectTerritories(neighbor.x, neighbor.y)) {
        value += 0.5;
      }
    }
    else if (neighbor.cell.owner !== this.bot.id) {
      const adjacentTroops = this.gameRoom.getAdjacentTroops(neighbor.x, neighbor.y, this.bot.id);
      const canConquer = adjacentTroops > neighbor.cell.troops + 5;
      
      if (canConquer) {
        value = 0.6;
        
        const enemyStrength = this.getPlayerStrength(neighbor.cell.owner);
        if (enemyStrength < 0.3) {
          value += 0.4;
        }
        
        if (neighbor.cell.building) {
          value += 0.5;
        }
      }
    }
    
    return {
      x: neighbor.x,
      y: neighbor.y,
      value,
      owner: neighbor.cell.owner,
      troops: neighbor.cell.troops,
      cell: neighbor.cell
    };
  }

  wouldConnectTerritories(x, y) {
    const neighbors = this.gameRoom.mapGrid.getNeighbors(x, y);
    let myNeighborCount = 0;
    
    neighbors.forEach(n => {
      if (n.cell.owner === this.bot.id) {
        myNeighborCount++;
      }
    });
    
    return myNeighborCount >= 2;
  }

  calculateMilitaryStrength() {
    const territories = this.gameRoom.mapGrid.getPlayerCells(this.bot.id);
    let totalTroops = 0;
    let borderTroops = 0;
    
    territories.forEach(({ x, y, cell }) => {
      totalTroops += cell.troops;
      
      if (this.isBorderTerritory(x, y)) {
        borderTroops += cell.troops;
      }
    });
    
    return {
      total: totalTroops,
      border: borderTroops,
      ratio: borderTroops / (totalTroops + 1)
    };
  }

  isBorderTerritory(x, y) {
    const neighbors = this.gameRoom.mapGrid.getNeighbors(x, y);
    
    return neighbors.some(n => 
      n.cell.type === 'land' && n.cell.owner !== this.bot.id
    );
  }

  analyzeOtherPlayers() {
    const players = [];
    
    this.gameRoom.players.forEach((player, playerId) => {
      if (playerId === this.bot.id) return;
      
      const territories = this.gameRoom.mapGrid.getPlayerCells(playerId);
      const strength = this.getPlayerStrength(playerId);
      
      players.push({
        id: playerId,
        name: player.name,
        territories: territories.length,
        strength,
        isAlly: this.bot.isAlliedWith(playerId),
        isBot: player.isBot
      });
    });
    
    return players.sort((a, b) => b.strength - a.strength);
  }

  getPlayerStrength(playerId) {
    const territories = this.gameRoom.mapGrid.getPlayerCells(playerId);
    const player = this.gameRoom.players.get(playerId);
    
    if (!player) return 0;
    
    const territoryScore = territories.length * 10;
    const goldScore = player.gold * 0.1;
    const troopScore = player.troops * 1;
    
    return (territoryScore + goldScore + troopScore) / 1000;
  }

  selectStrategy(situation) {
    if (situation.threats.length > 3 && situation.militaryStrength.ratio < 0.3) {
      return 'defensive';
    }
    
    if (situation.controlPercentage > 0.3 && situation.gold > 2000) {
      return 'aggressive';
    }
    
    if (situation.myTerritories.length < 10) {
      return 'economic';
    }
    
    if (situation.opportunities.length > 5) {
      return 'expansion';
    }
    
    if (situation.playerAnalysis.length > 2 && Math.random() < this.params.allianceProbability) {
      return 'diplomatic';
    }
    
    return 'balanced';
  }

  async executeStrategy(strategy, situation) {
    if (Math.random() < this.params.mistakeRate) {
      strategy = 'random';
    }
    
    switch (strategy) {
      case 'defensive':
        await this.executeDefensiveStrategy(situation);
        break;
        
      case 'aggressive':
        await this.executeAggressiveStrategy(situation);
        break;
        
      case 'economic':
        await this.executeEconomicStrategy(situation);
        break;
        
      case 'expansion':
        await this.executeExpansionStrategy(situation);
        break;
        
      case 'diplomatic':
        await this.executeDiplomaticStrategy(situation);
        break;
        
      case 'balanced':
        await this.executeBalancedStrategy(situation);
        break;
        
      case 'random':
        await this.executeRandomAction(situation);
        break;
    }
  }

  async executeDefensiveStrategy(situation) {
    const borderTerritories = this.findBorderTerritories();
    
    for (let territory of borderTerritories) {
      if (this.bot.gold >= 100 && territory.cell.troops < 50) {
        this.gameRoom.reinforceCell(this.bot.id, territory.x, territory.y, 10);
        break;
      }
    }
    
    if (this.bot.gold >= 200) {
      const strategicPoint = this.findStrategicDefensePoint(situation);
      if (strategicPoint && !strategicPoint.cell.building) {
        this.gameRoom.buildBuilding(this.bot.id, strategicPoint.x, strategicPoint.y, 'outpost');
      }
    }
  }

  async executeAggressiveStrategy(situation) {
    const weakestPlayer = situation.playerAnalysis.find(p => 
      !p.isAlly && p.strength < 0.5
    );
    
    if (weakestPlayer) {
      this.targetPlayer = weakestPlayer.id;
      
      const targets = this.findPlayerTerritories(weakestPlayer.id);
      
      for (let target of targets) {
        if (this.canConquerTerritory(target.x, target.y)) {
          this.gameRoom.expandTerritory(this.bot.id, target.x, target.y);
          break;
        }
      }
    }
    
    if (situation.opportunities.length > 0) {
      const bestOpp = situation.opportunities[0];
      if (this.canExpandTo(bestOpp.x, bestOpp.y)) {
        this.gameRoom.expandTerritory(this.bot.id, bestOpp.x, bestOpp.y);
      }
    }
  }

  async executeEconomicStrategy(situation) {
    const citySpots = this.findBestCitySpots(situation);
    
    if (citySpots.length > 0 && this.bot.gold >= 500) {
      const spot = citySpots[0];
      this.gameRoom.buildBuilding(this.bot.id, spot.x, spot.y, 'city');
      return;
    }
    
    if (this.bot.gold >= 300) {
      const coastalSpots = this.findCoastalSpots();
      if (coastalSpots.length > 0) {
        const spot = coastalSpots[0];
        this.gameRoom.buildBuilding(this.bot.id, spot.x, spot.y, 'port');
        return;
      }
    }
    
    const neutralTargets = situation.opportunities.filter(o => !o.owner);
    if (neutralTargets.length > 0) {
      const target = neutralTargets[0];
      if (this.canExpandTo(target.x, target.y)) {
        this.gameRoom.expandTerritory(this.bot.id, target.x, target.y);
      }
    }
  }

  async executeExpansionStrategy(situation) {
    const bestOpportunities = situation.opportunities.slice(0, 3);
    
    for (let opp of bestOpportunities) {
      if (!opp.owner && this.canExpandTo(opp.x, opp.y)) {
        this.gameRoom.expandTerritory(this.bot.id, opp.x, opp.y);
        break;
      }
    }
    
    if (this.bot.gold >= 400) {
      const barracksSpot = this.findBestBarracksSpot();
      if (barracksSpot && !barracksSpot.cell.building) {
        this.gameRoom.buildBuilding(this.bot.id, barracksSpot.x, barracksSpot.y, 'barracks');
      }
    }
  }

  async executeDiplomaticStrategy(situation) {
    const potentialAllies = situation.playerAnalysis.filter(p =>
      !p.isAlly && !p.isBot && p.strength > 0.3 && p.strength < 0.7
    );
    
    if (potentialAllies.length > 0) {
      const ally = potentialAllies[Math.floor(Math.random() * potentialAllies.length)];
      this.gameRoom.proposeAlliance(this.bot.id, ally.id);
    }
    
    const allies = situation.playerAnalysis.filter(p => p.isAlly);
    if (allies.length > 0 && this.bot.gold > 1000) {
      const ally = allies[0];
      this.gameRoom.tradeSoldGold(this.bot.id, ally.id, 200);
    }
    
    await this.executeEconomicStrategy(situation);
  }

  async executeBalancedStrategy(situation) {
    const actions = [];
    
    if (Math.random() < 0.4 && situation.opportunities.length > 0) {
      const target = situation.opportunities[0];
      if (this.canExpandTo(target.x, target.y)) {
        actions.push(() => this.gameRoom.expandTerritory(this.bot.id, target.x, target.y));
      }
    }
    
    if (Math.random() < 0.3 && this.bot.gold >= 300) {
      const buildingType = this.selectBuildingType();
      const spot = this.findBuildingSpot(buildingType);
      if (spot) {
        actions.push(() => this.gameRoom.buildBuilding(this.bot.id, spot.x, spot.y, buildingType));
      }
    }
    
    if (Math.random() < 0.2 && situation.threats.length > 0) {
      const threat = situation.threats[0];
      const reinforceSpot = this.findReinforceSpot(threat);
      if (reinforceSpot && this.bot.gold >= 100) {
        actions.push(() => this.gameRoom.reinforceCell(this.bot.id, reinforceSpot.x, reinforceSpot.y, 10));
      }
    }
    
    if (Math.random() < 0.1) {
      await this.executeDiplomaticStrategy(situation);
      return;
    }
    
    if (actions.length > 0) {
      const action = actions[Math.floor(Math.random() * actions.length)];
      action();
    }
  }

  async executeRandomAction(situation) {
    const randomActions = [
      () => {
        if (situation.opportunities.length > 0) {
          const random = situation.opportunities[Math.floor(Math.random() * situation.opportunities.length)];
          if (this.canExpandTo(random.x, random.y)) {
            this.gameRoom.expandTerritory(this.bot.id, random.x, random.y);
          }
        }
      },
      () => {
        if (this.bot.gold >= 200) {
          const territories = this.gameRoom.mapGrid.getPlayerCells(this.bot.id);
          if (territories.length > 0) {
            const random = territories[Math.floor(Math.random() * territories.length)];
            if (!random.cell.building) {
              const buildings = ['city', 'port', 'outpost', 'barracks'];
              const building = buildings[Math.floor(Math.random() * buildings.length)];
              this.gameRoom.buildBuilding(this.bot.id, random.x, random.y, building);
            }
          }
        }
      }
    ];
    
    const action = randomActions[Math.floor(Math.random() * randomActions.length)];
    action();
  }

  
  findBorderTerritories() {
    const territories = this.gameRoom.mapGrid.getPlayerCells(this.bot.id);
    return territories.filter(({ x, y }) => this.isBorderTerritory(x, y));
  }

  findStrategicDefensePoint(situation) {
    const candidates = this.findBorderTerritories()
      .filter(t => !t.cell.building)
      .sort((a, b) => {
        const aThreats = situation.threats.filter(threat => 
          Math.abs(threat.x - a.x) + Math.abs(threat.y - a.y) <= 2
        ).length;
        const bThreats = situation.threats.filter(threat =>
          Math.abs(threat.x - b.x) + Math.abs(threat.y - b.y) <= 2
        ).length;
        return bThreats - aThreats;
      });
    
    return candidates[0];
  }

  findPlayerTerritories(playerId) {
    return this.gameRoom.mapGrid.getPlayerCells(playerId);
  }

  canConquerTerritory(x, y) {
    const cell = this.gameRoom.mapGrid.getCell(x, y);
    if (!cell || cell.owner === this.bot.id) return false;
    
    const adjacentTroops = this.gameRoom.getAdjacentTroops(x, y, this.bot.id);
    const requiredTroops = cell.troops + 5;
    
    return adjacentTroops >= requiredTroops * this.params.troopEfficiency;
  }

  canExpandTo(x, y) {
    const cell = this.gameRoom.mapGrid.getCell(x, y);
    if (!cell || cell.type !== 'land') return false;
    
    const adjacentTroops = this.gameRoom.getAdjacentTroops(x, y, this.bot.id);
    const cost = this.gameRoom.config.expandCost;
    
    if (cell.owner && cell.owner !== this.bot.id) {
      return adjacentTroops > cell.troops + cost;
    }
    
    return adjacentTroops >= cost;
  }

  findBestCitySpots(situation) {
    const territories = situation.myTerritories
      .filter(t => !t.cell.building)
      .map(t => ({
        ...t,
        score: this.evaluateCitySpot(t.x, t.y)
      }))
      .sort((a, b) => b.score - a.score);
    
    return territories.slice(0, 3);
  }

  evaluateCitySpot(x, y) {
    let score = 0;
    
    const neighbors = this.gameRoom.mapGrid.getNeighbors(x, y);
    const myNeighbors = neighbors.filter(n => n.cell.owner === this.bot.id).length;
    score += myNeighbors * 10;
    
    if (!this.isBorderTerritory(x, y)) {
      score += 20;
    }
    
    const buildingNearby = neighbors.some(n => n.cell.building);
    if (buildingNearby) {
      score -= 15;
    }
    
    return score;
  }

  findCoastalSpots() {
    const territories = this.gameRoom.mapGrid.getPlayerCells(this.bot.id);
    return territories.filter(t => 
      !t.cell.building && this.gameRoom.mapGrid.isCoastal(t.x, t.y)
    );
  }

  findBestBarracksSpot() {
    const borderTerritories = this.findBorderTerritories()
      .filter(t => !t.cell.building);
    
    if (borderTerritories.length > 0) {
      return borderTerritories[Math.floor(Math.random() * borderTerritories.length)];
    }
    
    return null;
  }

  selectBuildingType() {
    const weights = {
      city: this.bot.gold >= 500 ? 0.4 : 0,
      port: this.bot.gold >= 300 ? 0.2 : 0,
      outpost: this.bot.gold >= 200 ? 0.2 : 0,
      barracks: this.bot.gold >= 400 ? 0.2 : 0
    };
    
    const random = Math.random();
    let cumulative = 0;
    
    for (let [type, weight] of Object.entries(weights)) {
      cumulative += weight;
      if (random < cumulative) {
        return type;
      }
    }
    
    return 'outpost';
  }

  findBuildingSpot(buildingType) {
    const territories = this.gameRoom.mapGrid.getPlayerCells(this.bot.id)
      .filter(t => !t.cell.building);
    
    if (buildingType === 'port') {
      return territories.find(t => this.gameRoom.mapGrid.isCoastal(t.x, t.y));
    }
    
    if (buildingType === 'outpost' || buildingType === 'barracks') {
      const border = territories.filter(t => this.isBorderTerritory(t.x, t.y));
      if (border.length > 0) {
        return border[Math.floor(Math.random() * border.length)];
      }
    }
    
    if (territories.length > 0) {
      return territories[Math.floor(Math.random() * territories.length)];
    }
    
    return null;
  }

  findReinforceSpot(threat) {
    const myTerritories = this.gameRoom.mapGrid.getPlayerCells(this.bot.id);
    
    const closest = myTerritories
      .map(t => ({
        ...t,
        distance: Math.abs(t.x - threat.x) + Math.abs(t.y - threat.y)
      }))
      .sort((a, b) => a.distance - b.distance);
    
    return closest[0];
  }

  countAllLandCells() {
    let count = 0;
    for (let y = 0; y < this.gameRoom.mapGrid.height; y++) {
      for (let x = 0; x < this.gameRoom.mapGrid.width; x++) {
        if (this.gameRoom.mapGrid.grid[y][x].type === 'land') {
          count++;
        }
      }
    }
    return count;
  }
}

module.exports = BotAI;