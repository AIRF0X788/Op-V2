const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, '../client')));

// Gestion des rooms de jeu
const gameRooms = new Map();

// Classe GameRoom
class GameRoom {
  constructor(code, hostId) {
    this.code = code;
    this.hostId = hostId;
    this.players = new Map();
    this.bots = new Map();
    this.territories = new Map();
    this.gameState = 'lobby'; // lobby, playing, finished
    this.tickRate = 1000; // 1 tick par seconde
    this.gameLoop = null;
    this.initializeTerritories();
    this.initializeBots(5); // 5 bots par défaut
  }

  initializeTerritories() {
    // Création de territoires simplifiés (continents/pays)
    const territoryData = [
      { id: 'na', name: 'Amérique du Nord', x: 200, y: 150, income: 100, troops: 50 },
      { id: 'sa', name: 'Amérique du Sud', x: 300, y: 400, income: 80, troops: 40 },
      { id: 'eu', name: 'Europe', x: 550, y: 150, income: 120, troops: 60 },
      { id: 'af', name: 'Afrique', x: 550, y: 350, income: 90, troops: 45 },
      { id: 'as', name: 'Asie', x: 750, y: 200, income: 150, troops: 70 },
      { id: 'oc', name: 'Océanie', x: 850, y: 450, income: 70, troops: 35 },
      { id: 'me', name: 'Moyen-Orient', x: 650, y: 250, income: 110, troops: 55 },
      { id: 'ru', name: 'Russie', x: 700, y: 100, income: 130, troops: 65 },
    ];

    territoryData.forEach(data => {
      this.territories.set(data.id, {
        ...data,
        owner: null,
        neighbors: this.calculateNeighbors(data.id)
      });
    });
  }

  calculateNeighbors(territoryId) {
    const neighbors = {
      'na': ['sa', 'eu', 'as'],
      'sa': ['na', 'af'],
      'eu': ['na', 'af', 'as', 'me', 'ru'],
      'af': ['sa', 'eu', 'me'],
      'as': ['na', 'eu', 'me', 'ru', 'oc'],
      'oc': ['as'],
      'me': ['eu', 'af', 'as', 'ru'],
      'ru': ['eu', 'as', 'me']
    };
    return neighbors[territoryId] || [];
  }

  initializeBots(count) {
    for (let i = 0; i < count; i++) {
      const botId = `bot_${i}`;
      this.bots.set(botId, {
        id: botId,
        name: `Bot ${i + 1}`,
        color: this.generateColor(),
        gold: 500,
        income: 0,
        troops: 0,
        isBot: true,
        difficulty: 'medium' // easy, medium, hard
      });
    }
  }

  generateColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  addPlayer(socketId, playerName) {
    this.players.set(socketId, {
      id: socketId,
      name: playerName,
      color: this.generateColor(),
      gold: 1000,
      income: 0,
      troops: 0,
      isBot: false,
      alliances: []
    });
  }

  removePlayer(socketId) {
    this.players.delete(socketId);
    if (this.players.size === 0) {
      this.stopGame();
      return true; // Room should be deleted
    }
    return false;
  }

  startGame() {
    if (this.gameState !== 'lobby') return;
    
    this.gameState = 'playing';
    this.assignStartingTerritories();
    this.gameLoop = setInterval(() => this.tick(), this.tickRate);
  }

  assignStartingTerritories() {
    const allPlayers = [...this.players.values(), ...this.bots.values()];
    const territoriesArray = Array.from(this.territories.keys());
    
    // Mélanger et distribuer équitablement
    for (let i = 0; i < territoriesArray.length; i++) {
      const player = allPlayers[i % allPlayers.length];
      const territory = this.territories.get(territoriesArray[i]);
      territory.owner = player.id;
    }
  }

  tick() {
    // Génération de revenus
    this.territories.forEach((territory, id) => {
      if (territory.owner) {
        const owner = this.players.get(territory.owner) || this.bots.get(territory.owner);
        if (owner) {
          owner.gold += territory.income / 10; // Revenu par tick
          owner.income = this.calculatePlayerIncome(territory.owner);
        }
      }
    });

    // IA des bots
    this.bots.forEach(bot => {
      this.botAI(bot);
    });

    // Envoyer l'état mis à jour
    this.broadcastGameState();
  }

  botAI(bot) {
    // Logique IA simple : attaque les territoires voisins faibles
    const ownedTerritories = Array.from(this.territories.values())
      .filter(t => t.owner === bot.id);

    if (ownedTerritories.length === 0) return;

    ownedTerritories.forEach(territory => {
      territory.neighbors.forEach(neighborId => {
        const neighbor = this.territories.get(neighborId);
        if (neighbor.owner !== bot.id && territory.troops > neighbor.troops * 1.5) {
          // Attaque si on a 1.5x plus de troupes
          this.attack(bot.id, territory.id, neighborId, Math.floor(territory.troops * 0.7));
        }
      });
    });

    // Recrutement de troupes
    if (bot.gold >= 100) {
      const randomTerritory = ownedTerritories[Math.floor(Math.random() * ownedTerritories.length)];
      this.recruitTroops(bot.id, randomTerritory.id, 10);
    }
  }

