import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './features/App';
import './styles/theme.css';

const root = document.getElementById('root');
if (root && !window.overlayApi) {
  // Opened in a normal browser (e.g. the Vite dev URL): there is no Electron bridge.
  root.textContent = 'This page runs inside the Electron overlay. Start it with "npm run dev" and use the overlay window.';
} else if (root) {
  createRoot(root).render(
    <StrictMode>
      <App api={window.overlayApi} />
    </StrictMode>,
  );
}
