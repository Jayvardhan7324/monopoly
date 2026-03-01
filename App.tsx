import React, { useReducer, useEffect, useState, useRef, useCallback } from 'react';
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
  TrendingUp, Landmark, ShoppingCart, LogIn, Package, Zap, Plane
} from 'lucide-react';
import { playSound } from './services/audioService';
import {
  INITIAL_TILES,
  PLAYER_COLORS,
} from './constants';
import { Avatar, APPEARANCE_COLORS } from './components/Avatar';
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

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [spectatorMode, setSpectatorMode] = useState(false);
  const [humanName, setHumanName] = useState('Player 1');

  // Multiplayer state
  const [isOnline, setIsOnline] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  // BUG-FIX: isHost stored in ref to avoid stale closures inside socket callbacks
  const [isHost, setIsHost] = useState(false);
  const isHostRef = useRef(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<any[]>([]);
  const [joinRoomId, setJoinRoomId] = useState('');
  const [myPlayerId, setMyPlayerId] = useState<number>(0);
  const [selectedAvatar, setSelectedAvatar] = useState(11);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);

  // BUG-FIX: Responsive layout — mobile/tablet: stacked (board full-width top, rest below)
  // Desktop (>= 1024px): 3-column row layout matching reference screenshot
  const [isStacked, setIsStacked] = useState(false);

  useEffect(() => {
    const checkLayout = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      setIsStacked(width < height + 688 || width < 1024);
    };
    checkLayout();
    window.addEventListener('resize', checkLayout);
    return () => window.removeEventListener('resize', checkLayout);
  }, []);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // BUG-FIX: Guard against duplicate bot bid timers
  const botBidFiringRef = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room) {
      setJoinRoomId(room.toUpperCase());
    }
  }, []);

  // BUG-FIX: keep isHostRef in sync so socket handlers always read fresh value
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  const sfx = useCallback((type: Parameters<typeof playSound>[0]) => {
    if (soundEnabled) playSound(type);
  }, [soundEnabled]);

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
        const newIsHost = me.isHost;
        setIsHost(newIsHost);
        isHostRef.current = newIsHost;
        setMyPlayerId(data.players.indexOf(me));
      }
    };

    const handleGameStarted = (data: any) => {
      if (data.state) {
        dispatch({ type: 'SYNC_STATE', payload: data.state });
        setGameStarted(true);
      }
    };

    // BUG-FIX: Use isHostRef instead of isHost to avoid stale closure
    const handleHostProcessAction = (action: any) => {
      if (isHostRef.current) {
        dispatch(action);
      }
    };

    const handleSyncState = (data: any) => {
      if (!isHostRef.current && data.state) {
        dispatch({ type: 'SYNC_STATE', payload: data.state });
        setGameStarted(true);
      }
    };

    const handleSettingsUpdated = (newSettings: any) => {
      setSettings(newSettings);
    };

    const handleKicked = () => {
      setIsOnline(false);
      setRoomId(null);
      setLobbyPlayers([]);
      setIsHost(false);
      isHostRef.current = false;
      alert('You have been kicked from the room.');
    };

    const handleChatMessage = (data: any) => {
      setChatMessages(prev => [...prev, data]);
    };

    socket.on('room_updated', handleRoomUpdated);
    socket.on('game_started', handleGameStarted);
    socket.on('host_process_action', handleHostProcessAction);
    socket.on('sync_state', handleSyncState);
    socket.on('settings_updated', handleSettingsUpdated);
    socket.on('kicked', handleKicked);
    socket.on('chat_message', handleChatMessage);

    return () => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('game_started', handleGameStarted);
      socket.off('host_process_action', handleHostProcessAction);
      socket.off('sync_state', handleSyncState);
      socket.off('settings_updated', handleSettingsUpdated);
      socket.off('kicked', handleKicked);
      socket.off('chat_message', handleChatMessage);
    };
    // BUG-FIX: Removed isHost from deps — we use isHostRef inside handlers instead.
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Sync state to clients if host
  useEffect(() => {
    if (isOnline && isHost && gameStarted) {
      const stablePhases = ['ROLL', 'TURN_END', 'AUCTION', 'ACTION'];
      if (!stablePhases.includes(gameState.phase)) return;

      const socket = getSocket();
      if (socket) {
        const timeoutId = setTimeout(() => {
          socket.emit('sync_state', { state: gameState });
        }, 0);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [gameState, isOnline, isHost, gameStarted]);

  // Intercept dispatch for online play
  const handleDispatch = useCallback((action: any) => {
    if (isOnline && !isHostRef.current) {
      const socket = getSocket();
      if (socket) {
        socket.emit('game_action', action);
      }
    } else {
      dispatch(action);
    }
  }, [isOnline]);

  // ── Phase auto-transitions ─────────────────────────────────────────────────
  useEffect(() => {
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
  }, [gameState.phase, gameStarted, gameState.winnerId, gameState.currentPlayerIndex, handleDispatch]);

  // ── Auction timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState.phase !== 'AUCTION' || !gameState.auction || gameState.winnerId !== null) return;
    if (isOnline && !isHostRef.current) return;

    if (gameState.auction.timer > 0) {
      const interval = setInterval(() => handleDispatch({ type: 'DECREMENT_AUCTION_TIMER' }), 1000);
      return () => clearInterval(interval);
    } else {
      handleDispatch({ type: 'END_AUCTION' });
    }
  }, [gameState.phase, gameState.auction?.timer, gameState.winnerId, isOnline, handleDispatch]);

  // ── Bot main actions ───────────────────────────────────────────────────────
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameStarted || !currentPlayer?.isBot || gameState.winnerId !== null) return;
    if (isOnline && !isHostRef.current) return;

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
  }, [gameState.phase, gameState.currentPlayerIndex, gameStarted, gameState.winnerId, isOnline, handleDispatch]);

  // ── Bot auction bids ───────────────────────────────────────────────────────
  useEffect(() => {
    if (gameState.phase !== 'AUCTION' || !gameState.auction || gameState.winnerId !== null) return;
    if (isOnline && !isHostRef.current) return;
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
  }, [gameState.phase, gameState.auction?.timer, gameState.auction?.highestBidderId, gameState.winnerId, isOnline, handleDispatch]);

  const handleStartGame = () => {
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

    dispatch(action as any);
    setGameStarted(true);

    if (isOnline && isHost) {
      const socket = getSocket();
      if (socket) {
        socket.emit('start_game', { initialState: null });
      }
    }
  };

  const createRoom = () => {
    const socket = getSocket() ?? initSocket();
    if (socket) {
      socket.emit('create_room', { name: humanName, avatar: selectedAvatar }, (res: any) => {
        if (res.success) {
          setIsOnline(true);
          setRoomId(res.roomId);
          setIsHost(true);
          isHostRef.current = true;
          setLobbyPlayers(res.players);
        }
      });
    }
  };

  const joinRoom = () => {
    if (!joinRoomId) return;
    const socket = getSocket() ?? initSocket();
    if (socket) {
      socket.emit('join_room', { roomId: joinRoomId, name: humanName, avatar: selectedAvatar }, (res: any) => {
        if (res.success) {
          setIsOnline(true);
          setRoomId(res.roomId);
          setIsHost(false);
          isHostRef.current = false;
          setLobbyPlayers(res.players);
        } else {
          alert(res.error);
        }
      });
    }
  };

  const joinRandomRoom = () => {
    const socket = getSocket() ?? initSocket();
    const payload = { name: humanName, avatar: selectedAvatar };

    if (!socket) {
      // BUG-FIX: Fall back to local single-player instead of just alerting
      handleStartGame();
      return;
    }

    socket.timeout(3000).emit('join_random_room', payload, (joinErr: any, joinRes: any) => {
      if (!joinErr && joinRes?.success) {
        setIsOnline(true);
        setRoomId(joinRes.roomId);
        const meIsHost = joinRes.players.find((p: any) => p.id === socket.id)?.isHost || false;
        setIsHost(meIsHost);
        isHostRef.current = meIsHost;
        setLobbyPlayers(joinRes.players);
        return;
      }

      socket.timeout(3000).emit('create_room', payload, (createErr: any, createRes: any) => {
        if (!createErr && createRes?.success) {
          setIsOnline(true);
          setRoomId(createRes.roomId);
          setIsHost(true);
          isHostRef.current = true;
          setLobbyPlayers(createRes.players);
          return;
        }

        // BUG-FIX: If server unreachable, start a local game instead of hard error
        handleStartGame();
      });
    });
  };

  const updateRule = (key: keyof typeof settings.rules, value: any) => {
    const newSettings = { ...settings, rules: { ...settings.rules, [key]: value } };
    setSettings(newSettings);
    if (isOnline && isHost) {
      getSocket()?.emit('update_settings', { settings: newSettings });
    }
  };

  const updateGeneralSetting = (key: keyof GameSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    if (isOnline && isHost) {
      getSocket()?.emit('update_settings', { settings: newSettings });
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
      socket.emit('send_chat', msg);
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

  // ── Chat Box ───────────────────────────────────────────────────────────────
  const renderChatBox = (isMobilePopup = false) => (
    <div className={`bg-[#1e1e24] rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-lg ${isMobilePopup ? 'w-80 h-96' : 'h-72 shrink-0'}`}>
      <div className="p-3 border-b border-slate-800 flex items-center justify-between text-slate-300 shrink-0">
        <div className="flex items-center gap-2 font-medium">
          <MessageSquare size={14} className="text-indigo-400" />
          <span className="font-bold text-sm">Chat</span>
        </div>
        {isMobilePopup && (
          <button onClick={() => setShowMobileChat(false)} className="text-slate-400 hover:text-white transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
        {chatMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 opacity-50">
            <MessageSquare size={24} />
            <span>No messages yet</span>
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-400">{msg.sender}</span>
                <span className="text-[9px] text-slate-500">{msg.time}</span>
              </div>
              <div className="bg-slate-800/50 rounded-lg px-2 py-1.5 text-xs text-slate-200 break-words">
                {msg.text}
              </div>
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
            placeholder="Type a message..."
            className="w-full bg-[#111116] border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 pr-8"
          />
          <button
            onClick={sendChatMessage}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Share Box ──────────────────────────────────────────────────────────────
  const renderShareBox = (showSettingsButton = false) => (
    <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-4 flex flex-col gap-2.5 shadow-lg shrink-0">
      <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
        Share this game <Info size={12} className="text-slate-500" />
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-[#111116] px-2.5 py-1.5 rounded-xl text-xs font-mono text-slate-300 select-all border border-slate-800 truncate">
          https://richup.io/{roomId}
        </div>
        <button
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('room', roomId || '');
            navigator.clipboard.writeText(url.toString());
          }}
          className="bg-indigo-500 hover:bg-indigo-400 p-1.5 rounded-xl text-white transition-colors flex items-center gap-1.5 px-2.5 text-xs font-bold shadow-lg shadow-indigo-500/20"
        >
          <Copy size={14} /> Copy
        </button>
      </div>
      {showSettingsButton && (
        <button
          onClick={() => setShowSettingsModal(true)}
          className="mt-1 w-full bg-slate-800 hover:bg-slate-700 p-1.5 rounded-xl text-slate-300 transition-colors flex items-center justify-center gap-2 text-xs font-bold"
        >
          <Settings size={14} /> View room settings
        </button>
      )}
    </div>
  );

  // ── Game Settings ──────────────────────────────────────────────────────────
  const renderGameSettings = () => (
    <div className="space-y-5 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
      {/* Maximum Players */}
      <div className="flex gap-3">
        <Users size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">Maximum players</div>
          <div className="text-[9px] text-slate-500 mb-1.5 uppercase font-black tracking-wider">How many players can join the game</div>
          <select
            disabled={!isHost || gameStarted}
            value={settings.maxPlayers}
            onChange={(e) => updateGeneralSetting('maxPlayers', parseInt(e.target.value))}
            className="w-full bg-[#111116] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-bold"
          >
            {[2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      </div>

      {/* Private Room */}
      <div className="flex gap-3 items-start">
        <Lock size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">Private room</div>
          <div className="text-[9px] text-slate-500 mb-1.5 uppercase font-black tracking-wider">Private rooms can be accessed using the room URL only</div>
        </div>
        <Switch
          disabled={!isHost || gameStarted}
          checked={settings.isPrivate}
          onCheckedChange={(checked) => updateGeneralSetting('isPrivate', checked)}
        />
      </div>

      {/* Allow Bots */}
      <div className="flex gap-3 items-start">
        <Bot size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200 flex items-center gap-2">
            Allow bots to join
            <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded-full border border-indigo-500/30 font-black">Beta</span>
          </div>
          <div className="text-[9px] text-slate-500 mb-1.5 uppercase font-black tracking-wider">Bots will join the game based on availability</div>
        </div>
        <Switch
          disabled={!isHost || gameStarted}
          checked={settings.allowBots}
          onCheckedChange={(checked) => updateGeneralSetting('allowBots', checked)}
        />
      </div>

      {/* Divider: Gameplay Rules */}
      <div className="pt-1 border-t border-slate-800">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Gameplay rules</p>
      </div>

      {/* Board Map */}
      <div className="flex gap-3 items-start">
        <Globe size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">Board map</div>
          <div className="text-[9px] text-slate-500 mb-0.5 uppercase font-black tracking-wider">Change map tiles, properties and stacks</div>
          <div className="text-right mt-1">
            <div className="text-xs font-bold text-slate-200">{settings.boardMap}</div>
            <button className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold">Browse maps &gt;</button>
          </div>
        </div>
      </div>

      {/* x2 rent on full-set */}
      <div className="flex gap-3 items-start">
        <Landmark size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">x2 rent on full-set properties</div>
          <div className="text-[9px] text-slate-500 mb-0 uppercase font-black tracking-wider">If a player owns a full property set, the base rent payment will be doubled</div>
        </div>
        <Switch
          disabled={!isHost || gameStarted}
          checked={settings.rules.doubleRentOnFullSet}
          onCheckedChange={(checked) => updateRule('doubleRentOnFullSet', checked)}
        />
      </div>

      {/* Vacation Cash */}
      <div className="flex gap-3 items-start">
        <Plane size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">Vacation cash</div>
          <div className="text-[9px] text-slate-500 mb-0 uppercase font-black tracking-wider">If a player lands on Vacation, all tax pool is awarded</div>
        </div>
        <Switch
          disabled={!isHost || gameStarted}
          checked={settings.rules.vacationCash}
          onCheckedChange={(checked) => updateRule('vacationCash', checked)}
        />
      </div>

      {/* Auction */}
      <div className="flex gap-3 items-start">
        <LayoutGrid size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">Auction enabled</div>
          <div className="text-[9px] text-slate-500 mb-0 uppercase font-black tracking-wider">Bidding system for unclaimed properties</div>
        </div>
        <Switch
          disabled={!isHost || gameStarted}
          checked={settings.rules.auctionEnabled}
          onCheckedChange={(checked) => updateRule('auctionEnabled', checked)}
        />
      </div>

      {/* No rent in jail */}
      <div className="flex gap-3 items-start">
        <ShieldCheck size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">No rent in jail</div>
          <div className="text-[9px] text-slate-500 mb-0 uppercase font-black tracking-wider">Jailed players don't collect rent</div>
        </div>
        <Switch
          disabled={!isHost || gameStarted}
          checked={settings.rules.noRentInJail}
          onCheckedChange={(checked) => updateRule('noRentInJail', checked)}
        />
      </div>

      {/* Mortgage */}
      <div className="flex gap-3 items-start">
        <Landmark size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">Mortgage enabled</div>
          <div className="text-[9px] text-slate-500 mb-0 uppercase font-black tracking-wider">Financial loans against properties</div>
        </div>
        <Switch
          disabled={!isHost || gameStarted}
          checked={settings.rules.mortgageEnabled}
          onCheckedChange={(checked) => updateRule('mortgageEnabled', checked)}
        />
      </div>

      {/* Even Building */}
      <div className="flex gap-3 items-start">
        <Copy size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">Even building</div>
          <div className="text-[9px] text-slate-500 mb-0 uppercase font-black tracking-wider">Buildings must be built evenly across a set</div>
        </div>
        <Switch
          disabled={!isHost || gameStarted}
          checked={settings.rules.evenBuild}
          onCheckedChange={(checked) => updateRule('evenBuild', checked)}
        />
      </div>

      {/* Starting Cash */}
      <div className="flex gap-3">
        <TrendingUp size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">Starting cash</div>
          <div className="text-[9px] text-slate-500 mb-1.5 uppercase font-black tracking-wider">Initial funds per player</div>
          <select
            disabled={!isHost || gameStarted}
            value={settings.rules.startingCash}
            onChange={(e) => updateRule('startingCash', parseInt(e.target.value))}
            className="w-full bg-[#111116] border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-bold"
          >
            {[1000, 1500, 2000, 2500, 3000].map(n => <option key={n} value={n}>${n}</option>)}
          </select>
        </div>
      </div>

      {/* Randomize Order */}
      <div className="flex gap-3 items-start">
        <Dices size={16} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-xs font-bold text-slate-200">Randomize order</div>
          <div className="text-[9px] text-slate-500 mb-0 uppercase font-black tracking-wider">Shuffle turn order at game start</div>
        </div>
        <Switch
          disabled={!isHost || gameStarted}
          checked={settings.rules.randomizeOrder}
          onCheckedChange={(checked) => updateRule('randomizeOrder', checked)}
        />
      </div>
    </div>
  );

  // ── Start Screen ────────────────────────────────────────────────────────────
  if (!gameStarted) {
    if (!isOnline) {
      return (
        <div className="min-h-screen bg-[#111116] text-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
          {/* Top Left: Sound Toggle */}
          <div className="absolute top-4 left-4 z-50">
            <button onClick={() => setSoundEnabled(!soundEnabled)} className="p-2 text-slate-400 hover:text-slate-200">
              {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          </div>
          {/* Top Right: Store and Login */}
          <div className="absolute top-4 right-4 z-50 flex items-center gap-6 text-slate-400 font-medium">
            <button className="flex items-center gap-2 hover:text-slate-200"><ShoppingCart size={18} /> Store</button>
            <button className="flex items-center gap-2 hover:text-slate-200"><LogIn size={18} /> Login</button>
          </div>

          {/* Floating Icons Background */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div className="absolute top-[20%] left-[15%] opacity-10 rotate-12"><Landmark size={64} /></div>
            <div className="absolute top-[60%] left-[10%] opacity-10 -rotate-12"><Package size={48} /></div>
            <div className="absolute top-[30%] right-[15%] opacity-10 rotate-45"><Zap size={56} /></div>
            <div className="absolute top-[70%] right-[20%] opacity-10 -rotate-12"><Plane size={64} /></div>
            <div className="absolute bottom-[10%] left-[40%] opacity-10 rotate-12"><Dices size={72} /></div>
          </div>

          <div className="relative z-10 flex flex-col items-center w-full max-w-md">
            <div className="mb-4">
              <Dices size={64} className="text-white drop-shadow-lg" />
            </div>
            <h1 className="text-6xl font-black tracking-tighter mb-1">
              RICHUP<span className="text-indigo-500">.IO</span>
            </h1>
            <p className="text-slate-400 text-lg mb-12">Rule the economy</p>

            <div className="w-full space-y-4">
              <input
                type="text"
                value={humanName}
                onChange={(e) => setHumanName(e.target.value)}
                className="w-full bg-[#1e1e24] border border-slate-700/50 rounded-xl px-6 py-4 text-center text-xl font-bold text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder="Player 1"
              />

              <button
                onClick={joinRandomRoom}
                className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold text-xl flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              >
                <ChevronsRight size={24} /> Play
              </button>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setShowJoinInput(!showJoinInput)}
                  className="flex-1 py-3 bg-[#2a2a35] hover:bg-[#323240] text-slate-200 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Users size={18} /> All rooms
                </button>
                <button
                  onClick={createRoom}
                  className="flex-1 py-3 bg-[#2a2a35] hover:bg-[#323240] text-slate-200 rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Key size={18} /> Create a private game
                </button>
              </div>

              {showJoinInput && (
                <div className="flex gap-2 pt-2 animate-in fade-in slide-in-from-top-2">
                  <input
                    type="text"
                    value={joinRoomId}
                    onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                    placeholder="ROOM CODE"
                    maxLength={6}
                    className="flex-1 bg-[#1e1e24] border border-slate-700/50 rounded-xl px-4 py-3 text-center font-mono font-bold text-white focus:outline-none focus:border-indigo-500 uppercase"
                  />
                  <button
                    onClick={joinRoom}
                    disabled={!joinRoomId}
                    className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 text-white rounded-xl font-bold transition-colors"
                  >
                    Join
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ── Room Lobby Screen ────────────────────────────────────────────────────
    return (
      <div
        className="group min-h-screen bg-[#111116] text-slate-50 flex p-0 relative overflow-hidden"
        data-layout={isStacked ? 'stacked' : 'row'}
      >
        {/* ── STACKED (mobile/tablet) layout ── */}
        {isStacked ? (
          <div className="w-full flex flex-col overflow-y-auto">
            {/* Board takes full width on mobile */}
            <div className="w-full aspect-square relative">
              <Board gameState={gameState} onTileClick={() => {}}>
                <div className="flex-1 flex flex-col items-center justify-center gap-4">
                  <h2 className="text-3xl font-black text-white tracking-tighter drop-shadow-2xl text-center">
                    LOBBY <span className="text-indigo-500">{roomId}</span>
                  </h2>
                  <p className="text-slate-400 font-medium text-sm">Waiting for players...</p>
                  <button
                    onClick={() => { if (isHost) handleStartGame(); }}
                    disabled={!isHost && lobbyPlayers.length < 2}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black text-lg transition-all shadow-[0_0_30px_rgba(79,70,229,0.4)] uppercase tracking-widest border-b-4 border-indigo-800"
                  >
                    {isHost ? 'Start Game' : 'Waiting for Host'}
                  </button>
                  <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                    <Users size={14} className="text-indigo-400" />
                    <span className="text-xs font-bold text-slate-300">{lobbyPlayers.length} / {settings.maxPlayers}</span>
                  </div>
                </div>
              </Board>
            </div>

            {/* Content below board on mobile */}
            <div className="flex flex-col gap-3 p-4">
              {renderShareBox(false)}

              {/* Avatar Picker */}
              <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-4 flex flex-col gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <Avatar avatarId={selectedAvatar} className="w-12 h-12 shadow-2xl ring-2 ring-indigo-500/50" />
                  <div>
                    <div className="font-bold text-white flex items-center gap-2">
                      {humanName} {isHost && <Crown size={14} className="text-amber-400" />}
                    </div>
                    <button
                      onClick={() => setSelectedAvatar((selectedAvatar + 1) % APPEARANCE_COLORS.length)}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300"
                    >Change appearance</button>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {APPEARANCE_COLORS.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedAvatar(idx);
                        getSocket()?.emit('update_player', { avatar: idx });
                      }}
                      className={`aspect-square rounded-full transition-all ${selectedAvatar === idx ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#1e1e24] scale-110' : 'hover:scale-110 opacity-40 hover:opacity-100'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Ad space */}
              <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-4 flex items-center justify-center h-20">
                <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">advertisement</span>
              </div>

              {/* Game Settings */}
              <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-4 shadow-lg">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                  <Settings size={14} /> Game Settings
                </h3>
                {renderGameSettings()}
              </div>
            </div>
          </div>
        ) : (
          /* ── ROW (desktop) layout — matches reference screenshot ── */
          <div className="w-full h-screen flex flex-row gap-0">
            {/* Left Column: Share + Ad + Chat */}
            <div className="w-72 flex flex-col gap-3 shrink-0 p-4 h-full overflow-y-auto border-r border-slate-800/50">
              {renderShareBox(false)}
              <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-4 flex items-center justify-center flex-1 min-h-[100px] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
                <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs text-center">advertisement</span>
              </div>
              {renderChatBox(false)}
            </div>

            {/* Center: Board */}
            <div className="flex-1 flex items-center justify-center p-4 h-full overflow-hidden">
              <Board gameState={gameState} onTileClick={() => {}}>
                <div className="flex-1 flex flex-col items-center justify-center gap-6">
                  <div className="text-center">
                    <h2 className="text-4xl font-black text-white tracking-tighter mb-2 drop-shadow-2xl">
                      LOBBY <span className="text-indigo-500">{roomId}</span>
                    </h2>
                    <p className="text-slate-400 font-medium">Waiting for players to join...</p>
                  </div>
                  <button
                    onClick={() => { if (isHost) handleStartGame(); }}
                    disabled={!isHost && lobbyPlayers.length < 2}
                    className="px-12 py-5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-2xl font-black text-2xl transition-all shadow-[0_0_40px_rgba(79,70,229,0.4)] hover:scale-105 active:scale-95 uppercase tracking-widest border-b-4 border-indigo-800"
                  >
                    {isHost ? 'Start Game' : 'Waiting for Host'}
                  </button>
                  <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
                    <Users size={16} className="text-indigo-400" />
                    <span className="text-sm font-bold text-slate-300">{lobbyPlayers.length} / {settings.maxPlayers} Players</span>
                  </div>
                </div>
              </Board>
            </div>

            {/* Right Column: Profile + Settings */}
            <div className="w-72 flex flex-col gap-3 shrink-0 p-4 h-full overflow-y-auto border-l border-slate-800/50">
              {/* "Waiting for players..." banner */}
              <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-3 text-center text-slate-400 text-xs font-bold">
                Waiting for players...
              </div>

              {/* User Profile Box */}
              <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-4 flex flex-col gap-3 shadow-lg shrink-0">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar avatarId={selectedAvatar} className="w-14 h-14 shadow-2xl ring-2 ring-indigo-500/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white truncate flex items-center gap-2">
                      {humanName}
                      {isHost && <Crown size={14} className="text-amber-400" />}
                    </div>
                    <button
                      onClick={() => setSelectedAvatar((selectedAvatar + 1) % APPEARANCE_COLORS.length)}
                      className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
                    >
                      Change appearance
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {APPEARANCE_COLORS.map((color, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedAvatar(idx);
                        getSocket()?.emit('update_player', { avatar: idx });
                      }}
                      className={`aspect-square rounded-full transition-all ${selectedAvatar === idx ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#1e1e24] scale-110' : 'hover:scale-110 opacity-40 hover:opacity-100'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Game Settings */}
              <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-4 flex-1 overflow-hidden flex flex-col shadow-lg">
                <h3 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 shrink-0 flex items-center gap-2">
                  <Settings size={14} /> Game Settings
                </h3>
                {renderGameSettings()}
              </div>
            </div>
          </div>
        )}

        {/* Mobile Chat FAB */}
        {isStacked && (
          <div className="fixed bottom-4 right-4 z-[60]">
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
        )}
      </div>
    );
  }

  // ── Game Screen ─────────────────────────────────────────────────────────────
  const myProperties = gameState.tiles.filter(t => t.ownerId === myPlayerId);

  return (
    <div
      className="group min-h-screen bg-[#111116] text-slate-50 relative"
      data-layout={isStacked ? 'stacked' : 'row'}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950 pointer-events-none fixed" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none fixed" />

      {/* Sound toggle */}
      <div className="absolute top-3 right-3 z-50 fixed">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors backdrop-blur-sm shadow-lg"
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
      </div>

      {isStacked ? (
        /* ── STACKED Game Layout (mobile/tablet) ── */
        <div className="flex flex-col w-full overflow-y-auto">
          {/* Board takes full width on mobile */}
          <div className="w-full aspect-square relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full h-full"
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
                  onViewPlayer={setViewingPlayerId}
                />
              </Board>
            </motion.div>
          </div>

          {/* Below board: all UI elements */}
          <div className="flex flex-col gap-3 p-4 relative z-10">
            {/* Share box */}
            {renderShareBox(true)}

            {/* Players */}
            <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-3 flex flex-col gap-2 shadow-lg">
              {gameState.players.map(player => {
                const isActive = gameState.currentPlayerIndex === gameState.players.indexOf(player);
                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => setViewingPlayerId(player.id)}
                    className={`relative flex items-center gap-2.5 bg-[#111116] border p-2.5 rounded-xl shadow-md cursor-pointer transition-all duration-300 ${isActive ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-slate-800'} ${player.isBankrupt ? 'opacity-40 grayscale' : ''}`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-indicator-mobile"
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)] z-30"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
                    )}
                    <Avatar avatarId={player.avatarId} color={player.color} isBankrupt={player.isBankrupt} inJail={player.inJail} className="w-8 h-8" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black text-slate-200 truncate">{player.name}</div>
                      <div className="text-xs font-mono font-bold text-emerald-400">${player.money}</div>
                    </div>
                    {player.isBot && <span className="text-[8px] bg-slate-800 text-slate-500 px-1 rounded border border-slate-700">AI</span>}
                  </motion.div>
                );
              })}
            </div>

            {/* Logs */}
            <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-3 shadow-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={13} className="text-indigo-400" />
                <span className="font-black text-[9px] text-slate-400 uppercase tracking-widest">Protocol Feed</span>
                <span className="ml-auto font-mono text-[9px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">T-{gameState.turnCount}</span>
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
                {gameState.logs.map((log, i) => (
                  <div key={i} className={`text-[10px] font-bold leading-relaxed pl-2 ${i === 0 ? 'text-indigo-300 border-l-2 border-indigo-500' : 'text-slate-500 opacity-60'}`}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Ad */}
            <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-4 flex items-center justify-center h-20">
              <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs">advertisement</span>
            </div>
          </div>

          {/* Mobile Chat FAB */}
          <div className="fixed bottom-4 right-4 z-[60]">
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
        </div>
      ) : (
        /* ── ROW Game Layout (desktop) — matches reference screenshot ── */
        <div className="w-full h-screen flex flex-row">
          {/* Left Column: Share + Ad + Chat */}
          <div className="w-72 shrink-0 flex flex-col gap-3 p-4 h-full overflow-hidden border-r border-slate-800/50 relative z-10">
            {renderShareBox(false)}

            <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl flex items-center justify-center flex-1 min-h-0 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5" />
              <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs text-center">advertisement</span>
            </div>

            {renderChatBox(false)}
          </div>

          {/* Center: Board */}
          <div className="flex-1 flex items-center justify-center p-4 h-full overflow-hidden relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full h-full flex items-center justify-center"
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
                  onViewPlayer={setViewingPlayerId}
                />
              </Board>
            </motion.div>
          </div>

          {/* Right Column: Players + Logs */}
          <div className="w-72 shrink-0 flex flex-col gap-3 p-4 h-full overflow-hidden border-l border-slate-800/50 relative z-10">
            {/* Players List */}
            <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-3 flex flex-col gap-2 shadow-lg shrink-0 max-h-[45%] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
              {gameState.players.map(player => {
                const isActive = gameState.currentPlayerIndex === gameState.players.indexOf(player);
                return (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setViewingPlayerId(player.id)}
                    className={`relative flex items-center gap-2.5 bg-[#111116] border p-2.5 rounded-xl shadow-md cursor-pointer transition-all duration-300 ${isActive ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-slate-800 hover:border-slate-700'} ${player.isBankrupt ? 'opacity-40 grayscale' : ''}`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-indicator"
                        className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)] z-30"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                      />
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
                        <span className={`text-[10px] font-black uppercase truncate ${isActive ? 'text-indigo-300' : 'text-slate-200'}`}>
                          {player.name}
                        </span>
                        {player.isBot && <span className="text-[7px] bg-slate-800 text-slate-500 px-1 rounded border border-slate-700 shrink-0">AI</span>}
                      </div>
                      <span className={`font-mono text-xs font-bold ${player.isBankrupt ? 'text-slate-600' : 'text-emerald-400'}`}>
                        ${player.money}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Protocol Feed */}
            <div className="flex-1 bg-[#1e1e24] rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-lg min-h-0">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between text-slate-300 shrink-0">
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} className="text-indigo-400" />
                  <span className="font-black text-[9px] text-slate-400 uppercase tracking-widest">Protocol Feed</span>
                </div>
                <span className="font-mono text-[9px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20">T-{gameState.turnCount}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
                {gameState.logs.map((log, i) => (
                  <div key={i} className={`text-[10px] font-bold leading-relaxed transition-opacity duration-500 ${i === 0 ? 'text-indigo-300 border-l-2 border-indigo-500 pl-2 animate-pulse' : 'text-slate-500 pl-2 opacity-60'}`}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
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

        {viewingPlayerId !== null && gameState.players.find(p => p.id === viewingPlayerId) && (
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
            onAccept={() => handleDispatch({ type: 'ACCEPT_TRADE' })}
            onDecline={() => handleDispatch({ type: 'DECLINE_TRADE' })}
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
              className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-5 w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-5 shrink-0">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Settings size={18} className="text-indigo-400" />
                  Room Settings
                </h3>
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="p-2 text-slate-400 hover:text-white transition-colors rounded-xl hover:bg-slate-800"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                {renderGameSettings()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;