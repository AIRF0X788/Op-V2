function updateGameHUD(player, mapData) {
    if (!player) return;

    document.getElementById('hudPlayerName').textContent = player.name;
    document.getElementById('hudPlayerColor').style.background = player.color;
    document.getElementById('hudGold').textContent = Math.floor(player.gold);
    document.getElementById('hudIncome').textContent = Math.floor(player.income);
    document.getElementById('hudTroops').textContent = Math.floor(player.troops);
    
    const cells = mapData?.cells?.filter(c => c.o === player.id).length || 0;
    document.getElementById('hudCells').textContent = cells;
    
    // Mettre à jour l'indicateur d'expansion
    const canvas = document.getElementById('gameCanvas');
    const indicator = document.getElementById('expansionIndicator');
    
    if (player.isExpanding) {
      canvas.classList.add('expanding');
      if (indicator) indicator.classList.remove('hidden');
    } else {
      canvas.classList.remove('expanding');
      if (indicator) indicator.classList.add('hidden');
    }
    }
  
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
    const startBtn = document.getElementById('startGameBtn');
    const leaveBtn = document.getElementById('leaveLobbyBtn');
    const copyBtn = document.getElementById('copyCodeBtn');

    if (!startBtn || !leaveBtn || !copyBtn) {
      console.error('❌ Lobby buttons not found!');
      return;
    }

    startBtn.addEventListener('click', () => {
      network.startGame();
    });

    leaveBtn.addEventListener('click', () => {
      if (confirm('Leave lobby?')) location.reload();
    });

    copyBtn.addEventListener('click', () => {
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
        ${player.isBot ? '<span class="bot-badge">BOT</span>' : ''}
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
    const centerBtn = document.getElementById('centerBaseBtn');
    const leaveBtn = document.getElementById('leaveGameBtn');

    if (!centerBtn || !leaveBtn) {
      console.error('❌ Game screen buttons not found!');
      return;
    }

    centerBtn.addEventListener('click', () => {
      game.centerOnBase();
    });

    leaveBtn.addEventListener('click', () => {
      if (confirm('Leave game?')) location.reload();
    });
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

    tooltip.innerHTML = `
      <div class="owner" style="color: ${ownerColor}">${ownerName}</div>
      <div class="stat">
        <span>Position:</span>
        <span class="stat-value">(${x}, ${y})</span>
      </div>
    `;

    const tooltipWidth = 160;
    const tooltipHeight = 60;
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

    let statsText = '\n\nFinal Stats:\n';
    data.stats.forEach((stat, i) => {
      statsText += `${i + 1}. ${stat.name}: ${stat.cells} cells, ${stat.troops} troops\n`;
    });

    alert(`Game Over!\n\nWinner: ${data.winner.name}\nDuration: ${minutes}m ${seconds}s${statsText}`);
    
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
    }
  }
}

const ui = new UIManager();