import React, { useState, useCallback, useEffect } from 'react';
import { Board } from './components/Board';
import { Controls } from './components/Controls';
import { GameState, TileType, ColorGroup, Player } from './types';
import { GAME_CONSTANTS } from './constants';

const INITIAL_TILES = [
  { id: 0, name: 'START', type: TileType.CORNER, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 1, name: 'Mediterranean Ave', type: TileType.PROPERTY, group: ColorGroup.BROWN, price: 60, rent: [2, 10, 30, 90, 160, 250], houseCost: 50, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'it' },
  { id: 2, name: 'Community Chest', type: TileType.COMMUNITY_CHEST, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 3, name: 'Baltic Ave', type: TileType.PROPERTY, group: ColorGroup.BROWN, price: 60, rent: [4, 20, 60, 180, 320, 450], houseCost: 50, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'it' },
  { id: 4, name: 'Income Tax', type: TileType.TAX, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 5, name: 'Reading Railroad', type: TileType.RAILROAD, group: ColorGroup.NONE, price: 200, rent: [25, 50, 100, 200], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 6, name: 'Oriental Ave', type: TileType.PROPERTY, group: ColorGroup.LIGHT_BLUE, price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'jp' },
  { id: 7, name: 'Chance', type: TileType.CHANCE, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 8, name: 'Vermont Ave', type: TileType.PROPERTY, group: ColorGroup.LIGHT_BLUE, price: 100, rent: [6, 30, 90, 270, 400, 550], houseCost: 50, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'jp' },
  { id: 9, name: 'Connecticut Ave', type: TileType.PROPERTY, group: ColorGroup.LIGHT_BLUE, price: 120, rent: [8, 40, 100, 300, 450, 600], houseCost: 50, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'jp' },
  { id: 10, name: 'In Prison', type: TileType.CORNER, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 11, name: 'St. Charles Place', type: TileType.PROPERTY, group: ColorGroup.PINK, price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'fr' },
  { id: 12, name: 'Electric Company', type: TileType.UTILITY, group: ColorGroup.NONE, price: 150, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 13, name: 'States Ave', type: TileType.PROPERTY, group: ColorGroup.PINK, price: 140, rent: [10, 50, 150, 450, 625, 750], houseCost: 100, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'fr' },
  { id: 14, name: 'Virginia Ave', type: TileType.PROPERTY, group: ColorGroup.PINK, price: 160, rent: [12, 60, 180, 500, 700, 900], houseCost: 100, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'fr' },
  { id: 15, name: 'Pennsylvania Railroad', type: TileType.RAILROAD, group: ColorGroup.NONE, price: 200, rent: [25, 50, 100, 200], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 16, name: 'St. James Place', type: TileType.PROPERTY, group: ColorGroup.ORANGE, price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'es' },
  { id: 17, name: 'Community Chest', type: TileType.COMMUNITY_CHEST, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 18, name: 'Tennessee Ave', type: TileType.PROPERTY, group: ColorGroup.ORANGE, price: 180, rent: [14, 70, 200, 550, 750, 950], houseCost: 100, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'es' },
  { id: 19, name: 'New York Ave', type: TileType.PROPERTY, group: ColorGroup.ORANGE, price: 200, rent: [16, 80, 220, 600, 800, 1000], houseCost: 100, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'es' },
  { id: 20, name: 'Vacation', type: TileType.CORNER, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 21, name: 'Kentucky Ave', type: TileType.PROPERTY, group: ColorGroup.RED, price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'gb' },
  { id: 22, name: 'Chance', type: TileType.CHANCE, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 23, name: 'Indiana Ave', type: TileType.PROPERTY, group: ColorGroup.RED, price: 220, rent: [18, 90, 250, 700, 875, 1050], houseCost: 150, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'gb' },
  { id: 24, name: 'Illinois Ave', type: TileType.PROPERTY, group: ColorGroup.RED, price: 240, rent: [20, 100, 300, 750, 925, 1100], houseCost: 150, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'gb' },
  { id: 25, name: 'B. & O. Railroad', type: TileType.RAILROAD, group: ColorGroup.NONE, price: 200, rent: [25, 50, 100, 200], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 26, name: 'Atlantic Ave', type: TileType.PROPERTY, group: ColorGroup.YELLOW, price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'de' },
  { id: 27, name: 'Ventnor Ave', type: TileType.PROPERTY, group: ColorGroup.YELLOW, price: 260, rent: [22, 110, 330, 800, 975, 1150], houseCost: 150, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'de' },
  { id: 28, name: 'Water Works', type: TileType.UTILITY, group: ColorGroup.NONE, price: 150, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 29, name: 'Marvin Gardens', type: TileType.PROPERTY, group: ColorGroup.YELLOW, price: 280, rent: [24, 120, 360, 850, 1025, 1200], houseCost: 150, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'de' },
  { id: 30, name: 'Go to prison', type: TileType.CORNER, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 31, name: 'Pacific Ave', type: TileType.PROPERTY, group: ColorGroup.GREEN, price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'us' },
  { id: 32, name: 'North Carolina Ave', type: TileType.PROPERTY, group: ColorGroup.GREEN, price: 300, rent: [26, 130, 390, 900, 1100, 1275], houseCost: 200, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'us' },
  { id: 33, name: 'Community Chest', type: TileType.COMMUNITY_CHEST, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 34, name: 'Pennsylvania Ave', type: TileType.PROPERTY, group: ColorGroup.GREEN, price: 320, rent: [28, 150, 450, 1000, 1200, 1400], houseCost: 200, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'us' },
  { id: 35, name: 'Short Line', type: TileType.RAILROAD, group: ColorGroup.NONE, price: 200, rent: [25, 50, 100, 200], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 36, name: 'Chance', type: TileType.CHANCE, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 37, name: 'Park Place', type: TileType.PROPERTY, group: ColorGroup.DARK_BLUE, price: 350, rent: [35, 175, 500, 1100, 1300, 1500], houseCost: 200, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'ca' },
  { id: 38, name: 'Luxury Tax', type: TileType.TAX, group: ColorGroup.NONE, price: 0, rent: [0], houseCost: 0, ownerId: null, buildingCount: 0, isMortgaged: false },
  { id: 39, name: 'Boardwalk', type: TileType.PROPERTY, group: ColorGroup.DARK_BLUE, price: 400, rent: [50, 200, 600, 1400, 1700, 2000], houseCost: 200, ownerId: null, buildingCount: 0, isMortgaged: false, countryCode: 'ca' },
];

