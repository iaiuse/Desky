import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";

import { initializeVoiceSettings } from './lib/voiceSettings'

// Initialize voice settings
initializeVoiceSettings().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}).catch(error => {
  console.error('Failed to initialize voice settings:', error);
  // You might want to show an error message to the user or handle this error in some way
})