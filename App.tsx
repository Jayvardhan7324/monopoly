import React, { useReducer, useEffect, useState, useRef, useMemo, lazy, Suspense } from 'react';
import { gameReducer, initialState } from './services/gameReducer';
import { PLAYER_ALLOWED_ACTIONS } from './services/actionPolicy';
import { getBotAction, getBotBidAction } from './services/botService';
import { Board } from './components/Board';
import { GameSettings, TileType, ColorGroup } from './types';
import {
  Play, Settings, Users, UsersRound, Info, ShieldCheck, Globe, Lock, Cpu,
  LayoutGrid, ChevronRight, ChevronLeft, Volume2, VolumeX, Eye, Trophy, X,
  Dices, Key, Copy, MessageSquare, ChevronsRight, Bot, Crown,
  TrendingUp, Landmark, ShoppingCart, LogIn, Package, Zap, Plane, Handshake, UserX, Flag, LogOut, Coins, WifiOff, UserCircle, ChevronDown, User,
  Building2, Wallet, Gem, Briefcase, Medal, Gift, Car, Anchor, Train
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { playSound } from './services/audioService';
import AdSlot from './components/ads/AdSlot';
import {
  INITIAL_TILES,
  PLAYER_COLORS,
} from './constants';
import { Avatar, APPEARANCE_COLORS } from './components/Avatar';
import { Switch } from './components/animate-ui/components/base/switch';
import { Button } from './components/ui/button';
import NavDock, { NavDockItem, NavDockLink, NavDockSep } from './components/ui/NavDock';
import { motion, AnimatePresence } from 'motion/react';
import { initSocket, getSocket, resetSocket } from './services/socketService';
import { authFetch } from './lib/auth-client';

const Controls = lazy(() => import('./components/Controls').then(m => ({ default: m.Controls })));
const PropertyModal = lazy(() => import('./components/PropertyModal').then(m => ({ default: m.PropertyModal })));
const PlayerPortfolioModal = lazy(() => import('./components/PlayerPortfolioModal').then(m => ({ default: m.PlayerPortfolioModal })));
const TradeProposalModal = lazy(() => import('./components/TradeProposalModal').then(m => ({ default: m.TradeProposalModal })));
const CreateTradeModal = lazy(() => import('./components/CreateTradeModal').then(m => ({ default: m.CreateTradeModal })));
const AuctionModal = lazy(() => import('./components/AuctionModal').then(m => ({ default: m.AuctionModal })));
const SetCompleteAnimation = lazy(() => import('./components/SetCompleteAnimation').then(m => ({ default: m.SetCompleteAnimation })));

const GamePanelFallback = () => (
  <div className="w-full min-h-[260px] flex items-center justify-center">
    <div className="w-6 h-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
  </div>
);

type LoadingScreenProps = {
  title: string;
  subtitle: string;
  mode?: 'fixed' | 'absolute';
};

const CashlyLoadingScreen = ({ title, subtitle, mode = 'fixed' }: LoadingScreenProps) => (
  <motion.div
    className={`${mode === 'fixed' ? 'fixed' : 'absolute'} inset-0 z-[600] overflow-hidden bg-[#0e0e14]/96 backdrop-blur-md flex items-center justify-center px-6`}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.25 }}
  >
    <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-indigo-500/20 via-violet-500/10 to-transparent pointer-events-none" />
    <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 31.5H32M.5 0V32' stroke='white' stroke-opacity='.8'/%3E%3C/svg%3E\")", backgroundSize: '32px 32px' }} />

    <motion.div
      className="relative flex w-full max-w-[360px] flex-col items-center gap-5 text-center"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
    >
      <div className="relative h-28 w-28">
        <motion.div
          className="absolute inset-0 rounded-full border border-indigo-400/25"
          animate={{ scale: [0.92, 1.08, 0.92], opacity: [0.35, 0.75, 0.35] }}
          transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute inset-3 rounded-full border border-violet-300/15"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 7, ease: 'linear' }}
        >
          <Coins size={16} className="absolute -top-2 left-1/2 -translate-x-1/2 text-amber-300" />
          <Landmark size={16} className="absolute bottom-1 left-0 text-sky-300" />
          <Car size={16} className="absolute bottom-1 right-0 text-emerald-300" />
        </motion.div>
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
        >
          <Dices size={48} className="text-indigo-300 drop-shadow-[0_0_24px_rgba(129,140,248,0.45)]" />
        </motion.div>
      </div>

      <div className="space-y-1">
        <p className="text-white font-black text-xl tracking-tight">{title}</p>
        <p className="text-slate-400 text-sm font-medium">{subtitle}</p>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800/80 border border-white/10">
        <motion.div
          className="h-full w-1/2 rounded-full bg-gradient-to-r from-indigo-400 via-violet-400 to-fuchsia-400"
          animate={{ x: ['-105%', '210%'] }}
          transition={{ repeat: Infinity, duration: 1.25, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  </motion.div>
);

const getProfileFallbackImage = (name: string, avatarId = 0, color?: string): string => {
  const bg = color || APPEARANCE_COLORS[Math.abs(avatarId) % APPEARANCE_COLORS.length] || '#6366f1';
  const initials = (name || 'P')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('') || 'P';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="96" height="96" rx="48" fill="url(#g)"/><circle cx="72" cy="20" r="18" fill="rgba(255,255,255,.16)"/><circle cx="25" cy="73" r="24" fill="rgba(0,0,0,.18)"/><text x="48" y="57" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-size="30" font-weight="900" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

// ─────────────────────────────────────────────────────────────────────────────
const VISUAL_DEFAULTS = {
  particleCount: 120, particleSpeed: 1.0, particleSize: 1.0,
  particleOpacity: 0.7, particleFadeZone: 0.28,
  glowOpacity: 0.65, glowWidth: 960, glowHeight: 520, glowY: -180,
  particleShape: 'circle' as 'circle' | 'snowflake',
};
type VisualSettings = typeof VISUAL_DEFAULTS;
function loadVisualSettings(): VisualSettings {
  try { const r = localStorage.getItem('cashly_visual_settings'); return r ? { ...VISUAL_DEFAULTS, ...JSON.parse(r) } : VISUAL_DEFAULTS; }
  catch { return VISUAL_DEFAULTS; }
}

function HomeGlow() {
  const [s, setS] = useState<VisualSettings>(loadVisualSettings);
  useEffect(() => {
    const h = () => setS(loadVisualSettings());
    const hs = (e: StorageEvent) => { if (e.key === 'cashly_visual_settings') h(); };
    window.addEventListener('cashly_visual_change', h);
    window.addEventListener('storage', hs);
    return () => { window.removeEventListener('cashly_visual_change', h); window.removeEventListener('storage', hs); };
  }, []);
  return (
    <div
      className="pointer-events-none bg-gradient-to-b from-indigo-500 via-violet-500/40 to-transparent blur-3xl rounded-full"
      style={{ position: 'absolute', top: `${s.glowY}px`, left: '50%', transform: 'translateX(-50%)', width: `${s.glowWidth}px`, height: `${s.glowHeight}px`, opacity: s.glowOpacity, zIndex: 0 }}
    />
  );
}

function HomeParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sRef = useRef<VisualSettings>(loadVisualSettings());
  useEffect(() => {
    const h = () => { sRef.current = loadVisualSettings(); };
    const hs = (e: StorageEvent) => { if (e.key === 'cashly_visual_settings') h(); };
    window.addEventListener('cashly_visual_change', h);
    window.addEventListener('storage', hs);
    return () => { window.removeEventListener('cashly_visual_change', h); window.removeEventListener('storage', hs); };
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf: number;
    let cssW = 0, cssH = 0;
    type P = { x: number; y: number; vx: number; baseVy: number; baseSize: number; baseAlpha: number; rot: number; rotV: number };
    const particles: P[] = [];
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      cssW = rect.width || window.innerWidth;
      cssH = rect.height || Math.round(window.innerHeight * 0.72);
      canvas.width = cssW * dpr; canvas.height = cssH * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const spawn = (): P => ({
      x: Math.random() * cssW, y: Math.random() * -20,
      vx: (Math.random() - 0.5) * 0.4,
      baseVy: 0.4 + Math.random() * 1.1,
      baseSize: 0.6 + Math.random() * 2.2,
      baseAlpha: 0.15 + Math.random() * 0.55,
      rot: Math.random() * Math.PI * 2,
      rotV: (Math.random() - 0.5) * 0.04,
    });
    for (let i = 0; i < 80; i++) { const p = spawn(); p.y = Math.random() * cssH; particles.push(p); }
    const drawSnowflake = (x: number, y: number, r: number, rot: number, alpha: number) => {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(rot);
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = Math.max(0.4, r * 0.18);
      for (let j = 0; j < 6; j++) {
        ctx.save(); ctx.rotate((Math.PI / 3) * j);
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(r, 0);
        ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 0.68, -r * 0.28);
        ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 0.68, r * 0.28);
        ctx.stroke(); ctx.restore();
      }
      ctx.restore();
    };
    const tick = () => {
      const s = sRef.current;
      ctx.clearRect(0, 0, cssW, cssH);
      while (particles.length < s.particleCount) particles.push(spawn());
      while (particles.length > s.particleCount) particles.pop();
      const fadeStart = s.particleFadeZone * cssH;
      const fadeEnd = fadeStart + cssH * 0.10;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.baseVy * s.particleSpeed;
        p.vx += (Math.random() - 0.5) * 0.02;
        p.rot += p.rotV;
        if (p.x < 0) p.x += cssW; if (p.x > cssW) p.x -= cssW;
        if (p.y > fadeEnd) { Object.assign(p, spawn()); continue; }
        const topFade = Math.min(1, p.y / 30);
        const bottomFade = p.y < fadeStart ? 1 : 1 - (p.y - fadeStart) / (fadeEnd - fadeStart);
        const alpha = p.baseAlpha * s.particleOpacity * topFade * bottomFade;
        if (alpha <= 0.005) continue;
        const r = p.baseSize * s.particleSize;
        if (s.particleShape === 'snowflake') {
          drawSnowflake(p.x, p.y, r * 2.5, p.rot, alpha);
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);
  return (
    <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '72dvh', pointerEvents: 'none', zIndex: 0 }} />
  );
}

interface AppProps {
  onOpenStore?: () => void;
  onOpenLogin?: () => void;
  onOpenProfile?: () => void;
  onOpenSettings?: () => void;
  onOpenFriends?: () => void;
  onSignOut?: () => void;
  sessionUser?: any | null;
}

