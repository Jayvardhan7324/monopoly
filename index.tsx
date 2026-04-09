import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AdminPage from './components/admin/AdminPage';
import LoginPage from './components/auth/LoginPage';
import StorePage from './components/store/StorePage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { authClient } from './lib/auth-client';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

// Admin panel — no auth gate, uses its own token
if (window.location.pathname.startsWith('/admin')) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <AdminPage />
      </ErrorBoundary>
    </React.StrictMode>
  );
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </React.StrictMode>
  );
}

function Root() {
  const session = authClient.useSession();
  const [page, setPage] = useState<'game' | 'store' | 'login'>('game');

  // If not logged in, show login page
  if (!session.isPending && !session.data) {
    return <LoginPage onSuccess={() => setPage('game')} />;
  }

  if (page === 'store') {
    return <StorePage onBack={() => setPage('game')} />;
  }

  return <App onOpenStore={() => setPage('store')} />;
}
