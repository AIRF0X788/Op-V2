// Gestion de la connexion Socket.io
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
        console.log('Connecté au serveur');
        this.connected = true;
        this.playerId = this.socket.id;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('Déconnecté du serveur');
        this.connected = false;
        this.showNotification('Connexion perdue avec le serveur', 'error');
      });

      this.socket.on('connect_error', (error) => {
        console.error('Erreur de connexion:', error);
        reject(error);
      });

      this.setupEventListeners();
    });
  }

  setupEventListeners() {
    // Événements des rooms
    this.socket.on('roomCreated', (data) => {
      console.log('Room créée:', data);
      this.currentRoom = data.code;
      this.trigger('roomCreated', data);
    });

    this.socket.on('roomJoined', (data) => {
      console.log('Room rejointe:', data);
      this.currentRoom = data.room.code;
      this.trigger('roomJoined', data);
    });

    this.socket.on('playerJoined', (data) => {
      console.log('Joueur a rejoint:', data);
      this.trigger('playerJoined', data);
      this.showNotification('Un joueur a rejoint la partie', 'info');
    });

    // Événements de jeu
    this.socket.on('gameStarted', (data) => {
      console.log('Partie démarrée:', data);
      this.trigger('gameStarted', data);
      this.showNotification('La partie commence !', 'success');
    });

    this.socket.on('gameState', (state) => {
      this.trigger('gameState', state);
    });

    // Erreurs
    this.socket.on('error', (message) => {
      console.error('Erreur serveur:', message);
      this.showNotification(message, 'error');
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

  attack(from, to, troops) {
    if (!this.currentRoom) return;
    this.socket.emit('attack', {
      roomCode: this.currentRoom,
      from,
      to,
      troops
    });
  }

  recruitTroops(territoryId, count) {
    if (!this.currentRoom) return;
    this.socket.emit('recruitTroops', {
      roomCode: this.currentRoom,
      territoryId,
      count
    });
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
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    container.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(100px)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Instance globale
const network = new NetworkManager();