const App: React.FC<AppProps> = ({ onOpenStore, onOpenLogin, onOpenProfile, onOpenSettings, onOpenFriends, onSignOut, sessionUser }) => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [viewingPlayerId, setViewingPlayerId] = useState<number | null>(null);
  const [settings, setSettings] = useState<GameSettings>(initialState.settings);

  // Saved/admin board catalog
  const [savedBoards, setSavedBoards] = useState<any[]>([]);
  const [activeBoard, setActiveBoard] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('adminActiveBoard') || 'null'); } catch { return null; }
  });

  const selectedBoard = useMemo(() => {
    if (settings.boardMap === 'Classic') return null;
    return savedBoards.find((board: any) => board.name === settings.boardMap)
      ?? (activeBoard?.name === settings.boardMap ? activeBoard : null);
  }, [activeBoard, savedBoards, settings.boardMap]);

  const customBoardTiles = useMemo(() => {
    if (!selectedBoard?.tiles) return null;
    return (selectedBoard.tiles as any[])
      .map((t: any) => ({
        id: t.position ?? t.id,
        name: t.name,
        type: t.type,
        price: t.price ?? 0,
        rent: t.rent ?? [],
        group: t.group,
        ownerId: null,
        buildingCount: 0,
        isMortgaged: false,
        houseCost: t.houseCost ?? 0,
        countryCode: t.countryCode,
      }))
      .sort((a: any, b: any) => a.id - b.id);
  }, [selectedBoard]);

  const lobbyPreviewState = useMemo(
    () => (!gameStarted && customBoardTiles ? { ...gameState, tiles: customBoardTiles } : gameState),
    [customBoardTiles, gameStarted, gameState]
  );

  useEffect(() => {
    if (settings.boardMap === 'Classic') return;
    if (selectedBoard) return;
    setSettings(prev => ({ ...prev, boardMap: 'Classic' }));
  }, [selectedBoard, settings.boardMap]);

  // FEAT-04: Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // FEAT-06: Spectator mode (all bots, no human)
  const [spectatorMode, setSpectatorMode] = useState(false);

  const [humanName, setHumanName] = useState(() => {
    const adjs = ['Swift', 'Brave', 'Fierce', 'Bold', 'Dark', 'Iron', 'Stone', 'Silent', 'Shadow', 'Crimson',
      'Silver', 'Golden', 'Arctic', 'Cosmic', 'Neon', 'Phantom', 'Rogue', 'Thunder', 'Velvet', 'Blazing',
      'Crystal', 'Electric', 'Sacred', 'Frozen', 'Obsidian', 'Scarlet', 'Astral', 'Hollow', 'Ember', 'Void'];
    const nouns = ['Falcon', 'Wolf', 'Panther', 'Dragon', 'Phoenix', 'Hawk', 'Blade', 'Shield', 'Ghost',
      'Viper', 'Tiger', 'Lion', 'Fox', 'Raven', 'Eagle', 'Cobra', 'Titan', 'Ranger', 'Knight', 'Wizard',
      'Ninja', 'Viking', 'Warrior', 'Samurai', 'Mage', 'Archer', 'Scout', 'Cipher', 'Wraith', 'Oracle'];
    return adjs[Math.floor(Math.random() * adjs.length)] + nouns[Math.floor(Math.random() * nouns.length)];
  });

  // Auto-fill name from logged-in profile
  useEffect(() => {
    if (sessionUser?.name) setHumanName(sessionUser.name);
  }, [sessionUser?.name]);

  // Multiplayer state
  const [isOnline, setIsOnline] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [sessionPlayerId, setSessionPlayerId] = useState<string | null>(null);
  const [savedSession, setSavedSession] = useState<{ playerId: string; roomId: string; playerName?: string; savedAt?: number } | null>(() => {
    try { return JSON.parse(localStorage.getItem('cashly_session') || 'null'); } catch { return null; }
  });
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<number>(0);
  const [selectedAvatar, setSelectedAvatar] = useState(11);
  const [showRoomBrowser, setShowRoomBrowser] = useState(false);
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'logs' | 'chat'>('chat');
  const [isSocketDisconnected, setIsSocketDisconnected] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isStacked, setIsStacked] = useState(false);
  const [showCreateTradeModal, setShowCreateTradeModal] = useState(false);
  const [tradePopupDismissed, setTradePopupDismissed] = useState(false);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  const [confirmAlert, setConfirmAlert] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [isAutoJoining, setIsAutoJoining] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const autoJoinAttemptedRef = useRef(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const isOnlineRef = useRef(false);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  // NET-01: Use a ref so socket handlers always read the latest isHost value without stale closures
  const isHostRef = useRef(false);
  useEffect(() => { isHostRef.current = isHost; }, [isHost]);
  // 100ms per-action-type throttle — prevents double-fire from rapid clicks
  const lastActionTimeRef = useRef<Map<string, number>>(new Map());
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [activePolicyPage, setActivePolicyPage] = useState<'privacy' | 'terms' | 'cookies' | 'contact' | null>(null);
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugTitle, setBugTitle] = useState('');
  const [bugDesc, setBugDesc] = useState('');
  const [bugImage, setBugImage] = useState<string | null>(null);
  const [bugSubmitting, setBugSubmitting] = useState(false);
  const [bugSubmitted, setBugSubmitted] = useState(false);
  const [bugError, setBugError] = useState<string | null>(null);
  const session = sessionUser ? { user: sessionUser } : null;
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNowTs(Date.now()), 1000); return () => clearInterval(t); }, []);

  // ── Color set completion animation ──────────────────────────────────────────
  const [setCompleteAnim, setSetCompleteAnim] = useState<{ group: ColorGroup; tiles: typeof gameState.tiles; ownerName: string; ownerColor: string } | null>(null);
  const prevTilesRef = useRef(gameState.tiles);

  useEffect(() => {
    const checkLayout = () => {
      const width = window.innerWidth;
      setIsStacked(width < 1100);
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevLobbyCountRef = useRef(-1);

  // IMP-11: Prevent duplicate bot bid timers (BUG-11)
  const botBidFiringRef = useRef(false);
  // Tracks whether isOnline=true was set from a session restore (reload) vs new join
  const isSessionRestoreRef = useRef(false);
  const isRestoringSessionRef = useRef(false);

  const fetchBoardCatalog = () => {
    fetch('/api/boards')
      .then(r => r.json())
      .then(({ boards, activeBoard }) => {
        setSavedBoards(Array.isArray(boards) ? boards : []);
        setActiveBoard(activeBoard ?? null);
        if (activeBoard) localStorage.setItem('adminActiveBoard', JSON.stringify(activeBoard));
        else localStorage.removeItem('adminActiveBoard');
      })
      .catch(() => {
        setSavedBoards([]);
      });
  };

  // B6: Reconnect after page refresh — works from any URL, not just /room/XXX paths
  useEffect(() => {
    if (autoJoinAttemptedRef.current) return;
    const stored: { playerId?: string; roomId?: string; playerName?: string; savedAt?: number } | null =
      JSON.parse(localStorage.getItem('cashly_session') || 'null');
    const pathMatch = window.location.pathname.match(/^\/room\/([A-Z0-9]+)$/i);
    const roomFromUrl = pathMatch?.[1] || new URLSearchParams(window.location.search).get('room');

    if (roomFromUrl) {
      // URL-based restore (e.g. shared link or reload on /room/XXXX)
      autoJoinAttemptedRef.current = true;
      const cleanId = roomFromUrl.toUpperCase();
      if (stored?.roomId === cleanId && stored?.playerId) {
        isSessionRestoreRef.current = true;
        isRestoringSessionRef.current = true;
        setIsRestoringSession(true);
        setIsOnline(true);
        setRoomId(cleanId);
        setSessionPlayerId(stored.playerId);
      } else {
        // New visitor opening a shared link — join as spectator if game is in progress
        setIsAutoJoining(true);
        fetch(`/api/rooms/${cleanId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Guest', avatar: 11 }),
        })
          .then(r => r.json())
          .then(res => {
            if (res.success) {
              setIsOnline(true);
              setRoomId(res.roomId);
              setSessionPlayerId(res.playerId);
              setIsHost(false);
              setLobbyPlayers(res.players);
              if (res.settings) setSettings((prev) => ({ ...prev, ...res.settings, rules: { ...prev.rules, ...(res.settings.rules || {}) } }));
              if (res.isSpectator) setIsSpectator(true);
              localStorage.setItem('cashly_session', JSON.stringify({ playerId: res.playerId, roomId: res.roomId, savedAt: Date.now() }));
              window.history.replaceState({}, '', `/room/${res.roomId}`);
            } else {
              window.history.replaceState({}, '', '/');
            }
          })
          .catch(() => window.history.replaceState({}, '', '/'))
          .finally(() => setIsAutoJoining(false));
      }
    }
    // Intentional leave + page reload should land on the home screen.
    // Stored session (if recent) is surfaced via the "Rejoin" banner on the
    // landing page — no silent auto-rejoin here.
  }, []);

  // Show appearance modal when entering the lobby (skip on page-reload session restore)
  useEffect(() => {
    if (isOnline && !gameStarted) {
      if (isSessionRestoreRef.current) {
        isSessionRestoreRef.current = false;
      } else {
        setShowAppearanceModal(true);
      }
    }
  }, [isOnline]);

  // Safety-net: clear loading screen after 5s in case sync_state never arrives (e.g. host refresh)
  useEffect(() => {
    if (!isRestoringSession) return;
    const t = setTimeout(() => {
      isRestoringSessionRef.current = false;
      setIsRestoringSession(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [isRestoringSession]);

  // On session restore, immediately apply cached game state so the board shows while waiting for server sync
  useEffect(() => {
    if (!isRestoringSession || !roomId) return;
    try {
      const cached = localStorage.getItem(`cashly_game_${roomId}`);
      if (cached) {
        const s = JSON.parse(cached);
        if (s && Array.isArray(s.players) && Array.isArray(s.tiles) && typeof s.phase === 'string') {
          dispatch({ type: 'SYNC_STATE', payload: s });
          setGameStarted(true);
          // Keep isRestoringSession=true — server sync will clear it and overwrite with authoritative state
        }
      }
    } catch {}
  }, [isRestoringSession, roomId]);

  // Play sound proxy — respects toggle
  const sfx = (type: Parameters<typeof playSound>[0]) => {
    if (soundEnabled) playSound(type);
  };

  useEffect(() => {
    if (gameState.lastSoundEffect && soundEnabled) {
      playSound(gameState.lastSoundEffect.type);
    }
  }, [gameState.lastSoundEffect, soundEnabled]);

  // ── Multiplayer Socket Setup ───────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !sessionPlayerId) return;
    const socket = initSocket(roomId, sessionPlayerId);

    const handleRoomUpdated = (data: any) => {
      // B8: Receiving room_updated is authoritative proof the server has accepted us; clear any stale disconnect banner
      setIsSocketDisconnected(false);
      const newCount = data.players.length;
      const prevCount = prevLobbyCountRef.current;
      if (prevCount >= 0 && soundEnabled) {
        if (newCount > prevCount) playSound('player_join');
        else if (newCount < prevCount) playSound('player_leave');
      }
      prevLobbyCountRef.current = newCount;
      setLobbyPlayers(data.players);
      if (data.settings) {
        setSettings((prev) => ({ ...prev, ...data.settings, rules: { ...prev.rules, ...(data.settings.rules || {}) } }));
      }
      const me = data.players.find((p: any) => p.id === socket.id);
      if (me && !me.isSpectator) {
        setIsHost(me.isHost);
        if (typeof me.gamePlayerId === 'number') {
          setMyPlayerId(me.gamePlayerId);
        } else {
          const activeIndex = data.players.filter((p: any) => !p.disconnected).indexOf(me);
          setMyPlayerId(activeIndex >= 0 ? activeIndex : data.players.indexOf(me));
        }
      }
    };

    const handleGameStarted = (data: any) => {
      if (data.state) {
        dispatch({ type: 'SYNC_STATE', payload: data.state });
        setGameStarted(true);
        setIsRestoringSession(false);
      }
    };

    // NET-01: Read isHostRef.current (not closed-over isHost) so handler never goes stale
    // SEC-05 / CQ-8: Allowlist lives in services/actionPolicy.ts — imported to avoid drift.
    const handleHostProcessAction = (action: any) => {
      if (isHostRef.current && action?.type && PLAYER_ALLOWED_ACTIONS.has(action.type)) {
        dispatch(action);
      }
    };

    // SYNC-02: Validate shape before dispatching to prevent malicious/malformed state injection
    const isValidGameState = (s: any): boolean =>
      s && Array.isArray(s.players) && Array.isArray(s.tiles) &&
      typeof s.phase === 'string' && typeof s.currentPlayerIndex === 'number';

    const handleSyncState = (data: any) => {
      // Accept sync when: not the host (normal), OR restoring session (host promoted on reconnect)
      if ((!isHostRef.current || isRestoringSessionRef.current) && data.state && isValidGameState(data.state)) {
        dispatch({ type: 'SYNC_STATE', payload: data.state });
        setGameStarted(true);
        isRestoringSessionRef.current = false;
        setIsRestoringSession(false);
      }
    };

    const handleSettingsUpdated = (newSettings: any) => {
      setSettings((prev) => ({ ...prev, ...newSettings, rules: { ...prev.rules, ...(newSettings?.rules || {}) } }));
    };

    const handleKicked = () => {
      resetSocket(); // BUG-7 FIX: Reset socket singleton so player can join another room
      setIsRestoringSession(false);
      setIsOnline(false);
      setRoomId("");
      setLobbyPlayers([]);
      setIsHost(false);
      setGameStarted(false);
      setIsSpectator(false);
      setSystemAlert("You have been kicked from the room.");
      window.history.replaceState({}, '', '/');
    };

    const handleChatMessage = (data: any) => {
      // MEM-03: Cap chat history at 200 messages to prevent unbounded memory growth
      setChatMessages(prev => [...prev.slice(-199), data]);
      if (soundEnabled) playSound('notification');
    };

    // ERR-04: Surface action rejections from the server (rate limit or not-a-player)
    const handleActionError = (data: any) => {
      console.warn('[action_error]', data?.error);
      if (data?.error) setSystemAlert(data.error);
    };

    const handleSocketDisconnect = () => setIsSocketDisconnected(true);
    const handleSocketConnect = () => setIsSocketDisconnected(false);
    const handleYouAreHost = () => setIsHost(true); // B4: server promotes us to host after original host permanently left

    const handleSessionRejected = () => {
      localStorage.removeItem('cashly_session');
      if (roomId) localStorage.removeItem(`cashly_game_${roomId}`);
      setSavedSession(null);
      resetSocket();
      isRestoringSessionRef.current = false;
      setIsRestoringSession(false);
      setIsOnline(false);
      setRoomId(null);
      setSessionPlayerId(null);
      setIsHost(false);
      setLobbyPlayers([]);
      setGameStarted(false);
      window.history.replaceState({}, '', '/');
    };

    socket.on("room_updated", handleRoomUpdated);
    socket.on("game_started", handleGameStarted);
    socket.on("host_process_action", handleHostProcessAction);
    socket.on("sync_state", handleSyncState);
    socket.on("settings_updated", handleSettingsUpdated);
    socket.on("kicked", handleKicked);
    socket.on("chat_message", handleChatMessage);
    socket.on("action_error", handleActionError);
    socket.on("rooms_list", (rooms: any[]) => setActiveRooms(rooms));
    socket.on("admin_board_pushed", ({ board }: { board: any }) => {
      setActiveBoard(board ?? null);
      if (board) localStorage.setItem('adminActiveBoard', JSON.stringify(board));
      else localStorage.removeItem('adminActiveBoard');
      fetchBoardCatalog();
    });
    socket.on("boards_catalog_updated", fetchBoardCatalog);
    socket.on("disconnect", handleSocketDisconnect);
    socket.on("connect", handleSocketConnect);
    socket.on("connect_error", handleSocketDisconnect);
    socket.on("you_are_host", handleYouAreHost);
    socket.on("session_rejected", handleSessionRejected);

    return () => {
      socket.off("room_updated", handleRoomUpdated);
      socket.off("game_started", handleGameStarted);
      socket.off("host_process_action", handleHostProcessAction);
      socket.off("sync_state", handleSyncState);
      socket.off("settings_updated", handleSettingsUpdated);
      socket.off("kicked", handleKicked);
      socket.off("chat_message", handleChatMessage);
      socket.off("action_error", handleActionError);
      socket.off("rooms_list");
      socket.off("admin_board_pushed");
      socket.off("boards_catalog_updated", fetchBoardCatalog);
      socket.off("disconnect", handleSocketDisconnect);
      socket.off("you_are_host", handleYouAreHost);
      socket.off("connect", handleSocketConnect);
      socket.off("connect_error", handleSocketDisconnect);
      socket.off("session_rejected", handleSessionRejected);
    };
  }, [roomId, sessionPlayerId]);

  // Fetch saved board catalog on mount so the map picker matches the admin board library
  useEffect(() => {
    fetchBoardCatalog();
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Tracks whether we've already broadcast the initial start_game state (BUG-02)
  const startGameBroadcastedRef = useRef(false);
  useEffect(() => {
    if (!isOnline || !isHost) return;
    // BUG-02: Broadcast start_game using the real post-dispatch state from React,
    // not a manually pre-computed state (which would use different Math.random() calls).
    if (gameStarted && !startGameBroadcastedRef.current && gameState.phase !== undefined) {
      startGameBroadcastedRef.current = true;
      const socket = getSocket();
      if (socket) {
        socket.emit("start_game", { initialState: gameState });
      }
      return;
    }
  }, [gameStarted, gameState, isOnline, isHost]);

  // Sync state to clients if host
  useEffect(() => {
    if (isOnline && isHost && gameStarted) {
      const stablePhases = ['ROLL', 'TURN_END', 'AUCTION', 'ACTION'];
      if (!stablePhases.includes(gameState.phase)) return; // BUG-C7: Only sync on stable phases

      const socket = getSocket();
      if (socket) {
        // 50ms trailing debounce — collapses rapid state changes into one emit
        const timeoutId = setTimeout(() => {
          socket.emit("sync_state", { state: gameState });
        }, 50);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [gameState, isOnline, isHost, gameStarted]);

  // Dismiss trade modal when an auction starts (prevents overlapping modals)
  useEffect(() => {
    if (gameState.phase === 'AUCTION') {
      setShowCreateTradeModal(false);
    }
  }, [gameState.phase]);

  // Reset popup dismissed state when a new trade comes in
  useEffect(() => {
    if (gameState.pendingTrade) {
      setTradePopupDismissed(false);
    }
  }, [gameState.pendingTrade?.proposerId, gameState.pendingTrade?.targetId, gameState.pendingTrade?.targetPropertyId]);

  // Intercept dispatch for online play
  const handleDispatch = (action: any) => {
    if (action.type === 'BUY_PROPERTY') sfx('buy');
    if (isOnline && !isHost) {
      const socket = getSocket();
      if (socket) {
        const now = Date.now();
        const last = lastActionTimeRef.current.get(action.type) ?? 0;
        if (now - last < 100) return; // throttle duplicate rapid-fire actions
        lastActionTimeRef.current.set(action.type, now);
        socket.emit("game_action", action);
      }
    } else {
      dispatch(action);
    }
  };

  // ── Phase auto-transitions (non-bot) ───────────────────────────────────────
  useEffect(() => {
    // BUG-06: Guard by winnerId so timer doesn't fire after game ends
    if (!gameStarted || gameState.winnerId !== null || gameState.phase === 'AUCTION') return;
    // RACE-03: Only the host (or local singleplayer) drives MOVING/RESOLVING transitions.
    // Non-host clients must NOT fire these or the host receives duplicate actions.
    if (isOnline && !isHost) return;
    let timer: ReturnType<typeof setTimeout>;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isBot = currentPlayer?.isBot;

    if (gameState.phase === 'MOVING') {
      timer = setTimeout(() => handleDispatch({ type: 'MOVE_PLAYER' }), isBot ? 800 : 800);
    } else if (gameState.phase === 'RESOLVING') {
      timer = setTimeout(() => handleDispatch({ type: 'LAND_ON_TILE' }), isBot ? 500 : 600);
    }
    return () => clearTimeout(timer);
  }, [gameState.phase, gameStarted, gameState.winnerId, gameState.currentPlayerIndex]);

  // ── Timer loop for active Votekicks ─────────────────────────────────────────
  useEffect(() => {
    if (gameState.votekicks && gameState.votekicks.length > 0) {
      const interval = setInterval(() => {
        // BUG-07: Pass current timestamp so reducer stays deterministic
        handleDispatch({ type: 'CHECK_VOTEKICKS', payload: { now: Date.now() } });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState.votekicks?.length, gameStarted]);

  // RACE-04: Prevent END_AUCTION from firing while a DECREMENT is still in flight
  const auctionEndFiredRef = useRef(false);
  useEffect(() => {
    // BUG-06: Guard by winnerId
    if (gameState.phase !== 'AUCTION' || !gameState.auction || gameState.winnerId !== null) {
      auctionEndFiredRef.current = false;
      return;
    }
    if (isOnline && !isHost) return; // Only host handles timers

    if (gameState.auction.timer > 0) {
      auctionEndFiredRef.current = false;
      const interval = setInterval(() => handleDispatch({ type: 'DECREMENT_AUCTION_TIMER' }), 1000);
      return () => clearInterval(interval);
    } else if (!auctionEndFiredRef.current) {
      auctionEndFiredRef.current = true;
      handleDispatch({ type: 'END_AUCTION' });
    }
  }, [gameState.phase, gameState.auction?.timer, gameState.winnerId, isOnline, isHost]);

  // ── Bot main actions (IMP-11: via botService) ──────────────────────────────
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameStarted || !currentPlayer?.isBot || gameState.winnerId !== null) return;
    if (isOnline && !isHost) return; // Only host handles bots

    const delays: Record<string, number> = {
      ROLL: 400,
      ACTION: 500,
      TURN_END: 600,
    };
    const delay = delays[gameState.phase] ?? 0;
    if (!delay) return;

    const timer = setTimeout(() => {
      const action = getBotAction(gameState);
      if (action) {
        handleDispatch(action);
      } else {
        // Safety fallback for every phase — bot must never get stuck
        if (gameState.phase === 'ROLL') handleDispatch({ type: 'ROLL_DICE' });
        else handleDispatch({ type: 'END_TURN' });
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [
    gameState.phase,
    gameState.currentPlayerIndex,
    gameStarted,
    gameState.winnerId,
    isOnline,
    isHost,
    gameState.turnLogs.length,
    // NOTE: pendingTrade deliberately excluded — trade resolution resets the roll
    // timer causing bots to freeze. getBotAction reads pendingTrade from gameState
    // directly at fire-time, so removing it from deps is safe.
  ]);

  // ── Bot ROLL watchdog: hard guarantee bot always rolls within 2 seconds ─────
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameStarted || !currentPlayer?.isBot || gameState.winnerId !== null) return;
    if (gameState.phase !== 'ROLL') return;
    if (isOnline && !isHost) return;

    const watchdog = setTimeout(() => {
      handleDispatch({ type: 'ROLL_DICE' });
    }, 2000);

    return () => clearTimeout(watchdog);
  }, [
    gameState.phase,
    gameState.currentPlayerIndex,
    gameStarted,
    gameState.winnerId,
    isOnline,
    isHost,
  ]);

  // ── Bot ACTION watchdog: guarantee bot buys/skips within 2.5s ───────────────
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameStarted || !currentPlayer?.isBot || gameState.winnerId !== null) return;
    if (gameState.phase !== 'ACTION') return;
    if (isOnline && !isHost) return;

    const watchdog = setTimeout(() => {
      handleDispatch({ type: 'END_TURN' });
    }, 2500);

    return () => clearTimeout(watchdog);
  }, [
    gameState.phase,
    gameState.currentPlayerIndex,
    gameStarted,
    gameState.winnerId,
    isOnline,
    isHost,
  ]);

  // ── Bot TURN_END watchdog: guarantee bot ends turn within 4s ─────────────────
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameStarted || !currentPlayer?.isBot || gameState.winnerId !== null) return;
    if (gameState.phase !== 'TURN_END') return;
    if (isOnline && !isHost) return;

    const watchdog = setTimeout(() => {
      handleDispatch({ type: 'END_TURN' });
    }, 4000);

    return () => clearTimeout(watchdog);
  }, [
    gameState.phase,
    gameState.currentPlayerIndex,
    gameStarted,
    gameState.winnerId,
    isOnline,
    isHost,
  ]);

  // ── Bot RESOLVING watchdog: force END_TURN if stuck in RESOLVING > 3s ────────
  useEffect(() => {
    if (!gameStarted || gameState.winnerId !== null) return;
    if (gameState.phase !== 'RESOLVING') return;
    if (isOnline && !isHost) return;
    const watchdog = setTimeout(() => {
      handleDispatch({ type: 'END_TURN' });
    }, 3000);
    return () => clearTimeout(watchdog);
  }, [gameState.phase, gameState.currentPlayerIndex, gameStarted, gameState.winnerId, isOnline, isHost]);

  // ── Net worth history: snapshot every turn for end-game chart ─────────────
  const [netWorthHistory, setNetWorthHistory] = useState<Array<{ turn: number; values: Record<number, number> }>>([]);
  useEffect(() => {
    if (!gameStarted || gameState.turnCount === 0) return;
    const snapshot: Record<number, number> = {};
    gameState.players.forEach(p => {
      const propValue = gameState.tiles
        .filter(t => t.ownerId === p.id)
        .reduce((sum, t) => sum + t.price + t.buildingCount * (t.houseCost || 0), 0);
      snapshot[p.id] = p.isBankrupt ? 0 : p.money + propValue;
    });
    setNetWorthHistory(prev => {
      if (prev.length > 0 && prev[prev.length - 1].turn === gameState.turnCount) return prev;
      return [...prev, { turn: gameState.turnCount, values: snapshot }];
    });
  }, [gameState.turnCount, gameStarted]);
  useEffect(() => { if (!gameStarted) setNetWorthHistory([]); }, [gameStarted]);

  // Close monopoly popup when the active player's turn ends (currentPlayerIndex changes)
  const prevPlayerIndexRef = useRef(0);
  useEffect(() => {
    if (!gameStarted) return;
    if (gameState.currentPlayerIndex !== prevPlayerIndexRef.current) {
      prevPlayerIndexRef.current = gameState.currentPlayerIndex;
      setSetCompleteAnim(null);
    }
  }, [gameState.currentPlayerIndex, gameStarted]);

  // ── Detect newly completed color sets and trigger animation ─────────────────
  useEffect(() => {
    if (!gameStarted) return;
    const prevTiles = prevTilesRef.current;
    const newTiles = gameState.tiles;
    const groups = Array.from(new Set(newTiles.filter(t => t.group !== ColorGroup.NONE).map(t => t.group)));
    for (const group of groups) {
      const gTiles = newTiles.filter(t => t.group === group);
      const prevGTiles = prevTiles.filter(t => t.group === group);
      const newOwner = gTiles[0]?.ownerId;
      const isNowComplete = newOwner !== null && gTiles.every(t => t.ownerId === newOwner);
      const prevOwner = prevGTiles[0]?.ownerId;
      const wasComplete = prevOwner !== null && prevGTiles.every(t => t.ownerId === prevOwner);
      if (isNowComplete && !wasComplete) {
        const owner = gameState.players.find(p => p.id === newOwner);
        setSetCompleteAnim({ group, tiles: gTiles, ownerName: owner?.name ?? '', ownerColor: owner?.color ?? '#fff' });
        if (soundEnabled) playSound('monopoly');
      }
    }
    prevTilesRef.current = newTiles;
  }, [gameState.tiles, gameStarted]);

  // ── Auto-resolve bot-target trades after a brief delay so all players see it ─
  useEffect(() => {
    const trade = gameState.pendingTrade;
    if (!trade?.botDecision) return;
    if (isOnline && !isHost) return; // Only host resolves bot trades
    const t = setTimeout(() => {
      handleDispatch({ type: trade.botDecision === 'accept' ? 'ACCEPT_TRADE' : 'DECLINE_TRADE' });
    }, 1500);
    return () => clearTimeout(t);
  }, [gameState.pendingTrade?.proposerId, gameState.pendingTrade?.targetId, gameState.pendingTrade?.botDecision]);

  // ── Bot auction bids (IMP-11: via botService, BUG-11: ref guard) ───────────
  // RACE-02: Use a stable timer ref so cleanup always cancels the correct timeout
  const botBidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (gameState.phase !== 'AUCTION' || !gameState.auction || gameState.winnerId !== null) return;
    if (isOnline && !isHost) return; // Only host handles bots
    if (botBidFiringRef.current) return;

    botBidFiringRef.current = true;
    const auction = gameState.auction;
    const botsToAct = gameState.players.filter(p => p.isBot && !p.isBankrupt && p.id !== auction.highestBidderId);

    botBidTimerRef.current = setTimeout(() => {
      for (const bot of botsToAct) {
        const action = getBotBidAction(gameState, bot.id, auction);
        if (action) handleDispatch(action);
      }
      botBidFiringRef.current = false;
    }, 400 + Math.random() * 600);

    return () => {
      if (botBidTimerRef.current) clearTimeout(botBidTimerRef.current);
      botBidFiringRef.current = false;
    };
  }, [gameState.phase, gameState.auction?.timer, gameState.auction?.highestBidderId, gameState.winnerId, isOnline, isHost]);

  // F13: Keyboard shortcuts — Space=roll, B=buy, E=end turn, A=auction
  useEffect(() => {
    if (!gameStarted || gameState.winnerId !== null) return;
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (currentPlayer?.id !== myPlayerId || currentPlayer?.isBot) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && gameState.phase === 'ROLL') {
        e.preventDefault();
        handleDispatch({ type: 'ROLL_DICE' });
      } else if ((e.key === 'b' || e.key === 'B') && gameState.phase === 'ACTION') {
        handleDispatch({ type: 'BUY_PROPERTY' });
      } else if ((e.key === 'a' || e.key === 'A') && gameState.phase === 'ACTION') {
        handleDispatch({ type: 'START_AUCTION' });
      } else if ((e.key === 'e' || e.key === 'E') && (gameState.phase === 'TURN_END' || gameState.phase === 'ACTION')) {
        handleDispatch({ type: 'END_TURN' });
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameStarted, gameState.phase, gameState.currentPlayerIndex, gameState.winnerId, myPlayerId]);

  const handleStartGame = () => {
    // In spectator mode, make all players bots
    const effectiveSettings = spectatorMode
      ? { ...settings, allowBots: true, maxPlayers: settings.maxPlayers }
      : settings;

    const action = {
      type: 'START_GAME',
      payload: {
        humanName: spectatorMode ? 'Spectator' : humanName,
        settings: effectiveSettings,
        lobbyPlayers: isOnline ? lobbyPlayers : null,
        selectedAvatar,
        profileImage: session?.user?.image ?? undefined,
        customTiles: customBoardTiles ?? undefined,
      },
    };

    // BUG-02: dispatch first so React's state update holds the real computed state.
    // The start_game socket emit is handled in the sync useEffect below which reads
    // the post-dispatch gameState, avoiding a double reducer execution with Math.random().
    dispatch(action as any);
    setGameStarted(true);
  };

  const createRoom = async (isPrivate = false) => {
    setIsCreatingRoom(true);
    try {
      const r = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: humanName, avatar: selectedAvatar, profileImage: session?.user?.image ?? undefined, ...settings, isPrivate }),
      });
      if (!r.ok) throw new Error(await r.text());
      const res = await r.json();

      if (res.success) {
        setIsOnline(true);
        setRoomId(res.roomId);
        setSessionPlayerId(res.playerId);
        setIsHost(true);
        setLobbyPlayers(res.players);
        if (res.settings) setSettings((prev) => ({ ...prev, ...res.settings, rules: { ...prev.rules, ...(res.settings.rules || {}) } }));
        setShowRoomBrowser(false);
        localStorage.setItem('cashly_session', JSON.stringify({ playerId: res.playerId, roomId: res.roomId, playerName: humanName, savedAt: Date.now() }));
        if (isPrivate) {
          setSettings(prev => ({ ...prev, isPrivate: true }));
        }
        window.history.pushState({}, '', `/room/${res.roomId}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const joinRoom = async (specificRoomId: string = joinRoomId) => {
    if (!specificRoomId) return;
    const cleanId = specificRoomId.trim().toUpperCase();
    setIsJoiningRoom(true);
    try {
      const r = await fetch(`/api/rooms/${cleanId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: humanName, avatar: selectedAvatar, profileImage: session?.user?.image ?? undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      const res = await r.json();

      if (res.success) {
        setIsOnline(true);
        setRoomId(res.roomId);
        setSessionPlayerId(res.playerId);
        setIsHost(false);
        setLobbyPlayers(res.players);
        if (res.settings) setSettings((prev) => ({ ...prev, ...res.settings, rules: { ...prev.rules, ...(res.settings.rules || {}) } }));
        setShowRoomBrowser(false);
        if (res.isSpectator) setIsSpectator(true);
        localStorage.setItem('cashly_session', JSON.stringify({ playerId: res.playerId, roomId: res.roomId, playerName: humanName, savedAt: Date.now() }));
        window.history.replaceState({}, '', `/room/${res.roomId}`);
      } else {
        setSystemAlert(res.error || "Failed to join room");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const joinRandomRoom = async () => {
    try {
      const r = await fetch("/api/rooms/random", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: humanName, avatar: selectedAvatar, profileImage: session?.user?.image ?? undefined }),
      });
      if (!r.ok) throw new Error(await r.text());
      const res = await r.json();

      if (res.success) {
        setIsOnline(true);
        setRoomId(res.roomId);
        setSessionPlayerId(res.playerId);
        setIsHost(res.players.find((p: any) => p.id === res.playerId)?.isHost || false);
        setLobbyPlayers(res.players);
        if (res.settings) setSettings((prev) => ({ ...prev, ...res.settings, rules: { ...prev.rules, ...(res.settings.rules || {}) } }));
        localStorage.setItem('cashly_session', JSON.stringify({ playerId: res.playerId, roomId: res.roomId, playerName: humanName, savedAt: Date.now() }));
        window.history.pushState({}, '', `/room/${res.roomId}`);
      } else {
        setSystemAlert(res.error || "Failed to join random room");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const leaveRoom = () => {
    recordLeaveLoss();
    // NET-05: Tell server we're intentionally leaving so slot is freed immediately
    const socket = getSocket();
    if (socket) socket.emit("leave_room");
    resetSocket();
    localStorage.removeItem('cashly_session');
    if (roomId) localStorage.removeItem(`cashly_game_${roomId}`);
    setSavedSession(null);
    dispatch({ type: 'RESET_GAME' });
    startGameBroadcastedRef.current = false;
    prevLobbyCountRef.current = -1;
    setIsOnline(false);
    setRoomId(null);
    setSessionPlayerId(null);
    setIsHost(false);
    setLobbyPlayers([]);
    setGameStarted(false);
    setIsSpectator(false);
    setShowAppearanceModal(false);
    setMyPlayerId(0);
    setIsSocketDisconnected(false);
    window.history.replaceState({}, '', '/');
  };

  const handleRejoin = () => {
    if (!savedSession) return;
    setIsOnline(true);
    setRoomId(savedSession.roomId);
    setSessionPlayerId(savedSession.playerId);
    // B5: Restore the name the player originally joined with
    if (savedSession.playerName) setHumanName(savedSession.playerName);
    window.history.pushState({}, '', `/room/${savedSession.roomId}`);
  };

  // Back-button: leave room when browser navigates to /
  useEffect(() => {
    const handlePopState = () => {
      if (isOnlineRef.current) {
        recordLeaveLoss();
        resetSocket();
        setIsOnline(false); setRoomId(null); setSessionPlayerId(null);
        setIsHost(false); setLobbyPlayers([]); setGameStarted(false);
        setIsSpectator(false); setShowAppearanceModal(false); setMyPlayerId(0);
        dispatch({ type: 'RESET_GAME' });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Per-turn client save: refresh savedAt and overwrite previous turn snapshot.
  // Keeps only the latest turn in localStorage to minimise memory usage.
  // Runs for ALL rooms (solo bots, multiplayer, spectator — no edge-case carve-outs).
  useEffect(() => {
    if (!gameStarted || !isOnline || gameState.turnCount === 0) return;
    try {
      const raw = localStorage.getItem('cashly_session');
      if (raw) {
        const session = JSON.parse(raw);
        // Overwrite previous snapshot — single key, always the latest turn
        localStorage.setItem('cashly_session', JSON.stringify({
          ...session,
          savedAt: Date.now(),
          turnCount: gameState.turnCount,
        }));
      }
      // Cache full game state so page refresh can restore instantly before server sync arrives
      if (roomId) {
        localStorage.setItem(`cashly_game_${roomId}`, JSON.stringify(gameState));
      }
    } catch {}
  }, [gameState.turnCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Award 1 coin to logged-in user when they win
  const winCoinPostedRef = useRef(false);
  useEffect(() => {
    if (!gameStarted || gameState.winnerId === null) { winCoinPostedRef.current = false; return; }
    if (gameState.winnerId === myPlayerId && sessionUser && !winCoinPostedRef.current) {
      winCoinPostedRef.current = true;
      authFetch('/api/profile/win-coin', { method: 'POST' }).catch(() => {});
    }
  }, [gameState.winnerId, myPlayerId, gameStarted, sessionUser]);

  // ── Profile stats tracking ────────────────────────────────────────────────
  // Fires at most 2 requests per game: once on start, once on end/leave/bankruptcy.
  const statsStartedRef = useRef(false);
  const statsEndedRef = useRef(false);
  const postStats = (payload: Record<string, number>, useBeacon = false) => {
    if (useBeacon && 'fetch' in window) {
      try {
        fetch('/api/profile/stats', {
          method: 'POST',
          credentials: 'include',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {});
      } catch {}
    } else {
      authFetch('/api/profile/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
    }
  };

  // gamesPlayed: increment once when a game begins for a non-spectator user
  useEffect(() => {
    if (!gameStarted) {
      statsStartedRef.current = false;
      statsEndedRef.current = false;
      return;
    }
    if (sessionUser && !isSpectator && !statsStartedRef.current) {
      statsStartedRef.current = true;
      postStats({ gamesPlayed: 1 });
    }
  }, [gameStarted, sessionUser, isSpectator]);

  // gamesWon / gamesLost / bankruptcies: increment once when this player's game ends
  const myPlayer = gameState.players.find(p => p.id === myPlayerId);
  const myBankrupt = !!myPlayer?.isBankrupt;
  useEffect(() => {
    if (!gameStarted || !sessionUser || isSpectator || statsEndedRef.current) return;
    const gameOver = gameState.winnerId !== null;
    if (!gameOver && !myBankrupt) return;
    statsEndedRef.current = true;
    const payload: Record<string, number> = { totalTurns: gameState.turnCount ?? 0 };
    if (gameOver && gameState.winnerId === myPlayerId) payload.gamesWon = 1;
    else payload.gamesLost = 1;
    if (myBankrupt) payload.bankruptcies = 1;
    postStats(payload);
  }, [gameState.winnerId, myBankrupt, gameStarted, sessionUser, isSpectator, myPlayerId, gameState.turnCount]);

  // Record a loss if the user leaves an in-progress game (called from leave handlers)
  const recordLeaveLoss = () => {
    if (!gameStarted || statsEndedRef.current || !sessionUser || isSpectator) return;
    if (gameState.winnerId !== null) return; // game already ended — end-effect handles it
    statsEndedRef.current = true;
    postStats({ gamesLost: 1, totalTurns: gameState.turnCount ?? 0 }, true);
  };

  const fetchRooms = async () => {
    try {
      const rooms = await fetch("/api/rooms").then(r => r.json());
      setActiveRooms(rooms);
    } catch (e) {
      console.error(e);
    }
  };

  // Auto-refresh rooms when browser is open
  useEffect(() => {
    if (!showRoomBrowser) return;
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [showRoomBrowser]);

  // S3: Auto-join when room code reaches 6 characters
  // RACE-01: Use a ref flag set synchronously before the async call to prevent double-fire
  const autoJoinTriggeredRef = useRef(false);
  useEffect(() => {
    if (joinRoomId.length === 6 && !isOnline && !isJoiningRoom && !isAutoJoining && !autoJoinTriggeredRef.current) {
      autoJoinTriggeredRef.current = true;
      joinRoom(joinRoomId).finally(() => { autoJoinTriggeredRef.current = false; });
    }
  }, [joinRoomId]);

  const updateRule = (key: keyof typeof settings.rules, value: any) => {
    const newSettings = { ...settings, rules: { ...settings.rules, [key]: value } };
    setSettings(newSettings);
    if (isOnline && isHost) {
      getSocket()?.emit("update_settings", { settings: newSettings });
    }
  };

  const updateGeneralSetting = (key: keyof GameSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    if (isOnline && isHost) {
      getSocket()?.emit("update_settings", { settings: newSettings });
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim()) return;
    const socket = getSocket();
    if (socket) {
      const msg = {
        sender: humanName,
        text: chatInput,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      socket.emit("send_chat", msg);
      setChatInput('');
    }
  };

  const handleTileClick = (id: number) => {
    const tile = gameState.tiles[id];
    if (
      tile.type === TileType.CORNER ||
      tile.type === TileType.CHANCE ||
      tile.type === TileType.COMMUNITY_CHEST ||
      tile.type === TileType.TAX
    ) return;
    setSelectedTileId(id);
    sfx('land');
  };

  const renderChatBox = (isMobilePopup = false) => (
    <div className={`bg-[#1e1e24] rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-lg ${isMobilePopup ? 'w-[min(20rem,calc(100vw-2rem))] h-[min(24rem,calc(100dvh-7rem))]' : 'h-80 shrink-0'}`}>
      <div className="p-4 border-b border-slate-800 flex items-center justify-between text-slate-300 shrink-0">
        <div className="flex items-center gap-2 font-medium">
          <MessageSquare size={16} className="text-indigo-400" />
          <span className="font-bold">Chat</span>
        </div>
        {isMobilePopup && (
          <button onClick={() => setShowMobileChat(false)} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2 opacity-50">
            <MessageSquare size={32} />
            <span>No messages yet</span>
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400">{msg.sender}</span>
                <span className="text-[10px] text-slate-500">{msg.time}</span>
              </div>
              <div className="bg-slate-800/50 rounded-lg p-2 text-sm text-slate-200 break-words">
                {msg.text}
              </div>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 border-t border-slate-800 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
            placeholder="Say something..."
            className="w-full bg-[#111116] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 pr-10"
          />
          <button
            onClick={sendChatMessage}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  const renderShareBox = (showSettingsButton = false) => (
    <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-3 sm:p-5 flex flex-col gap-3 shadow-lg shrink-0">
      <div className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-2">
        Share this game <Info size={14} className="text-slate-500" />
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex-1 bg-[#111116] px-3 py-2 rounded-xl text-sm font-mono text-slate-300 select-all border border-slate-800 truncate">
          {window.location.origin}/room/{roomId}
        </div>
        <button
          onClick={() => {
            const textToCopy = `${window.location.origin}/room/${roomId || ''}`;

            if (navigator.clipboard && window.isSecureContext) {
              navigator.clipboard.writeText(textToCopy)
                .then(() => setSystemAlert("Copied room link to clipboard!"))
                .catch(() => setSystemAlert("Failed to copy link via clipboard API."));
            } else {
              // Fallback for non-HTTPS (like local network IP testing)
              try {
                const textArea = document.createElement("textarea");
                textArea.value = textToCopy;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                const successful = document.execCommand('copy');
                textArea.remove();
                if (successful) {
                  setSystemAlert("Copied room link to clipboard!");
                } else {
                  setSystemAlert("Failed to copy link using fallback.");
                }
              } catch (err) {
                setSystemAlert("Failed to copy link. Please select the text and copy manually.");
              }
            }
          }}
          className="bg-indigo-500 hover:bg-indigo-400 min-h-10 p-2 rounded-xl text-white transition-colors flex items-center gap-1.5 sm:gap-2 px-3 text-xs sm:text-sm font-bold shadow-lg shadow-indigo-500/20 shrink-0"
        >
          <Copy size={16} /> Copy
        </button>
      </div>
      {showSettingsButton && (
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex-1 bg-slate-800 hover:bg-slate-700 p-2 rounded-xl text-slate-300 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
          >
            <Settings size={16} /> View room settings
          </button>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="bg-slate-800 hover:bg-slate-700 p-2 rounded-xl text-slate-400 hover:text-slate-200 transition-colors"
            title={soundEnabled ? 'Mute' : 'Unmute'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>
        </div>
      )}
    </div>
  );

  const renderGameSettings = () => (
    <div className="space-y-6 overflow-y-auto pl-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
      <div className="flex gap-3">
        <Users size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Maximum players</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">How many players can join the game</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={!isHost || gameStarted}
                className="w-full bg-[#111116] border-slate-700 rounded-xl px-3 py-4 text-sm text-slate-300 font-bold justify-between hover:bg-slate-800 hover:text-white"
              >
                {settings.maxPlayers} Players
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full min-w-[200px] bg-[#111116] border-slate-700 text-slate-300 rounded-xl">
              <DropdownMenuGroup>
                {[2, 3, 4, 5, 6, 7, 8].map(n => (
                  <DropdownMenuItem
                    key={n}
                    disabled={!isHost || gameStarted}
                    onClick={() => updateGeneralSetting('maxPlayers', n)}
                    className="focus:bg-slate-800 focus:text-slate-200 cursor-pointer rounded-lg m-1 font-bold"
                  >
                    {n} Players
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={`flex gap-3 rounded-xl p-2 -mx-2 transition-colors ${settings.isPrivate ? 'bg-indigo-500/8 border border-indigo-500/15' : ''}`}>
        <Lock size={18} className={`shrink-0 mt-0.5 ${settings.isPrivate ? 'text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Private room</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">Private rooms can only be accessed using the room URL</div>
          <div className="flex justify-end">
            <Switch
              disabled={!isHost || gameStarted}
              checked={settings.isPrivate}
              onCheckedChange={(checked) => updateGeneralSetting('isPrivate', checked)}
            />
          </div>
        </div>
      </div>

      <div className={`flex gap-3 rounded-xl p-2 -mx-2 transition-colors ${settings.allowBots ? 'bg-indigo-500/8 border border-indigo-500/15' : ''}`}>
        <Bot size={18} className={`shrink-0 mt-0.5 ${settings.allowBots ? 'text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
            Allow bots to join
          </div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">Bots will join the game based on availability to fill empty slots</div>
          <div className="flex justify-end">
            <Switch
              disabled={!isHost || gameStarted}
              checked={settings.allowBots}
              onCheckedChange={(checked) => updateGeneralSetting('allowBots', checked)}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <TrendingUp size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Starting cash</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">Adjust how much money players start the game with</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={!isHost || gameStarted}
                className="w-full bg-[#111116] border-slate-700 rounded-xl px-3 py-4 text-sm text-slate-300 font-bold justify-between hover:bg-slate-800 hover:text-white"
              >
                ${settings.rules.startingCash}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full min-w-[200px] bg-[#111116] border-slate-700 text-slate-300 rounded-xl">
              <DropdownMenuGroup>
                {[1000, 1500, 2000, 2500, 3000].map(n => (
                  <DropdownMenuItem
                    key={n}
                    disabled={!isHost || gameStarted}
                    onClick={() => updateRule('startingCash', n)}
                    className="focus:bg-slate-800 focus:text-slate-200 cursor-pointer rounded-lg m-1 font-bold"
                  >
                    ${n}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className={`flex gap-3 rounded-xl p-2 -mx-2 transition-colors ${settings.rules.doubleRentOnFullSet ? 'bg-indigo-500/8 border border-indigo-500/15' : ''}`}>
        <Landmark size={18} className={`shrink-0 mt-0.5 ${settings.rules.doubleRentOnFullSet ? 'text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">x2 rent on full-set properties</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">If a player owns a full property set, the base rent payment will be doubled</div>
          <div className="flex justify-end">
            <Switch
              disabled={!isHost || gameStarted}
              checked={settings.rules.doubleRentOnFullSet}
              onCheckedChange={(checked) => updateRule('doubleRentOnFullSet', checked)}
            />
          </div>
        </div>
      </div>

      <div className={`flex gap-3 rounded-xl p-2 -mx-2 transition-colors ${settings.rules.vacationCash ? 'bg-indigo-500/8 border border-indigo-500/15' : ''}`}>
        <Plane size={18} className={`shrink-0 mt-0.5 ${settings.rules.vacationCash ? 'text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Vacation cash</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">If a player lands on Vacation, all collected money from taxes and bank payments will be earned</div>
          <div className="flex justify-end">
            <Switch
              disabled={!isHost || gameStarted}
              checked={settings.rules.vacationCash}
              onCheckedChange={(checked) => updateRule('vacationCash', checked)}
            />
          </div>
        </div>
      </div>

      <div className={`flex gap-3 rounded-xl p-2 -mx-2 transition-colors ${settings.rules.auctionEnabled ? 'bg-indigo-500/8 border border-indigo-500/15' : ''}`}>
        <LayoutGrid size={18} className={`shrink-0 mt-0.5 ${settings.rules.auctionEnabled ? 'text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Auction</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">If a player skips purchasing the property landed on, it will be sold to the highest bidder</div>
          <div className="flex justify-end">
            <Switch
              disabled={!isHost || gameStarted}
              checked={settings.rules.auctionEnabled}
              onCheckedChange={(checked) => updateRule('auctionEnabled', checked)}
            />
          </div>
        </div>
      </div>

      <div className={`flex gap-3 rounded-xl p-2 -mx-2 transition-colors ${settings.rules.noRentInJail ? 'bg-indigo-500/8 border border-indigo-500/15' : ''}`}>
        <ShieldCheck size={18} className={`shrink-0 mt-0.5 ${settings.rules.noRentInJail ? 'text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Don't collect rent while in prison</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">Rent will not be collected when landing on properties whose owners are in prison</div>
          <div className="flex justify-end">
            <Switch
              disabled={!isHost || gameStarted}
              checked={settings.rules.noRentInJail}
              onCheckedChange={(checked) => updateRule('noRentInJail', checked)}
            />
          </div>
        </div>
      </div>

      <div className={`flex gap-3 rounded-xl p-2 -mx-2 transition-colors ${settings.rules.mortgageEnabled ? 'bg-indigo-500/8 border border-indigo-500/15' : ''}`}>
        <Landmark size={18} className={`shrink-0 mt-0.5 ${settings.rules.mortgageEnabled ? 'text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Mortgage</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">Mortgage properties to earn 50% of their cost, but you won't get paid rent when players land on them</div>
          <div className="flex justify-end">
            <Switch
              disabled={!isHost || gameStarted}
              checked={settings.rules.mortgageEnabled}
              onCheckedChange={(checked) => updateRule('mortgageEnabled', checked)}
            />
          </div>
        </div>
      </div>

      <div className={`flex gap-3 rounded-xl p-2 -mx-2 transition-colors ${settings.rules.randomizeOrder ? 'bg-indigo-500/8 border border-indigo-500/15' : ''}`}>
        <Dices size={18} className={`shrink-0 mt-0.5 ${settings.rules.randomizeOrder ? 'text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Randomize player order</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">Shuffle the turn order at game start for a fair random sequence</div>
          <div className="flex justify-end">
            <Switch
              disabled={!isHost || gameStarted}
              checked={settings.rules.randomizeOrder}
              onCheckedChange={(checked) => updateRule('randomizeOrder', checked)}
            />
          </div>
        </div>
      </div>

      <div className={`flex gap-3 rounded-xl p-2 -mx-2 transition-colors ${settings.rules.evenBuild ? 'bg-indigo-500/8 border border-indigo-500/15' : ''}`}>
        <Copy size={18} className={`shrink-0 mt-0.5 ${settings.rules.evenBuild ? 'text-indigo-400' : 'text-slate-400'}`} />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Even build</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">Houses and hotels must be built up and sold off evenly within a property set</div>
          <div className="flex justify-end">
            <Switch
              disabled={!isHost || gameStarted}
              checked={settings.rules.evenBuild}
              onCheckedChange={(checked) => updateRule('evenBuild', checked)}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Globe size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Board map</div>
          <div className="text-[10px] text-slate-500 mb-2 leading-relaxed">Select which map to play on</div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                disabled={!isHost || gameStarted}
                className="w-full bg-[#111116] border-slate-700 rounded-xl px-3 py-4 text-sm text-slate-300 font-bold justify-between hover:bg-slate-800 hover:text-white"
              >
                {settings.boardMap}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full min-w-[200px] bg-[#111116] border-slate-700 text-slate-300 rounded-xl">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={!isHost || gameStarted}
                  onClick={() => updateGeneralSetting('boardMap', 'Classic')}
                  className="focus:bg-slate-800 focus:text-slate-200 cursor-pointer rounded-lg m-1 font-bold"
                >
                  Classic
                </DropdownMenuItem>
                {savedBoards.map((board: any) => (
                  <DropdownMenuItem
                    key={board.id}
                    disabled={!isHost || gameStarted}
                    onClick={() => updateGeneralSetting('boardMap', board.name)}
                    className="focus:bg-slate-800 focus:text-slate-200 cursor-pointer rounded-lg m-1 font-bold"
                  >
                    {board.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {savedBoards.length === 0 && (
            <div className="text-[10px] text-slate-600 mt-1.5">No saved boards available yet</div>
          )}
        </div>
      </div>
    </div>
  );

  // ── Start Screen ────────────────────────────────────────────────────────────
  if (!gameStarted) {
    if (!isOnline) {
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          role="main"
          className="min-h-[100dvh] w-full max-w-none bg-[#111116] text-slate-50 flex flex-col relative overflow-x-hidden touch-pan-y"
        >
          {/* Creating room overlay */}
          <AnimatePresence>
            {isCreatingRoom && (
              <CashlyLoadingScreen
                key="creating-room"
                title="Creating room..."
                subtitle="Setting up your private game"
              />
            )}
          </AnimatePresence>

          {/* Policy page overlay */}
          <AnimatePresence>
            {activePolicyPage && (
              <motion.div
                key="policy"
                className="fixed inset-0 z-[550] bg-[#111116] overflow-y-auto"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              >
                <div className="max-w-2xl mx-auto px-6 py-12">
                  <button onClick={() => setActivePolicyPage(null)}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-200 transition-colors text-sm font-bold mb-8">
                    <ChevronLeft size={16} /> Back
                  </button>
                  {activePolicyPage === 'privacy' && (
                    <div className="space-y-6">
                      <h1 className="text-3xl font-black text-white">Privacy Policy</h1>
                      <p className="text-slate-400 text-sm leading-relaxed">Last updated: March 2025</p>
                      {[
                        { title: 'Information We Collect', body: 'We collect only the player name you enter and basic gameplay data (room IDs, game actions) to operate the multiplayer service. No account registration is required.' },
                        { title: 'How We Use Your Data', body: 'Player names and gameplay data are used solely to run game sessions. Data is stored temporarily in memory and is not persisted to a database after sessions end.' },
                        { title: 'Cookies', body: 'We use minimal session cookies to maintain your connection to an active game room. No tracking or advertising cookies are used.' },
                        { title: 'Third Parties', body: 'We do not sell, share, or transfer your data to any third parties.' },
                        { title: 'Contact', body: 'Questions? Reach us through our Discord server.' },
                      ].map((s, i) => (
                        <div key={i} className="bg-[#1a1a22] rounded-xl p-5 border border-slate-800">
                          <h3 className="font-bold text-white mb-2">{s.title}</h3>
                          <p className="text-slate-400 text-sm leading-relaxed">{s.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {activePolicyPage === 'terms' && (
                    <div className="space-y-6">
                      <h1 className="text-3xl font-black text-white">Terms of Service</h1>
                      <p className="text-slate-400 text-sm leading-relaxed">Last updated: March 2025</p>
                      {[
                        { title: 'Acceptance', body: 'By playing Cashly.io you agree to these terms. The game is provided free of charge for entertainment purposes.' },
                        { title: 'Fair Play', body: 'Do not exploit bugs, harass other players, or attempt to disrupt game sessions. Violators may be removed from rooms by vote-kick.' },
                        { title: 'Disclaimer', body: 'The game is provided "as is" without warranty. We are not responsible for interrupted sessions due to server downtime.' },
                        { title: 'Intellectual Property', body: 'Cashly.io is an original web game inspired by classic board game mechanics. All code and design is © 2025 Cashly.io.' },
                      ].map((s, i) => (
                        <div key={i} className="bg-[#1a1a22] rounded-xl p-5 border border-slate-800">
                          <h3 className="font-bold text-white mb-2">{s.title}</h3>
                          <p className="text-slate-400 text-sm leading-relaxed">{s.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {activePolicyPage === 'cookies' && (
                    <div className="space-y-6">
                      <h1 className="text-3xl font-black text-white">Cookie Policy</h1>
                      <p className="text-slate-400 text-sm leading-relaxed">Last updated: March 2025</p>
                      {[
                        { title: 'What Are Cookies', body: 'Cookies are small text files stored in your browser. We use them only to maintain your active game session.' },
                        { title: 'Cookies We Use', body: 'Session cookies: used to keep you connected to your active game room. These expire when your browser closes. We do not use any tracking, analytics, or advertising cookies.' },
                        { title: 'Disabling Cookies', body: 'You can disable cookies in your browser settings. Note that this will prevent you from joining or creating multiplayer rooms.' },
                      ].map((s, i) => (
                        <div key={i} className="bg-[#1a1a22] rounded-xl p-5 border border-slate-800">
                          <h3 className="font-bold text-white mb-2">{s.title}</h3>
                          <p className="text-slate-400 text-sm leading-relaxed">{s.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {activePolicyPage === 'contact' && (
                    <div className="space-y-6">
                      <h1 className="text-3xl font-black text-white">Contact</h1>
                      <p className="text-slate-400 text-sm leading-relaxed">Have a question, bug report, or feedback? We'd love to hear from you.</p>
                      {[
                        { title: 'Discord Community', body: 'Join our Discord server to chat with the developers and other players, report bugs, and suggest features.' },
                        { title: 'Bug Reports', body: 'Found a bug? Please describe the steps to reproduce it in our Discord #bug-reports channel.' },
                        { title: 'Feature Requests', body: 'Share your ideas in #suggestions on Discord. Popular requests get prioritised in our roadmap.' },
                      ].map((s, i) => (
                        <div key={i} className="bg-[#1a1a22] rounded-xl p-5 border border-slate-800">
                          <h3 className="font-bold text-white mb-2">{s.title}</h3>
                          <p className="text-slate-400 text-sm leading-relaxed">{s.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Top loading bar — only visible while loading */}
          <AnimatePresence>
            {(isAutoJoining || isJoiningRoom) && (
              <motion.div
                key="topbar"
                className="fixed top-0 left-0 right-0 z-[500] h-[3px] bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-500 overflow-hidden"
                initial={{ scaleX: 0, transformOrigin: 'left' }}
                animate={{ scaleX: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 2.5, ease: 'easeOut' }}
              >
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Auto-join loading overlay */}
          <AnimatePresence>
            {isAutoJoining && (
              <CashlyLoadingScreen
                key="auto-joining"
                mode="absolute"
                title="Joining room..."
                subtitle="Finding your table and syncing players"
              />
            )}
          </AnimatePresence>

          {/* Header glow — sits behind the top nav */}
          <HomeGlow />

          {/* Top Navigation Bar */}
          <nav className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 z-20 relative shrink-0 pt-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                aria-label={soundEnabled ? "Mute sound" : "Unmute sound"}
                className="p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-800/60"
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>
              <a
                href="#"
                title="Join our Discord"
                aria-label="Join our Discord"
                className="hidden sm:inline-flex p-2 text-slate-400 hover:text-indigo-400 transition-colors rounded-xl hover:bg-slate-800/60"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.461-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.030zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
            </div>

            {/* Mobile menu bar — sm:hidden */}
            <div className="sm:hidden relative">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setMobileNavOpen(v => !v)}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/80 border border-slate-700/50 backdrop-blur-md shadow-xl shadow-black/30"
              >
                {session?.user ? (
                  <>
                    {session.user.image ? (
                      <img src={session.user.image} className="h-5 w-5 rounded-full object-cover border border-slate-600 shrink-0" alt="" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-black shrink-0">
                        {session.user.name?.[0]?.toUpperCase() ?? '?'}
                      </div>
                    )}
                    <span className="max-w-[80px] truncate text-xs font-semibold text-slate-300">{session.user.name}</span>
                  </>
                ) : (
                  <>
                    <LayoutGrid size={15} className="text-slate-400 shrink-0" />
                    <span className="text-xs font-semibold text-slate-400 tracking-wide">Menu</span>
                  </>
                )}
                <ChevronDown size={11} className={`text-slate-500 shrink-0 transition-transform duration-200 ${mobileNavOpen ? 'rotate-180' : ''}`} />
              </motion.button>

              <AnimatePresence>
                {mobileNavOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMobileNavOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -8 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                      className="absolute right-0 top-full mt-2 z-50 bg-[#1a1a24]/95 border border-slate-700/50 rounded-2xl p-2 shadow-2xl backdrop-blur-md w-52"
                    >
                      {session?.user && (
                        <div className="flex items-center gap-3 px-3 py-3 mb-1">
                          {session.user.image ? (
                            <img src={session.user.image} className="h-9 w-9 rounded-full object-cover border-2 border-indigo-500/30 shrink-0" alt="" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-sm shrink-0">
                              {session.user.name?.[0]?.toUpperCase() ?? '?'}
                            </div>
                          )}
                          <p className="text-sm font-black text-white truncate">{session.user.name}</p>
                        </div>
                      )}

                      <button onClick={() => { onOpenStore?.(); setMobileNavOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/6 active:bg-white/10 transition-colors text-sm font-medium">
                        <ShoppingCart size={15} className="text-slate-400 shrink-0" /> Store
                      </button>

                      {session?.user ? (
                        <>
                          <button onClick={() => { onOpenFriends?.(); setMobileNavOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/6 active:bg-white/10 transition-colors text-sm font-medium">
                            <UsersRound size={15} className="text-slate-400 shrink-0" /> Friends
                          </button>
                          <button onClick={() => { onOpenProfile?.(); setMobileNavOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/6 active:bg-white/10 transition-colors text-sm font-medium">
                            <User size={15} className="text-slate-400 shrink-0" /> Your Profile
                          </button>
                          <button onClick={() => { onOpenSettings?.(); setMobileNavOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/6 active:bg-white/10 transition-colors text-sm font-medium">
                            <Settings size={15} className="text-slate-400 shrink-0" /> Settings
                          </button>
                          <div className="h-px bg-slate-700/60 my-1 mx-1" />
                          <button onClick={() => { onSignOut?.(); setMobileNavOpen(false); }}
                            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 active:bg-rose-500/15 transition-colors text-sm font-medium">
                            <LogOut size={15} className="shrink-0" /> Sign out
                          </button>
                        </>
                      ) : (
                        <button onClick={() => { onOpenLogin?.(); setMobileNavOpen(false); }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/6 active:bg-white/10 transition-colors text-sm font-medium">
                          <LogIn size={15} className="text-slate-400 shrink-0" /> Login
                        </button>
                      )}

                      <div className="h-px bg-slate-700/60 my-1 mx-1" />
                      <a href="#" onClick={() => setMobileNavOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-300 hover:text-indigo-400 hover:bg-white/6 active:bg-white/10 transition-colors text-sm font-medium">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" className="text-slate-400 shrink-0">
                          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.461-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.030zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        Discord
                      </a>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Desktop NavDock — hidden on mobile */}
            <div className="hidden sm:block">
            <NavDock>
              {/* Store */}
              <NavDockItem onClick={onOpenStore}>
                <ShoppingCart size={15} /> Store
              </NavDockItem>

              {session?.user ? (
                <>
                  <NavDockSep />
                  {/* Friends */}
                  <NavDockItem onClick={() => onOpenFriends?.()} title="Friends">
                    <UsersRound size={15} /> Friends
                  </NavDockItem>

                  <NavDockSep />

                  {/* User avatar dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <NavDockItem className="gap-2">
                        {session.user.image ? (
                          <img src={session.user.image} className="h-5 w-5 rounded-full object-cover border border-slate-600" alt="" />
                        ) : (
                          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-[9px] font-black">
                            {session.user.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                        <span className="max-w-[80px] truncate text-sm">{session.user.name}</span>
                        <ChevronDown size={12} className="text-slate-500 shrink-0" />
                      </NavDockItem>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52 bg-[#1a1a24] border border-white/10 rounded-xl shadow-2xl p-1.5">
                      <div className="flex flex-col items-center gap-2 px-3 py-3 mb-1">
                        {session.user.image ? (
                          <img src={session.user.image} className="h-12 w-12 rounded-full object-cover border-2 border-indigo-500/30" alt="" />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">
                            {session.user.name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                        )}
                        <div className="text-center">
                          <p className="text-sm font-black text-white leading-tight">{session.user.name}</p>
                        </div>
                      </div>
                      <DropdownMenuSeparator className="bg-white/5 my-1" />
                      <DropdownMenuItem
                        onClick={() => onOpenProfile?.()}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer focus:bg-white/5 focus:text-white"
                      >
                        <User size={14} className="text-slate-500" /> Your profile
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onOpenSettings?.()}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer focus:bg-white/5 focus:text-white"
                      >
                        <Settings size={14} className="text-slate-500" /> Settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-white/5 my-1" />
                      <DropdownMenuItem
                        onClick={() => onSignOut?.()}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg cursor-pointer focus:bg-rose-500/10 focus:text-rose-300"
                      >
                        <LogOut size={14} /> Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <>
                  <NavDockSep />
                  {/* Login with hover tooltip */}
                  <div className="relative group">
                    <NavDockItem onClick={() => onOpenLogin?.()}>
                      <LogIn size={15} /> Login
                    </NavDockItem>
                    <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50 text-left">
                      <p className="text-xs font-bold text-white mb-2">Sign in to unlock:</p>
                      <ul className="space-y-1 text-xs text-slate-400">
                        <li>📊 Stats tracking (wins, earnings)</li>
                        <li>👥 Friends &amp; lobby invites</li>
                        <li>🖼️ Profile picture &amp; username</li>
                        <li>🪙 Coins &amp; store rewards</li>
                      </ul>
                    </div>
                  </div>
                </>
              )}

            </NavDock>
            </div>
          </nav>

          {/* Floating Icons Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden text-slate-400">
            <div className="absolute top-[12%] left-[15%] opacity-[0.09] rotate-12"><Landmark size={64} /></div>
            <div className="absolute top-[60%] left-[8%] opacity-[0.08] -rotate-12"><Package size={48} /></div>
            <div className="absolute top-[28%] right-[14%] opacity-[0.09] rotate-45"><Zap size={56} /></div>
            <div className="absolute top-[72%] right-[18%] opacity-[0.08] -rotate-12"><Plane size={60} /></div>
            <div className="absolute bottom-[8%] left-[40%] opacity-[0.09] rotate-12"><Dices size={72} /></div>
            <div className="absolute top-[42%] left-[45%] opacity-[0.07] -rotate-6"><Building2 size={56} /></div>
            <div className="absolute top-[18%] right-[38%] opacity-[0.08] rotate-6"><Coins size={44} /></div>
            <div className="absolute bottom-[24%] right-[8%] opacity-[0.08] rotate-12"><Gem size={48} /></div>
            <div className="absolute top-[82%] left-[24%] opacity-[0.07] -rotate-12"><Car size={52} /></div>
            <div className="absolute top-[8%] left-[50%] opacity-[0.07] rotate-6"><Train size={52} /></div>
            <div className="absolute bottom-[36%] left-[20%] opacity-[0.07] -rotate-6"><Wallet size={46} /></div>
            <div className="absolute top-[50%] right-[30%] opacity-[0.07] rotate-12"><Trophy size={46} /></div>
          </div>


          {/* Main content — switches between landing & inline room browser */}
          <div className="flex-1 flex flex-col overflow-x-hidden w-full max-w-none">
            <AnimatePresence mode="wait">
              {showRoomBrowser ? (
                /* ── Inline Room Browser (U4) ── */
                <motion.div
                  key="rooms"
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  className="flex-1 flex flex-col items-center py-8 px-4 relative z-10"
                >
                  <div className="w-full max-w-lg">
                    <div className="flex items-center justify-between mb-6">
                      <button
                        onClick={() => setShowRoomBrowser(false)}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors font-bold text-sm"
                      >
                        <ChevronRight size={16} className="rotate-180" /> Back
                      </button>
                      <button
                        onClick={() => { setShowRoomBrowser(false); createRoom(false); }}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shadow-lg shadow-indigo-500/20"
                      >
                        <Play size={13} /> New room
                      </button>
                    </div>

                    <h2 className="text-2xl font-black text-white mb-1">Select the room you would like to join</h2>
                    <p className="text-slate-500 text-sm mb-6 flex items-center gap-2">
                      {activeRooms.length} room{activeRooms.length !== 1 ? 's' : ''} available
                      <span className="inline-flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                        <span className="text-[10px] text-slate-600">Auto-refreshing</span>
                      </span>
                    </p>

                    <div className="space-y-3 overflow-y-auto max-h-[60vh] scrollbar-thin scrollbar-thumb-slate-700 pr-1">
                      {activeRooms.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center bg-[#1e1e24] rounded-2xl border border-slate-800">
                          <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                            <Users size={28} className="text-slate-600" />
                          </div>
                          <h4 className="text-slate-400 font-bold text-lg mb-1">No Active Rooms</h4>
                          <p className="text-slate-600 text-sm max-w-xs">No public rooms right now. Create your own or hit Play to start one!</p>
                        </div>
                      ) : (
                        activeRooms.map((room, idx) => (
                          <motion.div
                            key={room.roomId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="bg-[#1e1e24] border border-slate-800 rounded-xl p-4 flex items-center gap-4 hover:border-slate-600 transition-all"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-sm font-bold text-white truncate">{room.hostName}</span>
                                {room.isPrivate && <Lock size={11} className="text-slate-500 shrink-0" />}
                                <span style={{ fontFamily: "'Outfit', sans-serif" }} className="text-[9px] text-slate-600 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">{room.roomId}</span>
                              </div>
                              {/* U5: Player slot dots */}
                              <div className="flex items-center gap-1.5">
                                {Array.from({ length: room.maxPlayers }).map((_, i) => (
                                  <div
                                    key={i}
                                    className={`w-3 h-3 rounded-full border transition-all ${
                                      i < room.playerCount
                                        ? 'bg-indigo-500 border-indigo-400'
                                        : 'bg-slate-800 border-slate-700'
                                    }`}
                                  />
                                ))}
                                <span className="text-[10px] text-slate-500 ml-1 font-bold">{room.playerCount}/{room.maxPlayers}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => { setJoinRoomId(room.roomId); joinRoom(room.roomId); }}
                              disabled={isJoiningRoom}
                              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-all active:scale-95 shrink-0 shadow-lg shadow-indigo-500/20"
                            >
                              {isJoiningRoom ? '…' : 'Join'}
                            </button>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : (
                /* ── Landing Page ── */
                <motion.div
                  key="landing"
                  initial={{ opacity: 0, x: -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 30 }}
                  className="flex-1 flex flex-col relative z-10 w-full max-w-none"
                >
                  {/* Hero / join form */}
                  <div className="flex flex-col items-center w-full px-4 sm:px-6 pt-10 sm:pt-14 pb-6 relative">
                    <HomeParticles />
                    <div className="w-full max-w-sm flex flex-col items-center gap-4 relative z-10">
                      <div className="flex flex-col items-center gap-1.5">
                        <motion.div
                          animate={{ y: [0, -6, 0], rotate: [0, 6, 0, -6, 0] }}
                          transition={{ repeat: Infinity, duration: 4.5, ease: 'easeInOut' }}
                          className="relative"
                        >
                          <div className="absolute inset-0 blur-2xl bg-indigo-500/40 rounded-full scale-125" />
                          <Dices size={56} className="relative text-white drop-shadow-[0_4px_18px_rgba(99,102,241,0.55)]" />
                        </motion.div>
                        <h1 className="text-5xl sm:text-6xl font-black tracking-tight text-center leading-[1.1] pb-1 px-2">
                          <span className="bg-gradient-to-br from-white via-slate-100 to-slate-300 bg-clip-text text-transparent inline-block pr-0.5">CASHLY</span>
                          <span className="bg-gradient-to-br from-indigo-400 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent inline-block text-xl sm:text-2xl align-baseline ml-1 font-black">.IO</span>
                        </h1>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="relative flex h-1.5 w-1.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                          </span>
                          <p className="text-slate-400 text-sm font-medium tracking-wide">
                            Rule the economy
                          </p>
                        </div>
                      </div>

                      <div className="w-full space-y-3 mt-1">
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1.5 text-center">Playing as</p>
                          {sessionUser ? (
                            <div className="w-full flex items-center gap-2.5 bg-[#1e1e24] border border-slate-700/50 rounded-xl px-3.5 py-2.5">
                              {sessionUser.image ? (
                                <img src={sessionUser.image} className="h-8 w-8 rounded-full object-cover border border-indigo-500/40 shrink-0" alt="" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-black text-xs shrink-0">
                                  {sessionUser.name?.[0]?.toUpperCase() ?? '?'}
                                </div>
                              )}
                              <span className="font-bold text-white text-sm truncate min-w-0">{sessionUser.name}</span>
                              <button
                                onClick={() => onOpenProfile?.()}
                                className="ml-auto shrink-0 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-lg px-2.5 py-1 transition-all"
                              >
                                Edit profile
                              </button>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={humanName}
                              onChange={(e) => setHumanName(e.target.value)}
                              onFocus={(e) => e.target.select()}
                              className="w-full bg-[#1e1e24] border border-slate-700/50 rounded-xl px-5 py-3.5 text-center text-lg font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 placeholder:font-normal"
                              placeholder="Enter name"
                            />
                          )}
                        </div>

                        {savedSession && (() => {
                          const minsLeft = savedSession.savedAt
                            ? Math.max(0, Math.floor((5 * 60 * 1000 - (nowTs - savedSession.savedAt)) / 60000))
                            : 5;
                          return minsLeft > 0 ? (
                            <div className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Game in progress</p>
                                <p className="text-xs text-slate-300 font-mono mt-0.5">
                                  Room: <span style={{ fontFamily: "'Outfit', sans-serif" }} className="font-black text-white">{savedSession.roomId}</span>
                                  {savedSession.playerName && <span className="text-slate-500"> · {savedSession.playerName}</span>}
                                </p>
                                <p className="text-[9px] text-amber-400 font-bold mt-0.5">{minsLeft} min left to rejoin</p>
                              </div>
                              <button
                                onClick={handleRejoin}
                                className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-white text-[11px] font-black uppercase tracking-widest rounded-lg transition-colors active:scale-95 shrink-0"
                              >
                                Rejoin
                              </button>
                              <button
                                onClick={() => { localStorage.removeItem('cashly_session'); setSavedSession(null); }}
                                className="p-1 text-slate-500 hover:text-slate-300 transition-colors shrink-0"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : null;
                        })()}

                        <button
                          onClick={joinRandomRoom}
                          className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold text-xl flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)] relative overflow-hidden group active:scale-[0.98]"
                        >
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out" />
                          <ChevronsRight size={22} className="relative z-10" />
                          <span className="relative z-10">Play</span>
                        </button>

                        <div className="flex gap-3">
                          <button
                            onClick={() => { setShowRoomBrowser(true); fetchRooms(); }}
                            className="flex-1 py-3 bg-[#2a2a35] hover:bg-[#323240] text-slate-200 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-sm active:scale-[0.98]"
                          >
                            <Users size={15} /> All rooms
                          </button>
                          <button
                            onClick={() => createRoom(true)}
                            disabled={isCreatingRoom}
                            className="flex-1 py-3 bg-[#2a2a35] hover:bg-[#323240] text-slate-200 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors text-sm active:scale-[0.98] disabled:opacity-60"
                          >
                            {isCreatingRoom
                              ? <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}><Dices size={15} /></motion.div> Creating…</>
                              : <><Lock size={15} /> Create private</>}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                            placeholder="ROOM CODE"
                            maxLength={6}
                            style={{ fontFamily: "'JetBrains Mono', monospace" }}
                            className="flex-1 bg-[#1e1e24] border border-slate-700/50 rounded-xl px-4 py-3 text-center font-bold text-white focus:outline-none focus:border-indigo-500 uppercase tracking-[0.35em] text-sm"
                          />
                          <button
                            onClick={() => joinRoom()}
                            disabled={!joinRoomId || isJoiningRoom}
                            className="px-5 py-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white rounded-xl font-bold transition-colors min-w-[64px] flex items-center justify-center active:scale-[0.98]"
                          >
                            {isJoiningRoom ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
                                <Dices size={16} />
                              </motion.div>
                            ) : 'Join'}
                          </button>
                        </div>
                      </div>

                      <div className="w-full pt-1" />

                      {/* Trending room — quick join (only if a public room exists) */}
                      {(() => {
                        const top = activeRooms.find(r => !r.isPrivate && r.playerCount < r.maxPlayers);
                        if (!top) return null;
                        return (
                          <motion.button
                            onClick={() => { setJoinRoomId(top.roomId); joinRoom(top.roomId); }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4, delay: 0.25 }}
                            className="w-full text-left bg-gradient-to-r from-[#1a1a22] to-[#1d1a28] hover:from-[#1f1f29] hover:to-[#231e34] border border-indigo-500/20 hover:border-indigo-500/50 rounded-xl px-3.5 py-2.5 flex items-center gap-3 transition-all group active:scale-[0.99]"
                          >
                            <div className="shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/30 flex items-center justify-center">
                              <Zap size={15} className="text-indigo-300" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Trending</p>
                                <span style={{ fontFamily: "'Outfit', sans-serif" }} className="text-[9px] text-slate-500 bg-slate-800/60 px-1.5 rounded">{top.roomId}</span>
                              </div>
                              <p className="text-xs font-bold text-white truncate mt-0.5">{top.hostName}'s room · {top.playerCount}/{top.maxPlayers} players</p>
                            </div>
                            <ChevronRight size={16} className="text-slate-500 group-hover:text-indigo-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </motion.button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Bottom section: Features + How To Play side by side */}
                  <div className="w-full max-w-2xl mx-auto px-4 pt-10 pb-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Features */}
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.5, delay: 0.05 }}
                    >
                      <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Zap size={11} /> Features
                      </h2>
                      <div className="flex flex-col gap-2">
                        {[
                          { icon: <Globe size={12} className="text-indigo-400" />, title: 'Online Multiplayer' },
                          { icon: <Bot size={12} className="text-violet-400" />, title: 'Smart AI Bots' },
                          { icon: <Zap size={12} className="text-amber-400" />, title: 'Fast Gameplay' },
                          { icon: <ShieldCheck size={12} className="text-emerald-400" />, title: 'Fair Play' },
                          { icon: <Handshake size={12} className="text-sky-400" />, title: 'Trading' },
                          { icon: <Trophy size={12} className="text-rose-400" />, title: 'Custom Rules' },
                        ].map((feat, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: i * 0.06 }}
                            className="flex items-center gap-2 bg-[#1a1a22] rounded-xl px-3 py-2 border border-slate-800/60"
                          >
                            <div className="shrink-0">{feat.icon}</div>
                            <p className="text-xs font-bold text-slate-300">{feat.title}</p>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>

                    {/* How to play */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: '-40px' }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                    >
                      <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Info size={11} /> How to play
                      </h2>
                      <div className="flex flex-col gap-2">
                        {[
                          { icon: <Coins size={12} className="text-emerald-400" />, title: 'Start with configurable cash' },
                          { icon: <Dices size={12} className="text-indigo-400" />, title: 'Roll & move' },
                          { icon: <Landmark size={12} className="text-amber-400" />, title: 'Buy properties' },
                          { icon: <TrendingUp size={12} className="text-rose-400" />, title: 'Build houses & hotels' },
                          { icon: <Trophy size={12} className="text-amber-400" />, title: 'Last one standing wins' },
                        ].map((step, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.3, delay: i * 0.07 }}
                            className="flex items-center gap-2 bg-[#1a1a22] rounded-xl px-3 py-2 border border-slate-800/60"
                          >
                            <span className="text-[9px] font-black text-slate-600 w-3 shrink-0">{i + 1}</span>
                            <div className="shrink-0">{step.icon}</div>
                            <p className="text-xs font-bold text-slate-300">{step.title}</p>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  {/* Ad slot — admin-controlled */}
                  <div className="w-full px-4 sm:px-6 mt-4">
                    <div className="max-w-5xl mx-auto">
                      <AdSlot placement="lobby_bottom" className="min-h-[1px]" />
                    </div>
                  </div>

                  {/* Footer */}
                  <footer className="w-full border-t border-slate-800/60 py-5 px-4 sm:px-6 mt-auto">
                    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
                      <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap justify-center">
                        <button onClick={() => setActivePolicyPage('privacy')} className="hover:text-slate-200 transition-colors">Privacy Policy</button>
                        <span className="text-slate-600 hidden sm:inline">·</span>
                        <button onClick={() => setActivePolicyPage('terms')} className="hover:text-slate-200 transition-colors">Terms of Service</button>
                        <span className="text-slate-600 hidden sm:inline">·</span>
                        <button onClick={() => setActivePolicyPage('cookies')} className="hover:text-slate-200 transition-colors">Cookie Policy</button>
                        <span className="text-slate-600 hidden sm:inline">·</span>
                        <button onClick={() => setActivePolicyPage('contact')} className="hover:text-slate-200 transition-colors">Contact</button>
                        <span className="text-slate-600 hidden sm:inline">·</span>
                        <button onClick={() => { setShowBugModal(true); setBugSubmitted(false); setBugError(null); setBugTitle(''); setBugDesc(''); setBugImage(null); }} className="text-slate-400 hover:text-rose-400 transition-colors flex items-center gap-1">
                          <Flag size={10} /> Report a Bug
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">© 2025 Cashly.io · All rights reserved</p>
                    </div>
                  </footer>
                </motion.div>
              )}
            </AnimatePresence>

          {/* Bug Report Modal — available on home screen */}
          {showBugModal && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
              onClick={e => { if (e.target === e.currentTarget) setShowBugModal(false); }}
            >
              <motion.div
                initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
                onClick={e => e.stopPropagation()}
                className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Flag size={16} className="text-rose-400" /> Report a Bug
                  </h3>
                  <button onClick={() => setShowBugModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
                    <X size={16} />
                  </button>
                </div>
                {bugSubmitted ? (
                  <div className="flex flex-col items-center gap-3 py-4 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                      <Flag size={22} className="text-emerald-400" />
                    </div>
                    <p className="text-white font-bold">Report submitted!</p>
                    <p className="text-slate-400 text-sm">Thanks for helping improve Cashly.</p>
                    <button onClick={() => setShowBugModal(false)} className="mt-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors">Close</button>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      <div>
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5 block">Title</label>
                        <input type="text" value={bugTitle} onChange={e => { setBugTitle(e.target.value); setBugError(null); }} placeholder="Short summary of the bug…" maxLength={120} className="w-full bg-[#111116] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5 block">Description</label>
                        <textarea value={bugDesc} onChange={e => { setBugDesc(e.target.value); setBugError(null); }} placeholder="What happened? What did you expect?" maxLength={2000} rows={4} className="w-full bg-[#111116] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
                        <p className="text-[10px] text-slate-600 text-right mt-0.5">{bugDesc.length}/2000</p>
                      </div>
                      <div>
                        <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5 block">Screenshot (optional)</label>
                        {bugImage ? (
                          <div className="relative">
                            <img src={bugImage} alt="preview" className="w-full max-h-36 object-contain rounded-xl border border-slate-700" />
                            <button onClick={() => setBugImage(null)} className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-black text-white rounded-lg p-1 transition-colors"><X size={12} /></button>
                          </div>
                        ) : (
                          <label className="flex items-center justify-center gap-2 w-full border border-dashed border-slate-700 rounded-xl py-3 px-4 cursor-pointer hover:border-indigo-500 transition-colors text-slate-500 hover:text-slate-300 text-sm">
                            <Package size={14} /> Click to attach image
                            <input type="file" accept="image/*" className="hidden" onChange={e => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              if (file.size > 1_500_000) { setBugError('Image must be under 1.5 MB.'); return; }
                              const reader = new FileReader();
                              reader.onload = ev => setBugImage(ev.target?.result as string);
                              reader.readAsDataURL(file);
                            }} />
                          </label>
                        )}
                      </div>
                      {bugError && <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{bugError}</p>}
                    </div>
                    <button
                      disabled={bugSubmitting}
                      onClick={async () => {
                        setBugError(null);
                        setBugSubmitting(true);
                        try {
                          const res = await fetch('/api/bug-report', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ title: bugTitle, description: bugDesc, imageUrl: bugImage }),
                          });
                          const data = await res.json();
                          if (!res.ok) { setBugError(data.error ?? 'Failed to submit.'); return; }
                          setBugSubmitted(true);
                        } catch {
                          setBugError('Network error — try again.');
                        } finally {
                          setBugSubmitting(false);
                        }
                      }}
                      className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      {bugSubmitting ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}><Flag size={14} /></motion.div> : <Flag size={14} />}
                      Submit Report
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}

          </div>
        </motion.div>
      );
    }

    // Session restore loading screen — shown while rejoining an in-progress game
    if (isRestoringSession) {
      return (
        <CashlyLoadingScreen
          title="Rejoining game..."
          subtitle="Restoring your session"
        />
      );
    }

    // Room Lobby Screen
    return (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="group min-h-[100dvh] data-[layout=row]:h-[100dvh] bg-[#111116] text-slate-50 flex flex-col data-[layout=row]:flex-row p-1.5 sm:p-2 gap-2 sm:gap-4 relative overflow-y-auto data-[layout=row]:overflow-hidden"
        data-layout={isStacked ? "stacked" : "row"}
      >
        {/* Disconnect overlay */}
        {isSocketDisconnected && (
          <div className="fixed inset-0 z-[999] bg-red-900/60 backdrop-blur-sm flex flex-col items-center justify-center gap-4">
            <WifiOff size={56} className="text-red-300 animate-pulse drop-shadow-lg" />
            <p className="text-white text-xl font-black uppercase tracking-widest drop-shadow-lg">Disconnected</p>
            <p className="text-red-200 text-sm font-medium drop-shadow-md">Trying to reconnect…</p>
          </div>
        )}

        {/* Left Column: Share, Ad & Chat */}
        <div className="w-full group-data-[layout=row]:w-64 flex flex-col gap-2 sm:gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-2 group-data-[layout=row]:order-1">
          {renderShareBox(false)}

          {/* Ad Banner Space — desktop only; mobile version sits below board */}
          <div className="hidden sm:flex bg-[#1e1e24] border border-slate-800 rounded-2xl p-5 flex-col items-center justify-center shadow-lg flex-1 relative overflow-hidden group min-h-[120px] group-data-[layout=row]:min-h-0">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs text-center relative z-10">Advertisement<br />Space</span>
          </div>

          {/* Chat Box */}
          <div className="hidden group-data-[layout=row]:block">
            {renderChatBox(false)}
          </div>
        </div>

        {/* Center Column: Board */}
        <div className="flex w-full group-data-[layout=row]:flex-1 flex-col items-center justify-center relative z-10 group-data-[layout=row]:overflow-hidden group-data-[layout=row]:h-full p-0 order-1 group-data-[layout=row]:order-2">
          <div className="w-full max-w-[calc(100vw-0.75rem)] sm:max-w-[660px] group-data-[layout=row]:max-w-none group-data-[layout=row]:w-full group-data-[layout=row]:h-full flex items-center justify-center mx-auto">
            <Board gameState={lobbyPreviewState} onTileClick={() => { }}>
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                {showAppearanceModal ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-4 bg-slate-950/95 border border-slate-700/60 rounded-2xl p-6 shadow-2xl w-[260px]"
                  >
                    <div className="text-center">
                      <h3 className="text-lg font-black text-white tracking-tight">Choose Appearance</h3>
                      <p className="text-indigo-400 text-xs font-bold mt-0.5">{humanName}</p>
                    </div>
                    <Avatar avatarId={selectedAvatar} className="w-16 h-16 shadow-2xl ring-2 ring-indigo-500/60" />
                    <div className="grid grid-cols-6 gap-2">
                      {(() => {
                        const takenAvatarIndices = new Set(
                          lobbyPlayers
                            .filter((p: any) => p.id !== sessionPlayerId)
                            .map((p: any) => p.avatar ?? 0)
                        );
                        return APPEARANCE_COLORS.map((color, idx) => {
                          const isTaken = takenAvatarIndices.has(idx);
                          return (
                            <button
                              key={idx}
                              disabled={isTaken}
                              onClick={() => {
                                if (isTaken) return;
                                setSelectedAvatar(idx);
                                sfx('buy');
                                const socket = getSocket();
                                if (socket) socket.emit('update_player', { avatar: idx });
                              }}
                              title={isTaken ? 'Taken by another player' : undefined}
                              className={`w-7 h-7 rounded-full transition-all relative ${
                                selectedAvatar === idx
                                  ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 scale-110'
                                  : isTaken
                                    ? 'opacity-25 cursor-not-allowed grayscale'
                                    : 'hover:scale-110 hover:ring-2 hover:ring-white/40 hover:ring-offset-1 hover:ring-offset-slate-950'
                              }`}
                              style={{ backgroundColor: color }}
                            >
                              {isTaken && (
                                <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50">
                                  <X size={10} className="text-white/80" strokeWidth={3} />
                                </div>
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    {/* U13: Get more appearances link */}
                    <button className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest transition-colors">
                      Get more appearances
                    </button>
                    <button
                      onClick={() => setShowAppearanceModal(false)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-black text-sm uppercase tracking-widest transition-all active:scale-95"
                    >
                      OK
                    </button>
                  </motion.div>
                ) : (
                  <>
                    {/* U7: Animated dice hero in lobby */}
                    <motion.div
                      animate={{ y: [0, -8, 0] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                    >
                      <Dices size={52} className="text-indigo-400 drop-shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                    </motion.div>

                    <div className="text-center">
                      <h2 className="text-4xl font-black text-white tracking-tighter mb-2 drop-shadow-2xl">
                        LOBBY <span className="text-indigo-500">{roomId}</span>
                      </h2>
                      <p className="text-slate-400 font-medium">Waiting for players to join...</p>
                    </div>

                    {(() => {
                      const totalPlayers = lobbyPlayers.filter((p: any) => !p.isSpectator).length;
                      const canStart = isHost && totalPlayers >= 2;
                      return (
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => { if (canStart) handleStartGame(); }}
                            disabled={!canStart}
                            className="px-6 py-3 sm:px-12 sm:py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl sm:rounded-2xl font-black text-base sm:text-2xl transition-all shadow-[0_0_40px_rgba(79,70,229,0.4)] enabled:hover:scale-105 active:scale-95 uppercase tracking-wider sm:tracking-widest border-b-4 border-indigo-800 max-w-[92vw]"
                          >
                            {isHost ? 'Start Game' : 'Waiting for Host'}
                          </button>
                          {isHost && totalPlayers < 2 && (
                            <p className="text-[11px] text-rose-400 font-bold">Need at least 2 players to start</p>
                          )}
                        </div>
                      );
                    })()}

                    {(() => {
                      const humanCount = lobbyPlayers.filter((p: any) => !p.isSpectator && !p.isBot).length;
                      const botCount = lobbyPlayers.filter((p: any) => p.isBot).length;
                      const spectatorCount = lobbyPlayers.filter((p: any) => p.isSpectator).length;
                      return (
                        <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
                          <Users size={16} className="text-indigo-400" />
                          <span className="text-sm font-bold text-slate-300">{humanCount} / {settings.maxPlayers} Players</span>
                          {botCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-violet-400 font-bold">
                              <Bot size={11} /> {botCount} bots
                            </span>
                          )}
                          {spectatorCount > 0 && (
                            <span className="flex items-center gap-1 text-[10px] text-slate-500 font-bold">
                              <Eye size={11} /> {spectatorCount}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            </Board>
          </div>
        </div>

        {/* Ad Banner — mobile only, below board */}
        <div className="sm:hidden order-3 bg-[#1e1e24] border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group min-h-16">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity" />
          <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs text-center relative z-10">Advertisement<br />Space</span>
        </div>

        {/* Right Column: Profile & Settings */}
        <div className="w-full group-data-[layout=row]:w-64 flex flex-col gap-2 sm:gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-4 group-data-[layout=row]:order-3">
          {/* Lobby Players List */}
          <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-5 flex flex-col gap-3 shadow-lg shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Users size={13} /> In Lobby
              </h3>
              <span className="text-[10px] font-bold text-slate-600">{lobbyPlayers.filter((p: any) => !p.isSpectator).length}/{settings.maxPlayers}</span>
            </div>
            {lobbyPlayers.length === 0 ? (
                <div className="flex flex-col gap-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-white/5 animate-pulse shrink-0" />
                      <div className="flex-1 h-4 rounded-lg bg-white/5 animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {lobbyPlayers.map((player: any) => (
                    <div key={player.id} className="flex items-center gap-3">
                      <Avatar avatarId={player.avatar ?? 0} className="w-8 h-8 shrink-0" />
                      <span className="text-sm font-bold text-slate-200 truncate flex-1">{player.name}</span>
                      {player.isHost && <Crown size={13} className="text-amber-400 shrink-0" />}
                      {player.isBot && <span className="text-[8px] bg-slate-800 text-violet-400 px-1.5 py-0.5 rounded border border-slate-700 font-bold">BOT</span>}
                      {player.disconnected && <span className="text-[9px] font-bold text-rose-400 uppercase">Away</span>}
                      {isHost && !player.isHost && player.id !== sessionPlayerId && (
                        <button
                          onClick={() => getSocket()?.emit('kick_player', { playerId: player.id })}
                          className="p-1 text-slate-600 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-950/30"
                          title={`Kick ${player.name}`}
                        >
                          <UserX size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </>
              )}
            <button
              onClick={leaveRoom}
              className="w-full py-2 bg-slate-800 hover:bg-rose-900/40 text-slate-500 hover:text-rose-400 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={13} /> Leave Room
            </button>
          </div>

          {/* Game Settings Box */}
          <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-5 flex-1 flex flex-col shadow-lg min-h-[400px] group-data-[layout=row]:min-h-0">
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-[0.2em] mb-6 shrink-0 flex items-center gap-2">
              <Settings size={16} /> Game Settings
            </h3>
            {renderGameSettings()}
          </div>
        </div>

        {/* Mobile Chat Button & Popup */}
        <div className="group-data-[layout=row]:hidden fixed bottom-4 right-4 z-[60]">
          {showMobileChat ? (
            <div className="mb-4 shadow-2xl">
              {renderChatBox(true)}
            </div>
          ) : (
            <button
              onClick={() => setShowMobileChat(true)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105"
            >
              <MessageSquare size={24} />
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  // ── Game Screen ─────────────────────────────────────────────────────────────
  const myProperties = gameState.tiles.filter(t => t.ownerId === myPlayerId);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="group min-h-[100dvh] data-[layout=row]:h-[100dvh] bg-[#111116] text-slate-50 flex flex-col data-[layout=row]:flex-row p-1.5 sm:p-2 gap-2 sm:gap-4 relative overflow-y-auto data-[layout=row]:overflow-hidden"
      data-layout={isStacked ? "stacked" : "row"}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950 pointer-events-none fixed" />
      <div className="fixed inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='1' cy='1' r='1' fill='white'/%3E%3C/svg%3E\")", backgroundSize: '32px 32px' }} />

      {/* Disconnect overlay */}
      {isSocketDisconnected && (
        <div className="fixed inset-0 z-[999] bg-red-950 flex flex-col items-center justify-center gap-4">
          <WifiOff size={56} className="text-red-400 animate-pulse" />
          <p className="text-white text-xl font-black uppercase tracking-widest">Disconnected</p>
          <p className="text-red-300 text-sm font-medium">Trying to reconnect…</p>
        </div>
      )}

      {/* Spectator badge */}
      {isSpectator && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-1.5 bg-slate-900/90 border border-slate-700/60 rounded-full text-slate-400 text-xs font-black uppercase tracking-widest backdrop-blur-sm shadow-lg">
          <Eye size={13} className="text-indigo-400" /> Spectating
        </div>
      )}

      {/* Sound toggle + Rules button */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setShowRulesModal(true)}
          className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-indigo-400 transition-colors backdrop-blur-sm shadow-lg"
          title="Rules reference"
        >
          <Info size={18} />
        </button>
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors backdrop-blur-sm shadow-lg"
          title={soundEnabled ? 'Mute' : 'Unmute'}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      {/* Left Column: Share, Ad Banner & Chat */}
      <div className="w-full group-data-[layout=row]:w-64 flex flex-col gap-2 sm:gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-2 group-data-[layout=row]:order-1">
        {isOnline && renderShareBox(true)}

        {/* Ad Banner Space — desktop only; mobile version sits below board */}
        <div className="hidden sm:flex bg-[#1e1e24] border border-slate-800 rounded-2xl p-5 flex-col items-center justify-center shadow-lg flex-1 relative overflow-hidden group min-h-[120px] group-data-[layout=row]:min-h-0">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity" />
          <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs text-center relative z-10">Advertisement<br />Space</span>
        </div>

        {/* B2/U9: Tabbed Logs/Chat panel */}
        <div className="hidden group-data-[layout=row]:flex flex-col bg-[#1e1e24] rounded-2xl border border-slate-800 overflow-hidden shadow-lg h-80 shrink-0">
          {/* Tab headers */}
          <div className="flex items-center border-b border-slate-800 shrink-0">
            <button
              onClick={() => setActiveSidebarTab('logs')}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${activeSidebarTab === 'logs' ? 'text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Activity
            </button>
            <button
              onClick={() => setActiveSidebarTab('chat')}
              className={`flex-1 py-2.5 text-xs font-black uppercase tracking-widest transition-colors ${activeSidebarTab === 'chat' ? 'text-white border-b-2 border-indigo-500' : 'text-slate-500 hover:text-slate-300'}`}
            >
              Chat
            </button>
          </div>

          {activeSidebarTab === 'logs' ? (
            /* Activity log */
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700">
              {gameState.logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 opacity-50">
                  <Dices size={28} />
                  <span>No activity yet</span>
                </div>
              ) : (
                [...gameState.logs].map((log, i) => {
                  // Category detection via prefix/keyword match for color + accent
                  const isNewest = i === 0;
                  let accent = 'border-slate-800 bg-slate-900/40 text-slate-300';
                  if (log.startsWith('🎴')) accent = 'border-amber-700/60 bg-amber-950/30 text-amber-100';
                  else if (log.startsWith('🤝')) accent = 'border-fuchsia-700/60 bg-fuchsia-950/30 text-fuchsia-100';
                  else if (/bankrupt|eliminat/i.test(log)) accent = 'border-rose-700/60 bg-rose-950/30 text-rose-100';
                  else if (/auction|bid/i.test(log)) accent = 'border-cyan-700/60 bg-cyan-950/30 text-cyan-100';
                  else if (/built|upgrade|house|hotel/i.test(log)) accent = 'border-emerald-700/60 bg-emerald-950/30 text-emerald-100';
                  else if (/jail|fine/i.test(log)) accent = 'border-orange-700/60 bg-orange-950/30 text-orange-100';
                  else if (/bought|sold|mortgage/i.test(log)) accent = 'border-blue-700/60 bg-blue-950/30 text-blue-100';
                  else if (/rent|paid|received/i.test(log)) accent = 'border-yellow-700/60 bg-yellow-950/30 text-yellow-100';
                  const newestRing = isNewest ? 'ring-1 ring-indigo-500/50 shadow-[0_0_8px_rgba(99,102,241,0.25)]' : '';
                  return (
                    <div key={i} className={`text-xs leading-snug px-2 py-1.5 rounded-md border-l-2 ${accent} ${newestRing}`}>
                      {log}
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            /* Chat */
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
                {chatMessages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-sm gap-2 opacity-50">
                    <MessageSquare size={28} />
                    <span>No messages yet</span>
                  </div>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-400">{msg.sender}</span>
                        <span className="text-[10px] text-slate-500">{msg.time}</span>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-2 text-sm text-slate-200 break-words">{msg.text}</div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t border-slate-800 shrink-0">
                <div className="relative">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Say something..."
                    className="w-full bg-[#111116] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 pr-10"
                  />
                  <button onClick={sendChatMessage} className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 transition-colors">
                    <ChevronRight size={20} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Center Column: Board Preview */}
      <div className="w-full group-data-[layout=row]:flex-1 flex flex-col items-center justify-center relative z-10 group-data-[layout=row]:overflow-hidden group-data-[layout=row]:h-full p-0 order-1 group-data-[layout=row]:order-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-full max-w-[calc(100vw-0.75rem)] sm:max-w-[660px] group-data-[layout=row]:max-w-none group-data-[layout=row]:w-full group-data-[layout=row]:h-full flex items-center justify-center mx-auto"
        >
          <Board gameState={gameState} onTileClick={handleTileClick}>
            <Suspense fallback={<GamePanelFallback />}>
              <Controls
                gameState={gameState}
                myPlayerId={myPlayerId}
                logs={gameState.logs}
                onRoll={() => handleDispatch({ type: 'ROLL_DICE' })}
                onBuy={() => handleDispatch({ type: 'BUY_PROPERTY' })}
                onEndTurn={() => handleDispatch({ type: 'END_TURN' })}
                onUpgrade={tileId => handleDispatch({ type: 'UPGRADE_PROPERTY', payload: { tileId } })}
                onOpenProperty={handleTileClick}
                onTrade={(offer, targetTileId, targetPlayerId) =>
                  handleDispatch({ type: 'PROPOSE_TRADE', payload: { proposerId: myPlayerId, offerCash: offer.cash, offerPropertyIds: offer.properties, targetTileId, requestCash: offer.requestCash, targetPlayerId } })
                }
                dispatch={handleDispatch}
                onViewPlayer={id => setViewingPlayerId(id)}
                netWorthHistory={netWorthHistory}
                onReset={() => {
                  // STATE-03: Reset both the game reducer state AND all React online state
                  dispatch({ type: 'RESET_GAME' });
                  setGameStarted(false);
                  startGameBroadcastedRef.current = false;
                  if (isOnline) leaveRoom();
                }}
              />
            </Suspense>
          </Board>
        </motion.div>
      </div>

      {/* Ad Banner — mobile only, below board */}
      <div className="sm:hidden order-3 bg-[#1e1e24] border border-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center shadow-lg relative overflow-hidden group min-h-16">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity" />
        <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs text-center relative z-10">Advertisement<br />Space</span>
      </div>

      {/* Right Column: Players, Actions & Properties */}
      <div className="w-full group-data-[layout=row]:w-64 flex flex-col gap-3 shrink-0 z-10 group-data-[layout=row]:h-full order-4 group-data-[layout=row]:order-3 group-data-[layout=row]:overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">

        {/* Players List */}
        <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-3 flex flex-col gap-2 shadow-lg shrink-0">
          <AnimatePresence>
          {gameState.players.map(player => {
            const isActive = gameState.currentPlayerIndex === gameState.players.indexOf(player);
            return (
              <motion.div
                key={player.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{
                  opacity: player.isBankrupt ? 0.35 : 1,
                  y: 0,
                  scale: player.isBankrupt ? 0.97 : 1,
                  filter: player.isBankrupt ? 'grayscale(1)' : 'grayscale(0)'
                }}
                exit={{ opacity: 0, scale: 0.8, x: -20, transition: { duration: 0.4 } }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                whileHover={player.isBankrupt ? {} : { scale: 1.02 }}
                onClick={() => setViewingPlayerId(player.id)}
                className={`
                  relative flex items-center gap-2 bg-[#111116] border p-2.5 rounded-xl shadow-md cursor-pointer transition-colors duration-300
                  ${isActive ? 'border-indigo-500/60 ring-2 ring-indigo-500/25 shadow-lg shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'}
                `}
              >
                {/* U11: Active player pulse dot */}
                {isActive && !player.isBankrupt && (
                  <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-[#111116] animate-pulse z-10" />
                )}
                <div className="relative shrink-0">
                  {player.profileImage ? (
                    <img
                      src={player.profileImage}
                      alt=""
                      className={`w-9 h-9 rounded-full object-cover shadow-lg ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#111116]' : ''} ${player.isBankrupt ? 'opacity-40 grayscale' : ''}`}
                    />
                  ) : (
                    <Avatar
                      avatarId={player.avatarId}
                      color={player.color}
                      isBankrupt={player.isBankrupt}
                      inJail={player.inJail}
                      className={`w-9 h-9 shadow-lg ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#111116]' : ''}`}
                    />
                  )}
                  {player.isBankrupt && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                      <X size={12} className="text-rose-500" strokeWidth={3} />
                    </div>
                  )}
                </div>
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className={`text-xs font-black uppercase truncate ${isActive ? 'text-indigo-300' : 'text-slate-200'}`}>
                      {player.name}
                    </span>
                    {player.isBot && <span className="text-[8px] bg-slate-800 text-slate-500 px-1 rounded-sm border border-slate-700">AI</span>}
                    {/* I5: Disconnected countdown — 2 min window */}
                    {(player as any).disconnected && (player as any).disconnectedAt && (() => {
                      const secondsLeft = Math.max(0, 5 * 60 - Math.floor((nowTs - (player as any).disconnectedAt) / 1000));
                      return secondsLeft > 0
                        ? <span className="text-[8px] font-mono text-amber-400 animate-pulse ml-0.5">{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
                        : <span className="text-[8px] text-slate-600 ml-0.5">away</span>;
                    })()}
                  </div>
                  {/* U10: Money badge with coin icon */}
                  <div className={`flex items-center gap-1 font-mono text-sm font-bold ${player.isBankrupt ? 'text-slate-600' : 'text-emerald-400'}`}>
                    <Coins size={11} />
                    <span>${player.money.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-[9px] text-slate-600 font-mono shrink-0">
                  {gameState.tiles.filter(t => t.ownerId === player.id).length} props
                </span>
              </motion.div>
            );
          })}
          </AnimatePresence>
        </div>

        {/* Votekick & Bankrupt */}
        <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-3 flex gap-2 shadow-lg shrink-0">
          {/* Votekick — auto-targets the current turn player */}
          {(() => {
            const turnPlayer = gameState.players[gameState.currentPlayerIndex];
            const canVotekick = turnPlayer && turnPlayer.id !== myPlayerId && !turnPlayer.isBankrupt;
            return (
              <Button
                variant="outline"
                size="sm"
                disabled={!canVotekick}
                onClick={() => {
                  if (canVotekick) {
                    handleDispatch({ type: 'VOTE_KICK', payload: { targetId: turnPlayer.id, voterId: myPlayerId, expiresAt: Date.now() + 120000 } });
                  }
                }}
                className="flex-1 text-xs border-slate-700 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-slate-300 gap-1.5 flex items-center justify-center"
                title={canVotekick ? `Vote to kick ${turnPlayer.name} (current turn)` : "Can't kick yourself or on your turn"}
              >
                <UserX size={13} className="text-rose-400" />
                Kick {canVotekick ? <span className="text-rose-300 truncate max-w-[50px]">{turnPlayer.name}</span> : 'player'}
              </Button>
            );
          })()}
          {/* Self-bankrupt */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmAlert({ message: 'Declare yourself bankrupt? All assets will be forfeited.', onConfirm: () => handleDispatch({ type: 'DECLARE_BANKRUPT' }) })}
            className="flex-1 text-xs border-rose-900/40 bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 gap-1.5 flex items-center justify-center"
          >
            <Flag size={13} /> Bankrupt
          </Button>
        </div>

        {/* Active Votekicks */}
        {gameState.votekicks && gameState.votekicks.length > 0 && (
          <div className="bg-[#1e1e24] rounded-2xl border border-rose-900/50 p-3 flex flex-col gap-2 shadow-lg shrink-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1.5">
              <UserX size={11} /> Active Votekicks
            </span>
            {gameState.votekicks.map(vote => {
              const target = gameState.players.find(p => p.id === vote.targetId);
              if (!target) return null;
              const activeCount = gameState.players.filter(p => !p.isBankrupt).length;
              const requiredVotes = activeCount - 1;
              const timeLeftMs = Math.max(0, vote.expiresAt - nowTs);
              const mins = Math.floor(timeLeftMs / 60000);
              const secs = Math.floor((timeLeftMs % 60000) / 1000);
              const timeDisplay = `${mins}:${secs.toString().padStart(2, '0')}`;

              return (
                <div key={vote.targetId} className="flex flex-col gap-1 bg-rose-950/20 p-2 rounded-xl border border-rose-900/40">
                  <div className="flex items-center justify-between text-[10px] text-slate-300">
                    <span className="truncate max-w-[100px]">Target: <strong className="text-white">{target.name}</strong></span>
                    <span className={`font-mono font-bold shrink-0 ${timeLeftMs < 30000 ? 'text-rose-300 animate-pulse' : 'text-rose-400'}`}>{timeDisplay}</span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-400 mt-0.5">
                    <span>Votes: <strong className="text-emerald-400">{vote.voterIds.length}</strong> / {requiredVotes}</span>
                    {vote.voterIds.includes(myPlayerId) ? (
                      <span className="text-emerald-500 font-bold italic">You voted</span>
                    ) : (
                      <span className="italic">Voting counts!</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Trades */}
        <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-3 flex flex-col gap-2 shadow-lg shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
              <Handshake size={13} className="text-indigo-400" /> Trades
              {gameState.pendingTrade && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_rgba(244,63,94,0.7)]" />
              )}
            </span>
            <Button
              size="sm"
              onClick={() => setShowCreateTradeModal(true)}
              className="h-6 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white"
            >
              Create
            </Button>
          </div>
          {gameState.pendingTrade ? (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-1">
                <div className="text-[10px] text-indigo-300 font-bold leading-tight">
                  {gameState.players.find(p => p.id === gameState.pendingTrade?.proposerId)?.name} → {gameState.players.find(p => p.id === gameState.pendingTrade?.targetId)?.name}
                </div>
                {tradePopupDismissed && gameState.pendingTrade.targetId === myPlayerId && (
                  <span className="text-[8px] font-bold text-amber-400 uppercase tracking-widest shrink-0">Dismissed</span>
                )}
              </div>
              <div className="text-[9px] text-slate-400 flex flex-wrap gap-1">
                {gameState.pendingTrade.offerCash > 0 && <span className="text-emerald-400">+${gameState.pendingTrade.offerCash} cash</span>}
                {gameState.pendingTrade.requestCash > 0 && <span className="text-rose-400">-${gameState.pendingTrade.requestCash} cash</span>}
                {gameState.pendingTrade.offerPropertyIds.length > 0 && (
                  <span className="text-indigo-300">{gameState.pendingTrade.offerPropertyIds.length} prop{gameState.pendingTrade.offerPropertyIds.length > 1 ? 's' : ''} offered</span>
                )}
                <span className="text-slate-500">for {gameState.tiles[gameState.pendingTrade.targetPropertyId]?.name}</span>
              </div>
              {gameState.pendingTrade.botDecision ? (
                <p className="text-[9px] text-slate-400 italic">Bot is deciding…</p>
              ) : gameState.pendingTrade.proposerId === myPlayerId ? (
                <button
                  onClick={() => handleDispatch({ type: 'CANCEL_TRADE' })}
                  className="text-[9px] text-rose-400 hover:text-rose-300 font-bold uppercase tracking-widest transition-colors"
                >
                  Cancel offer
                </button>
              ) : gameState.pendingTrade.targetId === myPlayerId && (
                <>
                  {tradePopupDismissed && (
                    <button
                      onClick={() => setTradePopupDismissed(false)}
                      className="w-full text-[9px] text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-widest transition-colors border border-indigo-500/30 rounded-lg py-1"
                    >
                      View Details
                    </button>
                  )}
                  <div className="flex gap-1.5">
                    <Button size="sm" onClick={() => { setTradePopupDismissed(false); handleDispatch({ type: 'ACCEPT_TRADE' }); }} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] h-7">
                      Accept
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setTradePopupDismissed(false); handleDispatch({ type: 'DECLINE_TRADE' }); }} className="flex-1 border-slate-700 text-slate-300 text-[10px] h-7">
                      Decline
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-slate-500 text-center py-1">No pending trades. Open a property to propose one.</p>
          )}
        </div>

        {/* My Properties */}
        <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-3 flex flex-col gap-2 shadow-lg">
          <span className="text-xs font-black uppercase tracking-widest text-slate-300 flex items-center gap-1.5">
            <Landmark size={13} className="text-indigo-400" /> My Properties ({myProperties.length})
          </span>
          {myProperties.length === 0 ? (
            <p className="text-[10px] text-slate-500 text-center py-1">No properties yet.</p>
          ) : (
            <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
              {myProperties.map(prop => (
                <button
                  key={prop.id}
                  onClick={() => setSelectedTileId(prop.id)}
                  className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/60 hover:bg-slate-800/60 text-left transition-colors border border-slate-800 hover:border-slate-700"
                >
                  <div
                    className="w-1 h-5 rounded-full shrink-0"
                    style={{ backgroundColor: gameState.players.find(p => p.id === myPlayerId)?.color || '#888' }}
                  />
                  <span className="flex-1 text-[10px] font-bold text-slate-200 truncate">{prop.name}</span>
                  <span className="text-[9px] font-mono text-slate-400 shrink-0">${prop.price}</span>
                  {prop.buildingCount > 0 && (
                    <span className="text-[9px] text-emerald-400 font-bold shrink-0">
                      {prop.buildingCount === 5 ? '🏨' : `🏠×${prop.buildingCount}`}
                    </span>
                  )}
                  {prop.isMortgaged && <span className="text-[9px] text-rose-400 font-bold shrink-0">MRTG</span>}
                </button>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Mobile Chat Button & Popup */}
      <div className="group-data-[layout=row]:hidden fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 sm:right-4 z-[60]">
        {showMobileChat ? (
          <div className="mb-4 shadow-2xl">
            {renderChatBox(true)}
          </div>
        ) : (
          <button
            onClick={() => setShowMobileChat(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-lg shadow-indigo-500/30 transition-transform hover:scale-105"
          >
            <MessageSquare size={24} />
          </button>
        )}
      </div>

      <Suspense fallback={null}>
        <AnimatePresence>
          {selectedTileId !== null && (
            <PropertyModal
            tile={gameState.tiles[selectedTileId]}
            owner={gameState.players.find(p => p.id === gameState.tiles[selectedTileId].ownerId)}
            onClose={() => setSelectedTileId(null)}
            onUpgrade={() => handleDispatch({ type: 'UPGRADE_PROPERTY', payload: { tileId: selectedTileId } })}
            canUpgrade={(gameState.phase === 'TURN_END' || gameState.phase === 'ACTION') && gameState.tiles[selectedTileId].ownerId === myPlayerId && gameState.players[gameState.currentPlayerIndex]?.id === myPlayerId}
            currentPlayer={gameState.players.find(p => p.id === myPlayerId)}
            myProperties={gameState.tiles}
            onMortgage={() => handleDispatch({ type: 'MORTGAGE_PROPERTY', payload: { tileId: selectedTileId } })}
            onUnmortgage={() => handleDispatch({ type: 'UNMORTGAGE_PROPERTY', payload: { tileId: selectedTileId } })}
            onSell={() => handleDispatch({ type: 'SELL_PROPERTY', payload: { tileId: selectedTileId } })}
            onDowngrade={() => handleDispatch({ type: 'DOWNGRADE_PROPERTY', payload: { tileId: selectedTileId } })}
            />
          )}

          {viewingPlayerId !== null && gameState.players.find(p => p.id === viewingPlayerId) && (
            <PlayerPortfolioModal
            player={gameState.players.find(p => p.id === viewingPlayerId)!}
            tiles={gameState.tiles}
            onClose={() => setViewingPlayerId(null)}
            />
          )}

          {showCreateTradeModal && (
            <CreateTradeModal
              isOpen={showCreateTradeModal}
              onClose={() => setShowCreateTradeModal(false)}
              players={gameState.players}
              tiles={gameState.tiles}
              myPlayerId={myPlayerId}
              onTrade={(offerCash, offerPropertyIds, targetTileId, requestCash, targetPlayerId) => {
                handleDispatch({ type: 'PROPOSE_TRADE', payload: { proposerId: myPlayerId, offerCash, offerPropertyIds, targetTileId, requestCash, targetPlayerId } });
              }}
            />
          )}

          {gameState.pendingTrade &&
         !gameState.pendingTrade.botDecision &&
         gameState.pendingTrade.targetId === myPlayerId &&
         !tradePopupDismissed &&
         gameState.players.some(p => p.id === gameState.pendingTrade?.proposerId && !p.isBankrupt) && (
            <TradeProposalModal
            trade={gameState.pendingTrade}
            players={gameState.players}
            tiles={gameState.tiles}
            myPlayerId={myPlayerId}
            onAccept={() => { setTradePopupDismissed(false); handleDispatch({ type: 'ACCEPT_TRADE' }); }}
            onDecline={() => { setTradePopupDismissed(false); handleDispatch({ type: 'DECLINE_TRADE' }); }}
            onDismiss={() => setTradePopupDismissed(true)}
            onCancel={() => { setTradePopupDismissed(false); handleDispatch({ type: 'CANCEL_TRADE' }); }}
            />
          )}

          {gameState.phase === 'AUCTION' && (
            <AuctionModal
              gameState={gameState}
              myPlayerId={myPlayerId}
              dispatch={handleDispatch}
              isSpectator={isSpectator}
            />
          )}

          {setCompleteAnim && (
            <SetCompleteAnimation
            group={setCompleteAnim.group}
            tiles={setCompleteAnim.tiles}
            ownerName={setCompleteAnim.ownerName}
            ownerColor={setCompleteAnim.ownerColor}
            onDone={() => setSetCompleteAnim(null)}
            />
          )}

          {showSettingsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-6 w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Settings size={20} className="text-indigo-400" />
                  Room Settings
                </h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-slate-800"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                {renderGameSettings()}
              </div>
            </motion.div>
          </motion.div>
          )}

        {systemAlert && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center gap-4 text-center"
            >
              <Info size={32} className="text-indigo-400 mb-2" />
              <p className="text-white font-bold">{systemAlert}</p>
              <button onClick={() => setSystemAlert(null)} className="mt-4 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">
                OK
              </button>
            </motion.div>
          </motion.div>
        )}

        {confirmAlert && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl flex flex-col items-center gap-4 text-center"
            >
              <Info size={32} className="text-rose-500 mb-2" />
              <p className="text-white font-bold">{confirmAlert.message}</p>
              <div className="flex gap-2 w-full mt-4">
                <button onClick={() => setConfirmAlert(null)} className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold uppercase tracking-widest text-xs transition-colors">
                  Cancel
                </button>
                <button onClick={() => { confirmAlert.onConfirm(); setConfirmAlert(null); }} className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs transition-colors shadow-lg shadow-rose-600/20">
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Bug Report Modal */}
        {showBugModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowBugModal(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Flag size={16} className="text-rose-400" /> Report a Bug
                </h3>
                <button onClick={() => setShowBugModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors">
                  <X size={16} />
                </button>
              </div>

              {bugSubmitted ? (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                    <Flag size={22} className="text-emerald-400" />
                  </div>
                  <p className="text-white font-bold">Report submitted!</p>
                  <p className="text-slate-400 text-sm">Thanks for helping improve Cashly.</p>
                  <button onClick={() => setShowBugModal(false)} className="mt-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-colors">
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5 block">Title</label>
                      <input
                        type="text"
                        value={bugTitle}
                        onChange={e => { setBugTitle(e.target.value); setBugError(null); }}
                        placeholder="Short summary of the bug…"
                        maxLength={120}
                        className="w-full bg-[#111116] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5 block">Description</label>
                      <textarea
                        value={bugDesc}
                        onChange={e => { setBugDesc(e.target.value); setBugError(null); }}
                        placeholder="What happened? What did you expect?"
                        maxLength={2000}
                        rows={4}
                        className="w-full bg-[#111116] border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors resize-none"
                      />
                      <p className="text-[10px] text-slate-600 text-right mt-0.5">{bugDesc.length}/2000</p>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1.5 block">Screenshot (optional)</label>
                      {bugImage ? (
                        <div className="relative">
                          <img src={bugImage} alt="preview" className="w-full max-h-36 object-contain rounded-xl border border-slate-700" />
                          <button onClick={() => setBugImage(null)} className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-black text-white rounded-lg p-1 transition-colors"><X size={12} /></button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 w-full border border-dashed border-slate-700 rounded-xl py-3 px-4 cursor-pointer hover:border-indigo-500 transition-colors text-slate-500 hover:text-slate-300 text-sm">
                          <Package size={14} /> Click to attach image
                          <input type="file" accept="image/*" className="hidden" onChange={e => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 1_500_000) { setBugError('Image must be under 1.5 MB.'); return; }
                            const reader = new FileReader();
                            reader.onload = ev => setBugImage(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }} />
                        </label>
                      )}
                    </div>
                    {bugError && (
                      <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{bugError}</p>
                    )}
                  </div>
                  <button
                    disabled={bugSubmitting}
                    onClick={async () => {
                      setBugError(null);
                      setBugSubmitting(true);
                      try {
                        const res = await fetch('/api/bug-report', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ title: bugTitle, description: bugDesc, imageUrl: bugImage }),
                        });
                        const data = await res.json();
                        if (!res.ok) { setBugError(data.error ?? 'Failed to submit.'); return; }
                        setBugSubmitted(true);
                      } catch {
                        setBugError('Network error — try again.');
                      } finally {
                        setBugSubmitting(false);
                      }
                    }}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                  >
                    {bugSubmitting ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}><Flag size={14} /></motion.div> : <Flag size={14} />}
                    Submit Report
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}

        {/* F8: Rules reference modal */}
        {showRulesModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowRulesModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 16 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl flex flex-col gap-5 max-h-[80vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700"
            >
              <div className="flex items-center justify-between shrink-0">
                <h3 className="text-lg font-black text-white flex items-center gap-2"><Info size={18} className="text-indigo-400" /> Rules Reference</h3>
                <button onClick={() => setShowRulesModal(false)} className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"><X size={18} /></button>
              </div>

              {[
                { title: 'Rent', rows: [
                  ['No buildings (no monopoly)', 'Base rent'],
                  ['No buildings (monopoly)', 'Base rent ×2 (if rule on)'],
                  ['1 House', 'rent[1]'],
                  ['2 Houses', 'rent[2]'],
                  ['3 Houses', 'rent[3]'],
                  ['4 Houses', 'rent[4]'],
                  ['Hotel (5)', 'rent[5]'],
                ]},
                { title: 'Railroads', rows: [
                  ['1 owned', '$25'],
                  ['2 owned', '$50'],
                  ['3 owned', '$100'],
                  ['4 owned', '$200'],
                ]},
                { title: 'Utilities', rows: [
                  ['1 owned', 'Dice × 4'],
                  ['2 owned', 'Dice × 10'],
                ]},
                { title: 'Mortgage', rows: [
                  ['Mortgage value', '50% of price'],
                  ['Unmortgage cost', '55% of price'],
                  ['Cannot build if mortgaged', '—'],
                ]},
                { title: 'Jail', rows: [
                  ['Fine to leave', '$50'],
                  ['Max turns in jail', '3'],
                  ['3 doubles → sent to jail', '—'],
                ]},
                { title: 'Keyboard Shortcuts', rows: [
                  ['Space', 'Roll dice'],
                  ['B', 'Buy property'],
                  ['A', 'Start auction'],
                  ['E', 'End turn'],
                ]},
              ].map(section => (
                <div key={section.title}>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{section.title}</p>
                  <div className="rounded-xl overflow-hidden border border-slate-800">
                    {section.rows.map(([label, value], i) => (
                      <div key={i} className={`flex items-center justify-between px-3 py-2 text-xs ${i % 2 === 0 ? 'bg-slate-900/60' : 'bg-slate-900/30'}`}>
                        <span className="text-slate-400">{label}</span>
                        <span className="font-bold text-slate-200">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>
      </Suspense>
    </motion.div>
  );
};

export default App;