const INITIAL_PLAYERS: Player[] = [
  { id: 0, name: 'Player 1', money: GAME_CONSTANTS.STARTING_MONEY, position: 0, color: '#ef4444', avatarId: 0, isBankrupt: false, inJail: false, jailTurns: 0, properties: [], isBot: false },
  { id: 1, name: 'Bot 1', money: GAME_CONSTANTS.STARTING_MONEY, position: 0, color: '#3b82f6', avatarId: 1, isBankrupt: false, inJail: false, jailTurns: 0, properties: [], isBot: true },
  { id: 2, name: 'Bot 2', money: GAME_CONSTANTS.STARTING_MONEY, position: 0, color: '#22c55e', avatarId: 2, isBankrupt: false, inJail: false, jailTurns: 0, properties: [], isBot: true },
  { id: 3, name: 'Bot 3', money: GAME_CONSTANTS.STARTING_MONEY, position: 0, color: '#eab308', avatarId: 3, isBankrupt: false, inJail: false, jailTurns: 0, properties: [], isBot: true },
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    tiles: INITIAL_TILES,
    players: INITIAL_PLAYERS,
    currentPlayerIndex: 0,
    dice: [1, 1],
    phase: 'ROLL',
    logs: ['Welcome to Monopoly Empire!'],
    turnLogs: [],
    winnerId: null,
    taxPool: 0,
    auction: null,
    settings: {
      rules: {
        auctionEnabled: true,
        doubleRentOnMonopoly: true,
        evenBuild: true,
      }
    }
  });

  const handleRoll = useCallback(() => {
    if (gameState.phase !== 'ROLL') return;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    
    setGameState(prev => ({
      ...prev,
      dice: [d1, d2],
      phase: 'MOVING',
      logs: [`${prev.players[prev.currentPlayerIndex].name} rolled ${d1 + d2}`],
    }));

    // Simulate movement
    setTimeout(() => {
      setGameState(prev => {
        const player = prev.players[prev.currentPlayerIndex];
        let newPos = (player.position + d1 + d2) % GAME_CONSTANTS.BOARD_SIZE;
        
        const newPlayers = [...prev.players];
        newPlayers[prev.currentPlayerIndex] = { ...player, position: newPos };

        return {
          ...prev,
          players: newPlayers,
          phase: 'ACTION',
          logs: [`${player.name} landed on ${prev.tiles[newPos].name}`],
        };
      });
    }, 1000);
  }, [gameState.phase, gameState.currentPlayerIndex]);

  const handleBuy = useCallback(() => {
    setGameState(prev => {
      const player = prev.players[prev.currentPlayerIndex];
      const tile = prev.tiles[player.position];
      
      if (player.money < tile.price || tile.ownerId !== null) return prev;

      const newPlayers = [...prev.players];
      newPlayers[prev.currentPlayerIndex] = {
        ...player,
        money: player.money - tile.price,
        properties: [...player.properties, tile.id]
      };

      const newTiles = [...prev.tiles];
      newTiles[tile.id] = { ...tile, ownerId: player.id };

      return {
        ...prev,
        players: newPlayers,
        tiles: newTiles,
        phase: 'TURN_END',
        logs: [`${player.name} bought ${tile.name}`],
      };
    });
  }, [gameState.currentPlayerIndex]);

  const handleEndTurn = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      currentPlayerIndex: (prev.currentPlayerIndex + 1) % prev.players.length,
      phase: 'ROLL',
      logs: [`It's ${prev.players[(prev.currentPlayerIndex + 1) % prev.players.length].name}'s turn`],
    }));
  }, []);

  const handleUpgrade = useCallback((tileId: number) => {
    setGameState(prev => {
      const tile = prev.tiles[tileId];
      const player = prev.players[prev.currentPlayerIndex];
      
      if (tile.ownerId !== player.id || player.money < tile.houseCost || tile.buildingCount >= 5) return prev;

      const newTiles = [...prev.tiles];
      newTiles[tileId] = { ...tile, buildingCount: tile.buildingCount + 1 };

      const newPlayers = [...prev.players];
      newPlayers[prev.currentPlayerIndex] = { ...player, money: player.money - tile.houseCost };

      return {
        ...prev,
        tiles: newTiles,
        players: newPlayers,
        logs: [`${player.name} upgraded ${tile.name}`],
      };
    });
  }, [gameState.currentPlayerIndex]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#0c121d] font-sans selection:bg-indigo-500/30">
      <div className="w-full max-w-7xl grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
        <Board 
          gameState={gameState} 
          onTileClick={(id) => console.log('Tile clicked:', id)}
        >
          <Controls 
            gameState={gameState}
            myPlayerId={0}
            onRoll={handleRoll}
            onBuy={handleBuy}
            onEndTurn={handleEndTurn}
            onUpgrade={handleUpgrade}
            onOpenProperty={() => {}}
            onTrade={() => {}}
            dispatch={() => {}}
          />
        </Board>
        
        <div className="flex flex-col gap-4">
          <div className="bg-[#1a212e] rounded-2xl p-6 border border-white/5 shadow-xl">
            <h2 className="text-xl font-black uppercase tracking-tighter mb-4 text-slate-400">Players</h2>
            <div className="space-y-4">
              {gameState.players.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-xl bg-black/20 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="font-bold">{p.name}</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold">${p.money}</span>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-[#1a212e] rounded-2xl p-6 border border-white/5 shadow-xl flex-1">
            <h2 className="text-xl font-black uppercase tracking-tighter mb-4 text-slate-400">Game Logs</h2>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
              {gameState.logs.map((log, i) => (
                <div key={i} className="text-sm text-slate-300 border-l-2 border-indigo-500 pl-3 py-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
