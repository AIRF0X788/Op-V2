// server/game/GameRoom.js
const Player = require('./Player');
const Bot = require('./Bot');
const Territory = require('./Territory');

class GameRoom {
  constructor(code, hostId, io) {
    this.code = code;
    this.hostId = hostId;
    this.io = io;
    this.players = new Map();
    this.bots = new Map();
    this.territories = new Map();
    this.gameState = 'lobby'; // lobby, playing, finished
    this.tickRate = 1000; // 1 tick par seconde
    this.gameLoop = null;
    this.startTime = null;
    this.tickCount = 0;
    
    this.initializeTerritories();
    this.initializeBots(5);
  }

  initializeTerritories() {
    const territoryData = [
      { id: 'na', name: 'Amérique du Nord', x: 200, y: 150, income: 100 },
      { id: 'sa', name: 'Amérique du Sud', x: 300, y: 400, income: 80 },
      { id: 'eu', name: 'Europe', x: 550, y: 150, income: 120 },
      { id: 'af', name: 'Afrique', x: 550, y: 350, income: 90 },
      { id: 'as', name: 'Asie', x: 750, y: 200, income: 150 },
      { id: 'oc', name: 'Océanie', x: 850, y: 450, income: 70 },
      { id: 'me', name: 'Moyen-Orient', x: 650, y: 250, income: 110 },
      { id: 'ru', name: 'Russie', x: 700, y: 100, income: 130 },
      { id: 'cn', name: 'Chine', x: 800, y: 250, income: 140 },
      { id: 'in', name: 'Inde', x: 720, y: 320, income: 125 },
      { id: 'jp', name: 'Japon', x: 900, y: 220, income: 115 },
      { id: 'br', name: 'Brésil', x: 350, y: 480, income: 105 },
    ];

    territoryData.forEach(data => {
      this.territories.set(data.id, new Territory(data));
    });

    // Définir les voisins après création
    this.defineNeighbors();
  }

  defineNeighbors() {
    const neighborMap = {
      'na': ['sa', 'eu', 'as', 'ru'],
      'sa': ['na', 'af', 'br'],
      'eu': ['na', 'af', 'me', 'ru'],
      'af': ['sa', 'eu', 'me', 'br'],
      'as': ['na', 'eu', 'me', 'ru', 'cn', 'in', 'oc'],
      'oc': ['as', 'jp'],
      'me': ['eu', 'af', 'as', 'ru', 'in'],
      'ru': ['na', 'eu', 'as', 'me', 'cn'],
      'cn': ['as', 'ru', 'in', 'jp'],
      'in': ['as', 'me', 'cn'],
      'jp': ['cn', 'oc'],
      'br': ['sa', 'af']
    };

    Object.entries(neighborMap).forEach(([id, neighbors]) => {
      const territory = this.territories.get(id);
      if (territory) {
        territory.setNeighbors(neighbors);
      }
    });
  }

  initializeBots(count) {
    const difficulties = ['easy', 'medium', 'hard'];
    for (let i = 0; i < count; i++) {
      const botId = `bot_${i}`;
      const difficulty = difficulties[i % difficulties.length];
      this.bots.set(botId, new Bot(botId, `Bot ${i + 1}`, difficulty));
    }
  }

  addPlayer(socketId, playerName) {
    const player = new Player(socketId, playerName);
    this.players.set(socketId, player);
    console.log(`Joueur ${playerName} ajouté à la room ${this.code}`);
    return player;
  }

  removePlayer(socketId) {
    const player = this.players.get(socketId);
    if (player) {
      console.log(`Joueur ${player.name} retiré de la room ${this.code}`);
      this.players.delete(socketId);
      
      // Transférer les territoires du joueur aux bots
      this.territories.forEach(territory => {
        if (territory.owner === socketId) {
          const randomBot = Array.from(this.bots.keys())[
            Math.floor(Math.random() * this.bots.size)
          ];
          territory.owner = randomBot;
        }
      });
    }
    
    return this.players.size === 0;
  }

  startGame() {
    if (this.gameState !== 'lobby') {
      console.log('La partie a déjà commencé');
      return false;
    }
    
    this.gameState = 'playing';
    this.startTime = Date.now();
    this.assignStartingTerritories();
    
    // Démarrer la boucle de jeu
    this.gameLoop = setInterval(() => this.tick(), this.tickRate);
    
    console.log(`Partie démarrée dans la room ${this.code}`);
    return true;
  }

