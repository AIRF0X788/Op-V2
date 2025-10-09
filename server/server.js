const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const GameRoom = require('./game/GameRoom');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
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
  console.log(`✅ Client connected: ${socket.id}`);

  socket.on('createRoom', (playerName) => {
    try {
      const roomCode = generateRoomCode();
      const room = new GameRoom(roomCode, socket.id, io);
      gameRooms.set(roomCode, room);
      room.addPlayer(socket.id, playerName);
      socket.join(roomCode);
      socket.emit('roomCreated', { code: roomCode, room: room.getState() });
      console.log(`🎮 Room created: ${roomCode}`);
    } catch (error) {
      console.error('❌ Create room error:', error);
      socket.emit('error', 'Error creating room');
    }
  });

  socket.on('joinRoom', ({ code, playerName }) => {
    try {
      const room = gameRooms.get(code);
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }
      if (room.gameState !== 'lobby') {
        socket.emit('error', 'Game already started');
        return;
      }
      if (room.players.size >= 8) {
        socket.emit('error', 'Room full');
        return;
      }
      room.addPlayer(socket.id, playerName);
      socket.join(code);
      socket.emit('roomJoined', { room: room.getState() });
      io.to(code).emit('playerJoined', { room: room.getState() });
      console.log(`👤 ${playerName} joined ${code}`);
    } catch (error) {
      console.error('❌ Join room error:', error);
      socket.emit('error', 'Error joining room');
    }
  });

  socket.on('startGame', (roomCode) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }
      if (room.hostId !== socket.id) {
        socket.emit('error', 'Only host can start');
        return;
      }
      if (room.players.size < 1) {
        socket.emit('error', 'Not enough players');
        return;
      }
      if (room.startGame()) {
        io.to(roomCode).emit('gameStarted', { room: room.getState() });
        console.log(`🎯 Placement phase: ${roomCode}`);
      }
    } catch (error) {
      console.error('❌ Start game error:', error);
      socket.emit('error', 'Error starting game');
    }
  });

  socket.on('placeBase', ({ roomCode, x, y }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room || room.gameState !== 'placement') {
        socket.emit('error', 'Placement phase ended');
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
        console.log(`📍 ${player.name} placed base at (${x}, ${y})`);
      } else {
        socket.emit('basePlaced', { success: false, reason: result.reason });
      }
    } catch (error) {
      console.error('❌ Place base error:', error);
      socket.emit('error', 'Error placing base');
    }
  });

  socket.on('expandTerritory', ({ roomCode, x, y }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room || room.gameState !== 'playing') {
        socket.emit('error', 'Game not in progress');
        return;
      }
      const result = room.expandTerritory(socket.id, x, y);
      socket.emit('actionResult', result);
    } catch (error) {
      console.error('❌ Expand territory error:', error);
      socket.emit('error', 'Error expanding territory');
    }
  });

  socket.on('reinforceCell', ({ roomCode, x, y, troops }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room || room.gameState !== 'playing') {
        socket.emit('error', 'Game not in progress');
        return;
      }
      const result = room.reinforceCell(socket.id, x, y, troops);
      socket.emit('actionResult', result);
    } catch (error) {
      console.error('❌ Reinforce error:', error);
      socket.emit('error', 'Error reinforcing');
    }
  });

  socket.on('proposeAlliance', ({ roomCode, targetId }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room || room.gameState !== 'playing') {
        socket.emit('error', 'Game not in progress');
        return;
      }
      const result = room.proposeAlliance(socket.id, targetId);
      socket.emit('actionResult', result);
    } catch (error) {
      console.error('❌ Alliance proposal error:', error);
      socket.emit('error', 'Error proposing alliance');
    }
  });

  socket.on('acceptAlliance', ({ roomCode, fromId }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }
      room.proposeAlliance(socket.id, fromId);
    } catch (error) {
      console.error('❌ Accept alliance error:', error);
      socket.emit('error', 'Error accepting alliance');
    }
  });

  socket.on('breakAlliance', ({ roomCode, targetId }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room || room.gameState !== 'playing') {
        socket.emit('error', 'Game not in progress');
        return;
      }
      const result = room.breakAlliance(socket.id, targetId);
      socket.emit('actionResult', result);
    } catch (error) {
      console.error('❌ Break alliance error:', error);
      socket.emit('error', 'Error breaking alliance');
    }
  });

  socket.on('createTradeOffer', ({ roomCode, targetId, offer }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room || room.gameState !== 'playing') {
        socket.emit('error', 'Game not in progress');
        return;
      }
      const result = room.createTradeOffer(socket.id, targetId, offer);
      socket.emit('actionResult', result);
    } catch (error) {
      console.error('❌ Trade offer error:', error);
      socket.emit('error', 'Error creating trade offer');
    }
  });

  socket.on('acceptTrade', ({ roomCode, tradeId }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }
      const result = room.acceptTrade(tradeId, socket.id);
      socket.emit('actionResult', result);
    } catch (error) {
      console.error('❌ Accept trade error:', error);
      socket.emit('error', 'Error accepting trade');
    }
  });

  socket.on('rejectTrade', ({ roomCode, tradeId }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room) {
        socket.emit('error', 'Room not found');
        return;
      }
      const result = room.rejectTrade(tradeId, socket.id);
      socket.emit('actionResult', result);
    } catch (error) {
      console.error('❌ Reject trade error:', error);
      socket.emit('error', 'Error rejecting trade');
    }
  });

  socket.on('buildBuilding', ({ roomCode, x, y, buildingType }) => {
    try {
      const room = gameRooms.get(roomCode);
      if (!room || room.gameState !== 'playing') {
        socket.emit('error', 'Game not in progress');
        return;
      }
      const result = room.buildBuilding(socket.id, x, y, buildingType);
      socket.emit('actionResult', result);
    } catch (error) {
      console.error('❌ Build building error:', error);
      socket.emit('error', 'Error building');
    }
  });

  socket.on('requestFullState', (roomCode) => {
    const room = gameRooms.get(roomCode);
    if (room) socket.emit('fullState', room.getState());
  });

  socket.on('disconnect', () => {
    console.log(`❌ Disconnection: ${socket.id}`);
    gameRooms.forEach((room, code) => {
      if (room.players.has(socket.id)) {
        const isEmpty = room.removePlayer(socket.id);
        if (isEmpty) {
          room.stopGame();
          gameRooms.delete(code);
          console.log(`🗑️ Room ${code} deleted`);
        } else {
          io.to(code).emit('playerLeft', { playerId: socket.id });
          if (room.hostId === socket.id) {
            const newHost = Array.from(room.players.keys())[0];
            if (newHost) {
              room.hostId = newHost;
              io.to(code).emit('info', 'New host assigned');
            }
          }
        }
      }
    });
  });
});

setInterval(() => {
  const now = Date.now();
  const timeout = 60 * 60 * 1000;
  gameRooms.forEach((room, code) => {
    if (room.gameState === 'finished' || room.players.size === 0) {
      const roomAge = room.startTime ? now - room.startTime : Infinity;
      if (roomAge > timeout || room.players.size === 0) {
        room.stopGame();
        gameRooms.delete(code);
        console.log(`🗑️ Room ${code} cleaned`);
      }
    }
  });
}, 10 * 60 * 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║  🌍 WorldConquest.io - OpenFront     ║
║                                      ║
║  Port: ${PORT.toString().padEnd(29)} ║
║  Local: http://localhost:${PORT.toString().padEnd(10)}  ║
║                                      ║
║  ✨ Ready to conquer!                ║
╚══════════════════════════════════════╝
  `);
});