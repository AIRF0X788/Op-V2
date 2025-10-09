class UIManager {
  constructor() {
    this.currentScreen = 'menuScreen';
  }

  init() {
    this.setupMenuScreen();
    this.setupLobbyScreen();
    this.setupGameScreen();
  }

  setupMenuScreen() {
    const createBtn = document.getElementById('createRoomBtn');
    const joinBtn = document.getElementById('joinRoomBtn');
    const joinForm = document.getElementById('joinRoomForm');
    const confirmJoinBtn = document.getElementById('confirmJoinBtn');

    createBtn.addEventListener('click', () => {
      const playerName = document.getElementById('playerName').value.trim();
      if (!playerName || playerName.length < 2) {
        network.showNotification('Invalid name (min 2 chars)', 'warning');
        return;
      }
      network.createRoom(playerName);
    });

    joinBtn.addEventListener('click', () => {
      joinForm.classList.toggle('hidden');
    });

    confirmJoinBtn.addEventListener('click', () => {
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
  }

  setupLobbyScreen() {
    document.getElementById('startGameBtn').addEventListener('click', () => {
      network.startGame();
    });

    document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
      if (confirm('Leave lobby?')) location.reload();
    });

    document.getElementById('copyCodeBtn').addEventListener('click', () => {
      const code = document.getElementById('displayRoomCode').textContent;
      navigator.clipboard.writeText(code).then(() => {
        network.showNotification('Code copied!', 'success');
      });
    });
  }

  updateLobby(roomData) {
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
    if (network.playerId === roomData.hostId) {
      startBtn.style.display = 'block';
      startBtn.disabled = roomData.players.length < 1;
    } else {
      startBtn.style.display = 'none';
    }
  }

  setupGameScreen() {
    document.getElementById('centerBaseBtn').addEventListener('click', () => {
      game.centerOnBase();
    });

    document.getElementById('leaveGameBtn').addEventListener('click', () => {
      if (confirm('Leave game?')) location.reload();
    });
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
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = screenId;
    }
  }
}

const ui = new UIManager();