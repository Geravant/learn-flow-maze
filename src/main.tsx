import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Ensure WebContainer globals are available as fallback
if (typeof globalThis.__WS_TOKEN__ === 'undefined') {
  globalThis.__WS_TOKEN__ = 'fallback-token-' + Date.now();
}
if (typeof (window as any).global === 'undefined') {
  (window as any).global = globalThis;
}

createRoot(document.getElementById("root")!).render(<App />);
