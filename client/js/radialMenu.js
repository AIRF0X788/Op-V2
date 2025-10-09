class RadialMenu {
  constructor() {
    this.container = document.getElementById('radialMenu');
    this.centerIcon = document.getElementById('radialCenter');
    this.isOpen = false;
    this.selectedCell = null;
    this.currentGameState = null;
    this.items = [];
    this.radius = 110;
    this.itemSize = 80;
    
    this.createOverlay();
    this.setupGlobalListeners();
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'radial-overlay';
    this.overlay.addEventListener('click', () => this.close());
    document.body.appendChild(this.overlay);
  }

  setupGlobalListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });

    document.addEventListener('contextmenu', (e) => {
      if (this.isOpen) {
        e.preventDefault();
        this.close();
      }
    });
  }

  open(x, y, cellData, gameState) {
    this.selectedCell = { x, y, data: cellData };
    this.currentGameState = gameState;
    
    this.container.classList.remove('hidden');
    this.overlay.classList.add('active');
    
    const menuSize = 300;
    const padding = 20;
    
    let menuX = Math.max(padding, Math.min(window.innerWidth - menuSize - padding, x - menuSize/2));
    let menuY = Math.max(padding, Math.min(window.innerHeight - menuSize - padding, y - menuSize/2));
    
    this.container.style.left = `${menuX}px`;
    this.container.style.top = `${menuY}px`;
    
    this.buildMenuItems(cellData, gameState);
    
    setTimeout(() => {
      this.container.classList.add('active');
      this.isOpen = true;
    }, 50);
  }

  close() {
    this.container.classList.remove('active');
    this.overlay.classList.remove('active');
    this.isOpen = false;
    
    setTimeout(() => {
      this.clearItems();
      this.container.classList.add('hidden');
    }, 400);
    
    this.selectedCell = null;
    this.currentGameState = null;
  }

  buildMenuItems(cellData, gameState) {
    this.clearItems();
    
    const isOurs = cellData.o === network.playerId;
    const isEnemy = cellData.o && cellData.o !== network.playerId;
    const isAdjacent = this.isCellAdjacentToPlayer(cellData.x, cellData.y);
    
    const currentPlayer = gameState.players.find(p => p.id === network.playerId);
    const hasBuilding = cellData.b !== null;
    
    if (isOurs) {
      this.centerIcon.textContent = '✓';
      this.centerIcon.style.borderColor = currentPlayer?.color || '#4a9eff';
      this.centerIcon.style.color = currentPlayer?.color || '#4a9eff';
    } else if (isEnemy) {
      this.centerIcon.textContent = '⚔️';
      this.centerIcon.style.borderColor = '#e74c3c';
      this.centerIcon.style.color = '#e74c3c';
    } else {
      this.centerIcon.textContent = '○';
      this.centerIcon.style.borderColor = '#2ecc71';
      this.centerIcon.style.color = '#2ecc71';
    }
    
    const actions = [];
    
    if (isOurs) {
      actions.push({
        icon: '🛡️',
        label: 'Reinforce',
        cost: '100💰',
        action: 'reinforce',
        canAfford: currentPlayer.gold >= 100
      });
      
      if (!hasBuilding) {
        actions.push(
          { icon: '🏛️', label: 'City', cost: '500💰', action: 'buildCity', canAfford: currentPlayer.gold >= 500 },
          { icon: '⚓', label: 'Port', cost: '300💰', action: 'buildPort', canAfford: currentPlayer.gold >= 300 },
          { icon: '🏰', label: 'Outpost', cost: '200💰', action: 'buildOutpost', canAfford: currentPlayer.gold >= 200 },
          { icon: '⚔️', label: 'Barracks', cost: '400💰', action: 'buildBarracks', canAfford: currentPlayer.gold >= 400 }
        );
      }
    } else if (isAdjacent) {
      const adjacentTroops = this.getAdjacentTroops(cellData.x, cellData.y);
      if (isEnemy) {
        const isAlly = typeof allianceSystem !== 'undefined' && 
                       allianceSystem.currentAlliances.has(cellData.o);
        
        if (!isAlly) {
          actions.push({
            icon: '⚔️',
            label: 'Attack',
            cost: '5⚔️',
            action: 'attack',
            canAfford: adjacentTroops >= 5 && (adjacentTroops - 5) > cellData.tr
          });
        } else {
          actions.push({
            icon: '🤝',
            label: 'Allied',
            cost: '',
            action: 'info',
            canAfford: false
          });
        }
      } else {
        actions.push({
          icon: '➕',
          label: 'Expand',
          cost: '5⚔️',
          action: 'expand',
          canAfford: adjacentTroops >= 5
        });
      }
    }
    
    actions.push({
      icon: 'ℹ️',
      label: 'Info',
      cost: '',
      action: 'info',
      canAfford: true
    });
    
    this.createRadialItems(actions);
  }

  createRadialItems(actions) {
    const angleStep = (2 * Math.PI) / actions.length;
    
    actions.forEach((action, index) => {
      const angle = angleStep * index - Math.PI / 2;
      const x = 150 + Math.cos(angle) * this.radius;
      const y = 150 + Math.sin(angle) * this.radius;
      
      const item = document.createElement('div');
      item.className = 'radial-item';
      if (!action.canAfford) item.classList.add('disabled');
      
      item.style.left = `${x}px`;
      item.style.top = `${y}px`;
      
      item.innerHTML = `
        <div class="radial-item-icon">${action.icon}</div>
        <div class="radial-item-label">${action.label}</div>
        ${action.cost ? `<div class="radial-item-cost">${action.cost}</div>` : ''}
      `;
      
      if (action.canAfford) {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          this.handleAction(action.action);
        });
      }
      
      this.container.appendChild(item);
      this.items.push(item);
    });
  }

  clearItems() {
    this.items.forEach(item => item.remove());
    this.items = [];
  }

  handleAction(action) {
    if (!this.selectedCell) return;
    
    const { x, y } = this.selectedCell;
    
    switch (action) {
      case 'expand':
      case 'attack':
        game.expandToCell(x, y);
        break;
        
      case 'reinforce':
        const troops = prompt('How many troops to add? (10💰 per troop)', '10');
        if (troops && !isNaN(troops) && troops > 0) {
          game.reinforceCell(x, y, parseInt(troops));
        }
        break;
        
      case 'buildCity':
        game.buildBuilding(x, y, 'city');
        break;
        
      case 'buildPort':
        game.buildBuilding(x, y, 'port');
        break;
        
      case 'buildOutpost':
        game.buildBuilding(x, y, 'outpost');
        break;
        
      case 'buildBarracks':
        game.buildBuilding(x, y, 'barracks');
        break;
        
      case 'info':
        this.showCellInfo();
        return;
    }
    
    this.close();
  }

  showCellInfo() {
    if (!this.selectedCell) return;
    
    const { x, y } = this.selectedCell;
    const cellData = game.mapData.cells.find(c => c.x === x && c.y === y);
    
    if (!cellData) return;
    
    let ownerName = 'Neutral';
    if (cellData.o) {
      const owner = game.currentGameState.players.find(p => p.id === cellData.o);
      ownerName = owner ? owner.name : 'Unknown';
    }
    
    const buildingNames = {
      city: '🏛️ City',
      port: '⚓ Port',
      outpost: '🏰 Outpost',
      barracks: '⚔️ Barracks'
    };
    
    let message = `📍 Position: (${x}, ${y})\n👤 Owner: ${ownerName}\n🛡️ Troops: ${Math.floor(cellData.tr || 0)}`;
    if (cellData.b) {
      message += `\n🏗️ Building: ${buildingNames[cellData.b]}`;
    }
    
    network.showNotification(message, 'info');
  }

  isCellAdjacentToPlayer(x, y) {
    const directions = [
      [-1,-1],[0,-1],[1,-1],
      [-1,0],[1,0],
      [-1,1],[0,1],[1,1]
    ];

    return directions.some(([dx, dy]) => {
      const neighbor = game.mapData.cells.find(c => c.x === x + dx && c.y === y + dy);
      return neighbor && neighbor.o === network.playerId;
    });
  }

  getAdjacentTroops(x, y) {
    const directions = [
      [-1,-1],[0,-1],[1,-1],
      [-1,0],[1,0],
      [-1,1],[0,1],[1,1]
    ];

    let total = 0;
    directions.forEach(([dx, dy]) => {
      const neighbor = game.mapData.cells.find(c => c.x === x + dx && c.y === y + dy);
      if (neighbor && neighbor.o === network.playerId) {
        total += neighbor.tr || 0;
      }
    });

    return total;
  }
}

const radialMenu = new RadialMenu();