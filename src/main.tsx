import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

try {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
} catch (error) {
  console.error("Vite/React Boot Error:", error);
  const msg = error instanceof Error ? error.message : String(error);
  rootElement.innerHTML = `
    <div style="padding: 40px; color: #fff; background: #0a0c10; font-family: sans-serif; height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 20px;">⚠️</div>
      <h2 style="font-size: 24px; color: #f59e0b;">System Launch Failure</h2>
      <p style="opacity: 0.6; max-width: 400px; margin: 10px 0 20px;">${msg}</p>
      <button onclick="window.location.reload()" style="background: #f59e0b; color: black; border: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; cursor: pointer;">Initialize Recovery</button>
    </div>
  `;
}
