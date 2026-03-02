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
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; time: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'logs' | 'chat'>('logs');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
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

    const handleChatMessage = (data: any) => {
      setChatMessages(prev => [...prev, data]);
    };

    socket.on("room_updated", handleRoomUpdated);
    socket.on("game_started", handleGameStarted);
    socket.on("host_process_action", handleHostProcessAction);
    socket.on("sync_state", handleSyncState);
    socket.on("settings_updated", handleSettingsUpdated);
    socket.on("kicked", handleKicked);
    socket.on("chat_message", handleChatMessage);

    return () => {
      socket.off("room_updated", handleRoomUpdated);
      socket.off("game_started", handleGameStarted);
      socket.off("host_process_action", handleHostProcessAction);
      socket.off("sync_state", handleSyncState);
      socket.off("settings_updated", handleSettingsUpdated);
      socket.off("kicked", handleKicked);
      socket.off("chat_message", handleChatMessage);
    };
  }, [isHost]);

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
        selectedAvatar,
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
      socket.emit("create_room", { name: humanName, avatar: selectedAvatar }, (res: any) => {
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
      socket.emit("join_room", { roomId: joinRoomId, name: humanName, avatar: selectedAvatar }, (res: any) => {
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
      socket.emit("join_random_room", { name: humanName, avatar: selectedAvatar }, (res: any) => {
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
            placeholder="Type a message..."
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
          https://richup.io/{roomId}
        </div>
        <button 
          onClick={() => {
            const url = new URL(window.location.href);
            url.searchParams.set('room', roomId || '');
            navigator.clipboard.writeText(url.toString());
          }}
          className="bg-indigo-500 hover:bg-indigo-400 p-2 rounded-xl text-white transition-colors flex items-center gap-2 px-3 text-sm font-bold shadow-lg shadow-indigo-500/20"
        >
          <Copy size={16} /> Copy
        </button>
      </div>
      {showSettingsButton && (
        <button 
          onClick={() => setShowSettingsModal(true)}
          className="mt-2 w-full bg-slate-800 hover:bg-slate-700 p-2 rounded-xl text-slate-300 transition-colors flex items-center justify-center gap-2 text-sm font-bold"
        >
          <Settings size={16} /> View room settings
        </button>
      )}
    </div>
  );

  const renderGameSettings = () => (
    <div className="space-y-6 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-slate-700">
      <div className="flex gap-3">
        <Users size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Maximum players</div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Player capacity</div>
          <select 
            disabled={!isHost || gameStarted}
            value={settings.maxPlayers}
            onChange={(e) => updateGeneralSetting('maxPlayers', parseInt(e.target.value))}
            className="w-full bg-[#111116] border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-bold"
          >
            {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} Players</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <Lock size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Private room</div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Access control</div>
          <div className="flex justify-end">
            <Switch 
              disabled={!isHost || gameStarted} 
              checked={settings.isPrivate} 
              onCheckedChange={(checked) => updateGeneralSetting('isPrivate', checked)} 
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Bot size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
            Allow bots to join
          </div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">AI Opponents</div>
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
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Initial funds</div>
          <select 
            disabled={!isHost || gameStarted}
            value={settings.rules.startingCash}
            onChange={(e) => updateRule('startingCash', parseInt(e.target.value))}
            className="w-full bg-[#111116] border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-indigo-500 disabled:opacity-50 font-bold"
          >
            {[1000, 1500, 2000, 2500, 3000].map(n => <option key={n} value={n}>${n}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-3">
        <Landmark size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Double rent on set</div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Monopoly bonus</div>
          <div className="flex justify-end">
            <Switch 
              disabled={!isHost || gameStarted} 
              checked={settings.rules.doubleRentOnFullSet} 
              onCheckedChange={(checked) => updateRule('doubleRentOnFullSet', checked)} 
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Plane size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Vacation cash</div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Tax pool reward</div>
          <div className="flex justify-end">
            <Switch 
              disabled={!isHost || gameStarted} 
              checked={settings.rules.vacationCash} 
              onCheckedChange={(checked) => updateRule('vacationCash', checked)} 
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <LayoutGrid size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Auction enabled</div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Bidding system</div>
          <div className="flex justify-end">
            <Switch 
              disabled={!isHost || gameStarted} 
              checked={settings.rules.auctionEnabled} 
              onCheckedChange={(checked) => updateRule('auctionEnabled', checked)} 
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <ShieldCheck size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">No rent in jail</div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Prison rules</div>
          <div className="flex justify-end">
            <Switch 
              disabled={!isHost || gameStarted} 
              checked={settings.rules.noRentInJail} 
              onCheckedChange={(checked) => updateRule('noRentInJail', checked)} 
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Landmark size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Mortgage enabled</div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Financial loans</div>
          <div className="flex justify-end">
            <Switch 
              disabled={!isHost || gameStarted} 
              checked={settings.rules.mortgageEnabled} 
              onCheckedChange={(checked) => updateRule('mortgageEnabled', checked)} 
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Dices size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Randomize order</div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Turn shuffle</div>
          <div className="flex justify-end">
            <Switch 
              disabled={!isHost || gameStarted} 
              checked={settings.rules.randomizeOrder} 
              onCheckedChange={(checked) => updateRule('randomizeOrder', checked)} 
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Copy size={18} className="text-slate-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-bold text-slate-200">Even building</div>
          <div className="text-[10px] text-slate-500 mb-2 uppercase font-black tracking-wider">Construction rules</div>
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

    // Room Lobby Screen
    return (
      <div className="group min-h-screen data-[layout=row]:h-screen bg-[#111116] text-slate-50 flex flex-col data-[layout=row]:flex-row p-4 md:p-6 gap-6 relative overflow-y-auto data-[layout=row]:overflow-hidden" data-layout={isStacked ? "stacked" : "row"}>
        {/* Left Column: Share, Ad & Chat */}
        <div className="w-full group-data-[layout=row]:w-80 flex flex-col gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-2 group-data-[layout=row]:order-1">
          {renderShareBox(false)}

          {/* Ad Banner Space */}
          <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-lg flex-1 relative overflow-hidden group min-h-[120px] group-data-[layout=row]:min-h-0">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity" />
            <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs text-center relative z-10">Advertisement<br/>Space</span>
          </div>

          {/* Chat Box */}
          <div className="hidden group-data-[layout=row]:block">
            {renderChatBox(false)}
          </div>
        </div>

        {/* Center Column: Board Preview */}
        <div className="w-full group-data-[layout=row]:flex-1 flex flex-col items-center justify-center relative z-10 group-data-[layout=row]:overflow-hidden group-data-[layout=row]:h-full p-0 group-data-[layout=row]:p-4 order-1 group-data-[layout=row]:order-2">
          <div className="w-full max-w-[660px] group-data-[layout=row]:max-w-none group-data-[layout=row]:w-full group-data-[layout=row]:h-full flex items-center justify-center mx-auto">
            <Board gameState={gameState} onTileClick={() => {}}>
              <div className="flex-1 flex flex-col items-center justify-center gap-6">
                <div className="text-center">
                  <h2 className="text-4xl font-black text-white tracking-tighter mb-2 drop-shadow-2xl">
                    LOBBY <span className="text-indigo-500">{roomId}</span>
                  </h2>
                  <p className="text-slate-400 font-medium">Waiting for players to join...</p>
                </div>

                <button 
                  onClick={() => {
                    if (isHost) {
                      handleStartGame();
                    }
                  }}
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
        </div>

        {/* Right Column: Profile & Settings */}
        <div className="w-full group-data-[layout=row]:w-80 flex flex-col gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-3">
          {/* User Profile Box */}
          <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-5 flex flex-col gap-4 shadow-lg shrink-0">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar avatarId={selectedAvatar} className="w-16 h-16 shadow-2xl ring-2 ring-indigo-500/50" />
                <div className="absolute -bottom-1 -right-1 bg-indigo-500 text-white p-1 rounded-full shadow-lg">
                  <Settings size={12} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-lg font-black text-white truncate flex items-center gap-2">
                  {humanName}
                  {isHost && <Crown size={16} className="text-amber-400" />}
                </div>
                <button 
                  onClick={() => setSelectedAvatar((selectedAvatar + 1) % APPEARANCE_COLORS.length)}
                  className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
                >
                  Change appearance
                </button>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-2 pt-2">
              {APPEARANCE_COLORS.map((color, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedAvatar(idx);
                    const socket = getSocket();
                    if (socket) {
                      socket.emit("update_player", { avatar: idx });
                    }
                  }}
                  className={`aspect-square rounded-full transition-all ${
                    selectedAvatar === idx 
                      ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-[#1e1e24] scale-110' 
                      : 'hover:scale-110 opacity-40 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Game Settings Box */}
          <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-5 flex-1 overflow-hidden flex flex-col shadow-lg min-h-[400px] group-data-[layout=row]:min-h-0">
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
      </div>
    );
  }

  // ── Game Screen ─────────────────────────────────────────────────────────────
  const myProperties = gameState.tiles.filter(t => t.ownerId === myPlayerId);

  return (
    <div className="group min-h-screen data-[layout=row]:h-screen bg-[#111116] text-slate-50 flex flex-col data-[layout=row]:flex-row p-4 md:p-6 gap-6 relative overflow-y-auto data-[layout=row]:overflow-hidden" data-layout={isStacked ? "stacked" : "row"}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950 pointer-events-none fixed" />
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none fixed" />

      {/* FEAT-04: In-game sound toggle */}
      <div className="absolute top-4 right-4 z-50 flex items-center gap-2 fixed">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="p-2 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-400 hover:text-slate-200 transition-colors backdrop-blur-sm shadow-lg"
          title={soundEnabled ? 'Mute' : 'Unmute'}
        >
          {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      </div>

      {/* Left Column: Share, Ad Banner & Chat */}
      <div className="w-full group-data-[layout=row]:w-80 flex flex-col gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-2 group-data-[layout=row]:order-1">
        {renderShareBox(true)}

        {/* Ad Banner Space */}
        <div className="bg-[#1e1e24] border border-slate-800 rounded-2xl p-5 flex flex-col items-center justify-center shadow-lg flex-1 relative overflow-hidden group min-h-[120px] group-data-[layout=row]:min-h-0">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-50 group-hover:opacity-100 transition-opacity" />
          <span className="text-slate-500 font-black uppercase tracking-[0.2em] text-xs text-center relative z-10">Advertisement<br/>Space</span>
        </div>

        {/* Chat Box */}
        <div className="hidden group-data-[layout=row]:block">
          {renderChatBox(false)}
        </div>
      </div>

      {/* Center Column: Board Preview */}
      <div className="w-full group-data-[layout=row]:flex-1 flex flex-col items-center justify-center relative z-10 group-data-[layout=row]:overflow-hidden group-data-[layout=row]:h-full p-0 group-data-[layout=row]:p-4 order-1 group-data-[layout=row]:order-2">
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
      </div>

      {/* Right Column: Players & Logs */}
      <div className="w-full group-data-[layout=row]:w-80 flex flex-col gap-4 shrink-0 z-10 group-data-[layout=row]:h-full order-3">
        {/* Players List */}
        <div className="bg-[#1e1e24] rounded-2xl border border-slate-800 p-4 flex flex-col gap-3 shadow-lg shrink-0 max-h-[40vh] group-data-[layout=row]:max-h-[50%] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {gameState.players.map(player => {
            const isActive = gameState.currentPlayerIndex === gameState.players.indexOf(player);
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                onClick={() => setViewingPlayerId(player.id)}
                className={`
                  relative flex items-center gap-3 bg-[#111116] border p-3 rounded-xl shadow-md cursor-pointer transition-all duration-300
                  ${isActive ? 'border-indigo-500/50 ring-1 ring-indigo-500/20' : 'border-slate-800 hover:border-slate-700'}
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
                    className={`w-10 h-10 shadow-lg ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#111116]' : ''}`}
                  />
                  {player.isBankrupt && (
                    <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                      <X size={14} className="text-rose-500" strokeWidth={3} />
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-black uppercase truncate ${isActive ? 'text-indigo-300' : 'text-slate-200'}`}>
                      {player.name}
                    </span>
                    {player.isBot && <span className="text-[8px] bg-slate-800 text-slate-500 px-1 rounded-sm border border-slate-700">AI</span>}
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className={`font-mono text-sm font-bold ${player.isBankrupt ? 'text-slate-600' : 'text-emerald-400'}`}>
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

        {/* Protocol Feed (Logs) */}
        <div className="flex-1 bg-[#1e1e24] rounded-2xl border border-slate-800 flex flex-col overflow-hidden min-h-[300px] group-data-[layout=row]:min-h-0 shadow-lg">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between text-slate-300 shrink-0">
            <div className="flex items-center gap-2 font-medium">
              <TrendingUp size={16} className="text-indigo-400" />
              <span className="font-bold uppercase tracking-widest text-xs">Protocol Feed</span>
            </div>
            <span className="font-mono text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">T-{gameState.turnCount}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
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
              myPlayerId={myPlayerId}
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
        </AnimatePresence>
    </div>
  );
};

export default App;