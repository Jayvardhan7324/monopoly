
import React, { useReducer, useEffect, useState } from 'react';
import { gameReducer, initialState } from './services/gameReducer';
import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { PropertyModal } from './components/PropertyModal';
import { GameSettings, TileType } from './types';
import { Play, Settings, Users, Info, ShieldCheck, Coins, Globe, Lock, Cpu, LayoutGrid, ChevronRight } from 'lucide-react';
import { playSound } from './services/audioService';
import { Switch } from './components/animate-ui/components/base/switch';
import { Label } from './components/ui/label';
import { motion, AnimatePresence } from 'motion/react';

const App: React.FC = () => {
  const [gameState, dispatch] = useReducer(gameReducer, initialState);
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [settings, setSettings] = useState<GameSettings>(initialState.settings);

  useEffect(() => {
    if (gameState.lastSoundEffect) {
      playSound(gameState.lastSoundEffect.type);
    }
  }, [gameState.lastSoundEffect]);

  // Game core phase transitions
  useEffect(() => {
    if (!gameStarted || gameState.winnerId !== null || gameState.phase === 'AUCTION') return;
    let timer: ReturnType<typeof setTimeout>;
    
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const isBot = currentPlayer?.isBot;

    if (gameState.phase === 'MOVING') {
      // Slower delays for bots so humans can track
      timer = setTimeout(() => { dispatch({ type: 'MOVE_PLAYER' }); }, isBot ? 2000 : 800);
    } else if (gameState.phase === 'RESOLVING') {
      timer = setTimeout(() => { dispatch({ type: 'LAND_ON_TILE' }); }, isBot ? 1200 : 600);
    }
    return () => clearTimeout(timer);
  }, [gameState.phase, gameStarted, gameState.winnerId, gameState.currentPlayerIndex]);

  // Auction Timer Handling
  useEffect(() => {
    if (gameState.phase !== 'AUCTION' || !gameState.auction) return;
    
    if (gameState.auction.timer > 0) {
        const interval = setInterval(() => {
            dispatch({ type: 'DECREMENT_AUCTION_TIMER' });
        }, 1000);
        return () => clearInterval(interval);
    } else {
        dispatch({ type: 'END_AUCTION' });
    }
  }, [gameState.phase, gameState.auction?.timer]);

  // Bot Logic Handling
  useEffect(() => {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    if (!gameStarted || !currentPlayer || !currentPlayer.isBot || gameState.winnerId !== null) return;
    
    let botTimer: ReturnType<typeof setTimeout>;

    const runBotLogic = () => {
      // Phase-specific bot behaviors
      if (gameState.phase === 'ROLL') {
        if (currentPlayer.inJail) {
            botTimer = setTimeout(() => {
                // Bot jail logic: 30% chance to pay if has money, else roll
                if (currentPlayer.money > 500 && Math.random() > 0.7) {
                    dispatch({ type: 'PAY_JAIL_FINE' });
                } else {
                    dispatch({ type: 'ATTEMPT_JAIL_ROLL' });
                }
            }, 2500);
        } else {
            botTimer = setTimeout(() => { dispatch({ type: 'ROLL_DICE' }); }, 2500);
        }
      } else if (gameState.phase === 'ACTION') {
        const tile = gameState.tiles[currentPlayer.position];
        botTimer = setTimeout(() => {
          if (tile.price && currentPlayer.money >= tile.price + 200) {
            dispatch({ type: 'BUY_PROPERTY' });
          } else {
            if (gameState.settings.rules.auctionEnabled) {
                dispatch({ type: 'START_AUCTION' });
            } else {
                dispatch({ type: 'END_TURN' });
            }
          }
        }, 3000);
      } else if (gameState.phase === 'TURN_END') {
        // Wait longer on turn end so human can read the summary
        botTimer = setTimeout(() => { dispatch({ type: 'END_TURN' }); }, 4500);
      } else if (gameState.phase === 'AUCTION' && gameState.auction) {
          // Bidding bot logic
          const auction = gameState.auction;
          const tile = gameState.tiles[auction.tileId];
          const players = gameState.players;
          
          botTimer = setTimeout(() => {
              players.filter(p => p.isBot && !p.isBankrupt && p.id !== auction.highestBidderId).forEach(bot => {
                  // Strategic valuation
                  const groupTiles = gameState.tiles.filter(t => t.group === tile.group);
                  const botOwnedInGroup = groupTiles.filter(t => t.ownerId === bot.id).length;
                  const totalInGroup = groupTiles.length;
                  
                  // Base value is the price. 
                  let valuation = tile.price;
                  if (botOwnedInGroup === totalInGroup - 1) valuation *= 3.5; // Completes monopoly
                  else if (botOwnedInGroup > 0) valuation *= 1.8; // Adds to set

                  // Denial bidding: if someone else is close to a monopoly
                  const otherPlayers = players.filter(p => p.id !== bot.id && !p.isBankrupt);
                  otherPlayers.forEach(other => {
                      const otherOwnedInGroup = groupTiles.filter(t => t.ownerId === other.id).length;
                      if (otherOwnedInGroup === totalInGroup - 1) {
                          valuation = Math.max(valuation, tile.price * 2.5); // Bid high to deny monopoly
                      }
                  });

                  // Late game multiplier
                  if (gameState.turnCount > 100) valuation *= 1.5;
                  
                  // Don't bid more than valuation or more than 90% of current money
                  const maxBid = Math.min(valuation, bot.money * 0.9);
                  
                  if (auction.currentBid + 10 <= maxBid) {
                      // If the timer is low, bots are more likely to bid
                      const urgency = auction.timer <= 3 ? 0.8 : 0.4;
                      if (Math.random() < urgency) {
                          // Sometimes bid more than just +10 to scare others
                          const increment = (Math.random() > 0.8 && bot.money > auction.currentBid + 100) ? 50 : 10;
                          dispatch({ type: 'PLACE_BID', payload: { playerId: bot.id, amount: auction.currentBid + increment } });
                      }
                  }
              });
          }, 800 + Math.random() * 1500); // Slightly faster reactions
      }
    };

    runBotLogic();
    return () => clearTimeout(botTimer);
  }, [gameState.phase, gameState.currentPlayerIndex, gameStarted, gameState.winnerId, gameState.auction]);

  const handleStartGame = () => {
    dispatch({ type: 'START_GAME', payload: { humanName: 'You', settings } });
    setGameStarted(true);
  };

  const updateRule = (key: keyof typeof settings.rules, value: any) => {
    setSettings({ ...settings, rules: { ...settings.rules, [key]: value } });
  };

  const handleTileClick = (id: number) => {
    const tile = gameState.tiles[id];
    if (tile.type === TileType.CORNER || tile.type === TileType.CHANCE || tile.type === TileType.COMMUNITY_CHEST || tile.type === TileType.TAX) {
        return;
    }
    setSelectedTileId(id);
    playSound('land');
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-[#020617] text-slate-50 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-slate-950 to-slate-950 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none"></div>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-500/20 blur-[120px] rounded-full pointer-events-none"></div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-6xl w-full grid lg:grid-cols-[1fr_400px] gap-8 relative z-10 p-4"
        >
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
              The ultimate browser-based property trading simulator. Out-negotiate, out-invest, and out-maneuver your rivals to build an unbreakable empire.
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
                <p className="text-sm text-slate-500">Local multiplayer support with customizable player counts.</p>
              </div>
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400">
                  <ShieldCheck size={20} />
                </div>
                <h3 className="font-bold">AI Opponents</h3>
                <p className="text-sm text-slate-500">Advanced bots that adapt to your trading style.</p>
              </div>
            </motion.div>
            <motion.button 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: "spring" }}
              onClick={handleStartGame}
              className="group relative w-full md:w-fit px-12 py-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-xl shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-4 active:scale-95"
            >
              <Play fill="currentColor" size={24} /> START NEW SESSION
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </div>
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
              <div className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono uppercase">MAP: CLASSIC</div>
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
                          onClick={() => setSettings({...settings, maxPlayers: n})}
                          className={`flex-1 py-1.5 rounded-lg text-sm font-bold transition-all ${settings.maxPlayers === n ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                    <Label className="flex items-center gap-3 cursor-pointer" onClick={() => setSettings({...settings, isPrivate: !settings.isPrivate})}>
                      <Lock size={16} className="text-slate-500" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200">Private Room</span>
                        <span className="text-[10px] text-slate-600 font-normal">Invite-only access</span>
                      </div>
                    </Label>
                    <Switch 
                      checked={settings.isPrivate}
                      onCheckedChange={(checked) => setSettings({...settings, isPrivate: checked})}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800/50">
                    <Label className="flex items-center gap-3 cursor-pointer" onClick={() => setSettings({...settings, allowBots: !settings.allowBots})}>
                      <Cpu size={16} className="text-slate-500" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-200">Allow Bots</span>
                        <span className="text-[10px] text-slate-600 font-normal">Fill empty slots with AI</span>
                      </div>
                    </Label>
                    <Switch 
                      checked={settings.allowBots}
                      onCheckedChange={(checked) => setSettings({...settings, allowBots: checked})}
                    />
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
                      <Label className="flex flex-col cursor-pointer flex-1" onClick={() => updateRule(rule.id as any, !settings.rules[rule.id as keyof typeof settings.rules])}>
                        <span className="text-xs font-bold text-slate-200">{rule.label}</span>
                        <span className="text-[10px] text-slate-600 font-normal">{rule.info}</span>
                      </Label>
                      <Switch 
                        checked={settings.rules[rule.id as keyof typeof settings.rules] as boolean}
                        onCheckedChange={(checked) => updateRule(rule.id as any, checked)}
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

  const myProperties = gameState.tiles.filter(t => t.ownerId === 0);

  return (
    <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-start p-4 lg:p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-950/30 via-slate-950 to-slate-950 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none"></div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="relative w-full flex justify-center py-4 z-10"
        >
             <Board gameState={gameState} onTileClick={handleTileClick}>
                 <Controls 
                    gameState={gameState} 
                    onRoll={() => dispatch({ type: 'ROLL_DICE' })}
                    onBuy={() => dispatch({ type: 'BUY_PROPERTY' })}
                    onEndTurn={() => dispatch({ type: 'END_TURN' })}
                    onUpgrade={(tileId) => dispatch({ type: 'UPGRADE_PROPERTY', payload: { tileId } })}
                    onOpenProperty={handleTileClick}
                    onTrade={(offer, targetTileId) => dispatch({ type: 'PROPOSE_TRADE', payload: { offerCash: offer.cash, offerPropertyIds: offer.properties, targetTileId } })}
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
                    onTrade={(offer) => dispatch({ type: 'PROPOSE_TRADE', payload: { offerCash: offer.cash, offerPropertyIds: offer.properties, targetTileId: selectedTileId } })}
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
