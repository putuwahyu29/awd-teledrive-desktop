import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

window.addEventListener('error', e => {
  window.go?.main?.App?.LogDebug?.(`Global Error: ${e.message} at ${e.filename}:${e.lineno}`);
});
window.addEventListener('unhandledrejection', e => {
  window.go?.main?.App?.LogDebug?.(`Unhandled Promise: ${e.reason}`);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
