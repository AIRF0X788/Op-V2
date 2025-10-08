document.addEventListener('DOMContentLoaded', async () => {
  try {
    await game.init();
  } catch (error) {
    console.error('Initialization error:', error);
    alert('Error loading game. Please refresh the page.');
  }
});

window.addEventListener('beforeunload', (e) => {
  if (game.currentPhase === 'playing') {
    e.preventDefault();
    e.returnValue = 'Are you sure you want to leave the game?';
  }
});

window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
});

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