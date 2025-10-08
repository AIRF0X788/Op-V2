class NetworkManager {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.currentRoom = null;
    this.playerId = null;
    this.callbacks = {};
  }

  connect(serverUrl = window.location.origin) {
    return new Promise((resolve, reject) => {
      this.socket = io(serverUrl);

      this.socket.on('connect', () => {
        this.connected = true;
        this.playerId = this.socket.id;
        resolve();
      });

      this.socket.on('disconnect', () => {
        this.connected = false;
        this.showNotification('Connection lost', 'error');
      });

      this.socket.on('connect_error', (error) => {
        reject(error);
      });

      this.setupEventListeners();
    });
  }

  setupEventListeners() {
    this.socket.on('roomCreated', (data) => {
      this.currentRoom = data.code;
      this.trigger('roomCreated', data);
    });

    this.socket.on('roomJoined', (data) => {
      this.currentRoom = data.room.code;
      this.trigger('roomJoined', data);
    });

    this.socket.on('playerJoined', (data) => {
      this.trigger('playerJoined', data);
      this.showNotification('A player joined', 'info');
    });

    this.socket.on('playerLeft', (data) => {
      this.showNotification('A player left', 'warning');
    });

    this.socket.on('gameStarted', (data) => {
      this.trigger('gameStarted', data);
      this.showNotification('Game starting! Place your base', 'success');
    });

    this.socket.on('fullState', (state) => {
      this.trigger('fullState', state);
    });

    this.socket.on('gridUpdate', (data) => {
      this.trigger('gridUpdate', data);
    });

    this.socket.on('phaseChanged', (data) => {
      this.trigger('phaseChanged', data);
      if (data.phase === 'playing') {
        this.showNotification('All players ready! Conquest begins!', 'success');
      }
    });

    this.socket.on('basePlaced', (data) => {
      this.trigger('basePlaced', data);
      if (data.success && data.playerId === this.playerId) {
        this.showNotification('Base placed!', 'success');
      } else if (data.success) {
        this.showNotification(`${data.playerName} placed their base`, 'info');
      }
    });

    this.socket.on('placementUpdate', (data) => {
      this.trigger('placementUpdate', data);
    });

    this.socket.on('actionResult', (data) => {
      this.trigger('actionResult', data);
    });

    this.socket.on('gameOver', (data) => {
      this.trigger('gameOver', data);
    });

    this.socket.on('error', (message) => {
      this.showNotification(message, 'error');
    });

    this.socket.on('info', (message) => {
      this.showNotification(message, 'info');
    });
  }

  createRoom(playerName) {
    if (!this.connected) return;
    this.socket.emit('createRoom', playerName);
  }

  joinRoom(code, playerName) {
    if (!this.connected) return;
    this.socket.emit('joinRoom', { code, playerName });
  }

  startGame() {
    if (!this.currentRoom) return;
    this.socket.emit('startGame', this.currentRoom);
  }

  placeBase(x, y) {
    if (!this.currentRoom) return;
    this.socket.emit('placeBase', {
      roomCode: this.currentRoom,
      x,
      y
    });
  }

  on(event, callback) {
    if (!this.callbacks[event]) {
      this.callbacks[event] = [];
    }
    this.callbacks[event].push(callback);
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(callback => callback(data));
    }
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️'
    };
    
    notification.innerHTML = `<span>${icons[type] || ''} ${message}</span>`;
    
    container.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100px)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

const network = new NetworkManager();