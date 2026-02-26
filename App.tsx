import React, { useReducer, useEffect, useState, useRef } from 'react';
import { gameReducer, initialState } from './services/gameReducer';
import { getBotAction, getBotBidAction } from './services/botService';
import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { PropertyModal } from './components/PropertyModal';
import { PlayerPortfolioModal } from './components/PlayerPortfolioModal';
import { TradeProposalModal } from './components/TradeProposalModal';
import { GameSettings, TileType } from './types';
import {
  Play, Settings, Users, Info, ShieldCheck, Globe, Lock, Cpu,
  LayoutGrid, ChevronRight, Volume2, VolumeX, Eye, Trophy, X,
} from 'lucide-react';
import { playSound } from './services/audioService';
import {
  INITIAL_TILES,
  PLAYER_COLORS,
  AVAILABLE_AVATARS,
} from './constants';
import { Avatar } from './components/Avatar';
import { Switch } from './components/animate-ui/components/base/switch';
import { Label } from './components/ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { initSocket, getSocket } from './services/socketService';

// ─── Leaderboard helpers (FEAT-08) ──────────────────────────────────────────
interface LeaderboardEntry {
  name: string;
  wins: number;
}

const LEADERBOARD_KEY = 'richup_leaderboard';
const loadLeaderboard = (): LeaderboardEntry[] => {
  try {
    return JSON.parse(localStorage.getItem(LEADERBOARD_KEY) || '[]');
  } catch {
    return [];
  }
};
const saveWin = (name: string) => {
  const board = loadLeaderboard();
  const existing = board.find(e => e.name === name);
  if (existing) existing.wins += 1;
  else board.push({ name, wins: 1 });
  board.sort((a, b) => b.wins - a.wins);
  localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(board.slice(0, 10)));
};

