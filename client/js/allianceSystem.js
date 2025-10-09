class AllianceSystem {
  constructor() {
    this.currentAlliances = new Set();
    this.pendingRequests = new Map();
    this.tradeOffers = new Map();
    this.setupUI();
  }

  setupUI() {
    this.createAlliancePanel();
    this.createTradePanel();
    this.setupEventListeners();
  }

  createAlliancePanel() {
    const panel = document.createElement('div');
    panel.id = 'alliancePanel';
    panel.className = 'game-panel';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>🤝 Alliances</h3>
        <button class="panel-toggle" id="toggleAlliancePanel">−</button>
      </div>
      <div class="panel-content" id="alliancePanelContent">
        <div class="alliance-section">
          <h4>Current Allies</h4>
          <div id="currentAllies" class="ally-list"></div>
        </div>
        <div class="alliance-section">
          <h4>Players</h4>
          <div id="playerListAlliance" class="player-list"></div>
        </div>
        <div class="alliance-section">
          <h4>Pending Requests</h4>
          <div id="pendingAlliances" class="pending-list"></div>
        </div>
      </div>
    `;

    document.getElementById('gameScreen').appendChild(panel);

    document.getElementById('toggleAlliancePanel').addEventListener('click', () => {
      panel.classList.toggle('collapsed');
      const btn = document.getElementById('toggleAlliancePanel');
      btn.textContent = panel.classList.contains('collapsed') ? '+' : '−';
    });
  }

  createTradePanel() {
    const panel = document.createElement('div');
    panel.id = 'tradePanel';
    panel.className = 'game-panel hidden';
    panel.innerHTML = `
      <div class="panel-header">
        <h3>💰 Trade Offer</h3>
        <button class="close-btn" id="closeTradePanel">✕</button>
      </div>
      <div class="panel-content">
        <div class="trade-form">
          <div class="trade-section">
            <h4>You Offer:</h4>
            <div class="trade-input">
              <label>💰 Gold:</label>
              <input type="number" id="offerGold" min="0" value="0">
            </div>
          </div>
          <div class="trade-section">
            <h4>You Request:</h4>
            <div class="trade-input">
              <label>💰 Gold:</label>
              <input type="number" id="requestGold" min="0" value="0">
            </div>
          </div>
          <div class="trade-actions">
            <button id="sendTradeOffer" class="btn btn-primary">Send Offer</button>
            <button id="cancelTrade" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('gameScreen').appendChild(panel);

    document.getElementById('closeTradePanel').addEventListener('click', () => {
      this.hideTradePanel();
    });

    document.getElementById('cancelTrade').addEventListener('click', () => {
      this.hideTradePanel();
    });

    document.getElementById('sendTradeOffer').addEventListener('click', () => {
      this.sendTradeOffer();
    });
  }

  setupEventListeners() {
    network.on('allianceProposal', (data) => {
      this.handleAllianceProposal(data);
    });

    network.on('allianceFormed', (data) => {
      this.handleAllianceFormed(data);
      network.showNotification(`Alliance formed: ${data.players.join(' & ')}`, 'success');
    });

    network.on('allianceBroken', (data) => {
      this.handleAllianceBroken(data);
      network.showNotification(`Alliance broken: ${data.players.join(' & ')}`, 'warning');
    });

    network.on('tradeOffer', (data) => {
      this.handleTradeOffer(data);
    });

    network.on('tradeCompleted', (data) => {
      network.showNotification(`Trade completed: ${data.between.join(' ↔ ')}`, 'success');
    });

    network.on('combatEvent', (data) => {
      this.showCombatAnimation(data);
    });
  }

  updatePlayerList(players) {
    const container = document.getElementById('playerListAlliance');
    if (!container) return;

    container.innerHTML = '';

    players.forEach(player => {
      if (player.id === network.playerId) return;

      const isAlly = this.currentAlliances.has(player.id);
      const isPending = this.pendingRequests.has(player.id);

      const playerDiv = document.createElement('div');
      playerDiv.className = 'alliance-player-item';
      playerDiv.innerHTML = `
        <div class="player-info">
          <span class="player-color-dot" style="background: ${player.color}"></span>
          <span class="player-name">${player.name}</span>
          ${player.isBot ? '<span class="bot-badge">BOT</span>' : ''}
          ${isAlly ? '<span class="ally-badge">ALLY</span>' : ''}
        </div>
        <div class="player-stats">
          <span>🏠 ${player.cells || 0}</span>
          <span>⚔️ ${Math.floor(player.troops || 0)}</span>
        </div>
        <div class="player-actions">
          ${!isAlly && !isPending ? `
            <button class="btn-small btn-ally" data-player-id="${player.id}">
              Propose Alliance
            </button>
          ` : ''}
          ${!isAlly && !player.isBot ? `
            <button class="btn-small btn-trade" data-player-id="${player.id}">
              Trade
            </button>
          ` : ''}
          ${isAlly ? `
            <button class="btn-small btn-break" data-player-id="${player.id}">
              Break Alliance
            </button>
          ` : ''}
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

    container.querySelectorAll('.btn-trade').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const playerId = e.target.dataset.playerId;
        this.showTradePanel(playerId);
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

  handleAllianceProposal(data) {
    this.pendingRequests.set(data.fromId, data);
    
    const container = document.getElementById('pendingAlliances');
    if (!container) return;

    const requestDiv = document.createElement('div');
    requestDiv.className = 'alliance-request';
    requestDiv.id = `request-${data.fromId}`;
    requestDiv.innerHTML = `
      <div class="request-info">
        <span>${data.from} wants to form an alliance</span>
      </div>
      <div class="request-actions">
        <button class="btn-small btn-success" onclick="allianceSystem.acceptAlliance('${data.fromId}')">
          Accept
        </button>
        <button class="btn-small btn-danger" onclick="allianceSystem.rejectAlliance('${data.fromId}')">
          Reject
        </button>
      </div>
    `;

    container.appendChild(requestDiv);

    network.showNotification(`${data.from} wants to form an alliance!`, 'info');
  }

  acceptAlliance(fromId) {
    network.socket.emit('acceptAlliance', {
      roomCode: network.currentRoom,
      fromId: fromId
    });

    this.proposeAlliance(fromId);
    
    const request = document.getElementById(`request-${fromId}`);
    if (request) request.remove();
    this.pendingRequests.delete(fromId);
  }

  rejectAlliance(fromId) {
    const request = document.getElementById(`request-${fromId}`);
    if (request) request.remove();
    this.pendingRequests.delete(fromId);
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

  showTradePanel(targetId) {
    this.currentTradeTarget = targetId;
    const panel = document.getElementById('tradePanel');
    panel.classList.remove('hidden');

    const target = game.currentGameState?.players?.find(p => p.id === targetId);
    if (target) {
      document.querySelector('#tradePanel .panel-header h3').textContent = `💰 Trade with ${target.name}`;
    }
  }

  hideTradePanel() {
    document.getElementById('tradePanel').classList.add('hidden');
    this.currentTradeTarget = null;
  }

  sendTradeOffer() {
    if (!this.currentTradeTarget) return;

    const offerGold = parseInt(document.getElementById('offerGold').value) || 0;
    const requestGold = parseInt(document.getElementById('requestGold').value) || 0;

    if (offerGold === 0 && requestGold === 0) {
      network.showNotification('Please enter trade amounts', 'warning');
      return;
    }

    network.socket.emit('createTradeOffer', {
      roomCode: network.currentRoom,
      targetId: this.currentTradeTarget,
      offer: {
        gold: offerGold,
        requestGold: requestGold
      }
    });

    network.showNotification('Trade offer sent!', 'info');
    this.hideTradePanel();
  }

  handleTradeOffer(data) {
    const offerDiv = document.createElement('div');
    offerDiv.className = 'trade-offer-notification';
    offerDiv.innerHTML = `
      <div class="trade-header">Trade Offer from ${data.fromName}</div>
      <div class="trade-details">
        <div>Offers: 💰 ${data.offerGold}</div>
        <div>Requests: 💰 ${data.requestGold}</div>
      </div>
      <div class="trade-actions">
        <button onclick="allianceSystem.acceptTrade(${data.id})" class="btn btn-success">Accept</button>
        <button onclick="allianceSystem.rejectTrade(${data.id})" class="btn btn-danger">Reject</button>
      </div>
    `;

    document.getElementById('notifications').appendChild(offerDiv);

    setTimeout(() => offerDiv.remove(), 30000);
  }

  acceptTrade(tradeId) {
    network.socket.emit('acceptTrade', {
      roomCode: network.currentRoom,
      tradeId: tradeId
    });
  }

  rejectTrade(tradeId) {
    network.socket.emit('rejectTrade', {
      roomCode: network.currentRoom,
      tradeId: tradeId
    });
  }

  showCombatAnimation(data) {
    const cell = game.renderer?.getCellAtWorldPosition?.(data.x, data.y);
    if (!cell) return;

    const animation = document.createElement('div');
    animation.className = 'combat-animation';
    animation.style.left = `${cell.screenX}px`;
    animation.style.top = `${cell.screenY}px`;
    animation.innerHTML = '⚔️';

    document.getElementById('gameScreen').appendChild(animation);

    setTimeout(() => animation.remove(), 1000);
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