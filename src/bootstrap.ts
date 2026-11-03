// Separate entry surfaces: visiting the map does not initialize flight inputs or Phaser.
window.addEventListener('hashchange', () => window.location.reload());
if (window.location.hash === '#/map') {
  import('./galaxy/view').catch(showLoadError);
} else {
  import('./main').catch(showLoadError);
}
function showLoadError(error: unknown) {
  console.error(error);
  document.querySelector('#app')!.textContent = 'The app could not load. Reload to try again.';
}
export {};
