import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { BackendProvider } from './context/BackendContext';
import { theme } from './theme';
import App from './App';
import './app.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BackendProvider>
        <App />
      </BackendProvider>
    </ThemeProvider>
  </StrictMode>
);
