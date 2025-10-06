const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const GameRoom = require('./game/GameRoom');

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
  console.log(`[${new Date().toLocaleTimeString()}] Nouveau client connecté: ${socket.id}`);

  // Créer une nouvelle room
  socket.on('createRoom', (playerName) => {
    try {
      const roomCode = generateRoomCode();
      const room = new GameRoom(roomCode, socket.id, io);
      gameRooms.set(roomCode, room);
      
      room.addPlayer(socket.id, playerName);
      socket.join(roomCode);
      
      socket.emit('roomCreated', { code: roomCode, room: room.getState() });
      console.log(`[${new Date().toLocaleTimeString()}] Room créée: ${roomCode} par ${playerName}`);
    } catch (error) {
      console.error('Erreur création room:', error);
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
      
      console.log(`[${new Date().toLocaleTimeString()}] ${playerName} a rejoint la room ${code}`);
    } catch (error) {
      console.error('Erreur joinRoom:', error);
      socket.emit('error', 'Erreur lors de la connexion à la room');
    }
  });

  // Démarrer la partie
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

      if (room.startGame()) {
        io.to(roomCode).emit('gameStarted', { room: room.getState() });
        console.log(`[${new Date().toLocaleTimeString()}] Partie démarrée dans la room ${roomCode}`);
      }
    } catch (error) {
      console.error('Erreur startGame:', error);
      socket.emit('error', 'Erreur lors du démarrage de la partie');
    }
  });

  // Attaquer un territoire
  socket.on('attack', ({ roomCode, from, to, troops }) => {
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

      const result = room.attack(socket.id, from, to, troops);
      
      if (result.success) {
        room.broadcastGameState();
        
        // Notifier tous les joueurs de l'attaque
        io.to(roomCode).emit('attackExecuted', {
          attacker: socket.id,
          from: from,
          to: to,
          result: result.result
        });
      } else {
        socket.emit('error', `Attaque impossible: ${result.reason}`);
      }
    } catch (error) {
      console.error('Erreur attack:', error);
      socket.emit('error', 'Erreur lors de l\'attaque');
    }
  });

  // Recruter des troupes
  socket.on('recruitTroops', ({ roomCode, territoryId, count }) => {
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

      const result = room.recruitTroops(socket.id, territoryId, count);
      
      if (result.success) {
        room.broadcastGameState();
      } else {
        socket.emit('error', `Recrutement impossible: ${result.reason}`);
      }
    } catch (error) {
      console.error('Erreur recruitTroops:', error);
      socket.emit('error', 'Erreur lors du recrutement');
    }
  });

  // Proposer une alliance
  socket.on('proposeAlliance', ({ roomCode, targetPlayerId }) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room) {
        socket.emit('error', 'Room non trouvée');
        return;
      }

      const player = room.players.get(socket.id);
      const targetPlayer = room.players.get(targetPlayerId);

      if (!player || !targetPlayer) {
        socket.emit('error', 'Joueur non trouvé');
        return;
      }

      // Envoyer la demande d'alliance au joueur cible
      io.to(targetPlayerId).emit('allianceProposal', {
        from: socket.id,
        fromName: player.name
      });

      socket.emit('info', `Demande d'alliance envoyée à ${targetPlayer.name}`);
    } catch (error) {
      console.error('Erreur proposeAlliance:', error);
    }
  });

  // Accepter une alliance
  socket.on('acceptAlliance', ({ roomCode, playerId }) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room) return;

      const player1 = room.players.get(socket.id);
      const player2 = room.players.get(playerId);

      if (player1 && player2) {
        player1.addAlliance(playerId);
        player2.addAlliance(socket.id);
        
        room.broadcastGameState();
        
        io.to(socket.id).emit('info', `Alliance formée avec ${player2.name}`);
        io.to(playerId).emit('info', `Alliance formée avec ${player1.name}`);
      }
    } catch (error) {
      console.error('Erreur acceptAlliance:', error);
    }
  });

  // Rompre une alliance
  socket.on('breakAlliance', ({ roomCode, playerId }) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room) return;

      const player1 = room.players.get(socket.id);
      const player2 = room.players.get(playerId);

      if (player1 && player2) {
        player1.removeAlliance(playerId);
        player2.removeAlliance(socket.id);
        
        room.broadcastGameState();
        
        io.to(socket.id).emit('info', `Alliance rompue avec ${player2.name}`);
        io.to(playerId).emit('info', `${player1.name} a rompu l'alliance`);
      }
    } catch (error) {
      console.error('Erreur breakAlliance:', error);
    }
  });

  // Déconnexion
  socket.on('disconnect', () => {
    console.log(`[${new Date().toLocaleTimeString()}] Client déconnecté: ${socket.id}`);
    
    // Trouver et nettoyer les rooms
    gameRooms.forEach((room, code) => {
      if (room.players.has(socket.id)) {
        const isEmpty = room.removePlayer(socket.id);
        
        if (isEmpty) {
          // La room est vide, la supprimer
          room.stopGame();
          gameRooms.delete(code);
          console.log(`[${new Date().toLocaleTimeString()}] Room ${code} supprimée (vide)`);
        } else {
          // Notifier les autres joueurs
          room.broadcastGameState();
          io.to(code).emit('playerLeft', { playerId: socket.id });
          
          // Si c'était l'hôte, transférer l'hôte au premier joueur restant
          if (room.hostId === socket.id) {
            const newHost = Array.from(room.players.keys())[0];
            if (newHost) {
              room.hostId = newHost;
              io.to(code).emit('hostChanged', { newHostId: newHost });
              console.log(`[${new Date().toLocaleTimeString()}] Nouvel hôte: ${newHost}`);
            }
          }
        }
      }
    });
  });

  // Demander l'état actuel de la partie
  socket.on('requestGameState', (roomCode) => {
    const room = gameRooms.get(roomCode);
    if (room) {
      socket.emit('gameState', room.getState());
    }
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
      bots: room.bots.size,
      state: room.gameState
    }))
  };
  res.json(stats);
});

// Nettoyage des rooms inactives toutes les 5 minutes
setInterval(() => {
  const now = Date.now();
  const timeout = 30 * 60 * 1000; // 30 minutes

  gameRooms.forEach((room, code) => {
    if (room.gameState === 'finished' || 
        (room.gameState === 'lobby' && room.players.size === 0)) {
      const roomAge = room.startTime ? now - room.startTime : 0;
      
      if (roomAge > timeout || room.players.size === 0) {
        room.stopGame();
        gameRooms.delete(code);
        console.log(`[${new Date().toLocaleTimeString()}] Room ${code} nettoyée (inactive)`);
      }
    }
  });
}, 5 * 60 * 1000);

// Gestion des erreurs
process.on('uncaughtException', (error) => {
  console.error('Erreur non gérée:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Promise rejetée non gérée:', reason);
});

// Démarrage du serveur
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║        🌍 WorldConquest.io Server Started 🌍                      ║
║                                                                    ║
║  Port: ${PORT.toString().padEnd(46)}                               ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(38)}║
║                                                                    ║
║  Local:   http://localhost:${PORT.toString().padEnd(28)}           ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝
  `);
});