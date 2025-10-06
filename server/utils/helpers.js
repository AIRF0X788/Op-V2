// server/utils/helpers.js

/**
 * Génère un code de room aléatoire
 */
function generateRoomCode(length = 6) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

/**
 * Mélange un tableau (Fisher-Yates shuffle)
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calcule la distance entre deux points
 */
function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Génère une couleur aléatoire en hexadécimal
 */
function randomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
    '#F39C12', '#E74C3C', '#3498DB', '#2ECC71',
    '#9B59B6', '#1ABC9C', '#E67E22', '#34495E'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Valide un nom de joueur
 */
function validatePlayerName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Nom invalide' };
  }
  
  const trimmed = name.trim();
  
  if (trimmed.length < 2) {
    return { valid: false, error: 'Nom trop court (min 2 caractères)' };
  }
  
  if (trimmed.length > 20) {
    return { valid: false, error: 'Nom trop long (max 20 caractères)' };
  }
  
  // Interdire les caractères spéciaux dangereux
  if (!/^[a-zA-Z0-9_\-\s]+$/.test(trimmed)) {
    return { valid: false, error: 'Caractères non autorisés' };
  }
  
  return { valid: true, name: trimmed };
}

/**
 * Valide un code de room
 */
function validateRoomCode(code) {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  const trimmed = code.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(trimmed);
}

/**
 * Formate un nombre avec des séparateurs de milliers
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Formate une durée en millisecondes en texte lisible
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Calcule le pourcentage de victoire d'une attaque
 */
function calculateAttackChance(attackPower, defensePower) {
  const ratio = attackPower / defensePower;
  
  if (ratio >= 2) return 95;
  if (ratio >= 1.5) return 80;
  if (ratio >= 1.2) return 65;
  if (ratio >= 1) return 50;
  if (ratio >= 0.8) return 35;
  if (ratio >= 0.5) return 20;
  return 5;
}

/**
 * Clamp une valeur entre min et max
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Génère un nombre aléatoire entre min et max (inclus)
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Vérifie si un objet est vide
 */
function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

/**
 * Crée un délai (Promise)
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Logging avec timestamp
 */
function log(message, level = 'INFO') {
  const timestamp = new Date().toLocaleTimeString('fr-FR');
  const levels = {
    INFO: '\x1b[36m',    // Cyan
    SUCCESS: '\x1b[32m', // Vert
    WARNING: '\x1b[33m', // Jaune
    ERROR: '\x1b[31m',   // Rouge
    DEBUG: '\x1b[35m'    // Magenta
  };
  const color = levels[level] || '\x1b[0m';
  const reset = '\x1b[0m';
  
  console.log(`${color}[${timestamp}] [${level}]${reset} ${message}`);
}

/**
 * Sanitize l'input utilisateur
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '') // Retirer < et >
    .trim()
    .substring(0, 100); // Limiter la longueur
}

/**
 * Calcule les statistiques d'une partie
 */
function calculateGameStats(territories, players) {
  const stats = {
    totalTerritories: territories.size,
    totalPlayers: players.size,
    distribution: new Map()
  };
  
  territories.forEach(territory => {
    if (territory.owner) {
      const count = stats.distribution.get(territory.owner) || 0;
      stats.distribution.set(territory.owner, count + 1);
    }
  });
  
  return stats;
}

module.exports = {
  generateRoomCode,
  shuffleArray,
  calculateDistance,
  randomColor,
  validatePlayerName,
  validateRoomCode,
  formatNumber,
  formatDuration,
  calculateAttackChance,
  clamp,
  randomInt,
  isEmpty,
  delay,
  log,
  sanitizeInput,
  calculateGameStats
};