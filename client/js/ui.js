// client/js/ui.js - Gestion de l'interface utilisateur

class UIManager {
  constructor() {
    this.currentScreen = 'menuScreen';
    this.currentCell = null;
  }

  init() {
    this.setupMenuScreen();
    this.setupLobbyScreen();
    this.setupGameScreen();
  }

  // === MENU PRINCIPAL ===
  setupMenuScreen() {
    const createBtn = document.getElementById('createRoomBtn');
    const joinBtn = document.getElementById('joinRoomBtn');
    const joinForm = document.getElementById('joinRoomForm');
    const confirmJoinBtn = document.getElementById('confirmJoinBtn');

    createBtn.addEventListener('click', () => {
      const playerName = document.getElementById('playerName').value.trim();
      if (!playerName) {
        network.showNotification('Veuillez entrer un pseudo', 'warning');
        return;
      }
      if (playerName.length < 2) {
        network.showNotification('Le pseudo doit faire au moins 2 caractères', 'warning');
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
        network.showNotification('Veuillez remplir tous les champs', 'warning');
        return;
      }
      
      if (roomCode.length !== 6) {
        network.showNotification('Le code doit faire 6 caractères', 'warning');
        return;
      }
      
      network.joinRoom(roomCode, playerName);
    });
  }

  // === LOBBY ===
  setupLobbyScreen() {
    const startBtn = document.getElementById('startGameBtn');
    const leaveBtn = document.getElementById('leaveLobbyBtn');
    const copyBtn = document.getElementById('copyCodeBtn');

    startBtn.addEventListener('click', () => {
      network.startGame();
    });

    leaveBtn.addEventListener('click', () => {
      if (confirm('Voulez-vous vraiment quitter le lobby ?')) {
        this.switchScreen('menuScreen');
        location.reload();
      }
    });

    copyBtn.addEventListener('click', () => {
      const code = document.getElementById('displayRoomCode').textContent;
      navigator.clipboard.writeText(code).then(() => {
        network.showNotification('Code copié dans le presse-papier !', 'success');
      });
    });
  }

