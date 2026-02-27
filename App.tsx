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
  Dices, Key, Copy, MessageSquare, ChevronsRight, Bot, Crown,
  TrendingUp, Landmark
} from 'lucide-react';
import { playSound } from './services/audioService';
import {
  INITIAL_TILES,
  PLAYER_COLORS,
} from './constants';
import { Avatar } from './components/Avatar';
import { Switch } from './components/animate-ui/components/base/switch';
import { Label } from './components/ui/label';
import { motion, AnimatePresence } from 'motion/react';
import { initSocket, getSocket } from './services/socketService';

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

  const [humanName, setHumanName] = useState('Player 1');

  // Multiplayer state
  const [isOnline, setIsOnline] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<number>(0);
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(11);
  const [showJoinInput, setShowJoinInput] = useState(false);

  // IMP-11: Prevent duplicate bot bid timers (BUG-11)
  const botBidFiringRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setJoinRoomId(room.toUpperCase());
    }
  }, []);

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

    const handleRoomUpdated = (data: any) => {
      setLobbyPlayers(data.players);
      const me = data.players.find((p: any) => p.id === socket.id);
      if (me) {
        setIsHost(me.isHost);
        setMyPlayerId(data.players.indexOf(me));
      }
    };

    const handleGameStarted = (data: any) => {
      if (data.state) {
        dispatch({ type: 'SYNC_STATE', payload: data.state });
        setGameStarted(true);
      }
    };

    const handleHostProcessAction = (action: any) => {
      if (isHost) {
        dispatch(action);
      }
    };

    const handleSyncState = (data: any) => {
      if (!isHost && data.state) {
        dispatch({ type: 'SYNC_STATE', payload: data.state });
        setGameStarted(true);
      }
    };

    const handleSettingsUpdated = (newSettings: any) => {
      setSettings(newSettings);
    };

    const handleKicked = () => {
      setIsOnline(false);
      setRoomId("");
      setLobbyPlayers([]);
      setIsHost(false);
      alert("You have been kicked from the room.");
    };

    socket.on("room_updated", handleRoomUpdated);
    socket.on("game_started", handleGameStarted);
    socket.on("host_process_action", handleHostProcessAction);
    socket.on("sync_state", handleSyncState);
    socket.on("settings_updated", handleSettingsUpdated);
    socket.on("kicked", handleKicked);

    return () => {
      socket.off("room_updated", handleRoomUpdated);
      socket.off("game_started", handleGameStarted);
      socket.off("host_process_action", handleHostProcessAction);
      socket.off("sync_state", handleSyncState);
      socket.off("settings_updated", handleSettingsUpdated);
      socket.off("kicked", handleKicked);
    };
  }, [isHost]);

  // Sync state to clients if host
  useEffect(() => {
    if (isOnline && isHost && gameStarted) {
      const stablePhases = ['ROLL', 'TURN_END', 'AUCTION', 'ACTION'];
      if (!stablePhases.includes(gameState.phase)) return; // BUG-C7: Only sync on stable phases

      const socket = getSocket();
      if (socket) {
        // Debounce the sync emission
        const timeoutId = setTimeout(() => {
          socket.emit("sync_state", { state: gameState });
        }, 0);
        return () => clearTimeout(timeoutId);
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
      socket.emit("create_room", { name: humanName }, (res: any) => {
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
      socket.emit("join_room", { roomId: joinRoomId, name: humanName }, (res: any) => {
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

  const joinRandomRoom = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit("join_random_room", { name: humanName }, (res: any) => {
        if (res.success) {
          setIsOnline(true);
          setRoomId(res.roomId);
          setIsHost(res.players.find((p: any) => p.id === socket.id)?.isHost || false);
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
          className="max-w-6xl w-full grid lg:grid-cols-[1fr_450px] gap-8 lg:gap-16 relative z-10 p-4"
        >
          {/* Left hero */}
          <div className="flex flex-col justify-center py-8 lg:py-12">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] md:text-xs font-black tracking-widest uppercase mb-6 w-fit"
            >
              <Globe size={14} /> MULTIPLAYER STRATEGY v2.0
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter mb-6 leading-none"
            >
              RICHUP<span className="text-indigo-500">.IO</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-slate-400 text-lg md:text-xl max-w-xl leading-relaxed mb-12"
            >
              The ultimate browser-based property trading simulator. Out-negotiate, out-invest, and out-maneuver your rivals.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12"
            >
              <div className="space-y-3 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/50">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Users size={24} />
                </div>
                <h3 className="font-black text-lg text-slate-200">Play with Friends</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Local multiplayer with customizable player counts.</p>
              </div>
              <div className="space-y-3 bg-slate-900/30 p-4 rounded-2xl border border-slate-800/50">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={24} />
                </div>
                <h3 className="font-black text-lg text-slate-200">AI Opponents</h3>
                <p className="text-sm text-slate-500 leading-relaxed">Strategic bots that adapt to the board state.</p>
              </div>
            </motion.div>

            {/* Player Customization */}
            {!spectatorMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 mb-8 backdrop-blur-md shadow-2xl"
              >
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Users size={14} className="text-indigo-400" /> Your Identity
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-2 block tracking-widest">Player Name</label>
                    <input
                      type="text"
                      value={humanName}
                      onChange={(e) => setHumanName(e.target.value)}
                      maxLength={15}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-lg font-black text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all placeholder:text-slate-700"
                      placeholder="Enter your name..."
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <div className="flex flex-col gap-6">
              {!isOnline ? (
                <>
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, type: 'spring' }}
                    onClick={joinRandomRoom}
                    className="group relative w-full px-8 py-6 bg-indigo-600 hover:bg-indigo-500 text-white rounded-3xl font-black text-xl md:text-2xl shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-4 active:scale-95 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:250%_250%,100%_100%] animate-shimmer pointer-events-none" />
                    <Play fill="currentColor" size={28} className="relative z-10" /> 
                    <span className="relative z-10 tracking-tight">PLAY ONLINE</span>
                    <ChevronRight className="relative z-10 group-hover:translate-x-2 transition-transform" size={28} />
                  </motion.button>
                  
                  <div className="flex flex-col sm:flex-row gap-4">
                    <motion.button
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.65, type: 'spring' }}
                      onClick={createRoom}
                      className="group relative flex-1 px-4 py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-lg shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                    >
                      <Globe size={22} className="shrink-0" /> 
                      <span className="tracking-tight whitespace-nowrap">CREATE ROOM</span>
                    </motion.button>
                    <div className="flex flex-1 gap-3">
                      <input
                        type="text"
                        value={joinRoomId}
                        onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                        placeholder="ROOM"
                        maxLength={6}
                        className="w-full min-w-0 bg-slate-900 border border-slate-700 rounded-2xl px-4 font-mono font-black text-center text-slate-200 focus:outline-none focus:border-indigo-500 transition-colors uppercase text-lg placeholder:text-slate-600 placeholder:font-sans"
                      />
                      <motion.button
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.7, type: 'spring' }}
                        onClick={joinRoom}
                        disabled={!joinRoomId}
                        className="px-6 py-5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-slate-800 text-white rounded-2xl font-black text-lg transition-all flex items-center justify-center active:scale-95 tracking-tight shrink-0"
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
                  className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-md shadow-2xl"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <h3 className="font-black text-2xl text-white flex items-center gap-3">
                      <Globe className="text-emerald-400" size={28} /> ONLINE LOBBY
                    </h3>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="bg-slate-950 px-4 py-2.5 rounded-2xl border border-slate-800 flex items-center gap-3 flex-1 sm:flex-none justify-center">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Room Code</span>
                        <span className="font-mono font-black text-xl text-indigo-400 tracking-widest">{roomId}</span>
                      </div>
                      <button
                        onClick={() => {
                          const url = new URL(window.location.href);
                          url.searchParams.set('room', roomId || '');
                          navigator.clipboard.writeText(url.toString());
                          alert('Invite link copied to clipboard!');
                        }}
                        className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl transition-colors shadow-lg shadow-indigo-600/20 active:scale-95 shrink-0"
                        title="Copy Invite Link"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-8">
                    {lobbyPlayers.map((p, i) => (
                      <div key={p.id} className="flex items-center justify-between bg-slate-800/40 p-4 rounded-2xl border border-slate-700/50">
                        <div className="flex items-center gap-4">
                          <Avatar avatarId={p.avatar} color={PLAYER_COLORS[i % PLAYER_COLORS.length]} className="w-12 h-12 shadow-md" />
                          <span className="font-black text-lg text-slate-200">{p.name} {p.id === getSocket()?.id ? <span className="text-slate-500 text-sm font-bold ml-1">(You)</span> : ''}</span>
                        </div>
                        {p.isHost && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-3 py-1.5 rounded-lg font-black uppercase tracking-[0.2em] border border-indigo-500/30">Host</span>}
                      </div>
                    ))}
                    {Array.from({ length: settings.maxPlayers - lobbyPlayers.length }).map((_, i) => (
                      <div key={`empty-${i}`} className="flex items-center gap-4 bg-slate-900/30 p-4 rounded-2xl border border-slate-800 border-dashed opacity-50">
                        <div className="w-12 h-12 rounded-full bg-slate-800/80 flex items-center justify-center">
                          <Users size={20} className="text-slate-600" />
                        </div>
                        <span className="font-bold text-slate-600 italic">Waiting for player...</span>
                      </div>
                    ))}
                  </div>

                  {isHost ? (
                    <button
                      onClick={handleStartGame}
                      className="w-full py-5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-xl shadow-xl shadow-emerald-600/20 transition-all flex items-center justify-center gap-3 active:scale-95 tracking-tight"
                    >
                      <Play fill="currentColor" size={24} /> START GAME
                    </button>
                  ) : (
                    <div className="w-full py-5 bg-slate-800/80 text-slate-400 rounded-2xl font-bold text-center flex items-center justify-center gap-3 border border-slate-700/50">
                      <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                      Waiting for host to start...
                    </div>
                  )}
                </motion.div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-slate-900/40 backdrop-blur-xl border border-slate-800 rounded-3xl flex flex-col h-auto max-h-[700px] shadow-2xl overflow-hidden"
          >
            {!isOnline ? (
              <div className="p-8 md:p-10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-black text-2xl text-white flex items-center gap-3 tracking-tight">
                    <Info className="text-indigo-400" size={28} /> HOW TO PLAY
                  </h2>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-all"
                    title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
                  >
                    {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                  </button>
                </div>
                <div className="space-y-8 text-slate-300 leading-relaxed flex-1 overflow-y-auto pr-4 scrollbar-thin">
                  <p className="text-lg text-slate-400">
                    <strong>Richup.io</strong> is a multiplayer property trading game. The goal is to bankrupt your opponents by buying, upgrading, and collecting rent on properties.
                  </p>
                  <ul className="space-y-6">
                    <li className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 font-black text-sm mt-1">1</div>
                      <span className="text-slate-300"><strong className="text-white">Roll the dice</strong> to move around the board. If you land on an unowned property, you can buy it. If you pass, it goes to auction.</span>
                    </li>
                    <li className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 font-black text-sm mt-1">2</div>
                      <span className="text-slate-300"><strong className="text-white">Collect color sets</strong> to build houses and hotels. This massively increases the rent other players must pay when they land on your tiles.</span>
                    </li>
                    <li className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 font-black text-sm mt-1">3</div>
                      <span className="text-slate-300"><strong className="text-white">Trade with others</strong> to complete your sets. A good trade can turn the game in your favor.</span>
                    </li>
                    <li className="flex gap-4 items-start">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 font-black text-sm mt-1">4</div>
                      <span className="text-slate-300"><strong className="text-white">Avoid bankruptcy!</strong> If you owe more money than you can pay, you lose. Mortgage properties if you need quick cash.</span>
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Settings size={18} className="text-slate-400" />
                    <h2 className="font-bold text-sm uppercase tracking-widest text-slate-200">Game Settings</h2>
                  </div>
                  <div className="flex items-center gap-2">
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

                <div className={`flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin ${!isHost ? 'opacity-50 pointer-events-none' : ''}`}>
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
              </>
            )}
            
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
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors backdrop-blur-sm shadow-lg"
          title={soundEnabled ? 'Mute' : 'Unmute'}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      <div className="w-full max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 lg:gap-8 px-2 lg:px-4 z-10 py-2 lg:py-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative w-full max-w-[1100px] flex justify-center order-2 lg:order-1"
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

        {/* Player Status List & Protocol Feed */}
        <div className="w-full lg:w-64 flex flex-col gap-4 shrink-0 order-1 lg:order-2 px-2 lg:px-0">
          <div className="flex flex-row lg:flex-col gap-3 overflow-x-auto lg:overflow-y-auto pb-2 lg:pb-0 scrollbar-hide snap-x snap-mandatory">
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
                    snap-center relative flex items-center gap-3 bg-slate-900/60 backdrop-blur-md border p-2.5 lg:p-3 rounded-2xl min-w-[140px] lg:min-w-0 shadow-2xl cursor-pointer transition-all duration-300
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

          {/* Protocol Feed */}
          <div className="hidden lg:flex flex-col gap-3 mt-2 flex-1 min-h-[250px] max-h-[400px]">
            <div className="h-full bg-slate-900/60 rounded-2xl flex flex-col p-4 border border-white/5 overflow-hidden backdrop-blur-md shadow-2xl">
              <div className="flex justify-between items-center mb-3 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  <TrendingUp size={14} className="text-indigo-400" />
                  <span>Protocol Feed</span>
                </div>
                <span className="font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">T-{gameState.turnCount}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-slate-700">
                {gameState.logs.map((log, i) => (
                  <div
                    key={i}
                    className={`text-xs font-bold leading-relaxed transition-opacity duration-500 ${i === 0 ? 'text-indigo-300 border-l-2 border-indigo-500 pl-3 animate-pulse' : 'text-slate-500 pl-3 opacity-60'}`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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