  calculatePlayerIncome(playerId) {
    let income = 0;
    this.territories.forEach(territory => {
      if (territory.owner === playerId) {
        income += territory.income;
      }
    });
    return income;
  }

  attack(attackerId, fromTerritoryId, toTerritoryId, troopCount) {
    const fromTerritory = this.territories.get(fromTerritoryId);
    const toTerritory = this.territories.get(toTerritoryId);

    if (!fromTerritory || !toTerritory) return false;
    if (fromTerritory.owner !== attackerId) return false;
    if (fromTerritory.troops < troopCount) return false;
    if (!fromTerritory.neighbors.includes(toTerritoryId)) return false;

    // Combat simplifié
    const attackPower = troopCount * 1.2; // Bonus attaquant
    const defensePower = toTerritory.troops;

    fromTerritory.troops -= troopCount;

    if (attackPower > defensePower) {
      // Victoire de l'attaquant
      const survivingTroops = Math.floor(troopCount * 0.6);
      toTerritory.owner = attackerId;
      toTerritory.troops = survivingTroops;
    } else {
      // Victoire du défenseur
      toTerritory.troops = Math.floor(defensePower - attackPower * 0.5);
    }

    return true;
  }

  recruitTroops(playerId, territoryId, count) {
    const player = this.players.get(playerId) || this.bots.get(playerId);
    const territory = this.territories.get(territoryId);

    if (!player || !territory) return false;
    if (territory.owner !== playerId) return false;

    const cost = count * 10;
    if (player.gold < cost) return false;

    player.gold -= cost;
    territory.troops += count;
    return true;
  }

  stopGame() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    this.gameState = 'finished';
  }

  broadcastGameState() {
    const state = {
      players: Array.from(this.players.values()),
      bots: Array.from(this.bots.values()),
      territories: Array.from(this.territories.values()),
      gameState: this.gameState
    };
    io.to(this.code).emit('gameState', state);
  }

  getState() {
    return {
      code: this.code,
      hostId: this.hostId,
      players: Array.from(this.players.values()),
      bots: Array.from(this.bots.values()),
      territories: Array.from(this.territories.values()),
      gameState: this.gameState
    };
  }
}

// Génération de code de room
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket.io événements
io.on('connection', (socket) => {
  console.log('Nouveau client connecté:', socket.id);

  socket.on('createRoom', (playerName) => {
    const roomCode = generateRoomCode();
    const room = new GameRoom(roomCode, socket.id);
    gameRooms.set(roomCode, room);
    
    room.addPlayer(socket.id, playerName);
    socket.join(roomCode);
    
    socket.emit('roomCreated', { code: roomCode, room: room.getState() });
    console.log(`Room créée: ${roomCode} par ${playerName}`);
  });

  socket.on('joinRoom', ({ code, playerName }) => {
    const room = gameRooms.get(code);
    
    if (!room) {
      socket.emit('error', 'Room non trouvée');
      return;
    }

    if (room.gameState !== 'lobby') {
      socket.emit('error', 'La partie a déjà commencé');
      return;
    }

    room.addPlayer(socket.id, playerName);
    socket.join(code);
    
    socket.emit('roomJoined', { room: room.getState() });
    io.to(code).emit('playerJoined', { room: room.getState() });
    console.log(`${playerName} a rejoint la room ${code}`);
  });

  socket.on('startGame', (roomCode) => {
    const room = gameRooms.get(roomCode);
    if (room && room.hostId === socket.id) {
      room.startGame();
      io.to(roomCode).emit('gameStarted', { room: room.getState() });
      console.log(`Partie démarrée dans la room ${roomCode}`);
    }
  });

  socket.on('attack', ({ roomCode, from, to, troops }) => {
    const room = gameRooms.get(roomCode);
    if (room) {
      const success = room.attack(socket.id, from, to, troops);
      if (success) {
        room.broadcastGameState();
      }
    }
  });

  socket.on('recruitTroops', ({ roomCode, territoryId, count }) => {
    const room = gameRooms.get(roomCode);
    if (room) {
      const success = room.recruitTroops(socket.id, territoryId, count);
      if (success) {
        room.broadcastGameState();
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client déconnecté:', socket.id);
    
    // Trouver et nettoyer les rooms
    gameRooms.forEach((room, code) => {
      if (room.removePlayer(socket.id)) {
        gameRooms.delete(code);
        console.log(`Room ${code} supprimée (vide)`);
      } else {
        room.broadcastGameState();
      }
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});