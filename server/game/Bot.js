// server/game/Bot.js

class Bot {
  constructor(id, name, difficulty = 'medium') {
    this.id = id;
    this.name = name;
    this.color = this.generateColor();
    this.gold = 500;
    this.income = 0;
    this.troops = 0;
    this.isBot = true;
    this.difficulty = difficulty;
    this.alliances = [];
    this.kills = 0;
    this.conquests = 0;
    this.strategy = this.selectStrategy();
    this.lastAction = Date.now();
  }

  generateColor() {
    const botColors = [
      '#8B4513', '#696969', '#808000', '#800080',
      '#008080', '#4B0082', '#2F4F4F', '#556B2F'
    ];
    return botColors[Math.floor(Math.random() * botColors.length)];
  }

  selectStrategy() {
    const strategies = ['aggressive', 'defensive', 'economic', 'balanced'];
    return strategies[Math.floor(Math.random() * strategies.length)];
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      color: this.color,
      gold: Math.floor(this.gold),
      income: Math.floor(this.income),
      troops: this.troops,
      isBot: true,
      difficulty: this.difficulty,
      strategy: this.strategy,
      alliances: this.alliances,
      kills: this.kills,
      conquests: this.conquests
    };
  }
}

module.exports = Bot;