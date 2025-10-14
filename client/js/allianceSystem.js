class AllianceSystem {
  constructor() {
    this.currentAlliances = new Set();
    this.setupUI();
  }

  setupUI() {
    this.setupEventListeners();
    this.setupAllianceButton();
  }

  setupAllianceButton() {
    const allianceBtn = document.getElementById('allianceBtn');
    const alliancePanel = document.getElementById('alliancePanel');
    const closeBtn = document.getElementById('closeAlliancePanel');

    if (allianceBtn) {
      allianceBtn.addEventListener('click', () => {
        alliancePanel.classList.toggle('hidden');
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        alliancePanel.classList.add('hidden');
      });
    }
  }

  setupEventListeners() {
    network.on('allianceFormed', (data) => {
      this.handleAllianceFormed(data);
      network.showNotification(`Alliance formed: ${data.players.join(' & ')}`, 'success');
    });

    network.on('allianceBroken', (data) => {
      this.handleAllianceBroken(data);
      network.showNotification(`Alliance broken: ${data.players.join(' & ')}`, 'warning');
    });
  }

  updatePlayerList(players) {
    const container = document.getElementById('playerListAlliance');
    if (!container) return;

    container.innerHTML = '';

    players.forEach(player => {
      if (player.id === network.playerId) return;

      const isAlly = this.currentAlliances.has(player.id);

      const playerDiv = document.createElement('div');
      playerDiv.className = 'alliance-player-item';
      playerDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
          <span class="player-color-dot" style="background: ${player.color}"></span>
          <span>${player.name}</span>
          ${player.isBot ? '<span class="bot-badge">BOT</span>' : ''}
        </div>
        <div style="display: flex; gap: 0.25rem;">
          ${!isAlly ? `
            <button class="btn-small btn-ally" data-player-id="${player.id}">
              Ally
            </button>
          ` : `
            <button class="btn-small btn-break" data-player-id="${player.id}">
              Break
            </button>
          `}
        </div>
      `;

      container.appendChild(playerDiv);
    });

    container.querySelectorAll('.btn-ally').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const playerId = e.target.dataset.playerId;
        this.proposeAlliance(playerId);
      });
    });

    container.querySelectorAll('.btn-break').forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (confirm('Break this alliance?')) {
          const playerId = e.target.dataset.playerId;
          this.breakAlliance(playerId);
        }
      });
    });
  }

  updateAlliesList() {
    const container = document.getElementById('currentAllies');
    if (!container) return;

    if (this.currentAlliances.size === 0) {
      container.innerHTML = '<div class="no-allies">No alliances yet</div>';
      return;
    }

    container.innerHTML = '';
    this.currentAlliances.forEach(allyId => {
      const ally = game.currentGameState?.players?.find(p => p.id === allyId);
      if (ally) {
        const allyDiv = document.createElement('div');
        allyDiv.className = 'ally-item';
        allyDiv.innerHTML = `
          <span class="player-color-dot" style="background: ${ally.color}"></span>
          <span>${ally.name}</span>
        `;
        container.appendChild(allyDiv);
      }
    });
  }

  proposeAlliance(targetId) {
    network.socket.emit('proposeAlliance', {
      roomCode: network.currentRoom,
      targetId: targetId
    });

    network.showNotification('Alliance proposal sent!', 'info');
  }

  breakAlliance(targetId) {
    network.socket.emit('breakAlliance', {
      roomCode: network.currentRoom,
      targetId: targetId
    });
  }

  handleAllianceFormed(data) {
    if (game.currentGameState) {
      const currentPlayer = game.currentGameState.players.find(p => p.id === network.playerId);
      if (currentPlayer && currentPlayer.allies) {
        this.currentAlliances = new Set(currentPlayer.allies);
        this.updateAlliesList();
      }
    }
  }

  handleAllianceBroken(data) {
    this.handleAllianceFormed(data);
  }

  updateFromGameState(gameState) {
    if (!gameState) return;

    const currentPlayer = gameState.players.find(p => p.id === network.playerId);
    if (currentPlayer && currentPlayer.allies) {
      this.currentAlliances = new Set(currentPlayer.allies);
      this.updateAlliesList();
    }

    this.updatePlayerList(gameState.players);
  }
}

const allianceSystem = new AllianceSystem();