// server/game/Territory.js

class Territory {
  constructor({ id, name, x, y, income }) {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.income = income; // Revenu par seconde
    this.troops = 50; // Troupes de départ
    this.owner = null; // ID du propriétaire
    this.neighbors = []; // IDs des territoires voisins
    this.fortificationLevel = 0; // Niveau de fortification (à implémenter)
  }

  setNeighbors(neighborIds) {
    this.neighbors = neighborIds;
  }

  setOwner(ownerId) {
    this.owner = ownerId;
  }

  addTroops(count) {
    this.troops += count;
  }

  removeTroops(count) {
    this.troops = Math.max(0, this.troops - count);
  }

  attackTerritory(targetTerritory, attackingTroops) {
    if (attackingTroops > this.troops) {
      return { success: false, reason: 'insufficient_troops' };
    }

    // Retirer les troupes attaquantes
    this.removeTroops(attackingTroops);

    // Calculer le combat
    const attackPower = attackingTroops * 1.2; // Bonus attaquant 20%
    const defensePower = targetTerritory.troops * 1.0; // Défenseur normal

    // Ajouter un facteur aléatoire pour rendre le combat moins prévisible
    const randomFactor = 0.8 + Math.random() * 0.4; // Entre 0.8 et 1.2
    const finalAttackPower = attackPower * randomFactor;

    if (finalAttackPower > defensePower) {
      // Victoire de l'attaquant
      const survivingTroops = Math.max(
        1,
        Math.floor(attackingTroops * (finalAttackPower - defensePower) / finalAttackPower)
      );

      const previousOwner = targetTerritory.owner;
      targetTerritory.setOwner(this.owner);
      targetTerritory.troops = survivingTroops;

      return {
        success: true,
        victory: true,
        attackerLosses: attackingTroops - survivingTroops,
        defenderLosses: defensePower,
        survivingTroops: survivingTroops,
        previousOwner: previousOwner
      };
    } else {
      // Victoire du défenseur
      const defenderLosses = Math.floor(finalAttackPower * 0.7);
      targetTerritory.troops = Math.max(1, targetTerritory.troops - defenderLosses);

      return {
        success: true,
        victory: false,
        attackerLosses: attackingTroops,
        defenderLosses: defenderLosses,
        survivingTroops: 0
      };
    }
  }

  isNeighborOf(territoryId) {
    return this.neighbors.includes(territoryId);
  }

  getStrength() {
    // Calculer la force totale (troupes + fortification)
    return this.troops * (1 + this.fortificationLevel * 0.1);
  }

  upgradeFortification() {
    if (this.fortificationLevel < 5) {
      this.fortificationLevel++;
      return true;
    }
    return false;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      income: this.income,
      troops: this.troops,
      owner: this.owner,
      neighbors: this.neighbors,
      fortificationLevel: this.fortificationLevel
    };
  }

  // Méthode pour calculer la distance avec un autre territoire
  distanceTo(otherTerritory) {
    const dx = this.x - otherTerritory.x;
    const dy = this.y - otherTerritory.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Vérifier si ce territoire est stratégique (beaucoup de voisins)
  isStrategic() {
    return this.neighbors.length >= 4;
  }

  // Réinitialiser le territoire
  reset() {
    this.troops = 50;
    this.owner = null;
    this.fortificationLevel = 0;
  }
}

module.exports = Territory;