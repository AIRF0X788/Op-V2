// client/js/ui.js

class UIManager {
  constructor() {
    this.currentScreen = 'menuScreen';
    this.panelCollapsed = false;
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
        network.showNotification('Nom invalide (min 2 caractères)', 'warning');
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
        network.showNotification('Remplir tous les champs', 'warning');
        return;
      }
      
      if (roomCode.length !== 6) {
        network.showNotification('Code invalide (6 caractères)', 'warning');
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
      if (confirm('Quitter le lobby ?')) {
        location.reload();
      }
    });

    document.getElementById('copyCodeBtn').addEventListener('click', () => {
      const code = document.getElementById('displayRoomCode').textContent;
      navigator.clipboard.writeText(code).then(() => {
        network.showNotification('Code copié !', 'success');
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

    document.getElementById('togglePanelBtn').addEventListener('click', () => {
      this.toggleSidePanel();
    });

    document.getElementById('leaveGameBtn').addEventListener('click', () => {
      if (confirm('Quitter la partie ?')) {
        location.reload();
      }
    });

    // Bouton d'expansion
    document.getElementById('expandCellBtn').addEventListener('click', () => {
      if (game.selectedCell) {
        game.expandToCell(game.selectedCell.x, game.selectedCell.y);
      }
    });

    // Boutons de bâtiments
    document.querySelectorAll('.building-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const buildingType = btn.dataset.building;
        if (game.selectedCell) {
          game.buildBuilding(game.selectedCell.x, game.selectedCell.y, buildingType);
        }
      });
    });
  }

  updateGameHUD(player, mapData) {
    if (!player) return;

    document.getElementById('hudPlayerName').textContent = player.name;
    document.getElementById('hudPlayerColor').style.background = player.color;
    document.getElementById('hudGold').textContent = player.gold;
    document.getElementById('hudIncome').textContent = player.income;
    document.getElementById('hudTroops').textContent = player.troops;
    
    const cells = mapData?.cells?.filter(c => c.o === player.id).length || 0;
    document.getElementById('hudCells').textContent = cells;

    // Mettre à jour les stats du panneau
    document.getElementById('statTerritories').textContent = cells;
    document.getElementById('statTroops').textContent = player.troops;
    document.getElementById('statIncome').textContent = player.income;
    document.getElementById('statGold').textContent = player.gold;
    
    const cities = mapData?.cells?.filter(c => c.o === player.id && c.b === 'city').length || 0;
    document.getElementById('statCities').textContent = cities;
  }

  showCellPanel(x, y, mapData, gameState) {
    const section = document.getElementById('cellInfoSection');
    section.classList.remove('hidden');

    const cellData = mapData.cells.find(c => c.x === x && c.y === y);
    if (!cellData) {
      section.classList.add('hidden');
      return;
    }

    let ownerName = 'Neutral';
    let isOurs = false;
    
    if (cellData.o) {
      const owner = gameState.players.find(p => p.id === cellData.o);
      ownerName = owner ? owner.name : 'Unknown';
      isOurs = cellData.o === network.playerId;
    }

    document.getElementById('cellOwner').textContent = ownerName;
    document.getElementById('cellTroops').textContent = cellData.tr || 0;
    
    const buildingNames = {
      city: '🏛️ City',
      port: '⚓ Port',
      outpost: '🏰 Outpost',
      barracks: '⚔️ Barracks'
    };
    document.getElementById('cellBuilding').textContent = cellData.b ? buildingNames[cellData.b] : 'None';

    // Bouton d'expansion
    const expandBtn = document.getElementById('expandCellBtn');
    const isAdjacent = this.isCellAdjacentToPlayer(x, y, network.playerId, mapData);

    if (isOurs) {
      expandBtn.style.display = 'none';
    } else if (isAdjacent) {
      expandBtn.style.display = 'block';
      expandBtn.disabled = false;
      if (cellData.o) {
        expandBtn.textContent = `⚔️ Attack (Cost: 5 troops)`;
        expandBtn.className = 'btn btn-danger';
      } else {
        expandBtn.textContent = `➕ Expand (Cost: 5 troops)`;
        expandBtn.className = 'btn btn-primary';
      }
    } else {
      expandBtn.style.display = 'block';
      expandBtn.disabled = true;
      expandBtn.textContent = '❌ Not adjacent';
    }

    // Bâtiments disponibles seulement sur notre territoire
    const buildingBtns = document.querySelectorAll('.building-btn');
    buildingBtns.forEach(btn => {
      btn.disabled = !isOurs || cellData.b !== null;
    });
  }

  hideCellPanel() {
    document.getElementById('cellInfoSection').classList.add('hidden');
  }

  isCellAdjacentToPlayer(x, y, playerId, mapData) {
    const directions = [
      [-1,-1],[0,-1],[1,-1],
      [-1,0],[1,0],
      [-1,1],[0,1],[1,1]
    ];

    return directions.some(([dx, dy]) => {
      const neighbor = mapData.cells.find(c => c.x === x + dx && c.y === y + dy);
      return neighbor && neighbor.o === playerId;
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
    let ownerColor = '#888';
    
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
      <div class="stat"><span>Position:</span><span>(${x}, ${y})</span></div>
      <div class="stat"><span>Troops:</span><span>${cellData.tr || 0}</span></div>
      ${cellData.b ? `<div class="stat"><span>Building:</span><span>${buildingNames[cellData.b]}</span></div>` : ''}
    `;

    tooltip.style.left = `${mouseX + 15}px`;
    tooltip.style.top = `${mouseY + 15}px`;
    tooltip.classList.remove('hidden');
  }

  hideCellTooltip() {
    document.getElementById('cellTooltip').classList.add('hidden');
  }

  updateLeaderboard(players, mapData) {
    const leaderboardList = document.getElementById('leaderboardList');
    
    const sorted = players.map(p => {
      const cells = mapData.cells.filter(c => c.o === p.id).length;
      return { ...p, cells };
    }).sort((a, b) => b.cells - a.cells);

    leaderboardList.innerHTML = sorted.slice(0, 5).map((p, i) => `
      <div class="stat-row">
        <span class="label">
          ${i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
          <span style="color: ${p.color}">●</span> ${p.name}
        </span>
        <span class="value">${p.cells}</span>
      </div>
    `).join('');
  }

  toggleSidePanel() {
    const panel = document.getElementById('sidePanel');
    this.panelCollapsed = !this.panelCollapsed;
    panel.classList.toggle('collapsed', this.panelCollapsed);
  }

  showGameOverModal(data) {
    alert(`Game Over!\nWinner: ${data.winner.name}\nDuration: ${Math.floor(data.duration / 1000)}s`);
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