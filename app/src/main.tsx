import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createCreator } from './creator';
import { App } from './shell/App';
import './styles.css';

const params = new URLSearchParams(location.search);
const embedded = window.parent !== window;

const creator = createCreator({
  apiBase: params.get('api') || '/api',
  parent: embedded ? window.parent : null,
  // The platform serves the creator from its own origin.
  origin: location.origin,
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App creator={creator} />
  </StrictMode>,
);
