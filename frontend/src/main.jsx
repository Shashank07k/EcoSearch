import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Public backend address only. Never put JWT_SECRET, AI_API_KEY, or any other
// backend secret here — AuthProvider lives inside <App />, and the JWT is the
// opaque token returned by the backend, not the signing secret.
globalThis.__ECOSEARCH_API_BASE_URL__ = import.meta.env.VITE_API_BASE_URL || '/api';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* AuthProvider is mounted once inside App. Do not wrap again here. */}
    <App />
  </React.StrictMode>,
);
