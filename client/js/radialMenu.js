class RadialMenu {
  constructor() {
    this.container = document.getElementById('radialMenu');
    this.centerIcon = document.getElementById('radialCenter');
    this.isOpen = false;
    this.selectedCell = null;
    this.items = [];
    this.radius = 105;
    this.itemSize = 70;
    
    this.setupGlobalListeners();
  }

  setupGlobalListeners() {
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.container.contains(e.target)) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  open(x, y, cellData, gameState) {
    this.selectedCell = { x, y, data: cellData };
    
    this.container.style.left = `${x - 140}px`;
    this.container.style.top = `${y - 140}px`;
    
    this.buildMenuItems(cellData, gameState);
    
    setTimeout(() => {
      this.container.classList.add('active');
      this.isOpen = true;
    }, 10);
  }

  close() {
    this.container.classList.remove('active');
    this.isOpen = false;
    setTimeout(() => {
      this.clearItems();
    }, 300);
    this.selectedCell = null;
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
    } else if (isEnemy) {
      this.centerIcon.textContent = '⚔️';
      this.centerIcon.style.borderColor = '#e74c3c';
    } else {
      this.centerIcon.textContent = '○';
      this.centerIcon.style.borderColor = '#2ecc71';
    }
    
    const actions = [];
    
    if (isOurs) {
      // NOUVEAU: Ajouter le renforcement
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
        // NOUVEAU: Vérifier si c'est un allié
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
      const x = 140 + Math.cos(angle) * this.radius;
      const y = 140 + Math.sin(angle) * this.radius;
      
      const item = document.createElement('div');
      item.className = 'radial-item';
      if (!action.canAfford) {
        item.classList.add('disabled');
      }
      
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
        
      case 'reinforce':  // NOUVEAU
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
        break;
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
      city: 'City',
      port: 'Port',
      outpost: 'Outpost',
      barracks: 'Barracks'
    };
    
    let message = `Position: (${x}, ${y})\nOwner: ${ownerName}\nTroops: ${Math.floor(cellData.tr || 0)}`;
    if (cellData.b) {
      message += `\nBuilding: ${buildingNames[cellData.b]}`;
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