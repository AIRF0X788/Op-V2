// server/game/Player.js

class Player {
  constructor(id, name) {
    this.id = id;
    this.name = name;
    this.color = this.generateColor();
    this.gold = 1000; // Or de départ
    this.income = 0; // Revenu par seconde
    this.troops = 0; // Total des troupes
    this.isBot = false;
    this.alliances = []; // IDs des alliés
    this.kills = 0; // Nombre de joueurs éliminés
    this.conquests = 0; // Nombre de territoires conquis
  }

  generateColor() {
    const colors = [
      '#FF6B6B', // Rouge
      '#4ECDC4', // Turquoise
      '#45B7D1', // Bleu
      '#FFA07A', // Saumon
      '#98D8C8', // Vert d'eau
      '#F7DC6F', // Jaune
      '#BB8FCE', // Violet
      '#85C1E2', // Bleu clair
      '#F39C12', // Orange
      '#E74C3C', // Rouge foncé
      '#3498DB', // Bleu roi
      '#2ECC71'  // Vert
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
      conquests: this.conquests
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