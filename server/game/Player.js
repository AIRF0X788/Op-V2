class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.color = this.generateColor();
    this.gold = 1000;
    this.income = 0;
    this.troops = 0;
    this.isBot = false;
    this.alliances = [];
    this.kills = 0;
    this.conquests = 0;
  }

  generateColor() {
    const colors = [
      '#FF6B6B',
      '#4ECDC4',
      '#45B7D1',
      '#FFA07A',
      '#98D8C8',
      '#F7DC6F',
      '#BB8FCE',
      '#85C1E2',
      '#F39C12',
      '#E74C3C',
      '#3498DB',
      '#2ECC71'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  addAlliance(playerId) {
    if (!this.alliances.includes(playerId)) {
      this.alliances.push(playerId);
    }
  }

  removeAlliance(playerId) {
    const index = this.alliances.indexOf(playerId);
    if (index > -1) {
      this.alliances.splice(index, 1);
    }
  }

  isAlliedWith(playerId) {
    return this.alliances.includes(playerId);
  }

  canAfford(cost) {
    return this.gold >= cost;
  }

  spendGold(amount) {
    if (this.canAfford(amount)) {
      this.gold -= amount;
      return true;
    }
    return false;
  }

  addGold(amount) {
    this.gold += amount;
  }

  incrementKills() {
    this.kills++;
  }

  incrementConquests() {
    this.conquests++;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      gold: Math.floor(this.gold),
      income: Math.floor(this.income),
      troops: this.troops,
      isBot: this.isBot,
      alliances: this.alliances,
      kills: this.kills,
      conquests: this.conquests,
      baseX: this.baseX !== undefined ? this.baseX : null,
      baseY: this.baseY !== undefined ? this.baseY : null,
      hasPlacedBase: this.hasPlacedBase || false
    };
  }

  reset() {
    this.gold = 1000;
    this.income = 0;
    this.troops = 0;
    this.alliances = [];
    this.kills = 0;
    this.conquests = 0;
  }
}

module.exports = Player;