// ─────────────────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [viewingPlayerId, setViewingPlayerId] = useState<number | null>(null);
  const [settings, setSettings] = useState<GameSettings>(initialState.settings);

  // FEAT-04: Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // FEAT-06: Spectator mode (all bots, no human)
  const [spectatorMode, setSpectatorMode] = useState(false);

  // Leaderboard display toggle
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [humanName, setHumanName] = useState('Player 1');
  const [humanAvatar, setHumanAvatar] = useState('human');

  // Multiplayer state
  const [isOnline, setIsOnline] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<number>(0);

  // IMP-11: Prevent duplicate bot bid timers (BUG-11)
  const botBidFiringRef = useRef(false);

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
    const socket = initSocket();

    socket.on("room_updated", (data) => {
      setLobbyPlayers(data.players);
      const me = data.players.find((p: any) => p.id === socket.id);
      if (me) {
        setIsHost(me.isHost);
        setMyPlayerId(data.players.indexOf(me));
      }
    });

    socket.on("game_started", (data) => {
      dispatch({ type: 'SYNC_STATE', payload: data.state });
      setGameStarted(true);
    });

    socket.on("host_process_action", (action) => {
      if (isHost) {
        dispatch(action);
      }
    });

    socket.on("sync_state", (data) => {
      if (!isHost) {
        dispatch({ type: 'SYNC_STATE', payload: data.state });
      }
    });

    return () => {
      socket.off("room_updated");
      socket.off("game_started");
      socket.off("host_process_action");
      socket.off("sync_state");
    };
  }, [isHost]);

  // Sync state to clients if host
  useEffect(() => {
    if (isOnline && isHost && gameStarted) {
      const socket = getSocket();
      if (socket) {
        socket.emit("sync_state", { state: gameState });
      }
    }
  }, [gameState, isOnline, isHost, gameStarted]);

  // Intercept dispatch for online play
  const handleDispatch = (action: any) => {
    if (isOnline && !isHost) {
      const socket = getSocket();
      if (socket) {
        socket.emit("game_action", action);
      }
    } else {
      dispatch(action);
    }
  };

  // ── Save win to leaderboard when game ends ─────────────────────────────────
  useEffect(() => {
    if (gameState.winnerId !== null) {
      const winner = gameState.players.find(p => p.id === gameState.winnerId);
      if (winner) saveWin(winner.name);
      setLeaderboard(loadLeaderboard());
    }
  }, [gameState.winnerId]);

  // ── Phase auto-transitions (non-bot) ───────────────────────────────────────
  useEffect(() => {
    // BUG-06: Guard by winnerId so timer doesn't fire after game ends
    if (!gameStarted || gameState.winnerId !== null || gameState.phase === 'AUCTION') return;
    let timer: ReturnType<typeof setTimeout>;

    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isBot = currentPlayer?.isBot;

    if (gameState.phase === 'MOVING') {
      timer = setTimeout(() => handleDispatch({ type: 'MOVE_PLAYER' }), isBot ? 2000 : 800);
    } else if (gameState.phase === 'RESOLVING') {
      timer = setTimeout(() => handleDispatch({ type: 'LAND_ON_TILE' }), isBot ? 1200 : 600);
    }
    return () => clearTimeout(timer);
  }, [gameState.phase, gameStarted, gameState.winnerId, gameState.currentPlayerIndex]);

  // ── Auction timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    // BUG-06: Guard by winnerId
    if (gameState.phase !== 'AUCTION' || !gameState.auction || gameState.winnerId !== null) return;
    if (isOnline && !isHost) return; // Only host handles timers

    if (gameState.auction.timer > 0) {
      const interval = setInterval(() => handleDispatch({ type: 'DECREMENT_AUCTION_TIMER' }), 1000);
      return () => clearInterval(interval);
    } else {
      handleDispatch({ type: 'END_AUCTION' });
    }
  }, [gameState.phase, gameState.auction?.timer, gameState.winnerId, isOnline, isHost]);

  // ── Bot main actions (IMP-11: via botService) ──────────────────────────────
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameStarted || !currentPlayer?.isBot || gameState.winnerId !== null) return;
    if (isOnline && !isHost) return; // Only host handles bots

    // Spectator mode uses same bot timing — works automatically since bots handle all turns

    const delays: Record<string, number> = {
      ROLL: 2500,
      ACTION: 3000,
      TURN_END: 4500,
    };
    const delay = delays[gameState.phase] ?? 0;
    if (!delay) return;

    const timer = setTimeout(() => {
      const action = getBotAction(gameState);
      if (action) handleDispatch(action);
    }, delay);

    return () => clearTimeout(timer);
  }, [gameState.phase, gameState.currentPlayerIndex, gameStarted, gameState.winnerId, isOnline, isHost]);

  // ── Bot auction bids (IMP-11: via botService, BUG-11: ref guard) ───────────
  useEffect(() => {
    if (gameState.phase !== 'AUCTION' || !gameState.auction || gameState.winnerId !== null) return;
    if (isOnline && !isHost) return; // Only host handles bots
    if (botBidFiringRef.current) return;

    botBidFiringRef.current = true;
    const auction = gameState.auction;
    const botsToAct = gameState.players.filter(p => p.isBot && !p.isBankrupt && p.id !== auction.highestBidderId);

    const timer = setTimeout(() => {
      for (const bot of botsToAct) {
        const action = getBotBidAction(gameState, bot.id, auction);
        if (action) handleDispatch(action);
      }
      botBidFiringRef.current = false;
    }, 800 + Math.random() * 1500);

    return () => {
      clearTimeout(timer);
      botBidFiringRef.current = false;
    };
  }, [gameState.phase, gameState.auction?.timer, gameState.auction?.highestBidderId, gameState.winnerId, isOnline, isHost]);

  const handleStartGame = () => {
    // In spectator mode, make all players bots
    const effectiveSettings = spectatorMode
      ? { ...settings, allowBots: true, maxPlayers: settings.maxPlayers }
      : settings;

    const action = {
      type: 'START_GAME',
      payload: {
        humanName: spectatorMode ? 'Spectator' : humanName,
        humanAvatar: humanAvatar,
        settings: effectiveSettings,
        lobbyPlayers: isOnline ? lobbyPlayers : null,
      },
    };

    dispatch(action as any);
    setGameStarted(true);

    if (isOnline && isHost) {
      const socket = getSocket();
      if (socket) {
        // We need to wait for the state to update, but we can just send the action
        // Actually, the server expects the full initial state.
        // We'll let the sync_state effect handle it.
        socket.emit("start_game", { initialState: null }); // sync_state will send the real state
      }
    }
  };

  const createRoom = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit("create_room", { name: humanName, avatar: humanAvatar }, (res: any) => {
        if (res.success) {
          setIsOnline(true);
          setRoomId(res.roomId);
          setIsHost(true);
          setLobbyPlayers(res.players);
        }
      });
    }
  };

  const joinRoom = () => {
    if (!joinRoomId) return;
    const socket = getSocket();
    if (socket) {
      socket.emit("join_room", { roomId: joinRoomId, name: humanName, avatar: humanAvatar }, (res: any) => {
        if (res.success) {
          setIsOnline(true);
          setRoomId(res.roomId);
          setIsHost(false);
          setLobbyPlayers(res.players);
        } else {
          alert(res.error);
        }
      });
    }
  };

  const updateRule = (key: keyof typeof settings.rules, value: any) => {
    setSettings({ ...settings, rules: { ...settings.rules, [key]: value } });
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

  // ── Start Screen ────────────────────────────────────────────────────────────
  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950 pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl w-full grid lg:grid-cols-[1fr_400px] gap-8 relative z-10 p-4"
        >
          {/* Left hero */}
          <div className="flex flex-col justify-center p-4">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold tracking-wider mb-6"
            >
              <Globe size={14} /> MULTIPLAYER STRATEGY v2.0
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-6xl md:text-7xl font-black tracking-tighter mb-4"
            >
              RICHUP<span className="text-indigo-500">.IO</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-slate-400 text-xl max-w-xl leading-relaxed mb-10"
            >
              The ultimate browser-based property trading simulator. Out-negotiate, out-invest, and out-maneuver your rivals.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-2 gap-6 mb-8"
            >
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-indigo-400">
                  <Users size={20} />
                </div>
                <h3 className="font-bold">Play with Friends</h3>
                <p className="text-sm text-slate-500">Local multiplayer with customizable player counts.</p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="font-bold">AI Opponents</h3>
                <p className="text-sm text-slate-500">Strategic bots that adapt to the board state.</p>
              </div>
            </motion.div>

            {/* Player Customization */}
            {!spectatorMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 mb-8 backdrop-blur-sm"
              >
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Users size={12} className="text-indigo-400" /> Your Identity
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1.5 block">Player Name</label>
                    <input
                      type="text"
                      value={humanName}
                      onChange={(e) => setHumanName(e.target.value)}
                      maxLength={15}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                      placeholder="Enter your name..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 block">Choose Avatar</label>
                    <div className="grid grid-cols-8 gap-2">
                      {AVAILABLE_AVATARS.map((avatar) => (
                        <button
                          key={avatar.id}
                          onClick={() => setHumanAvatar(avatar.id)}
                          className={`
                            aspect-square rounded-xl flex items-center justify-center transition-all relative group
                            ${humanAvatar === avatar.id ? 'bg-indigo-600 ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900' : 'bg-slate-800 hover:bg-slate-700'}
                          `}
                          title={avatar.label}
                        >
                          <Avatar avatarId={avatar.id} color="transparent" className="w-full h-full border-none shadow-none" />
                          <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                            {avatar.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col gap-3">
              {!isOnline ? (
                <>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, type: 'spring' }}
                    onClick={handleStartGame}
                    className="group relative w-full md:w-fit px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-4 active:scale-95"
                  >
                    <Play fill="currentColor" size={24} /> LOCAL GAME
                    <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                  </motion.button>
                  
                  <div className="flex flex-col md:flex-row gap-3 mt-2">
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.65, type: 'spring' }}
                      onClick={createRoom}
                      className="group relative flex-1 px-6 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Globe size={20} /> HOST ONLINE
                    </motion.button>
                    <div className="flex flex-1 gap-2">
                      <input
                        type="text"
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                        placeholder="ROOM CODE"
                        maxLength={6}
                        className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-4 font-mono font-bold text-center text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors uppercase"
                      />
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7, type: 'spring' }}
                        onClick={joinRoom}
                        disabled={!joinRoomId}
                        className="px-6 py-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-white rounded-2xl font-black text-lg transition-all flex items-center justify-center active:scale-95"
                      >
                        JOIN
                      </motion.button>
                    </div>
                  </div>
                </>
              ) : (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-slate-900/60 border border-slate-700 rounded-2xl p-6"
                >
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-black text-xl text-white flex items-center gap-2">
                      <Globe className="text-emerald-400" /> ONLINE LOBBY
                    </h3>
                    <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 flex items-center gap-3">
                      <span className="text-xs text-slate-500 font-bold uppercase">Room Code</span>
                      <span className="font-mono font-black text-xl text-indigo-400 tracking-widest">{roomId}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {lobbyPlayers.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <Avatar avatarId={p.avatar} color={PLAYER_COLORS[i % PLAYER_COLORS.length]} className="w-10 h-10" />
                          <span className="font-bold text-slate-200">{p.name} {p.id === getSocket()?.id ? '(You)' : ''}</span>
                        </div>
                        {p.isHost && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded font-bold uppercase tracking-wider border border-indigo-500/30">Host</span>}
                      </div>
                    ))}
                    {Array.from({ length: settings.maxPlayers - lobbyPlayers.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex items-center gap-3 bg-slate-900/30 p-3 rounded-xl border border-slate-800 border-dashed opacity-50">
                        <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                          <Users size={16} className="text-slate-600" />
                        </div>
                        <span className="font-bold text-slate-600 italic">Waiting for player...</span>
                      </div>
                    ))}
                  </div>

                  {isHost ? (
                    <button
                      onClick={handleStartGame}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-lg shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Play fill="currentColor" size={20} /> START GAME
                    </button>
                  ) : (
                    <div className="w-full py-4 bg-slate-800 text-slate-400 rounded-xl font-bold text-center flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Waiting for host to start...
                    </div>
                  )}
                </motion.div>
              )}

              {/* FEAT-08: Leaderboard */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
                onClick={() => { setLeaderboard(loadLeaderboard()); setShowLeaderboard(!showLeaderboard); }}
                className="w-full md:w-fit px-8 py-3 bg-transparent hover:bg-slate-900 text-slate-500 hover:text-slate-300 rounded-xl font-bold text-sm border border-slate-800 transition-all flex items-center justify-center gap-2"
              >
                <Trophy size={16} /> Leaderboard
              </motion.button>
            </div>

            {/* Leaderboard panel */}
            <AnimatePresence>
              {showLeaderboard && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 overflow-hidden"
                >
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Trophy size={12} className="text-amber-400" /> All-Time Winners
                  </h3>
                  {leaderboard.length === 0 ? (
                    <p className="text-slate-600 text-xs italic">No games completed yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {leaderboard.map((entry, i) => (
                        <div key={entry.name} className="flex justify-between items-center text-sm">
                          <span className={`font-bold ${i === 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {i + 1}. {entry.name}
                          </span>
                          <span className="font-mono text-slate-500">{entry.wins}W</span>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right settings panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="shadcn-card bg-slate-900/40 backdrop-blur-xl p-0 flex flex-col h-auto max-h-[700px]"
          >
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-slate-400" />
                <h2 className="font-bold text-sm uppercase tracking-widest text-slate-200">Game Settings</h2>
              </div>
              <div className="flex items-center gap-2">
                {/* FEAT-04: Sound toggle */}
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="p-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
                  title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                >
                  {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                </button>
                <div className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono uppercase">MAP: CLASSIC</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Users size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Players & Room</span>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-slate-500 mb-2 block">Maximum Players</label>
                    <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                      {[2, 3, 4, 5].map(n => (
                        <button
                          key={n}
                          onClick={() => setSettings({ ...settings, maxPlayers: n })}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${settings.maxPlayers === n ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                    <Label className="flex items-center gap-3 cursor-pointer" onClick={() => setSettings({ ...settings, isPrivate: !settings.isPrivate })}>
                      <Lock size={16} className="text-slate-500" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200">Private Room</span>
                        <span className="text-[10px] text-slate-600 font-normal">Invite-only access</span>
                      </div>
                    </Label>
                    <Switch checked={settings.isPrivate} onCheckedChange={checked => setSettings({ ...settings, isPrivate: checked })} />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                    <Label className="flex items-center gap-3 cursor-pointer" onClick={() => setSettings({ ...settings, allowBots: !settings.allowBots })}>
                      <Cpu size={16} className="text-slate-500" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200">Allow Bots</span>
                        <span className="text-[10px] text-slate-600 font-normal">Fill empty slots with AI</span>
                      </div>
                    </Label>
                    <Switch checked={settings.allowBots} onCheckedChange={checked => setSettings({ ...settings, allowBots: checked })} />
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-400">
                  <LayoutGrid size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Gameplay Rules</span>
                </div>
                <div className="space-y-2">
                  {[
                    { id: 'doubleRentOnFullSet', label: 'x2 Rent on Sets', info: 'Monopoly base rent is doubled' },
                    { id: 'vacationCash', label: 'Vacation Cash', info: 'Landing on Parking wins tax pool' },
                    { id: 'auctionEnabled', label: 'Auction House', info: 'Unbought properties go to auction' },
                    { id: 'noRentInJail', label: 'No Rent in Jail', info: 'Prisoners cannot collect rent' },
                    { id: 'mortgageEnabled', label: 'Mortgage Enabled', info: 'Allow asset mortgaging' },
                    { id: 'evenBuild', label: 'Even Build', info: 'Enforce balanced construction' },
                    { id: 'randomizeOrder', label: 'Randomize Order', info: 'Shuffle player sequence' },
                  ].map(rule => (
                    <div key={rule.id} className="flex items-center justify-between p-3 bg-slate-950/20 rounded-xl border border-slate-800 hover:bg-slate-900/50 transition-colors">
                      <Label
                        className="flex flex-col cursor-pointer flex-1"
                        onClick={() => updateRule(rule.id as any, !settings.rules[rule.id as keyof typeof settings.rules])}
                      >
                        <span className="text-xs font-bold text-slate-200">{rule.label}</span>
                        <span className="text-[10px] text-slate-600 font-normal">{rule.info}</span>
                      </Label>
                      <Switch
                        checked={settings.rules[rule.id as keyof typeof settings.rules] as boolean}
                        onCheckedChange={checked => updateRule(rule.id as any, checked)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 bg-slate-950 border-t border-slate-800 text-center">
              <p className="text-[10px] text-slate-600 flex items-center justify-center gap-1 uppercase">
                <Info size={10} /> Local Session Data Protected
              </p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Game Screen ─────────────────────────────────────────────────────────────
  const myProperties = gameState.tiles.filter(t => t.ownerId === myPlayerId);

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-start p-4 lg:p-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950 pointer-events-none" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />

      {/* FEAT-04: In-game sound toggle */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors backdrop-blur-sm"
          title={soundEnabled ? 'Mute' : 'Unmute'}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="relative w-full flex justify-center py-4 z-10"
      >
        <Board gameState={gameState} onTileClick={handleTileClick}>
          <Controls
            gameState={gameState}
            myPlayerId={myPlayerId}
            onRoll={() => handleDispatch({ type: 'ROLL_DICE' })}
            onBuy={() => handleDispatch({ type: 'BUY_PROPERTY' })}
            onEndTurn={() => handleDispatch({ type: 'END_TURN' })}
            onUpgrade={tileId => handleDispatch({ type: 'UPGRADE_PROPERTY', payload: { tileId } })}
            onOpenProperty={handleTileClick}
            onTrade={(offer, targetTileId) =>
              handleDispatch({ type: 'PROPOSE_TRADE', payload: { offerCash: offer.cash, offerPropertyIds: offer.properties, targetTileId, requestCash: offer.requestCash } })
            }
            dispatch={handleDispatch}
          />
        </Board>
      </motion.div>

      {/* Player Status List Under Board */}
      <div className="w-full max-w-5xl mt-8 flex justify-center gap-4 px-4 overflow-x-auto pb-4 scrollbar-hide z-20">
        {gameState.players.map(player => {
          const isActive = gameState.currentPlayerIndex === gameState.players.indexOf(player);
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.05, y: -5 }}
              onClick={() => setViewingPlayerId(player.id)}
              className={`
                relative flex items-center gap-3 bg-slate-900/60 backdrop-blur-md border p-3 rounded-2xl min-w-[160px] shadow-2xl cursor-pointer transition-all duration-300
                ${isActive ? 'border-indigo-500/50 bg-indigo-500/5 ring-1 ring-indigo-500/20' : 'border-white/5 hover:border-white/20'}
                ${player.isBankrupt ? 'opacity-40 grayscale' : ''}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="active-indicator"
                  className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)] z-30"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                />
              )}
              
              <div className="relative">
                <Avatar
                  avatarId={player.avatar}
                  color={player.color}
                  isBankrupt={player.isBankrupt}
                  inJail={player.inJail}
                  className={`w-10 h-10 shadow-lg ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-950' : ''}`}
                />
                {player.isBankrupt && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                    <X size={14} className="text-rose-500" strokeWidth={3} />
                  </div>
                )}
              </div>
              
              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-[11px] font-black uppercase truncate ${isActive ? 'text-indigo-300' : 'text-slate-200'}`}>
                    {player.name}
                  </span>
                  {player.isBot && <span className="text-[8px] bg-slate-800 text-slate-500 px-1 rounded-sm border border-slate-700">AI</span>}
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <span className={`font-mono text-xs font-bold ${player.isBankrupt ? 'text-slate-600' : 'text-emerald-400'}`}>
                    ${player.money}
                  </span>
                  <div className="flex gap-0.5">
                    {gameState.tiles.filter(t => t.ownerId === player.id).length > 0 && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/40" />
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
          {selectedTileId !== null && (
            <PropertyModal
              tile={gameState.tiles[selectedTileId]}
              owner={gameState.players.find(p => p.id === gameState.tiles[selectedTileId].ownerId)}
              onClose={() => setSelectedTileId(null)}
              onUpgrade={() => dispatch({ type: 'UPGRADE_PROPERTY', payload: { tileId: selectedTileId } })}
              canUpgrade={gameState.phase === 'TURN_END' && gameState.tiles[selectedTileId].ownerId === myPlayerId}
              currentPlayer={gameState.players.find(p => p.id === myPlayerId)}
              myProperties={myProperties}
              onTrade={offer =>
                handleDispatch({ type: 'PROPOSE_TRADE', payload: { offerCash: offer.cash, offerPropertyIds: offer.properties, targetTileId: selectedTileId, requestCash: offer.requestCash } })
              }
              onMortgage={() => handleDispatch({ type: 'MORTGAGE_PROPERTY', payload: { tileId: selectedTileId } })}
              onUnmortgage={() => handleDispatch({ type: 'UNMORTGAGE_PROPERTY', payload: { tileId: selectedTileId } })}
              onSell={() => handleDispatch({ type: 'SELL_PROPERTY', payload: { tileId: selectedTileId } })}
            />
          )}

          {viewingPlayerId !== null && (
            <PlayerPortfolioModal
              player={gameState.players.find(p => p.id === viewingPlayerId)!}
              tiles={gameState.tiles}
              onClose={() => setViewingPlayerId(null)}
            />
          )}

          {gameState.pendingTrade && (
            <TradeProposalModal
              trade={gameState.pendingTrade}
              players={gameState.players}
              tiles={gameState.tiles}
              myPlayerId={myPlayerId}
              onAccept={() => handleDispatch({ type: 'ACCEPT_TRADE' })}
              onDecline={() => handleDispatch({ type: 'DECLINE_TRADE' })}
            />
          )}
        </AnimatePresence>
    </div>
  );
};

export default App;