import React, { useReducer, useEffect, useState, useRef, useMemo } from 'react';
import { gameReducer, initialState } from './services/gameReducer';
import { getBotAction, getBotBidAction } from './services/botService';
import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { PropertyModal } from './components/PropertyModal';
import { PlayerPortfolioModal } from './components/PlayerPortfolioModal';
import { TradeProposalModal } from './components/TradeProposalModal';
import { CreateTradeModal } from './components/CreateTradeModal';
import { AuctionModal } from './components/AuctionModal';
import { GameSettings, TileType } from './types';
import {
  Play, Settings, Users, Info, ShieldCheck, Globe, Lock, Cpu,
  LayoutGrid, ChevronRight, ChevronLeft, Volume2, VolumeX, Eye, Trophy, X,
  Dices, Key, Copy, MessageSquare, ChevronsRight, Bot, Crown,
  TrendingUp, Landmark, ShoppingCart, LogIn, Package, Zap, Plane, Handshake, UserX, Flag, LogOut, Coins, WifiOff
} from 'lucide-react';
import { playSound } from './services/audioService';
import {
  INITIAL_TILES,
  PLAYER_COLORS,
} from './constants';
import { Avatar, APPEARANCE_COLORS } from './components/Avatar';
import { Switch } from './components/animate-ui/components/base/switch';
import { Label } from './components/ui/label';
import { Button } from './components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'motion/react';
import { initSocket, getSocket, resetSocket } from './services/socketService';

