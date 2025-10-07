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

app.use(express.static(path.join(__dirname, '../client')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

const gameRooms = new Map();

function generateRoomCode() {
  let code;
  do {
    code = Math.random().toString(36).substring(2, 8).toUpperCase();
  } while (gameRooms.has(code));
  return code;
}

io.on('connection', (socket) => {
  console.log(`✅ Client connecté: ${socket.id}`);

  socket.on('createRoom', (playerName) => {
    try {
      const roomCode = generateRoomCode();
      const room = new GameRoomOpenFront(roomCode, socket.id, io);
      gameRooms.set(roomCode, room);
      
      room.addPlayer(socket.id, playerName);
      socket.join(roomCode);
      
      socket.emit('roomCreated', { code: roomCode, room: room.getState() });
      console.log(`🎮 Room créée: ${roomCode}`);
    } catch (error) {
      console.error('❌ Erreur création room:', error);
      socket.emit('error', 'Erreur lors de la création');
    }
  });

  socket.on('joinRoom', ({ code, playerName }) => {
    try {
      const room = gameRooms.get(code);
      
      if (!room) {
        socket.emit('error', 'Room non trouvée');
        return;
      }

      if (room.gameState !== 'lobby') {
        socket.emit('error', 'Partie déjà commencée');
        return;
      }

      if (room.players.size >= 8) {
        socket.emit('error', 'Room pleine');
        return;
      }

      room.addPlayer(socket.id, playerName);
      socket.join(code);
      
      socket.emit('roomJoined', { room: room.getState() });
      io.to(code).emit('playerJoined', { room: room.getState() });
      
      console.log(`👤 ${playerName} a rejoint ${code}`);
    } catch (error) {
      console.error('❌ Erreur joinRoom:', error);
      socket.emit('error', 'Erreur lors de la connexion');
    }
  });

  socket.on('startGame', (roomCode) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room) {
        socket.emit('error', 'Room non trouvée');
        return;
      }

      if (room.hostId !== socket.id) {
        socket.emit('error', 'Seul l\'hôte peut démarrer');
        return;
      }

      if (room.players.size < 1) {
        socket.emit('error', 'Pas assez de joueurs');
        return;
      }

      if (room.startGame()) {
        io.to(roomCode).emit('gameStarted', { room: room.getState() });
        console.log(`🎯 Phase de placement: ${roomCode}`);
      }
    } catch (error) {
      console.error('❌ Erreur startGame:', error);
      socket.emit('error', 'Erreur lors du démarrage');
    }
  });

  socket.on('placeBase', ({ roomCode, x, y }) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room || room.gameState !== 'placement') {
        socket.emit('error', 'Phase de placement terminée');
        return;
      }

      const result = room.placePlayerBase(socket.id, x, y);
      
      if (result.success) {
        const player = room.players.get(socket.id);
        
        socket.emit('basePlaced', {
          success: true,
          baseX: player.baseX,
          baseY: player.baseY,
          playerId: socket.id
        });
        
        io.to(roomCode).emit('placementUpdate', {
          playersPlaced: room.playersPlaced.size,
          totalPlayers: room.players.size
        });
        
        console.log(`📍 ${player.name} base placée en (${x}, ${y})`);
      } else {
        socket.emit('basePlaced', {
          success: false,
          reason: result.reason
        });
      }
    } catch (error) {
      console.error('❌ Erreur placeBase:', error);
      socket.emit('error', 'Erreur lors du placement');
    }
  });

  socket.on('expandTerritory', ({ roomCode, x, y }) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room || room.gameState !== 'playing') {
        socket.emit('error', 'Partie non en cours');
        return;
      }

      const result = room.expandTerritory(socket.id, x, y);
      
      socket.emit('actionResult', result);
      
      if (result.success) {
        console.log(`➕ Territoire étendu par ${socket.id}`);
      }
    } catch (error) {
      console.error('❌ Erreur expandTerritory:', error);
      socket.emit('error', 'Erreur lors de l\'expansion');
    }
  });

  socket.on('buildBuilding', ({ roomCode, x, y, buildingType }) => {
    try {
      const room = gameRooms.get(roomCode);
      
      if (!room || room.gameState !== 'playing') {
        socket.emit('error', 'Partie non en cours');
        return;
      }

      const result = room.buildBuilding(socket.id, x, y, buildingType);
      
      socket.emit('actionResult', result);
      
      if (result.success) {
        console.log(`🏗️ Bâtiment ${buildingType} construit`);
      }
    } catch (error) {
      console.error('❌ Erreur buildBuilding:', error);
      socket.emit('error', 'Erreur lors de la construction');
    }
  });

  socket.on('requestFullState', (roomCode) => {
    const room = gameRooms.get(roomCode);
    if (room) {
      socket.emit('fullState', room.getState());
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ Déconnexion: ${socket.id}`);
    
    gameRooms.forEach((room, code) => {
      if (room.players.has(socket.id)) {
        const isEmpty = room.removePlayer(socket.id);
        
        if (isEmpty) {
          room.stopGame();
          gameRooms.delete(code);
          console.log(`🗑️ Room ${code} supprimée`);
        } else {
          io.to(code).emit('playerLeft', { playerId: socket.id });
          
          if (room.hostId === socket.id) {
            const newHost = Array.from(room.players.keys())[0];
            if (newHost) {
              room.hostId = newHost;
              io.to(code).emit('info', 'Nouvel hôte désigné');
            }
          }
        }
      }
    });
  });
});

// Cleanup des rooms inactives
setInterval(() => {
  const now = Date.now();
  const timeout = 60 * 60 * 1000;

  gameRooms.forEach((room, code) => {
    if (room.gameState === 'finished' || room.players.size === 0) {
      const roomAge = room.startTime ? now - room.startTime : Infinity;
      
      if (roomAge > timeout || room.players.size === 0) {
        room.stopGame();
        gameRooms.delete(code);
        console.log(`🗑️ Room ${code} nettoyée`);
      }
    }
  });
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║  🌍 WorldConquest.io - OpenFront    ║
║                                      ║
║  Port: ${PORT.toString().padEnd(29)}║
║  Local: http://localhost:${PORT.toString().padEnd(10)}║
║                                      ║
║  ✨ Ready to conquer!                ║
╚══════════════════════════════════════╝
  `);
});