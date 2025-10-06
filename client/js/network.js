// client/js/network.js - Gestion de la connexion Socket.io

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
        console.log('🔗 Connecté au serveur');
        this.connected = true;
        this.playerId = this.socket.id;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Déconnecté du serveur');
        this.connected = false;
        this.showNotification('Connexion perdue avec le serveur', 'error');
      });

      this.socket.on('connect_error', (error) => {
        console.error('❌ Erreur de connexion:', error);
        reject(error);
      });

      this.setupEventListeners();
    });
  }

  setupEventListeners() {
    // Événements des rooms
    this.socket.on('roomCreated', (data) => {
      console.log('✅ Room créée:', data);
      this.currentRoom = data.code;
      this.trigger('roomCreated', data);
    });

    this.socket.on('roomJoined', (data) => {
      console.log('✅ Room rejointe:', data);
      this.currentRoom = data.room.code;
      this.trigger('roomJoined', data);
    });

    this.socket.on('playerJoined', (data) => {
      console.log('👤 Joueur a rejoint:', data);
      this.trigger('playerJoined', data);
      this.showNotification('Un joueur a rejoint la partie', 'info');
    });

    this.socket.on('playerLeft', (data) => {
      console.log('👋 Joueur est parti:', data);
      this.showNotification('Un joueur a quitté la partie', 'warning');
    });

    // Événements de jeu
    this.socket.on('gameStarted', (data) => {
      console.log('🎮 Partie démarrée:', data);
      this.trigger('gameStarted', data);
      this.showNotification('La partie commence ! Placez votre base.', 'success');
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
        this.showNotification('🎮 Tous les joueurs ont placé leur base ! La conquête commence !', 'success');
      }
    });

    // Événements de placement
    this.socket.on('basePlaced', (data) => {
      this.trigger('basePlaced', data);
      if (data.success && data.playerId === this.playerId) {
        this.showNotification('✅ Base placée !', 'success');
      } else if (data.success) {
        this.showNotification(`${data.playerName} a placé sa base`, 'info');
      }
    });

    this.socket.on('placementUpdate', (data) => {
      this.trigger('placementUpdate', data);
    });

    // Actions
    this.socket.on('actionResult', (data) => {
      this.trigger('actionResult', data);
    });

    // Fin de partie
    this.socket.on('gameOver', (data) => {
      this.trigger('gameOver', data);
    });

    // Erreurs
    this.socket.on('error', (message) => {
      console.error('❌ Erreur serveur:', message);
      this.showNotification(message, 'error');
    });

    // Infos
    this.socket.on('info', (message) => {
      this.showNotification(message, 'info');
    });
  }

  // Méthodes d'envoi
  createRoom(playerName) {
    if (!this.connected) {
      console.error('Non connecté au serveur');
      return;
    }
    this.socket.emit('createRoom', playerName);
  }

  joinRoom(code, playerName) {
    if (!this.connected) {
      console.error('Non connecté au serveur');
      return;
    }
    this.socket.emit('joinRoom', { code, playerName });
  }

  startGame() {
    if (!this.currentRoom) {
      console.error('Pas de room active');
      return;
    }
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

  expandTerritory(x, y) {
    if (!this.currentRoom) return;
    this.socket.emit('expandTerritory', {
      roomCode: this.currentRoom,
      x,
      y
    });
  }

  reinforceCell(x, y, count) {
    if (!this.currentRoom) return;
    this.socket.emit('reinforceCell', {
      roomCode: this.currentRoom,
      x,
      y,
      count
    });
  }

  requestFullState() {
    if (!this.currentRoom) return;
    this.socket.emit('requestFullState', this.currentRoom);
  }

  // Système d'événements
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

  // Notifications
  showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    // Ajouter une icône selon le type
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

// Instance globale
const network = new NetworkManager();