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
const FriendsPanel  = lazy(() => import('./components/friends/FriendsPanel'));
const NotFoundPage  = lazy(() => import('./components/NotFoundPage'));

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

type Page = 'store' | 'profile' | 'settings' | 'not-found' | null;

const KNOWN_PATHS = ['/', '/store', '/profile', '/settings'];

function pageFromPath(path: string): Page {
  if (path.startsWith('/store')) return 'store';
  if (path.startsWith('/profile')) return 'profile';
  if (path.startsWith('/settings')) return 'settings';
  if (path === '/' || path.startsWith('/room/') || path.startsWith('/game/')) return null;
  if (KNOWN_PATHS.some(p => path === p)) return null;
  return 'not-found';
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

  // Still loading auth — show 404 immediately so user never sees home flash
  if (sessionData === undefined) {
    if (page === 'not-found') {
      return (
        <div className="fixed inset-0 z-40">
          <Suspense fallback={<PageSpinner />}>
            <NotFoundPage onGoHome={() => { window.history.pushState({}, '', '/'); setPage(null); }} />
          </Suspense>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center overflow-hidden relative">
        {/* background glow */}
        <div
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-full"
          style={{ width: 600, height: 340, background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.35) 0%, rgba(168,85,247,0.18) 50%, transparent 80%)', filter: 'blur(40px)' }}
        />
        <div className="flex flex-col items-center gap-5 relative z-10">
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl blur-2xl scale-150 opacity-60" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)' }} />
            <div className="relative w-16 h-16 rounded-3xl flex items-center justify-center shadow-2xl" style={{ background: 'linear-gradient(135deg,#6366f1,#a855f7)', boxShadow: '0 0 60px 10px rgba(99,102,241,0.5)' }}>
              <span className="text-2xl font-black text-white" style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif" }}>C</span>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-black tracking-tight text-white" style={{ fontFamily: "'Space Grotesk',system-ui,sans-serif" }}>
              CASHLY<span className="text-base font-black" style={{ background: 'linear-gradient(to right,#818cf8,#c084fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>.IO</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium tracking-widest uppercase">Loading…</span>
          </div>
          <div className="w-32 h-[2px] rounded-full overflow-hidden bg-slate-800">
            <div className="h-full rounded-full animate-pulse" style={{ background: 'linear-gradient(to right,#6366f1,#a855f7)', width: '60%', animation: 'cashly-bar 1.4s ease-in-out infinite' }} />
          </div>
        </div>
        <style>{`
          @keyframes cashly-bar {
            0%   { width: 0%;   margin-left: 0%; }
            50%  { width: 70%;  margin-left: 15%; }
            100% { width: 0%;   margin-left: 100%; }
          }
        `}</style>
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
    // Optimistic local update so UI (home avatar, header chip) reflects instantly
    setSessionData((prev: any) => prev ? {
      ...prev,
      user: { ...prev.user, name, ...(image ? { image } : {}) }
    } : prev);
    // Also re-pull from server so any derived/cached session fields stay in sync
    refreshSession().catch(() => {});
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
      {page !== 'not-found' && (
        <App
          sessionUser={sessionData?.user ?? null}
          onOpenStore={() => navigate('store')}
          onOpenProfile={() => navigate('profile')}
          onOpenSettings={() => navigate('settings')}
          onOpenLogin={() => setShowLogin(true)}
          onOpenFriends={() => setShowFriends(true)}
          onSignOut={handleSignOut}
        />
      )}

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

      {/* ── 404 page ────────────────────────────────────────────── */}
      {page === 'not-found' && (
        <div className="fixed inset-0 z-40">
          <Suspense fallback={<PageSpinner />}>
            <NotFoundPage onGoHome={() => navigate(null)} />
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
