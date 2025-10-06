// Point d'entrée de l'application
console.log('🌍 WorldConquest.io - Chargement...');

// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM chargé, initialisation du jeu...');

  try {
    // Initialiser le jeu
    await game.init();
    console.log('✅ Jeu initialisé avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    alert('Erreur lors du chargement du jeu. Veuillez recharger la page.');
  }
});

// Gestion de la fermeture de la page
window.addEventListener('beforeunload', (e) => {
  if (game.isPlaying) {
    e.preventDefault();
    e.returnValue = 'Êtes-vous sûr de vouloir quitter la partie ?';
  }
});

// Gestion des erreurs globales
window.addEventListener('error', (e) => {
  console.error('Erreur globale:', e.error);
});

// Easter egg pour le debug
window.debugGame = () => {
  console.log('=== DEBUG INFO ===');
  console.log('Game State:', game.currentGameState);
  console.log('Network:', {
    connected: network.connected,
    playerId: network.playerId,
    currentRoom: network.currentRoom
  });
  console.log('Renderer:', game.renderer);
  console.log('UI:', game.ui);
};