// ─────────────────────────────────────────────────────────────────────────────
const BOT_ADJ = ['Swift','Brave','Fierce','Bold','Dark','Iron','Stone','Silent','Shadow','Crimson','Silver','Golden','Arctic','Cosmic','Neon','Phantom','Rogue','Thunder','Velvet','Blazing','Crystal','Electric','Sacred','Frozen','Obsidian','Scarlet','Astral','Hollow','Ember','Void'];
const BOT_NOUN = ['Falcon','Wolf','Panther','Dragon','Phoenix','Hawk','Blade','Shield','Ghost','Viper','Tiger','Lion','Fox','Raven','Eagle','Cobra','Titan','Ranger','Knight','Wizard','Ninja','Viking','Warrior','Samurai','Mage','Archer','Scout','Cipher','Wraith','Oracle'];
const generateBotLobbyName = (index: number) => BOT_ADJ[(index * 7 + 3) % BOT_ADJ.length] + BOT_NOUN[(index * 11 + 5) % BOT_NOUN.length];

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

  const [humanName, setHumanName] = useState(() => {
    const adjs = ['Swift', 'Brave', 'Fierce', 'Bold', 'Dark', 'Iron', 'Stone', 'Silent', 'Shadow', 'Crimson',
      'Silver', 'Golden', 'Arctic', 'Cosmic', 'Neon', 'Phantom', 'Rogue', 'Thunder', 'Velvet', 'Blazing',
      'Crystal', 'Electric', 'Sacred', 'Frozen', 'Obsidian', 'Scarlet', 'Astral', 'Hollow', 'Ember', 'Void'];
    const nouns = ['Falcon', 'Wolf', 'Panther', 'Dragon', 'Phoenix', 'Hawk', 'Blade', 'Shield', 'Ghost',
      'Viper', 'Tiger', 'Lion', 'Fox', 'Raven', 'Eagle', 'Cobra', 'Titan', 'Ranger', 'Knight', 'Wizard',
      'Ninja', 'Viking', 'Warrior', 'Samurai', 'Mage', 'Archer', 'Scout', 'Cipher', 'Wraith', 'Oracle'];
    return adjs[Math.floor(Math.random() * adjs.length)] + nouns[Math.floor(Math.random() * nouns.length)];
  });

  // Multiplayer state
  const [isOnline, setIsOnline] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [sessionPlayerId, setSessionPlayerId] = useState<string | null>(null);
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
  const [isStacked, setIsStacked] = useState(false);
  const [showCreateTradeModal, setShowCreateTradeModal] = useState(false);
  const [systemAlert, setSystemAlert] = useState<string | null>(null);
  const [confirmAlert, setConfirmAlert] = useState<{ message: string, onConfirm: () => void } | null>(null);
  const [isSpectator, setIsSpectator] = useState(false);
  const [showAppearanceModal, setShowAppearanceModal] = useState(false);
  const [isAutoJoining, setIsAutoJoining] = useState(false);
  const autoJoinAttemptedRef = useRef(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const isOnlineRef = useRef(false);
  useEffect(() => { isOnlineRef.current = isOnline; }, [isOnline]);
  // 100ms per-action-type throttle — prevents double-fire from rapid clicks
  const lastActionTimeRef = useRef<Map<string, number>>(new Map());
  const [kickedBotIds, setKickedBotIds] = useState<Set<number>>(new Set());
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [activePolicyPage, setActivePolicyPage] = useState<'privacy' | 'terms' | 'cookies' | 'contact' | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNowTs(Date.now()), 1000); return () => clearInterval(t); }, []);

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
  const kickTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const prevLobbyCountRef = useRef(-1);

  // IMP-11: Prevent duplicate bot bid timers (BUG-11)
  const botBidFiringRef = useRef(false);
  // Tracks whether isOnline=true was set from a session restore (reload) vs new join
  const isSessionRestoreRef = useRef(false);

  // Reconnect after page refresh — only restores an existing session, never auto-joins new players
  useEffect(() => {
    if (autoJoinAttemptedRef.current) return;
    const pathMatch = window.location.pathname.match(/^\/rooms\/([A-Z0-9]+)$/i);
    const roomFromUrl = pathMatch?.[1] || new URLSearchParams(window.location.search).get('room');
    if (!roomFromUrl) return;
    autoJoinAttemptedRef.current = true;
    const cleanId = roomFromUrl.toUpperCase();
    const stored = JSON.parse(sessionStorage.getItem('richup_session') || 'null');
    if (stored?.roomId === cleanId && stored?.playerId) {
      // Restore session on reload — socket will reconnect via join_session
      isSessionRestoreRef.current = true;
      setIsOnline(true);
      setRoomId(cleanId);
      setSessionPlayerId(stored.playerId);
    } else {
      // No stored session — clear the URL, player must enter room code manually
      window.history.replaceState({}, '', '/');
    }
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
      const newCount = data.players.length;
      const prevCount = prevLobbyCountRef.current;
      if (prevCount >= 0 && soundEnabled) {
        if (newCount > prevCount) playSound('player_join');
        else if (newCount < prevCount) playSound('player_leave');
      }
      prevLobbyCountRef.current = newCount;
      setLobbyPlayers(data.players);
      const me = data.players.find((p: any) => p.id === socket.id);
      if (me && !me.isSpectator) {
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
      resetSocket(); // BUG-7 FIX: Reset socket singleton so player can join another room
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
      setChatMessages(prev => [...prev, data]);
      if (soundEnabled) playSound('notification');
    };

    const handleSocketDisconnect = () => setIsSocketDisconnected(true);
    const handleSocketConnect = () => setIsSocketDisconnected(false);
    const handleYouAreHost = () => setIsHost(true); // B4: server promotes us to host after original host permanently left

    socket.on("room_updated", handleRoomUpdated);
    socket.on("game_started", handleGameStarted);
    socket.on("host_process_action", handleHostProcessAction);
    socket.on("sync_state", handleSyncState);
    socket.on("settings_updated", handleSettingsUpdated);
    socket.on("kicked", handleKicked);
    socket.on("chat_message", handleChatMessage);
    socket.on("rooms_list", (rooms: any[]) => setActiveRooms(rooms));
    socket.on("disconnect", handleSocketDisconnect);
    socket.on("connect", handleSocketConnect);
    socket.on("connect_error", handleSocketDisconnect);
    socket.on("you_are_host", handleYouAreHost);

    return () => {
      socket.off("room_updated", handleRoomUpdated);
      socket.off("game_started", handleGameStarted);
      socket.off("host_process_action", handleHostProcessAction);
      socket.off("sync_state", handleSyncState);
      socket.off("settings_updated", handleSettingsUpdated);
      socket.off("kicked", handleKicked);
      socket.off("chat_message", handleChatMessage);
      socket.off("rooms_list");
      socket.off("disconnect", handleSocketDisconnect);
      socket.off("you_are_host", handleYouAreHost);
      socket.off("connect", handleSocketConnect);
      socket.off("connect_error", handleSocketDisconnect);
    };
  }, [isHost, roomId, sessionPlayerId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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

  // ── Timer loop for active Votekicks ─────────────────────────────────────────
  useEffect(() => {
    if (gameState.votekicks && gameState.votekicks.length > 0) {
      const interval = setInterval(() => {
        handleDispatch({ type: 'CHECK_VOTEKICKS' });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [gameState.votekicks?.length, gameStarted]);

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
  }, [
    gameState.phase,
    gameState.currentPlayerIndex,
    gameStarted,
    gameState.winnerId,
    isOnline,
    isHost,
    gameState.turnLogs.length,
    gameState.pendingTrade
  ]);

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
        selectedAvatar,
      },
    };

    const computedInitialState = gameReducer(gameState, action as any);
    dispatch(action as any);
    setGameStarted(true);

    if (isOnline && isHost) {
      const socket = getSocket();
      if (socket) {
        socket.emit("start_game", { initialState: computedInitialState });
      }
    }
  };

  const createRoom = async (isPrivate = false) => {
    setIsCreatingRoom(true);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: humanName, avatar: selectedAvatar, isPrivate, maxPlayers: settings.maxPlayers }),
      }).then(r => r.json());

      if (res.success) {
        setIsOnline(true);
        setRoomId(res.roomId);
        setSessionPlayerId(res.playerId);
        setIsHost(true);
        setLobbyPlayers(res.players);
        setShowRoomBrowser(false);
        sessionStorage.setItem('richup_session', JSON.stringify({ playerId: res.playerId, roomId: res.roomId }));
        if (isPrivate) {
          setSettings(prev => ({ ...prev, isPrivate: true }));
        }
        window.history.pushState({}, '', `/rooms/${res.roomId}`);
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
      const res = await fetch(`/api/rooms/${cleanId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: humanName, avatar: selectedAvatar }),
      }).then(r => r.json());

      if (res.success) {
        setIsOnline(true);
        setRoomId(res.roomId);
        setSessionPlayerId(res.playerId);
        setIsHost(false);
        setLobbyPlayers(res.players);
        setShowRoomBrowser(false);
        sessionStorage.setItem('richup_session', JSON.stringify({ playerId: res.playerId, roomId: res.roomId }));
        window.history.replaceState({}, '', `/rooms/${res.roomId}`);
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
      const res = await fetch("/api/rooms/random", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: humanName, avatar: selectedAvatar }),
      }).then(r => r.json());

      if (res.success) {
        setIsOnline(true);
        setRoomId(res.roomId);
        setSessionPlayerId(res.playerId);
        setIsHost(res.players.find((p: any) => p.id === res.playerId)?.isHost || false);
        setLobbyPlayers(res.players);
        sessionStorage.setItem('richup_session', JSON.stringify({ playerId: res.playerId, roomId: res.roomId }));
        window.history.pushState({}, '', `/rooms/${res.roomId}`);
      } else {
        setSystemAlert(res.error || "Failed to join random room");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const leaveRoom = () => {
    resetSocket();
    sessionStorage.removeItem('richup_session');
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

  // Back-button: leave room when browser navigates to /
  useEffect(() => {
    const handlePopState = () => {
      if (isOnlineRef.current) {
        resetSocket();
        setIsOnline(false); setRoomId(null); setSessionPlayerId(null);
        setIsHost(false); setLobbyPlayers([]); setGameStarted(false);
        setIsSpectator(false); setShowAppearanceModal(false); setMyPlayerId(0);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Reset kicked bots when allowBots or maxPlayers changes
  useEffect(() => { setKickedBotIds(new Set()); }, [settings.allowBots, settings.maxPlayers]);

  const kickBotSlot = (index: number) => {
    setKickedBotIds(prev => new Set([...prev, index]));
    // Bot rejoins after 20 seconds — track timer so it can be cleared on unmount
    const t = setTimeout(() => {
      kickTimersRef.current.delete(index);
      setKickedBotIds(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }, 20000);
    kickTimersRef.current.set(index, t);
  };

  // Cleanup all pending kick-bot timers on unmount
  useEffect(() => {
    return () => { kickTimersRef.current.forEach(t => clearTimeout(t)); };
  }, []);

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
  useEffect(() => {
    if (joinRoomId.length === 6 && !isOnline && !isJoiningRoom && !isAutoJoining) {
      joinRoom(joinRoomId);
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
    <div className={`bg-[#1e1e24] rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-lg ${isMobilePopup ? 'w-80 h-96' : 'h-80 shrink-0'}`}>
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
    <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-5 flex flex-col gap-3 shadow-lg shrink-0">
      <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
        Share this game <Info size={14} className="text-slate-500" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-[#111116] px-3 py-2 rounded-xl text-sm font-mono text-slate-300 select-all border border-slate-800 truncate">
          {window.location.origin}/rooms/{roomId}
        </div>
        <button
          onClick={() => {
            const textToCopy = `${window.location.origin}/rooms/${roomId || ''}`;

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
          className="bg-indigo-500 hover:bg-indigo-400 p-2 rounded-xl text-white transition-colors flex items-center gap-2 px-3 text-sm font-bold shadow-lg shadow-indigo-500/20"
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
          <div className="text-[10px] text-slate-500 mb-1 uppercase font-black tracking-wider">World selection</div>
          <div className="text-right">
            <div className="text-sm font-bold text-slate-200">{settings.boardMap}</div>
            <button className="text-xs text-indigo-400 hover:text-indigo-300 font-bold">Browse maps &gt;</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── Start Screen ────────────────────────────────────────────────────────────
  if (!gameStarted) {
    if (!isOnline) {
      return (
        <>
        {/* Fixed left ad — outside motion.div so CSS transforms don't break position:fixed */}
        {!showRoomBrowser && (
          <div className="hidden lg:flex fixed left-0 top-0 h-screen w-36 z-[5] flex-col items-center justify-start gap-2 p-3 border-r border-slate-800/30 bg-[#0d0d12]/80">
            <span className="text-[7px] font-bold text-slate-800 uppercase tracking-widest mt-8">Ad</span>
            <div className="w-full flex-1 bg-slate-800/10 rounded-xl border border-slate-800/30" />
          </div>
        )}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="min-h-screen bg-[#111116] text-slate-50 flex flex-col relative overflow-y-auto"
        >
          {/* Creating room overlay */}
          <AnimatePresence>
            {isCreatingRoom && (
              <motion.div
                key="creating-room"
                className="fixed inset-0 z-[600] bg-[#0e0e14]/95 backdrop-blur-md flex flex-col items-center justify-center gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                >
                  <Dices size={52} className="text-indigo-400" />
                </motion.div>
                <div className="flex flex-col items-center gap-1">
                  <p className="text-white font-black text-xl tracking-tight">Creating room…</p>
                  <p className="text-slate-500 text-sm">Setting up your private game</p>
                </div>
                <div className="flex gap-1.5">
                  {[0,1,2].map(i => (
                    <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.4 }} />
                  ))}
                </div>
              </motion.div>
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
                        { title: 'Acceptance', body: 'By playing RichUp.io you agree to these terms. The game is provided free of charge for entertainment purposes.' },
                        { title: 'Fair Play', body: 'Do not exploit bugs, harass other players, or attempt to disrupt game sessions. Violators may be removed from rooms by vote-kick.' },
                        { title: 'Disclaimer', body: 'The game is provided "as is" without warranty. We are not responsible for interrupted sessions due to server downtime.' },
                        { title: 'Intellectual Property', body: 'RichUp.io is an original web game inspired by classic board game mechanics. All code and design is © 2025 RichUp.io.' },
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
          {isAutoJoining && (
            <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-[#111116]/95 backdrop-blur-sm gap-4">
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                <Dices size={40} className="text-indigo-400" />
              </motion.div>
              <p className="text-slate-300 font-black uppercase tracking-widest text-sm">Joining room…</p>
            </div>
          )}

          {/* Top Navigation Bar */}
          <nav className="w-full flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 z-20 relative shrink-0 pt-4">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-2 text-slate-400 hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-800/60"
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <div className="flex items-center gap-4 text-sm font-medium text-slate-400">
              <button className="flex items-center gap-2 hover:text-slate-200 transition-colors">
                <ShoppingCart size={16} /> Store
              </button>
              <button className="flex items-center gap-2 hover:text-slate-200 transition-colors">
                <LogIn size={16} /> Login
              </button>
              {/* Discord */}
              <a
                href="#"
                className="p-1.5 text-slate-400 hover:text-indigo-400 transition-colors rounded-lg hover:bg-slate-800/60"
                title="Join our Discord"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.032.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.461-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
              </a>
            </div>
          </nav>

          {/* Floating Icons Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[20%] left-[15%] opacity-10 rotate-12"><Landmark size={64} /></div>
            <div className="absolute top-[60%] left-[10%] opacity-10 -rotate-12"><Package size={48} /></div>
            <div className="absolute top-[30%] right-[15%] opacity-10 rotate-45"><Zap size={56} /></div>
            <div className="absolute top-[70%] right-[20%] opacity-10 -rotate-12"><Plane size={64} /></div>
            <div className="absolute bottom-[10%] left-[40%] opacity-10 rotate-12"><Dices size={72} /></div>
          </div>


          {/* Main content — switches between landing & inline room browser */}
          <div className="flex-1 flex flex-col overflow-y-auto">
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
                                <span className="text-[9px] font-mono text-slate-600 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">{room.roomId}</span>
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
                  className="flex-1 flex flex-col relative z-10 w-full"
                >
                  {/* Hero / join form — narrow centered column */}
                  <div className="flex flex-col items-center w-full px-4 pt-10 sm:pt-14 pb-6">
                    <div className="w-full max-w-sm flex flex-col items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <Dices size={48} className="text-white drop-shadow-lg mb-1" />
                        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter text-center">
                          RICHUP<span className="text-indigo-500">.IO</span>
                        </h1>
                        <p className="text-slate-400 text-base text-center">Rule the economy</p>
                      </div>

                      <div className="w-full space-y-3 mt-1">
                        <div>
                          <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1.5 text-center">Playing as</p>
                          <input
                            type="text"
                            value={humanName}
                            onChange={(e) => setHumanName(e.target.value)}
                            onFocus={(e) => e.target.select()}
                            className="w-full bg-[#1e1e24] border border-slate-700/50 rounded-xl px-5 py-3.5 text-center text-lg font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600 placeholder:font-normal"
                            placeholder="Enter name"
                          />
                        </div>

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
                              : <><Key size={15} /> Create private</>}
                          </button>
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={joinRoomId}
                            onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                            placeholder="ROOM CODE"
                            maxLength={6}
                            className="flex-1 bg-[#1e1e24] border border-slate-700/50 rounded-xl px-4 py-3 text-center font-mono font-bold text-white focus:outline-none focus:border-indigo-500 uppercase tracking-[0.3em] text-sm"
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

                      {/* Stats row */}
                      <div className="w-full pt-1">
                        <div className="grid grid-cols-3 gap-2.5">
                          {[
                            { value: '8', label: 'Max players' },
                            { value: '10K+', label: 'Games' },
                            { value: 'Free', label: 'Always' },
                          ].map((stat, i) => (
                            <div key={i} className="bg-[#1a1a22] rounded-xl p-3 border border-slate-800/60 text-center">
                              <div className="text-lg font-black text-white">{stat.value}</div>
                              <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">{stat.label}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom section: Features + How To Play side by side */}
                  <div className="w-full max-w-2xl mx-auto px-4 pb-10 grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Features */}
                    <div>
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Zap size={11} /> Features
                      </h3>
                      <div className="flex flex-col gap-2">
                        {[
                          { icon: <Globe size={12} className="text-indigo-400" />, title: 'Online Multiplayer' },
                          { icon: <Bot size={12} className="text-violet-400" />, title: 'Smart AI Bots' },
                          { icon: <Zap size={12} className="text-amber-400" />, title: 'Fast Gameplay' },
                          { icon: <ShieldCheck size={12} className="text-emerald-400" />, title: 'Fair Play' },
                          { icon: <Handshake size={12} className="text-sky-400" />, title: 'Trading' },
                          { icon: <Trophy size={12} className="text-rose-400" />, title: 'Custom Rules' },
                        ].map((feat, i) => (
                          <div key={i} className="flex items-center gap-2 bg-[#1a1a22] rounded-xl px-3 py-2 border border-slate-800/60">
                            <div className="shrink-0">{feat.icon}</div>
                            <p className="text-xs font-bold text-slate-300">{feat.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* How to play */}
                    <div>
                      <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                        <Info size={11} /> How to play
                      </h3>
                      <div className="flex flex-col gap-2">
                        {[
                          { icon: <Coins size={12} className="text-emerald-400" />, title: 'Start with configurable cash' },
                          { icon: <Dices size={12} className="text-indigo-400" />, title: 'Roll & move' },
                          { icon: <Landmark size={12} className="text-amber-400" />, title: 'Buy properties' },
                          { icon: <TrendingUp size={12} className="text-rose-400" />, title: 'Build houses & hotels' },
                          { icon: <Trophy size={12} className="text-amber-400" />, title: 'Last one standing wins' },
                        ].map((step, i) => (
                          <div key={i} className="flex items-center gap-2 bg-[#1a1a22] rounded-xl px-3 py-2 border border-slate-800/60">
                            <span className="text-[9px] font-black text-slate-600 w-3 shrink-0">{i + 1}</span>
                            <div className="shrink-0">{step.icon}</div>
                            <p className="text-xs font-bold text-slate-300">{step.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <footer className="w-full border-t border-slate-800/60 py-5 px-4 sm:px-6 mt-auto">
                    <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
                      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap justify-center">
                        <button onClick={() => setActivePolicyPage('privacy')} className="hover:text-slate-400 transition-colors">Privacy Policy</button>
                        <span className="text-slate-800 hidden sm:inline">·</span>
                        <button onClick={() => setActivePolicyPage('terms')} className="hover:text-slate-400 transition-colors">Terms of Service</button>
                        <span className="text-slate-800 hidden sm:inline">·</span>
                        <button onClick={() => setActivePolicyPage('cookies')} className="hover:text-slate-400 transition-colors">Cookie Policy</button>
                        <span className="text-slate-800 hidden sm:inline">·</span>
                        <button onClick={() => setActivePolicyPage('contact')} className="hover:text-slate-400 transition-colors">Contact</button>
                      </div>
                      <p className="text-[10px] text-slate-700 font-medium">© 2025 RichUp.io · All rights reserved</p>
                    </div>
                  </footer>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
        </>
      );
    }

    // Room Lobby Screen
    return (
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 18 }}
        transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        className="group min-h-screen data-[layout=row]:h-screen bg-[#111116] text-slate-50 flex flex-col data-[layout=row]:flex-row p-1.5 sm:p-2 gap-2 sm:gap-4 relative overflow-y-auto data-[layout=row]:overflow-hidden"
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
        <div className="w-full group-data-[layout=row]:w-64 flex flex-col gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-2 group-data-[layout=row]:order-1">
          {renderShareBox(false)}

          {/* Ad Banner Space */}
          <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-lg flex-1 relative overflow-hidden group min-h-[120px] group-data-[layout=row]:min-h-0">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs text-center relative z-10">Advertisement<br />Space</span>
          </div>

          {/* Chat Box */}
          <div className="hidden group-data-[layout=row]:block">
            {renderChatBox(false)}
          </div>
        </div>

        {/* Center Column: Board */}
        <div className="flex w-full group-data-[layout=row]:flex-1 flex-col items-center justify-center relative z-10 group-data-[layout=row]:overflow-hidden group-data-[layout=row]:h-full p-0 order-first group-data-[layout=row]:order-2">
          <div className="w-full max-w-[660px] group-data-[layout=row]:max-w-none group-data-[layout=row]:w-full group-data-[layout=row]:h-full flex items-center justify-center mx-auto">
            <Board gameState={gameState} onTileClick={() => { }}>
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
                      const activeBots = settings.allowBots ? Math.max(0, settings.maxPlayers - lobbyPlayers.length - kickedBotIds.size) : 0;
                      const totalPlayers = lobbyPlayers.length + activeBots;
                      const canStart = isHost && totalPlayers >= 2;
                      return (
                        <div className="flex flex-col items-center gap-1">
                          <button
                            onClick={() => { if (canStart) handleStartGame(); }}
                            disabled={!canStart}
                            className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-2xl font-black text-2xl transition-all shadow-[0_0_40px_rgba(79,70,229,0.4)] enabled:hover:scale-105 active:scale-95 uppercase tracking-widest border-b-4 border-indigo-800"
                          >
                            {isHost ? 'Start Game' : 'Waiting for Host'}
                          </button>
                          {isHost && totalPlayers < 2 && (
                            <p className="text-[11px] text-rose-400 font-bold">Need at least 2 players to start</p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center gap-3 bg-black/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
                      <Users size={16} className="text-indigo-400" />
                      <span className="text-sm font-bold text-slate-300">{lobbyPlayers.length} / {settings.maxPlayers} Players</span>
                      {settings.allowBots && Math.max(0, settings.maxPlayers - lobbyPlayers.length - kickedBotIds.size) > 0 && (
                        <span className="flex items-center gap-1 text-[10px] text-violet-400 font-bold">
                          <Bot size={11} /> {Math.max(0, settings.maxPlayers - lobbyPlayers.length - kickedBotIds.size)} bots
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </Board>
          </div>
        </div>

        {/* Right Column: Profile & Settings */}
        <div className="w-full group-data-[layout=row]:w-64 flex flex-col gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-3">
          {/* Lobby Players List */}
          <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-5 flex flex-col gap-3 shadow-lg shrink-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                <Users size={13} /> In Lobby
              </h3>
              <span className="text-[10px] font-bold text-slate-600">{lobbyPlayers.length}/{settings.maxPlayers}</span>
            </div>
            {lobbyPlayers.map((player: any) => (
              <div key={player.id} className="flex items-center gap-3">
                <Avatar avatarId={player.avatar ?? 0} className="w-8 h-8 shrink-0" />
                <span className="text-sm font-bold text-slate-200 truncate flex-1">{player.name}</span>
                {player.isHost && <Crown size={13} className="text-amber-400 shrink-0" />}
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
            {/* Bot slots — shown when allowBots is on */}
            {(() => {
              const realCount = lobbyPlayers.length;
              const totalBotSlots = settings.allowBots ? Math.max(0, settings.maxPlayers - realCount) : 0;
              return Array.from({ length: totalBotSlots }, (_, i) => i)
                .filter(i => !kickedBotIds.has(i))
                .map(i => (
                  <div key={`bot-${i}`} className="flex items-center gap-3 opacity-70">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                      <Bot size={14} className="text-violet-400" />
                    </div>
                    <span className="text-sm font-bold text-slate-400 truncate flex-1">{generateBotLobbyName(i)}</span>
                    <span className="text-[8px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded border border-slate-700 font-bold">BOT</span>
                    {isHost && (
                      <button
                        onClick={() => kickBotSlot(i)}
                        className="p-1 text-slate-600 hover:text-rose-400 transition-colors rounded-lg hover:bg-rose-950/30"
                        title="Kick bot"
                      >
                        <UserX size={12} />
                      </button>
                    )}
                  </div>
                ));
            })()}
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
      className="group min-h-screen data-[layout=row]:h-screen bg-[#111116] text-slate-50 flex flex-col data-[layout=row]:flex-row p-1.5 sm:p-2 gap-2 sm:gap-4 relative overflow-y-auto data-[layout=row]:overflow-hidden"
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

      {/* Sound toggle + Leave button */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors backdrop-blur-sm shadow-lg"
          title={soundEnabled ? 'Mute' : 'Unmute'}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      {/* Left Column: Share, Ad Banner & Chat */}
      <div className="w-full group-data-[layout=row]:w-64 flex flex-col gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-2 group-data-[layout=row]:order-1">
        {isOnline && renderShareBox(true)}

        {/* Ad Banner Space */}
        <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-lg flex-1 relative overflow-hidden group min-h-[120px] group-data-[layout=row]:min-h-0">
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
                [...gameState.logs].reverse().map((log, i) => (
                  <div key={i} className={`text-[10px] leading-relaxed px-2 py-1 rounded-lg ${i === 0 ? 'text-indigo-200 bg-indigo-950/50 border border-indigo-900/40' : 'text-slate-400'}`}>
                    {log}
                  </div>
                ))
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
          className="w-full max-w-[660px] group-data-[layout=row]:max-w-none group-data-[layout=row]:w-full group-data-[layout=row]:h-full flex items-center justify-center mx-auto"
        >
          <Board gameState={gameState} onTileClick={handleTileClick}>
            <Controls
              gameState={gameState}
              myPlayerId={myPlayerId}
              logs={gameState.logs}
              onRoll={() => handleDispatch({ type: 'ROLL_DICE' })}
              onBuy={() => handleDispatch({ type: 'BUY_PROPERTY' })}
              onEndTurn={() => handleDispatch({ type: 'END_TURN' })}
              onUpgrade={tileId => handleDispatch({ type: 'UPGRADE_PROPERTY', payload: { tileId } })}
              onOpenProperty={handleTileClick}
              onTrade={(offer, targetTileId) =>
                handleDispatch({ type: 'PROPOSE_TRADE', payload: { proposerId: myPlayerId, offerCash: offer.cash, offerPropertyIds: offer.properties, targetTileId, requestCash: offer.requestCash } })
              }
              dispatch={handleDispatch}
              onViewPlayer={id => setViewingPlayerId(id)}
            />
          </Board>
        </motion.div>
      </div>

      {/* Right Column: Players, Actions & Properties */}
      <div className="w-full group-data-[layout=row]:w-64 flex flex-col gap-3 shrink-0 z-10 group-data-[layout=row]:h-full order-3 group-data-[layout=row]:overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">

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
                <div className="relative">
                  <Avatar
                    avatarId={player.avatarId}
                    color={player.color}
                    isBankrupt={player.isBankrupt}
                    inJail={player.inJail}
                    className={`w-9 h-9 shadow-lg ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#111116]' : ''}`}
                  />
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
                      const secondsLeft = Math.max(0, 120 - Math.floor((nowTs - (player as any).disconnectedAt) / 1000));
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
                    handleDispatch({ type: 'VOTE_KICK', payload: { targetId: turnPlayer.id, voterId: myPlayerId } });
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
              {gameState.pendingTrade?.targetId === myPlayerId && (
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
              <div className="text-[10px] text-indigo-300 font-bold">
                Trade offer from {gameState.players.find(p => p.id === gameState.pendingTrade?.proposerId)?.name}
              </div>
              <div className="text-[9px] text-slate-400">
                {gameState.pendingTrade.offerCash > 0 && <span className="text-emerald-400">+${gameState.pendingTrade.offerCash} cash</span>}
                {gameState.pendingTrade.requestCash > 0 && <span className="text-rose-400 ml-1">-${gameState.pendingTrade.requestCash} cash</span>}
              </div>
              <div className="flex gap-1.5">
                <Button size="sm" onClick={() => handleDispatch({ type: 'ACCEPT_TRADE' })} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] h-7">
                  Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDispatch({ type: 'DECLINE_TRADE' })} className="flex-1 border-slate-700 text-slate-300 text-[10px] h-7">
                  Decline
                </Button>
              </div>
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
                  <span className="text-[9px] font-mono text-slate-500 shrink-0">${prop.price}</span>
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

      <AnimatePresence>
        {selectedTileId !== null && (
          <PropertyModal
            tile={gameState.tiles[selectedTileId]}
            owner={gameState.players.find(p => p.id === gameState.tiles[selectedTileId].ownerId)}
            onClose={() => setSelectedTileId(null)}
            onUpgrade={() => dispatch({ type: 'UPGRADE_PROPERTY', payload: { tileId: selectedTileId } })}
            canUpgrade={(gameState.phase === 'TURN_END' || gameState.phase === 'ACTION') && gameState.tiles[selectedTileId].ownerId === myPlayerId}
            currentPlayer={gameState.players.find(p => p.id === myPlayerId)}
            myProperties={myProperties}
            onTrade={offer =>
              handleDispatch({ type: 'PROPOSE_TRADE', payload: { proposerId: myPlayerId, offerCash: offer.cash, offerPropertyIds: offer.properties, targetTileId: selectedTileId, requestCash: offer.requestCash } })
            }
            onMortgage={() => handleDispatch({ type: 'MORTGAGE_PROPERTY', payload: { tileId: selectedTileId } })}
            onUnmortgage={() => handleDispatch({ type: 'UNMORTGAGE_PROPERTY', payload: { tileId: selectedTileId } })}
            onSell={() => handleDispatch({ type: 'SELL_PROPERTY', payload: { tileId: selectedTileId } })}
          />
        )}

        {viewingPlayerId !== null && gameState.players.find(p => p.id === viewingPlayerId) && (
          <PlayerPortfolioModal
            player={gameState.players.find(p => p.id === viewingPlayerId)!}
            tiles={gameState.tiles}
            onClose={() => setViewingPlayerId(null)}
          />
        )}

        <CreateTradeModal
          isOpen={showCreateTradeModal}
          onClose={() => setShowCreateTradeModal(false)}
          players={gameState.players}
          tiles={gameState.tiles}
          myPlayerId={myPlayerId}
          onTrade={(offerCash, offerPropertyIds, targetTileId, requestCash) => {
            handleDispatch({ type: 'PROPOSE_TRADE', payload: { proposerId: myPlayerId, offerCash, offerPropertyIds, targetTileId, requestCash } });
          }}
        />

        {gameState.pendingTrade && gameState.pendingTrade.targetId === myPlayerId &&
         gameState.players.some(p => p.id === gameState.pendingTrade?.proposerId && !p.isBankrupt) && (
          <TradeProposalModal
            trade={gameState.pendingTrade}
            players={gameState.players}
            tiles={gameState.tiles}
            myPlayerId={myPlayerId}
            onAccept={() => handleDispatch({ type: 'ACCEPT_TRADE' })}
            onDecline={() => handleDispatch({ type: 'DECLINE_TRADE' })}
          />
        )}

        <AuctionModal
          gameState={gameState}
          myPlayerId={myPlayerId}
          dispatch={handleDispatch}
        />

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
      </AnimatePresence>
    </motion.div>
  );
};

export default App;