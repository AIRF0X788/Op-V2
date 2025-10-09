class UIManager {
  constructor() {
    this.currentScreen = 'menuScreen';
  }

  init() {
    console.log('🎮 UI Manager initializing...');
    this.setupMenuScreen();
    this.setupLobbyScreen();
    this.setupGameScreen();
    console.log('✅ UI Manager initialized');
  }

  setupMenuScreen() {
    const createBtn = document.getElementById('createRoomBtn');
    const joinBtn = document.getElementById('joinRoomBtn');
    const joinForm = document.getElementById('joinRoomForm');
    const confirmJoinBtn = document.getElementById('confirmJoinBtn');

    if (!createBtn || !joinBtn || !confirmJoinBtn) {
      console.error('❌ Menu buttons not found!');
      return;
    }

    createBtn.addEventListener('click', () => {
      console.log('🎯 Create Room clicked');
      const playerName = document.getElementById('playerName').value.trim();
      console.log('Player name:', playerName);
      
      if (!playerName || playerName.length < 2) {
        network.showNotification('Invalid name (min 2 chars)', 'warning');
        return;
      }
      network.createRoom(playerName);
    });

    joinBtn.addEventListener('click', () => {
      console.log('🎯 Join Room clicked');
      joinForm.classList.toggle('hidden');
    });

    confirmJoinBtn.addEventListener('click', () => {
      console.log('🎯 Confirm Join clicked');
      const playerName = document.getElementById('playerName').value.trim();
      const roomCode = document.getElementById('roomCode').value.trim().toUpperCase();
      
      if (!playerName || !roomCode) {
        network.showNotification('Fill all fields', 'warning');
        return;
      }
      
      if (roomCode.length !== 6) {
        network.showNotification('Invalid code (6 chars)', 'warning');
        return;
      }
      
      network.joinRoom(roomCode, playerName);
    });

    console.log('✅ Menu screen setup complete');
  }

  setupLobbyScreen() {
    const startBtn = document.getElementById('startGameBtn');
    const leaveBtn = document.getElementById('leaveLobbyBtn');
    const copyBtn = document.getElementById('copyCodeBtn');

    if (!startBtn || !leaveBtn || !copyBtn) {
      console.error('❌ Lobby buttons not found!');
      return;
    }

    startBtn.addEventListener('click', () => {
      console.log('🚀 START GAME CLICKED!');
      console.log('Current room:', network.currentRoom);
      console.log('Player ID:', network.playerId);
      
      if (!network.currentRoom) {
        console.error('❌ No current room!');
        network.showNotification('No room found', 'error');
        return;
      }
      
      console.log('📤 Sending startGame event...');
      network.startGame();
    });

    leaveBtn.addEventListener('click', () => {
      console.log('🚪 Leave lobby clicked');
      if (confirm('Leave lobby?')) location.reload();
    });

    copyBtn.addEventListener('click', () => {
      console.log('📋 Copy code clicked');
      const code = document.getElementById('displayRoomCode').textContent;
      navigator.clipboard.writeText(code).then(() => {
        network.showNotification('Code copied!', 'success');
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    });

    console.log('✅ Lobby screen setup complete');
  }

  updateLobby(roomData) {
    console.log('📊 Updating lobby with data:', roomData);
    
    document.getElementById('displayRoomCode').textContent = roomData.code;

    const playersList = document.getElementById('playersList');
    const playerCount = document.getElementById('playerCount');
    playersList.innerHTML = '';
    playerCount.textContent = roomData.players.length;

    roomData.players.forEach(player => {
      const card = document.createElement('div');
      card.className = 'player-card';
      card.style.borderLeftColor = player.color;
      card.innerHTML = `
        <div class="player-color-dot" style="background: ${player.color}"></div>
        <span>${player.name}</span>
        ${player.id === roomData.hostId ? '<span>👑</span>' : ''}
      `;
      playersList.appendChild(card);
    });

    const startBtn = document.getElementById('startGameBtn');
    console.log('Player ID:', network.playerId);
    console.log('Host ID:', roomData.hostId);
    console.log('Is host?', network.playerId === roomData.hostId);
    
    if (network.playerId === roomData.hostId) {
      startBtn.style.display = 'block';
      startBtn.disabled = roomData.players.length < 1;
      console.log('✅ Start button visible (you are host)');
    } else {
      startBtn.style.display = 'none';
      console.log('ℹ️ Start button hidden (not host)');
    }
  }

  setupGameScreen() {
    const centerBtn = document.getElementById('centerBaseBtn');
    const leaveBtn = document.getElementById('leaveGameBtn');

    if (!centerBtn || !leaveBtn) {
      console.error('❌ Game screen buttons not found!');
      return;
    }

    centerBtn.addEventListener('click', () => {
      console.log('🎯 Center on base clicked');
      game.centerOnBase();
    });

    leaveBtn.addEventListener('click', () => {
      console.log('🚪 Leave game clicked');
      if (confirm('Leave game?')) location.reload();
    });

    console.log('✅ Game screen setup complete');
  }

  updateGameHUD(player, mapData) {
    if (!player) return;

    document.getElementById('hudPlayerName').textContent = player.name;
    document.getElementById('hudPlayerColor').style.background = player.color;
    document.getElementById('hudGold').textContent = Math.floor(player.gold);
    document.getElementById('hudIncome').textContent = Math.floor(player.income);
    document.getElementById('hudTroops').textContent = Math.floor(player.troops);
    
    const cells = mapData?.cells?.filter(c => c.o === player.id).length || 0;
    document.getElementById('hudCells').textContent = cells;
  }

  showCellTooltip(mouseX, mouseY, x, y, mapData, gameState) {
    const tooltip = document.getElementById('cellTooltip');
    const cellData = mapData.cells.find(c => c.x === x && c.y === y);
    
    if (!cellData || cellData.t !== 'l') {
      tooltip.classList.add('hidden');
      return;
    }

    let ownerName = 'Neutral';
    let ownerColor = '#8b92a8';
    
    if (cellData.o) {
      const owner = gameState.players.find(p => p.id === cellData.o);
      if (owner) {
        ownerName = owner.name;
        ownerColor = owner.color;
      }
    }

    const buildingNames = {
      city: '🏛️ City',
      port: '⚓ Port',
      outpost: '🏰 Outpost',
      barracks: '⚔️ Barracks'
    };

    tooltip.innerHTML = `
      <div class="owner" style="color: ${ownerColor}">${ownerName}</div>
      <div class="stat">
        <span>Troops:</span>
        <span class="stat-value">${Math.floor(cellData.tr || 0)}</span>
      </div>
      ${cellData.b ? `<div class="stat">
        <span>Building:</span>
        <span class="stat-value">${buildingNames[cellData.b]}</span>
      </div>` : ''}
    `;

    const tooltipWidth = 160;
    const tooltipHeight = 80;
    let left = mouseX + 15;
    let top = mouseY + 15;

    if (left + tooltipWidth > window.innerWidth) left = mouseX - tooltipWidth - 15;
    if (top + tooltipHeight > window.innerHeight) top = mouseY - tooltipHeight - 15;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.remove('hidden');
  }

  hideCellTooltip() {
    document.getElementById('cellTooltip').classList.add('hidden');
  }

  showGameOverModal(data) {
    const duration = Math.floor((data.duration || 0) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    alert(`Game Over!\nWinner: ${data.winner.name}\nDuration: ${minutes}m ${seconds}s`);
    
    setTimeout(() => location.reload(), 2000);
  }

  switchScreen(screenId) {
    console.log('🔄 Switching to screen:', screenId);
    
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = screenId;
      console.log('✅ Screen switched to:', screenId);
    } else {
      console.error('❌ Screen not found:', screenId);
    }
  }
}

const ui = new UIManager();