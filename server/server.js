const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const GameRoomOpenFront = require('./game/GameRoomOpenFront');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Servir les fichiers statiques du client
app.use(express.static(path.join(__dirname, '../client')));

// Route principale
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Gestion des rooms de jeu
const gameRooms = new Map();

// Fonction pour générer un code de room unique
function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (gameRooms.has(code));
  return code;
}

// Gestion des connexions Socket.io
io.on('connection', (socket) => {
  console.log(`[${new Date().toLocaleTimeString()}] 🔗 Client connecté: ${socket.id}`);

  // Créer une nouvelle room
  socket.on('createRoom', (playerName) => {
    try {
      const roomCode = generateRoomCode();
      const room = new GameRoomOpenFront(roomCode, socket.id, io);
      gameRooms.set(roomCode, room);
      
      room.addPlayer(socket.id, playerName);
      socket.join(roomCode);
      
      socket.emit('roomCreated', { code: roomCode, room: room.getState() });
      console.log(`[${new Date().toLocaleTimeString()}] ✅ Room créée: ${roomCode} par ${playerName}`);
    } catch (error) {
      console.error('❌ Erreur création room:', error);
      socket.emit('error', 'Erreur lors de la création de la room');
    }
  });

  // Rejoindre une room existante
  socket.on('joinRoom', ({ code, playerName }) => {
    try {
      const room = gameRooms.get(code);
      
      if (!room) {
        socket.emit('error', 'Room non trouvée');
        return;
      }

      if (room.gameState !== 'lobby') {
        socket.emit('error', 'La partie a déjà commencé');
        return;
      }

      if (room.players.size >= 8) {
        socket.emit('error', 'La room est pleine');
        return;
      }

      room.addPlayer(socket.id, playerName);
      socket.join(code);
      
      socket.emit('roomJoined', { room: room.getState() });
      io.to(code).emit('playerJoined', { room: room.getState() });
      
      console.log(`[${new Date().toLocaleTimeString()}] ✅ ${playerName} a rejoint la room ${code}`);
    } catch (error) {
      console.error('❌ Erreur joinRoom:', error);
      socket.emit('error', 'Erreur lors de la connexion à la room');
    }
  });

  // Démarrer la partie (phase de placement)
  socket.on('startGame', (roomCode) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room) {
        socket.emit('error', 'Room non trouvée');
        return;
      }

      if (room.hostId !== socket.id) {
        socket.emit('error', 'Seul l\'hôte peut démarrer la partie');
        return;
      }

      if (room.players.size < 1) {
        socket.emit('error', 'Pas assez de joueurs');
        return;
      }

      if (room.startGame()) {
        io.to(roomCode).emit('gameStarted', { room: room.getState() });
        console.log(`[${new Date().toLocaleTimeString()}] 🎯 Phase de placement démarrée dans ${roomCode}`);
      }
    } catch (error) {
      console.error('❌ Erreur startGame:', error);
      socket.emit('error', 'Erreur lors du démarrage de la partie');
    }
  });

  // Placer la base
  socket.on('placeBase', ({ roomCode, x, y }) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room) {
        socket.emit('error', 'Room non trouvée');
        return;
      }

      if (room.gameState !== 'placement') {
        socket.emit('error', 'Phase de placement terminée');
        return;
      }

      const result = room.placePlayerBase(socket.id, x, y);
      
      if (result.success) {
        const player = room.players.get(socket.id);
        
        // Notifier TOUS les joueurs (pas juste celui qui a placé)
        io.to(roomCode).emit('basePlaced', {
          success: true,
          baseX: player.baseX,
          baseY: player.baseY,
          playerId: socket.id,
          playerName: player.name
        });
        
        // Notifier tous les joueurs du nombre de placements
        io.to(roomCode).emit('placementUpdate', {
          playersPlaced: room.playersPlaced.size,
          totalPlayers: room.players.size
        });
        
        // Envoyer l'état complet mis à jour
        room.broadcastFullState();
        
        console.log(`[${new Date().toLocaleTimeString()}] 🎯 ${player.name} a placé sa base en (${x}, ${y})`);
      } else {
        socket.emit('basePlaced', {
          success: false,
          reason: result.reason,
          playerId: socket.id
        });
      }
    } catch (error) {
      console.error('❌ Erreur placeBase:', error);
      socket.emit('error', 'Erreur lors du placement');
    }
  });

  // Étendre le territoire
  socket.on('expandTerritory', ({ roomCode, x, y }) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room) {
        socket.emit('error', 'Room non trouvée');
        return;
      }

      if (room.gameState !== 'playing') {
        socket.emit('error', 'La partie n\'est pas en cours');
        return;
      }

      const result = room.expandTerritory(socket.id, x, y);
      
      if (result.success) {
        socket.emit('actionResult', {
          success: true,
          message: result.conquered ? 'Territoire conquis !' : 'Territoire étendu'
        });
      } else {
        socket.emit('actionResult', {
          success: false,
          reason: result.reason
        });
      }
    } catch (error) {
      console.error('❌ Erreur expandTerritory:', error);
      socket.emit('error', 'Erreur lors de l\'expansion');
    }
  });

  // Renforcer une cellule
  socket.on('reinforceCell', ({ roomCode, x, y, count }) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room) {
        socket.emit('error', 'Room non trouvée');
        return;
      }

      if (room.gameState !== 'playing') {
        socket.emit('error', 'La partie n\'est pas en cours');
        return;
      }

      const result = room.reinforceCell(socket.id, x, y, count);
      
      if (result.success) {
        socket.emit('actionResult', {
          success: true,
          message: `${count} troupes ajoutées`
        });
      } else {
        socket.emit('actionResult', {
          success: false,
          reason: result.reason
        });
      }
    } catch (error) {
      console.error('❌ Erreur reinforceCell:', error);
      socket.emit('error', 'Erreur lors du renforcement');
    }
  });

  // Demander l'état complet
  socket.on('requestFullState', (roomCode) => {
    const room = gameRooms.get(roomCode);
    if (room) {
      socket.emit('fullState', room.getState());
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] ❌ Client déconnecté: ${socket.id}`);
    
    // Trouver et nettoyer les rooms
    gameRooms.forEach((room, code) => {
      if (room.players.has(socket.id)) {
        const isEmpty = room.removePlayer(socket.id);
        
        if (isEmpty) {
          // La room est vide, la supprimer
          room.stopGame();
          gameRooms.delete(code);
          console.log(`[${new Date().toLocaleTimeString()}] 🗑️ Room ${code} supprimée (vide)`);
        } else {
          // Notifier les autres joueurs
          io.to(code).emit('playerLeft', { playerId: socket.id });
          
          // Si c'était l'hôte, transférer l'hôte
          if (room.hostId === socket.id) {
            const newHost = Array.from(room.players.keys())[0];
            if (newHost) {
              room.hostId = newHost;
              io.to(code).emit('info', 'Nouvel hôte désigné');
              console.log(`[${new Date().toLocaleTimeString()}] 👑 Nouvel hôte: ${newHost}`);
            }
          }
        }
      }
    });
  });
});

// Endpoint pour les statistiques du serveur
app.get('/api/stats', (req, res) => {
  const stats = {
    activeRooms: gameRooms.size,
    activePlayers: Array.from(gameRooms.values()).reduce((sum, room) => sum + room.players.size, 0),
    rooms: Array.from(gameRooms.entries()).map(([code, room]) => ({
      code,
      players: room.players.size,
      state: room.gameState
    }))
  };
  res.json(stats);
});

// Nettoyage des rooms inactives toutes les 10 minutes
setInterval(() => {
  const now = Date.now();
  const timeout = 60 * 60 * 1000; // 1 heure

  gameRooms.forEach((room, code) => {
    if (room.gameState === 'finished' || 
        (room.gameState === 'lobby' && room.players.size === 0)) {
      const roomAge = room.startTime ? now - room.startTime : Infinity;
      
      if (roomAge > timeout || room.players.size === 0) {
        room.stopGame();
        gameRooms.delete(code);
        console.log(`[${new Date().toLocaleTimeString()}] 🗑️ Room ${code} nettoyée (inactive)`);
      }
    }
  });
}, 10 * 60 * 1000);

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  console.error('❌ Erreur non gérée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promise rejetée:', reason);
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║       🌍 WorldConquest.io Server Started 🌍           ║
║              Style OpenFront.io                        ║
║                                                        ║
║  Port: ${PORT.toString().padEnd(45)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(37)}║
║                                                        ║
║  Local:   http://localhost:${PORT.toString().padEnd(25)}║
║                                                        ║
║  🎮 Fonctionnalités:                                   ║
║  • Placement de base sur carte                        ║
║  • Extension de territoire cellule par cellule        ║
║  • Combat tactique                                     ║
║  • Système économique                                  ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
  `);
});