  assignStartingTerritories() {
    const allPlayers = [
      ...Array.from(this.players.values()),
      ...Array.from(this.bots.values())
    ];
    
    const territoriesArray = Array.from(this.territories.values());
    
    // Mélanger les territoires
    for (let i = territoriesArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [territoriesArray[i], territoriesArray[j]] = [territoriesArray[j], territoriesArray[i]];
    }
    
    // Distribuer équitablement
    territoriesArray.forEach((territory, index) => {
      const player = allPlayers[index % allPlayers.length];
      territory.owner = player.id;
      territory.troops = 50; // Troupes de départ
    });
    
    console.log('Territoires assignés aux joueurs');
  }

  tick() {
    this.tickCount++;
    
    // Génération de revenus
    this.generateIncome();
    
    // IA des bots
    this.bots.forEach(bot => {
      bot.playTurn(this.territories, this);
    });
    
    // Vérifier la condition de victoire
    this.checkVictory();
    
    // Envoyer l'état mis à jour
    this.broadcastGameState();
  }

  generateIncome() {
    const allPlayers = [
      ...Array.from(this.players.values()),
      ...Array.from(this.bots.values())
    ];
    
    allPlayers.forEach(player => {
      let income = 0;
      let totalTroops = 0;
      
      this.territories.forEach(territory => {
        if (territory.owner === player.id) {
          income += territory.income / 10; // Revenu par tick (10 ticks = 1 seconde)
          totalTroops += territory.troops;
        }
      });
      
      player.gold += income;
      player.income = income * 10; // Revenu par seconde
      player.troops = totalTroops;
    });
  }

  attack(attackerId, fromTerritoryId, toTerritoryId, troopCount) {
    const fromTerritory = this.territories.get(fromTerritoryId);
    const toTerritory = this.territories.get(toTerritoryId);

    // Validations
    if (!fromTerritory || !toTerritory) {
      console.log('Territoire invalide');
      return { success: false, reason: 'invalid_territory' };
    }
    
    if (fromTerritory.owner !== attackerId) {
      console.log('Pas le propriétaire');
      return { success: false, reason: 'not_owner' };
    }
    
    if (fromTerritory.troops < troopCount) {
      console.log('Pas assez de troupes');
      return { success: false, reason: 'insufficient_troops' };
    }
    
    if (!fromTerritory.neighbors.includes(toTerritoryId)) {
      console.log('Pas voisin');
      return { success: false, reason: 'not_neighbor' };
    }

    // Combat
    const result = fromTerritory.attackTerritory(toTerritory, troopCount);
    
    console.log(`Attaque de ${fromTerritoryId} vers ${toTerritoryId}: ${result.victory ? 'Victoire' : 'Défaite'}`);
    
    return { success: true, result };
  }

  recruitTroops(playerId, territoryId, count) {
    const player = this.players.get(playerId) || this.bots.get(playerId);
    const territory = this.territories.get(territoryId);

    if (!player || !territory) {
      return { success: false, reason: 'invalid' };
    }
    
    if (territory.owner !== playerId) {
      return { success: false, reason: 'not_owner' };
    }

    const cost = count * 10;
    if (player.gold < cost) {
      return { success: false, reason: 'insufficient_gold' };
    }

    player.gold -= cost;
    territory.troops += count;
    
    console.log(`${player.name} a recruté ${count} troupes dans ${territory.name}`);
    
    return { success: true };
  }

  checkVictory() {
    const ownerCounts = new Map();
    
    this.territories.forEach(territory => {
      if (territory.owner) {
        ownerCounts.set(
          territory.owner,
          (ownerCounts.get(territory.owner) || 0) + 1
        );
      }
    });
    
    const totalTerritories = this.territories.size;
    
    for (let [playerId, count] of ownerCounts) {
      if (count === totalTerritories) {
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
      const territoriesOwned = Array.from(this.territories.values())
        .filter(t => t.owner === player.id).length;
      
      return {
        id: player.id,
        name: player.name,
        territories: territoriesOwned,
        troops: player.troops,
        gold: Math.floor(player.gold),
        income: Math.floor(player.income)
      };
    }).sort((a, b) => b.territories - a.territories);
  }

  stopGame() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    this.gameState = 'finished';
    console.log(`Partie terminée dans la room ${this.code}`);
  }

  broadcastGameState() {
    const state = this.getState();
    this.io.to(this.code).emit('gameState', state);
  }

  getState() {
    return {
      code: this.code,
      hostId: this.hostId,
      gameState: this.gameState,
      tickCount: this.tickCount,
      players: Array.from(this.players.values()).map(p => p.toJSON()),
      bots: Array.from(this.bots.values()).map(b => b.toJSON()),
      territories: Array.from(this.territories.values()).map(t => t.toJSON())
    };
  }
}

module.exports = GameRoom;