  updateLobby(roomData) {
    // Afficher le code de la room
    document.getElementById('displayRoomCode').textContent = roomData.code;

    // Afficher les joueurs
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
        ${player.id === roomData.hostId ? '<span>👑 Hôte</span>' : ''}
      `;
      playersList.appendChild(card);
    });

    // Afficher le bouton de démarrage seulement pour l'hôte
    const startBtn = document.getElementById('startGameBtn');
    if (network.playerId === roomData.hostId) {
      startBtn.style.display = 'block';
      startBtn.disabled = roomData.players.length < 1;
    } else {
      startBtn.style.display = 'none';
    }
  }

  // === ÉCRAN DE JEU ===
  setupGameScreen() {
    // Boutons du HUD
    document.getElementById('centerBaseBtn').addEventListener('click', () => {
      game.centerOnBase();
    });

    document.getElementById('statsBtn').addEventListener('click', () => {
      this.showStatsModal();
    });

    document.getElementById('leaveGameBtn').addEventListener('click', () => {
      if (confirm('Voulez-vous vraiment quitter la partie ?')) {
        this.switchScreen('menuScreen');
        location.reload();
      }
    });

    // Actions du panneau de cellule
    document.getElementById('expandBtn').addEventListener('click', () => {
      this.handleExpand();
    });

    document.getElementById('reinforceBtn').addEventListener('click', () => {
      this.handleReinforce();
    });

    // Fermeture des modals
    document.querySelectorAll('.close-modal').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.target.closest('.modal').classList.add('hidden');
      });
    });

    // Fermer modal en cliquant à l'extérieur
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });
  }

  updateGameHUD(player) {
    if (!player) return;

    document.getElementById('hudPlayerName').textContent = player.name;
    document.getElementById('hudPlayerColor').style.background = player.color;
    document.getElementById('hudGold').textContent = Math.floor(player.gold);
    document.getElementById('hudIncome').textContent = Math.floor(player.income);
    
    // Calculer le nombre de cellules
    const cells = game.mapData?.cells?.filter(c => c.o === player.id).length || 0;
    document.getElementById('hudCells').textContent = cells;
    document.getElementById('hudTroops').textContent = player.troops || 0;
  }

  showCellPanel(x, y, mapData, gameState) {
    const panel = document.getElementById('cellPanel');
    panel.classList.remove('hidden');

    this.currentCell = { x, y };

    // Trouver les données de la cellule
    const cellData = mapData.cells.find(c => c.x === x && c.y === y);
    
    if (!cellData) {
      panel.classList.add('hidden');
      return;
    }

    // Trouver le propriétaire
    let owner = null;
    let ownerName = 'Neutre';
    if (cellData.o) {
      owner = gameState.players.find(p => p.id === cellData.o);
      ownerName = owner ? owner.name : 'Inconnu';
    }

    document.getElementById('cellInfo').textContent = `Cellule (${x}, ${y})`;
    document.getElementById('cellOwner').textContent = ownerName;
    document.getElementById('cellTroops').textContent = cellData.tr || 0;
    document.getElementById('cellPosition').textContent = `${x}, ${y}`;

    // Déterminer les actions possibles
    const isOurs = cellData.o === network.playerId;
    const isAdjacent = this.isCellAdjacentToPlayer(x, y, network.playerId, mapData);
    const isNeutral = !cellData.o;
    const isEnemy = cellData.o && cellData.o !== network.playerId;

    // Bouton d'expansion
    const expandBtn = document.getElementById('expandBtn');
    if (isOurs) {
      expandBtn.disabled = true;
      expandBtn.textContent = '✅ Votre territoire';
    } else if (isAdjacent) {
      expandBtn.disabled = false;
      if (isNeutral) {
        expandBtn.textContent = '➕ Conquérir (50💰)';
        expandBtn.className = 'btn btn-primary';
      } else if (isEnemy) {
        expandBtn.textContent = '⚔️ Attaquer (50💰)';
        expandBtn.className = 'btn btn-danger';
      }
    } else {
      expandBtn.disabled = true;
      expandBtn.textContent = '❌ Pas adjacent';
    }

    // Renforcement
    document.getElementById('reinforceBtn').disabled = !isOurs;
    document.getElementById('reinforceCount').disabled = !isOurs;
  }

  isCellAdjacentToPlayer(x, y, playerId, mapData) {
    // Vérifier les 8 voisins
    const directions = [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0],           [1, 0],
      [-1, 1],  [0, 1],  [1, 1]
    ];

    return directions.some(([dx, dy]) => {
      const neighbor = mapData.cells.find(c => c.x === x + dx && c.y === y + dy);
      return neighbor && neighbor.o === playerId;
    });
  }

  hideCellPanel() {
    document.getElementById('cellPanel').classList.add('hidden');
    this.currentCell = null;
  }

  handleExpand() {
    if (!this.currentCell) return;

    const { x, y } = this.currentCell;
    game.expandToCell(x, y);
  }

  handleReinforce() {
    if (!this.currentCell) return;

    const count = parseInt(document.getElementById('reinforceCount').value);
    if (isNaN(count) || count < 1) {
      network.showNotification('Nombre invalide', 'warning');
      return;
    }

    const { x, y } = this.currentCell;
    game.reinforceCell(x, y, count);
  }

  showStatsModal() {
    const modal = document.getElementById('statsModal');
    const content = document.getElementById('statsContent');
    modal.classList.remove('hidden');

    if (!game.currentGameState) return;

    const players = game.currentGameState.players.map(player => {
      const cells = game.mapData?.cells?.filter(c => c.o === player.id).length || 0;
      
      return {
        name: player.name,
        color: player.color,
        gold: Math.floor(player.gold),
        income: Math.floor(player.income),
        cells: cells,
        troops: player.troops || 0
      };
    }).sort((a, b) => b.cells - a.cells);

    content.innerHTML = `
      <div class="stats-table">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color);">
              <th style="padding: 0.75rem; text-align: left;">Rang</th>
              <th style="padding: 0.75rem; text-align: left;">Joueur</th>
              <th style="padding: 0.75rem; text-align: center;">Cellules</th>
              <th style="padding: 0.75rem; text-align: center;">Troupes</th>
              <th style="padding: 0.75rem; text-align: center;">Or</th>
              <th style="padding: 0.75rem; text-align: center;">Revenu/s</th>
            </tr>
          </thead>
          <tbody>
            ${players.map((player, index) => `
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.75rem;">
                  ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </td>
                <td style="padding: 0.75rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 15px; height: 15px; border-radius: 50%; background: ${player.color};"></div>
                    ${player.name}
                  </div>
                </td>
                <td style="padding: 0.75rem; text-align: center;">🏠 ${player.cells}</td>
                <td style="padding: 0.75rem; text-align: center;">⚔️ ${player.troops}</td>
                <td style="padding: 0.75rem; text-align: center;">💰 ${player.gold}</td>
                <td style="padding: 0.75rem; text-align: center;">📈 ${player.income}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  showGameOverModal(data) {
    const modal = document.getElementById('statsModal');
    const content = document.getElementById('statsContent');
    modal.classList.remove('hidden');

    const duration = Math.floor((data.duration || 0) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    content.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <h2 style="font-size: 3rem; margin-bottom: 1rem;">
          ${data.winner.id === network.playerId ? '🎉' : '👑'}
        </h2>
        <h3 style="margin-bottom: 2rem;">
          ${data.winner.name} a conquis l'Europe !
        </h3>
        <p style="margin-bottom: 2rem; color: var(--text-muted);">
          Durée de la partie : ${minutes}m ${seconds}s
        </p>
        
        <h4 style="margin: 2rem 0 1rem;">📊 Classement final</h4>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color);">
              <th style="padding: 0.75rem;">Rang</th>
              <th style="padding: 0.75rem;">Joueur</th>
              <th style="padding: 0.75rem;">Cellules</th>
              <th style="padding: 0.75rem;">Troupes</th>
            </tr>
          </thead>
          <tbody>
            ${data.stats.map((player, index) => `
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.75rem; text-align: center;">
                  ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </td>
                <td style="padding: 0.75rem;">${player.name}</td>
                <td style="padding: 0.75rem; text-align: center;">${player.cells}</td>
                <td style="padding: 0.75rem; text-align: center;">${player.troops}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <button class="btn btn-primary btn-large" style="margin-top: 2rem;" onclick="location.reload()">
          Nouvelle partie
        </button>
      </div>
    `;
  }

  // === NAVIGATION ===
  switchScreen(screenId) {
    // Cacher tous les écrans
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // Afficher l'écran demandé
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.add('active');
      this.currentScreen = screenId;
    }
  }
}

// Instance globale
const ui = new UIManager();