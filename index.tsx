import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { authClient } from './lib/auth-client';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import './index.css';

// Lazy-load heavy page/panel components — only fetched when the page actually opens
const AdminPage   = lazy(() => import('./components/admin/AdminPage'));
const LoginPage   = lazy(() => import('./components/auth/LoginPage'));
const StorePage   = lazy(() => import('./components/store/StorePage'));
const ProfilePage = lazy(() => import('./components/profile/ProfilePage'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));
const FriendsPanel = lazy(() => import('./components/friends/FriendsPanel'));

const PageSpinner = () => (
  <div className="flex-1 flex items-center justify-center p-12">
    <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
  </div>
);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

// Internal panel — no auth gate, uses its own token
if (window.location.pathname.startsWith('/__sys')) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <Suspense fallback={<PageSpinner />}>
          <AdminPage />
        </Suspense>
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

function normalizeSession(data: any) {
  const u = data?.user;
  if (!u) return null;
  return {
    user: {
      id:    u.id,
      email: u.email,
      name:  u.name ?? u.email?.split('@')[0] ?? 'Player',
      image: u.image ?? null,
    },
  };
}

type Page = 'store' | 'profile' | 'settings' | null;

function pageFromPath(path: string): Page {
  if (path.startsWith('/store')) return 'store';
  if (path.startsWith('/profile')) return 'profile';
  if (path.startsWith('/settings')) return 'settings';
  return null;
}

function Root() {
  const [sessionData, setSessionData] = useState<any>(undefined); // undefined = loading
  const [showLogin, setShowLogin] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));

  // URL-driven routing for full pages. Push history entries so the browser
  // back button returns to the previous screen (including the in-game board).
  useEffect(() => {
    const onPop = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((target: Page) => {
    const path = target ? `/${target}` : '/';
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setPage(target);
  }, []);

  const goBack = useCallback(() => {
    // Prefer real browser back (preserves in-game URL + scroll), fall back to home
    if (window.history.length > 1) window.history.back();
    else navigate(null);
  }, [navigate]);

  const refreshSession = useCallback(async () => {
    const { data } = await authClient.getSession();
    const normalized = normalizeSession(data);
    setSessionData(normalized);
    return normalized;
  }, []);

  // Initial session load — Better Auth uses cookie-based sessions so a single
  // fetch on mount is sufficient. After OAuth redirects the browser navigates
  // back with the session cookie already set.
  useEffect(() => { refreshSession(); }, []);

  // If user hits /profile or /settings without a session, bounce to home and open login
  useEffect(() => {
    if (sessionData === null && (page === 'profile' || page === 'settings')) {
      navigate(null);
      setShowLogin(true);
    }
  }, [sessionData, page, navigate]);

  // Still loading auth
  if (sessionData === undefined) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-lg font-black text-white">C</span>
          </div>
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const handleSignOut = () => {
    authClient.signOut().then(() => {
      setSessionData(null);
      setShowFriends(false);
      setShowLogin(false);
      navigate(null);
    });
  };

  const handleProfileUpdated = (name: string, image?: string) => {
    setSessionData((prev: any) => prev ? {
      ...prev,
      user: { ...prev.user, name, ...(image ? { image } : {}) }
    } : prev);
  };

  // Login is optional — modal only opens when explicitly triggered
  const loginOpen = showLogin;
  const loginCanDismiss = true;

  // App stays mounted beneath so in-game state (sockets, reducer, timers)
  // survives navigation to these pages. Pages render as a full-viewport
  // overlay with a solid background — visually a real page, functionally
  // a sibling layer that preserves the game session.
  return (
    <>
      <App
        sessionUser={sessionData?.user ?? null}
        onOpenStore={() => navigate('store')}
        onOpenProfile={() => navigate('profile')}
        onOpenSettings={() => navigate('settings')}
        onOpenLogin={() => setShowLogin(true)}
        onOpenFriends={() => setShowFriends(true)}
        onSignOut={handleSignOut}
      />

      {/* ── Store page (URL: /store) ───────────────────────────── */}
      {page === 'store' && (
        <div className="fixed inset-0 z-40 bg-slate-950 overflow-hidden flex flex-col">
          <Suspense fallback={<PageSpinner />}>
            <StorePage onBack={goBack} userId={sessionData?.user?.id} />
          </Suspense>
        </div>
      )}

      {/* ── Profile page (URL: /profile) ───────────────────────── */}
      {page === 'profile' && sessionData && (
        <div className="fixed inset-0 z-40 bg-slate-950 overflow-hidden flex flex-col">
          <Suspense fallback={<PageSpinner />}>
            <ProfilePage
              sessionData={sessionData}
              onClose={goBack}
              onSignOut={handleSignOut}
              onOpenFriends={() => setShowFriends(true)}
              onProfileUpdated={handleProfileUpdated}
            />
          </Suspense>
        </div>
      )}

      {/* ── Settings page (URL: /settings) ─────────────────────── */}
      {page === 'settings' && sessionData && (
        <div className="fixed inset-0 z-40 bg-[#13131a] overflow-hidden flex flex-col">
          <Suspense fallback={<PageSpinner />}>
            <SettingsPage
              sessionData={sessionData}
              onClose={goBack}
              onOpenProfile={() => navigate('profile')}
            />
          </Suspense>
        </div>
      )}

      {/* ── Login modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {loginOpen && (
          <motion.div
            key="login-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm overflow-auto flex items-start sm:items-center justify-center"
          >
            {loginCanDismiss && (
              <button
                onClick={() => setShowLogin(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}
            <div className="w-full">
              <Suspense fallback={<PageSpinner />}>
                <LoginPage onSuccess={async () => {
                  await refreshSession();
                  setShowLogin(false);
                }} />
              </Suspense>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Friends modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {showFriends && sessionData && (
          <motion.div
            key="friends-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowFriends(false); }}
          >
            <Suspense fallback={<PageSpinner />}>
              <FriendsPanel
                userId={sessionData.user.id}
                onClose={() => setShowFriends(false)}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
