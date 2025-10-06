// Gestion de l'interface utilisateur
class UIManager {
  constructor() {
    this.currentScreen = 'menuScreen';
    this.currentPlayer = null;
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
      this.switchScreen('menuScreen');
      location.reload(); // Recharger pour réinitialiser
    });

    copyBtn.addEventListener('click', () => {
      const code = document.getElementById('displayRoomCode').textContent;
      navigator.clipboard.writeText(code).then(() => {
        network.showNotification('Code copié !', 'success');
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

    // Afficher les bots
    const botsList = document.getElementById('botsList');
    const botCount = document.getElementById('botCount');
    botsList.innerHTML = '';
    botCount.textContent = roomData.bots.length;

    roomData.bots.forEach(bot => {
      const card = document.createElement('div');
      card.className = 'bot-card';
      card.style.borderLeftColor = bot.color;
      card.innerHTML = `
        <div class="player-color-dot" style="background: ${bot.color}"></div>
        <span>${bot.name}</span>
        <span>🤖 ${bot.difficulty}</span>
      `;
      botsList.appendChild(card);
    });

    // Afficher le bouton de démarrage seulement pour l'hôte
    const startBtn = document.getElementById('startGameBtn');
    if (network.playerId === roomData.hostId) {
      startBtn.style.display = 'block';
    } else {
      startBtn.style.display = 'none';
    }
  }

  // === ÉCRAN DE JEU ===
  setupGameScreen() {
    // Boutons du HUD
    document.getElementById('allianceBtn').addEventListener('click', () => {
      this.showAllianceModal();
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

    // Actions du panneau de territoire
    document.getElementById('recruitBtn').addEventListener('click', () => {
      this.handleRecruitTroops();
    });

    document.getElementById('attackBtn').addEventListener('click', () => {
      this.handleAttack();
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
    document.getElementById('hudTroops').textContent = player.troops;
  }

  showTerritoryPanel(territory, gameState) {
    const panel = document.getElementById('territoryPanel');
    panel.classList.remove('hidden');

    // Trouver le propriétaire
    let owner = null;
    if (territory.owner) {
      owner = [...gameState.players, ...gameState.bots].find(p => p.id === territory.owner);
    }

    document.getElementById('territoryName').textContent = territory.name;
    document.getElementById('territoryOwner').textContent = owner ? owner.name : 'Neutre';
    document.getElementById('territoryTroops').textContent = territory.troops;
    document.getElementById('territoryIncome').textContent = territory.income;

    // Remplir la liste des cibles d'attaque
    const attackSelect = document.getElementById('attackTarget');
    attackSelect.innerHTML = '<option value="">Sélectionner une cible</option>';
    
    territory.neighbors.forEach(neighborId => {
      const neighbor = gameState.territories.find(t => t.id === neighborId);
      if (neighbor && neighbor.owner !== network.playerId) {
        const neighborOwner = [...gameState.players, ...gameState.bots].find(p => p.id === neighbor.owner);
        const option = document.createElement('option');
        option.value = neighbor.id;
        option.textContent = `${neighbor.name} (${neighborOwner ? neighborOwner.name : 'Neutre'}) - ${neighbor.troops} ⚔️`;
        attackSelect.appendChild(option);
      }
    });

    // Désactiver les actions si ce n'est pas notre territoire
    const isOurs = territory.owner === network.playerId;
    document.getElementById('recruitBtn').disabled = !isOurs;
    document.getElementById('attackBtn').disabled = !isOurs;
    document.getElementById('recruitCount').disabled = !isOurs;
    document.getElementById('attackTroops').disabled = !isOurs;
    document.getElementById('attackTarget').disabled = !isOurs;
  }

  hideTerritoryPanel() {
    document.getElementById('territoryPanel').classList.add('hidden');
  }

  handleRecruitTroops() {
    const territory = game.renderer.selectedTerritory;
    if (!territory) return;

    const count = parseInt(document.getElementById('recruitCount').value);
    if (isNaN(count) || count < 1) {
      network.showNotification('Nombre de troupes invalide', 'warning');
      return;
    }

    network.recruitTroops(territory.id, count);
  }

  handleAttack() {
    const fromTerritory = game.renderer.selectedTerritory;
    if (!fromTerritory) return;

    const toTerritoryId = document.getElementById('attackTarget').value;
    const troops = parseInt(document.getElementById('attackTroops').value);

    if (!toTerritoryId) {
      network.showNotification('Sélectionnez une cible', 'warning');
      return;
    }

    if (isNaN(troops) || troops < 1) {
      network.showNotification('Nombre de troupes invalide', 'warning');
      return;
    }

    if (troops > fromTerritory.troops) {
      network.showNotification('Pas assez de troupes', 'warning');
      return;
    }

    network.attack(fromTerritory.id, toTerritoryId, troops);
    
    // Animation visuelle
    const toTerritory = game.currentGameState.territories.find(t => t.id === toTerritoryId);
    if (toTerritory) {
      game.renderer.animateAttack(fromTerritory, toTerritory);
    }

    network.showNotification('Attaque lancée !', 'info');
  }

  showStatsModal() {
    const modal = document.getElementById('statsModal');
    const content = document.getElementById('statsContent');
    modal.classList.remove('hidden');

    if (!game.currentGameState) return;

    // Calculer les statistiques
    const allPlayers = [...game.currentGameState.players, ...game.currentGameState.bots];
    const stats = allPlayers.map(player => {
      const territoriesOwned = game.currentGameState.territories.filter(t => t.owner === player.id).length;
      const totalTroops = game.currentGameState.territories
        .filter(t => t.owner === player.id)
        .reduce((sum, t) => sum + t.troops, 0);
      
      return {
        name: player.name,
        color: player.color,
        gold: Math.floor(player.gold),
        income: Math.floor(player.income),
        territories: territoriesOwned,
        troops: totalTroops,
        isBot: player.isBot
      };
    }).sort((a, b) => b.territories - a.territories);

    // Afficher les stats
    content.innerHTML = `
      <div class="stats-table">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="border-bottom: 2px solid var(--border-color);">
              <th style="padding: 0.75rem; text-align: left;">Rang</th>
              <th style="padding: 0.75rem; text-align: left;">Joueur</th>
              <th style="padding: 0.75rem; text-align: center;">Territoires</th>
              <th style="padding: 0.75rem; text-align: center;">Troupes</th>
              <th style="padding: 0.75rem; text-align: center;">Or</th>
              <th style="padding: 0.75rem; text-align: center;">Revenu/s</th>
            </tr>
          </thead>
          <tbody>
            ${stats.map((player, index) => `
              <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.75rem;">
                  ${index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                </td>
                <td style="padding: 0.75rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 15px; height: 15px; border-radius: 50%; background: ${player.color};"></div>
                    ${player.name} ${player.isBot ? '🤖' : ''}
                  </div>
                </td>
                <td style="padding: 0.75rem; text-align: center;">${player.territories}</td>
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

  showAllianceModal() {
    const modal = document.getElementById('allianceModal');
    const content = document.getElementById('allianceContent');
    modal.classList.remove('hidden');

    if (!game.currentGameState) return;

    const currentPlayer = game.currentGameState.players.find(p => p.id === network.playerId);
    const otherPlayers = game.currentGameState.players.filter(p => p.id !== network.playerId);

    content.innerHTML = `
      <div class="alliance-section">
        <h3 style="margin-bottom: 1rem; color: var(--secondary-color);">Vos alliances</h3>
        ${currentPlayer && currentPlayer.alliances && currentPlayer.alliances.length > 0 ? `
          <div class="alliance-list">
            ${currentPlayer.alliances.map(allyId => {
              const ally = game.currentGameState.players.find(p => p.id === allyId);
              return ally ? `
                <div class="alliance-item" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: var(--dark-bg); border-radius: 8px; margin-bottom: 0.5rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="width: 15px; height: 15px; border-radius: 50%; background: ${ally.color};"></div>
                    <span>${ally.name}</span>
                  </div>
                  <button class="btn btn-danger btn-small" onclick="game.ui.breakAlliance('${allyId}')">Rompre</button>
                </div>
              ` : '';
            }).join('')}
          </div>
        ` : '<p style="color: var(--text-muted);">Vous n\'avez pas d\'alliance pour le moment.</p>'}

        <h3 style="margin: 2rem 0 1rem; color: var(--primary-color);">Proposer une alliance</h3>
        ${otherPlayers.length > 0 ? `
          <div class="players-alliance-list">
            ${otherPlayers.map(player => `
              <div class="alliance-item" style="display: flex; align-items: center; justify-content: space-between; padding: 1rem; background: var(--dark-bg); border-radius: 8px; margin-bottom: 0.5rem;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <div style="width: 15px; height: 15px; border-radius: 50%; background: ${player.color};"></div>
                  <span>${player.name}</span>
                </div>
                <button class="btn btn-primary btn-small" onclick="game.ui.proposeAlliance('${player.id}')">
                  ${currentPlayer.alliances && currentPlayer.alliances.includes(player.id) ? '✓ Allié' : 'Proposer'}
                </button>
              </div>
            `).join('')}
          </div>
        ` : '<p style="color: var(--text-muted);">Aucun autre joueur disponible.</p>'}

        <div style="margin-top: 2rem; padding: 1rem; background: rgba(52, 152, 219, 0.1); border-radius: 8px; border-left: 3px solid var(--primary-color);">
          <p style="font-size: 0.9rem;"><strong>💡 Info :</strong> Les alliances permettent de coordonner vos attaques et de partager des territoires. Les alliés ne peuvent pas s'attaquer mutuellement.</p>
        </div>
      </div>
    `;
  }

  proposeAlliance(playerId) {
    // TODO: Implémenter la logique d'alliance côté serveur
    network.showNotification('Fonctionnalité bientôt disponible !', 'info');
    console.log('Proposer alliance à', playerId);
  }

  breakAlliance(playerId) {
    // TODO: Implémenter la logique de rupture d'alliance
    network.showNotification('Alliance rompue', 'warning');
    console.log('Rompre alliance avec', playerId);
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