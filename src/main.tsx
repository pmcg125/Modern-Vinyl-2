import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import '@fontsource/archivo-black/latin-400.css';
import '@fontsource/chakra-petch/latin-400.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/chakra-petch/latin-700.css';
import '@fontsource-variable/jetbrains-mono/wght.css';
import './styles/main.css';

import App from './App';
import { engine, usePlayer } from './state/player';

// 控制台调试入口：只有 dev 构建暴露
if (import.meta.env.DEV) {
  Reflect.set(window, '__mv2', { engine, store: usePlayer });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
