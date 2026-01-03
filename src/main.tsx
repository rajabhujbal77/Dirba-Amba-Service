
import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker for caching and offline support (production only)
// Skip in development to avoid conflicts with Vite HMR
const isProduction = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';

if ('serviceWorker' in navigator && isProduction) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('[App] Service Worker registered with scope:', registration.scope);

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch((error) => {
        console.error('[App] Service Worker registration failed:', error);
      });
  });
} else if ('serviceWorker' in navigator && !isProduction) {
  // In development, unregister any existing service workers
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => {
      registration.unregister();
      console.log('[App] Service Worker unregistered for development');
    });
  });
}
