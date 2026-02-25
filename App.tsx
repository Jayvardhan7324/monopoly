import React, { useReducer, useEffect, useState, useRef } from 'react';
import { gameReducer, initialState } from './services/gameReducer';
import { getBotAction, getBotBidAction } from './services/botService';
import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { PropertyModal } from './components/PropertyModal';
import { GameSettings, TileType } from './types';
import {
  Play, Settings, Users, Info, ShieldCheck, Globe, Lock, Cpu,
  LayoutGrid, ChevronRight, Volume2, VolumeX, Eye, Trophy,
} from 'lucide-react';
import { playSound } from './services/audioService';
import { Switch } from './components/animate-ui/components/base/switch';
import { Label } from './components/ui/label';
import { motion, AnimatePresence } from 'motion/react';

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
  const [settings, setSettings] = useState<GameSettings>(initialState.settings);

  // FEAT-04: Sound toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // FEAT-06: Spectator mode (all bots, no human)
  const [spectatorMode, setSpectatorMode] = useState(false);

  // Leaderboard display toggle
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

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
      timer = setTimeout(() => dispatch({ type: 'MOVE_PLAYER' }), isBot ? 2000 : 800);
    } else if (gameState.phase === 'RESOLVING') {
      timer = setTimeout(() => dispatch({ type: 'LAND_ON_TILE' }), isBot ? 1200 : 600);
    }
    return () => clearTimeout(timer);
  }, [gameState.phase, gameStarted, gameState.winnerId, gameState.currentPlayerIndex]);

  // ── Auction timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    // BUG-06: Guard by winnerId
    if (gameState.phase !== 'AUCTION' || !gameState.auction || gameState.winnerId !== null) return;

    if (gameState.auction.timer > 0) {
      const interval = setInterval(() => dispatch({ type: 'DECREMENT_AUCTION_TIMER' }), 1000);
      return () => clearInterval(interval);
    } else {
      dispatch({ type: 'END_AUCTION' });
    }
  }, [gameState.phase, gameState.auction?.timer, gameState.winnerId]);

  // ── Bot main actions (IMP-11: via botService) ──────────────────────────────
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameStarted || !currentPlayer?.isBot || gameState.winnerId !== null) return;

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
      if (action) dispatch(action);
    }, delay);

    return () => clearTimeout(timer);
  }, [gameState.phase, gameState.currentPlayerIndex, gameStarted, gameState.winnerId]);

  // ── Bot auction bids (IMP-11: via botService, BUG-11: ref guard) ───────────
  useEffect(() => {
    if (gameState.phase !== 'AUCTION' || !gameState.auction || gameState.winnerId !== null) return;
    if (botBidFiringRef.current) return;

    botBidFiringRef.current = true;
    const auction = gameState.auction;
    const botsToAct = gameState.players.filter(p => p.isBot && !p.isBankrupt && p.id !== auction.highestBidderId);

    const timer = setTimeout(() => {
      for (const bot of botsToAct) {
        const action = getBotBidAction(gameState, bot.id, auction);
        if (action) dispatch(action);
      }
      botBidFiringRef.current = false;
    }, 800 + Math.random() * 1500);

    return () => {
      clearTimeout(timer);
      botBidFiringRef.current = false;
    };
  }, [gameState.phase, gameState.auction?.timer, gameState.auction?.highestBidderId, gameState.winnerId]);

  const handleStartGame = () => {
    // In spectator mode, make all players bots
    const effectiveSettings = spectatorMode
      ? { ...settings, allowBots: true, maxPlayers: settings.maxPlayers }
      : settings;

    dispatch({
      type: 'START_GAME',
      payload: {
        humanName: spectatorMode ? 'Spectator' : 'You',
        settings: effectiveSettings,
      },
    });
    setGameStarted(true);
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
              className="grid grid-cols-2 gap-6 mb-12"
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

            <div className="flex flex-col gap-3">
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6, type: 'spring' }}
                onClick={handleStartGame}
                className="group relative w-full md:w-fit px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-4 active:scale-95"
              >
                <Play fill="currentColor" size={24} /> START NEW SESSION
                <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </motion.button>

              {/* FEAT-06: Spectator mode */}
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.65, type: 'spring' }}
                onClick={() => { setSpectatorMode(true); setTimeout(handleStartGame, 10); }}
                className="group w-full md:w-fit px-12 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-black text-base shadow-lg border border-slate-700 transition-all flex items-center justify-center gap-3 active:scale-95"
              >
                <Eye size={20} /> WATCH BOTS PLAY
              </motion.button>

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
  const myProperties = gameState.tiles.filter(t => t.ownerId === 0);

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
            onRoll={() => dispatch({ type: 'ROLL_DICE' })}
            onBuy={() => dispatch({ type: 'BUY_PROPERTY' })}
            onEndTurn={() => dispatch({ type: 'END_TURN' })}
            onUpgrade={tileId => dispatch({ type: 'UPGRADE_PROPERTY', payload: { tileId } })}
            onOpenProperty={handleTileClick}
            onTrade={(offer, targetTileId) =>
              dispatch({ type: 'PROPOSE_TRADE', payload: { offerCash: offer.cash, offerPropertyIds: offer.properties, targetTileId } })
            }
            dispatch={dispatch}
          />
        </Board>

        <AnimatePresence>
          {selectedTileId !== null && (
            <PropertyModal
              tile={gameState.tiles[selectedTileId]}
              owner={gameState.players.find(p => p.id === gameState.tiles[selectedTileId].ownerId)}
              onClose={() => setSelectedTileId(null)}
              onUpgrade={() => dispatch({ type: 'UPGRADE_PROPERTY', payload: { tileId: selectedTileId } })}
              canUpgrade={gameState.phase === 'TURN_END' && gameState.tiles[selectedTileId].ownerId === 0}
              currentPlayer={gameState.players.find(p => p.id === 0)}
              myProperties={myProperties}
              onTrade={offer =>
                dispatch({ type: 'PROPOSE_TRADE', payload: { offerCash: offer.cash, offerPropertyIds: offer.properties, targetTileId: selectedTileId } })
              }
              onMortgage={() => dispatch({ type: 'MORTGAGE_PROPERTY', payload: { tileId: selectedTileId } })}
              onUnmortgage={() => dispatch({ type: 'UNMORTGAGE_PROPERTY', payload: { tileId: selectedTileId } })}
              onSell={() => dispatch({ type: 'SELL_PROPERTY', payload: { tileId: selectedTileId } })}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default App;