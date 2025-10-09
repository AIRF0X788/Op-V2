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

      this.socket.on('connect_error', (error) => reject(error));

      this.setupEventListeners();
    });
  }

  setupEventListeners() {
    const events = [
      'roomCreated', 'roomJoined', 'playerJoined', 'playerLeft',
      'gameStarted', 'fullState', 'gridUpdate', 'phaseChanged',
      'basePlaced', 'placementUpdate', 'actionResult', 'gameOver'
    ];

    events.forEach(event => {
      this.socket.on(event, (data) => this.trigger(event, data));
    });

    this.socket.on('roomCreated', (data) => {
      console.log('🎉 Room created event received:', data);
      this.currentRoom = data.code;
      console.log('✅ Current room set to:', this.currentRoom);
    });

    this.socket.on('roomJoined', (data) => {
      console.log('🎉 Room joined event received:', data);
      this.currentRoom = data.room.code;
      console.log('✅ Current room set to:', this.currentRoom);
    });

    this.socket.on('playerJoined', () => {
      this.showNotification('A player joined', 'info');
    });

    this.socket.on('playerLeft', () => {
      this.showNotification('A player left', 'warning');
    });

    this.socket.on('error', (message) => {
      this.showNotification(message, 'error');
    });

    this.socket.on('info', (message) => {
      this.showNotification(message, 'info');
    });
  }

  createRoom(playerName) {
    if (this.connected) this.socket.emit('createRoom', playerName);
  }

  joinRoom(code, playerName) {
    if (this.connected) this.socket.emit('joinRoom', { code, playerName });
  }

  startGame() {
    if (this.currentRoom) this.socket.emit('startGame', this.currentRoom);
  }

  placeBase(x, y) {
    if (this.currentRoom) {
      this.socket.emit('placeBase', { roomCode: this.currentRoom, x, y });
    }
  }

  on(event, callback) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => cb(data));
    }
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    notification.innerHTML = `<span>${icons[type] || ''} ${message}</span>`;
    
    container.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100px)';
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  disconnect() {
    if (this.socket) this.socket.disconnect();
  }
}

const network = new NetworkManager();