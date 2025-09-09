// WebContainer initialization script
// This script sets up the required globals for WebContainer to work properly

(function() {
  // Set up WebSocket token for WebContainer
  if (typeof globalThis.__WS_TOKEN__ === 'undefined') {
    globalThis.__WS_TOKEN__ = 'dev-token-' + Date.now();
  }
  
  // Ensure global is available
  if (typeof window.global === 'undefined') {
    window.global = globalThis;
  }
  
  // Log WebContainer readiness
  console.log('🌐 WebContainer globals initialized');
  console.log('   - __WS_TOKEN__:', typeof globalThis.__WS_TOKEN__ !== 'undefined' ? '✓' : '✗');
  console.log('   - global:', typeof window.global !== 'undefined' ? '✓' : '✗');
})();