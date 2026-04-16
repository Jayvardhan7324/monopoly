import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { supabase } from './lib/auth-client';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import './index.css';

// Lazy-load heavy page/panel components — only fetched when the modal actually opens
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

function normalizeSession(session: any) {
  if (!session) return null;
  return {
    user: {
      id:    session.user.id,
      email: session.user.email,
      name:  session.user.user_metadata?.name ?? session.user.email?.split('@')[0] ?? 'Player',
      image: session.user.user_metadata?.avatar_url ?? null,
    },
  };
}

function Root() {
  const [sessionData, setSessionData] = useState<any>(undefined); // undefined = loading
  const [showLogin, setShowLogin] = useState(false);
  const [showStore, setShowStore] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFriends, setShowFriends] = useState(false);

  const refreshSession = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const normalized = normalizeSession(session);
    setSessionData(normalized);
    return normalized;
  }, []);

  // Initial session load
  useEffect(() => { refreshSession(); }, []);

  // Keep session in sync with Supabase auth state changes (OAuth redirects, etc.)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionData(normalizeSession(session));
    });
    return () => subscription.unsubscribe();
  }, []);

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
    supabase.auth.signOut().then(() => {
      setSessionData(null);
      setShowStore(false);
      setShowProfile(false);
      setShowSettings(false);
      setShowFriends(false);
      setShowLogin(false);
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

  return (
    <>
      <App
        sessionUser={sessionData?.user ?? null}
        onOpenStore={() => setShowStore(true)}
        onOpenProfile={() => setShowProfile(true)}
        onOpenSettings={() => setShowSettings(true)}
        onOpenLogin={() => setShowLogin(true)}
        onOpenFriends={() => setShowFriends(true)}
        onSignOut={handleSignOut}
      />

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

      {/* ── Store modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {showStore && (
          <motion.div
            key="store-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={e => { if (e.target === e.currentTarget) setShowStore(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-5xl h-[90vh] bg-slate-950 rounded-t-2xl sm:rounded-2xl border border-slate-800 overflow-hidden flex flex-col"
            >
              <Suspense fallback={<PageSpinner />}>
                <StorePage onBack={() => setShowStore(false)} userId={sessionData?.user?.id} />
              </Suspense>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Profile page ────────────────────────────────────────── */}
      <AnimatePresence>
        {showProfile && sessionData && (
          <motion.div
            key="profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={e => { if (e.target === e.currentTarget) setShowProfile(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-2xl h-[90vh] bg-slate-950 rounded-t-2xl sm:rounded-2xl border border-slate-800 overflow-hidden flex flex-col"
            >
              <Suspense fallback={<PageSpinner />}>
                <ProfilePage
                  sessionData={sessionData}
                  onClose={() => setShowProfile(false)}
                  onSignOut={handleSignOut}
                  onOpenFriends={() => { setShowProfile(false); setShowFriends(true); }}
                  onProfileUpdated={handleProfileUpdated}
                />
              </Suspense>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ── Settings page ──────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && sessionData && (
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-end sm:items-center justify-center"
            onClick={e => { if (e.target === e.currentTarget) setShowSettings(false); }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-full max-w-2xl h-[90vh] bg-[#13131a] rounded-t-2xl sm:rounded-2xl border border-white/5 overflow-hidden flex flex-col"
            >
              <Suspense fallback={<PageSpinner />}>
                <SettingsPage
                  sessionData={sessionData}
                  onClose={() => setShowSettings(false)}
                  onOpenProfile={() => { setShowSettings(false); setShowProfile(true); }}
                />
              </Suspense>
            </motion.div>
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
