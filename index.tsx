import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminPage from './components/admin/AdminPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const isAdmin = window.location.pathname.startsWith('/admin');

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {isAdmin ? <AdminPage /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);