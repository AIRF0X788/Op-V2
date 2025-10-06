// Gestion du rendu graphique du jeu
class GameRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = 0;
    this.height = 0;
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.hoveredTerritory = null;
    this.selectedTerritory = null;
    
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = this.canvas.width = this.canvas.offsetWidth;
    this.height = this.canvas.height = this.canvas.offsetHeight;
  }

  clear() {
    this.ctx.fillStyle = '#0f1419';
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  render(gameState) {
    this.clear();
    
    if (!gameState || !gameState.territories) return;

    // Dessiner les connexions entre territoires
    this.drawConnections(gameState.territories);

    // Dessiner les territoires
    gameState.territories.forEach(territory => {
      this.drawTerritory(territory, gameState);
    });

    // Dessiner le territoire survolé
    if (this.hoveredTerritory) {
      this.highlightTerritory(this.hoveredTerritory, 'rgba(255, 255, 255, 0.2)');
    }

    // Dessiner le territoire sélectionné
    if (this.selectedTerritory) {
      this.highlightTerritory(this.selectedTerritory, 'rgba(52, 152, 219, 0.4)');
    }
  }

  drawConnections(territories) {
    this.ctx.strokeStyle = 'rgba(100, 100, 120, 0.3)';
    this.ctx.lineWidth = 2;

    territories.forEach(territory => {
      territory.neighbors.forEach(neighborId => {
        const neighbor = territories.find(t => t.id === neighborId);
        if (neighbor) {
          this.ctx.beginPath();
          this.ctx.moveTo(territory.x, territory.y);
          this.ctx.lineTo(neighbor.x, neighbor.y);
          this.ctx.stroke();
        }
      });
    });
  }

  drawTerritory(territory, gameState) {
    const radius = 60;
    const x = territory.x;
    const y = territory.y;

    // Trouver le propriétaire
    let owner = null;
    let ownerColor = '#2c3e50';
    
    if (territory.owner) {
      owner = [...gameState.players, ...gameState.bots].find(p => p.id === territory.owner);
      if (owner) {
        ownerColor = owner.color;
      }
    }

    // Cercle principal du territoire
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    
    // Dégradé
    const gradient = this.ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, this.lightenColor(ownerColor, 20));
    gradient.addColorStop(1, ownerColor);
    this.ctx.fillStyle = gradient;
    this.ctx.fill();
    
    // Bordure
    this.ctx.strokeStyle = this.lightenColor(ownerColor, 40);
    this.ctx.lineWidth = 3;
    this.ctx.stroke();

    // Nom du territoire
    this.ctx.fillStyle = 'white';
    this.ctx.font = 'bold 14px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(territory.name, x, y - 15);

    // Troupes
    this.ctx.font = 'bold 20px Arial';
    this.ctx.fillText(`⚔️ ${territory.troops}`, x, y + 10);

    // Revenu
    this.ctx.font = '12px Arial';
    this.ctx.fillStyle = '#f39c12';
    this.ctx.fillText(`+${territory.income}/s`, x, y + 30);

    // Nom du propriétaire
    if (owner) {
      this.ctx.font = 'italic 11px Arial';
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      this.ctx.fillText(owner.name, x, y - 35);
    }
  }

  highlightTerritory(territory, color) {
    const radius = 70;
    this.ctx.beginPath();
    this.ctx.arc(territory.x, territory.y, radius, 0, Math.PI * 2);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 4;
    this.ctx.stroke();
  }

  getTerritoryAtPosition(x, y, territories) {
    if (!territories) return null;

    for (let territory of territories) {
      const dx = x - territory.x;
      const dy = y - territory.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 60) {
        return territory;
      }
    }
    return null;
  }

  setHoveredTerritory(territory) {
    this.hoveredTerritory = territory;
  }

  setSelectedTerritory(territory) {
    this.selectedTerritory = territory;
  }

  // Utilitaires de couleur
  lightenColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255))
      .toString(16).slice(1);
  }

  // Animation de combat (bonus)
  animateAttack(fromTerritory, toTerritory) {
    let progress = 0;
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      progress = Math.min(elapsed / duration, 1);

      const x = fromTerritory.x + (toTerritory.x - fromTerritory.x) * progress;
      const y = fromTerritory.y + (toTerritory.y - fromTerritory.y) * progress;

      // Dessiner une flèche
      this.ctx.save();
      this.ctx.strokeStyle = '#e74c3c';
      this.ctx.lineWidth = 4;
      this.ctx.beginPath();
      this.ctx.moveTo(fromTerritory.x, fromTerritory.y);
      this.ctx.lineTo(x, y);
      this.ctx.stroke();

      // Pointe de flèche
      const angle = Math.atan2(toTerritory.y - fromTerritory.y, toTerritory.x - fromTerritory.x);
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(x - 15 * Math.cos(angle - Math.PI / 6), y - 15 * Math.sin(angle - Math.PI / 6));
      this.ctx.lineTo(x - 15 * Math.cos(angle + Math.PI / 6), y - 15 * Math.sin(angle + Math.PI / 6));
      this.ctx.closePath();
      this.ctx.fillStyle = '#e74c3c';
      this.ctx.fill();
      this.ctx.restore();

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }
}