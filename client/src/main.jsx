import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3800,
              style: {
                background: '#0C120E',
                color: '#F7F8F5',
                border: '1px solid #1F2E23',
                fontSize: '13px',
                borderRadius: '12px',
                padding: '10px 14px',
                boxShadow: '0 12px 40px -12px rgba(9,13,10,0.6)',
              },
              success: { iconTheme: { primary: '#34D399', secondary: '#0C120E' } },
              error: { iconTheme: { primary: '#F87171', secondary: '#0C120E' } },
            }}
          />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
