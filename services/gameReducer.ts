
import { GameState, Player, Tile, TileType, ColorGroup, GamePhase, SoundEffectType, GameSettings, AuctionState } from '../types';
import { INITIAL_TILES, PLAYERS_INITIAL_CASH, BOARD_SIZE } from '../constants';

type Action =
  | { type: 'START_GAME'; payload: { humanName: string; settings: GameSettings } }
  | { type: 'ROLL_DICE' }
  | { type: 'MOVE_PLAYER' }
  | { type: 'LAND_ON_TILE' }
  | { type: 'BUY_PROPERTY' }
  | { type: 'PAY_RENT' }
  | { type: 'END_TURN' }
  | { type: 'UPGRADE_PROPERTY'; payload: { tileId: number } }
  | { type: 'MORTGAGE_PROPERTY'; payload: { tileId: number } }
  | { type: 'UNMORTGAGE_PROPERTY'; payload: { tileId: number } }
  | { type: 'SELL_PROPERTY'; payload: { tileId: number } }
  | { type: 'PROPOSE_TRADE'; payload: { offerCash: number; offerPropertyIds: number[]; targetTileId: number } }
  | { type: 'PAY_JAIL_FINE' }
  | { type: 'ATTEMPT_JAIL_ROLL' }
  | { type: 'SKIP_JAIL_TURN' }
  | { type: 'START_AUCTION' }
  | { type: 'PLACE_BID'; payload: { playerId: number; amount: number } }
  | { type: 'DECREMENT_AUCTION_TIMER' }
  | { type: 'END_AUCTION' };

export const initialState: GameState = {
  players: [],
  tiles: INITIAL_TILES,
  currentPlayerIndex: 0,
  dice: [1, 1],
  lastDiceRollDoubles: false,
  doublesCount: 0,
  phase: 'TURN_END',
  logs: ['Welcome to Richup Clone! Configure your game and start.'],
  turnLogs: [],
  winnerId: null,
  turnCount: 0,
  lastSoundEffect: null,
  taxPool: 0,
  auction: null,
  settings: {
    maxPlayers: 4,
    isPrivate: false,
    allowBots: true,
    boardMap: 'Classic',
    rules: {
      doubleRentOnFullSet: true,
      vacationCash: true,
      auctionEnabled: true,
      noRentInJail: true,
      mortgageEnabled: true,
      evenBuild: true,
      startingCash: 1500,
      randomizeOrder: true,
    }
  }
};

const rollDie = () => Math.floor(Math.random() * 6) + 1;

const withSound = (state: GameState, type: SoundEffectType): GameState => ({
    ...state,
    lastSoundEffect: { type, id: Date.now() }
});

const getRent = (tile: Tile, diceSum: number, allTiles: Tile[], owner: Player | undefined, rules: any) => {
  if (tile.isMortgaged) return 0;
  if (rules.noRentInJail && owner?.inJail) return 0;
  
  if (tile.type === TileType.UTILITY) {
    const ownerUtilities = allTiles.filter(t => t.ownerId === tile.ownerId && t.type === TileType.UTILITY);
    const multiplier = ownerUtilities.length === 2 ? 10 : 4;
    return diceSum * multiplier; 
  }
  if (tile.type === TileType.RAILROAD) {
    const ownerTiles = allTiles.filter(t => t.ownerId === tile.ownerId && t.type === TileType.RAILROAD);
    return 25 * Math.pow(2, ownerTiles.length - 1);
  }
  if (tile.type === TileType.PROPERTY && tile.rent.length > 0) {
    if (tile.buildingCount === 0) {
      const groupTiles = allTiles.filter(t => t.group === tile.group);
      const isMonopoly = groupTiles.every(t => t.ownerId === tile.ownerId);
      return (isMonopoly && rules.doubleRentOnFullSet) ? tile.rent[0] * 2 : tile.rent[0];
    }
    return tile.rent[tile.buildingCount];
  }
  return 0;
};

const coreReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    case 'START_GAME': {
      const { humanName, settings } = action.payload;
      const botCount = settings.allowBots ? settings.maxPlayers - 1 : 0;
      
      let players: Player[] = [
        {
          id: 0,
          name: humanName || 'Player 1',
          color: '#ef4444',
          avatar: 'human',
          money: settings.rules.startingCash,
          position: 0,
          isBot: false,
          isBankrupt: false,
          inJail: false,
          jailTurns: 0,
        },
      ];
      
      const botNames = ['Bot Alpha', 'Bot Beta', 'Bot Gamma', 'Bot Delta'];
      const botColors = ['#3b82f6', '#22c55e', '#eab308', '#a855f7'];
      const botAvatars = ['bot_0', 'bot_1', 'bot_2', 'bot_3'];

      for (let i = 0; i < botCount; i++) {
        players.push({
          id: i + 1,
          name: botNames[i] || `Bot ${i + 1}`,
          color: botColors[i] || '#888',
          avatar: botAvatars[i % botAvatars.length],
          money: settings.rules.startingCash,
          position: 0,
          isBot: true,
          isBankrupt: false,
          inJail: false,
          jailTurns: 0,
        });
      }

      if (settings.rules.randomizeOrder) {
        players = players.sort(() => Math.random() - 0.5);
      }

      return withSound({
        ...state,
        players,
        settings,
        tiles: JSON.parse(JSON.stringify(INITIAL_TILES)),
        currentPlayerIndex: 0,
        phase: 'ROLL',
        lastDiceRollDoubles: false,
        doublesCount: 0,
        taxPool: 0,
        logs: ['Game started with custom rules!'],
        auction: null,
      }, 'turn_switch');
    }

    case 'ROLL_DICE': {
      const d1 = rollDie();
      const d2 = rollDie();
      const isDoubles = d1 === d2;
      const newDoublesCount = isDoubles ? state.doublesCount + 1 : 0;
      
      if (newDoublesCount === 3) {
          const newPlayers = [...state.players];
          newPlayers[state.currentPlayerIndex] = {
              ...newPlayers[state.currentPlayerIndex],
              position: 10,
              inJail: true,
              jailTurns: 0
          };
          return withSound({
              ...state,
              players: newPlayers,
              dice: [d1, d2],
              lastDiceRollDoubles: false,
              doublesCount: 0,
              phase: 'TURN_END',
              logs: [`${state.players[state.currentPlayerIndex].name} rolled doubles 3 times! Sent to Jail.`, ...state.logs],
          }, 'pay');
      }

      return withSound({
        ...state,
        dice: [d1, d2],
        lastDiceRollDoubles: isDoubles,
        doublesCount: newDoublesCount,
        phase: 'MOVING',
        logs: [`${state.players[state.currentPlayerIndex].name} rolled ${d1 + d2}${isDoubles ? ' (Doubles!)' : ''}.`, ...state.logs],
      }, 'roll');
    }

    case 'MOVE_PLAYER': {
        const player = state.players[state.currentPlayerIndex];
        const moveAmount = state.dice[0] + state.dice[1];
        let newPos = player.position + moveAmount;
        let passGoBonus = 0;

        if (newPos >= BOARD_SIZE) {
            newPos -= BOARD_SIZE;
            passGoBonus = 200;
        }

        const newPlayers = [...state.players];
        newPlayers[state.currentPlayerIndex] = {
            ...player,
            position: newPos,
            money: player.money + passGoBonus,
        };

        return withSound({
            ...state,
            players: newPlayers,
            phase: 'RESOLVING',
            logs: passGoBonus > 0 ? [`${player.name} passed GO and collected $200.`, ...state.logs] : state.logs,
        }, 'land');
    }

    case 'LAND_ON_TILE': {
        const player = state.players[state.currentPlayerIndex];
        const tile = state.tiles[player.position];
        const newPlayers = [...state.players];
        let newTaxPool = state.taxPool;
        let logs = [...state.logs];

        if (tile.type === TileType.TAX) {
            const taxAmount = tile.name === 'Income Tax' ? 200 : 100;
            newPlayers[state.currentPlayerIndex].money -= taxAmount;
            if (state.settings.rules.vacationCash) {
                newTaxPool += taxAmount;
            }
            logs.unshift(`${player.name} paid ${tile.name} ($${taxAmount}).`);
            return withSound({ ...state, players: newPlayers, taxPool: newTaxPool, logs, phase: 'TURN_END' }, 'pay');
        } 

        if (tile.type === TileType.CORNER) {
            if (tile.name === 'Go to prison') {
                newPlayers[state.currentPlayerIndex].position = 10;
                newPlayers[state.currentPlayerIndex].inJail = true;
                newPlayers[state.currentPlayerIndex].jailTurns = 0;
                logs.unshift(`${player.name} sent to Jail!`);
                return withSound({ ...state, players: newPlayers, logs, phase: 'TURN_END', lastDiceRollDoubles: false, doublesCount: 0 }, 'pay');
            }
            if (tile.name === 'Vacation' && state.settings.rules.vacationCash && state.taxPool > 0) {
                const winAmount = state.taxPool;
                newPlayers[state.currentPlayerIndex].money += winAmount;
                logs.unshift(`${player.name} landed on Vacation and won the tax pool of $${winAmount}!`);
                return withSound({ ...state, players: newPlayers, taxPool: 0, logs, phase: 'TURN_END' }, 'buy');
            }
            return { ...state, phase: 'TURN_END' };
        }

        if (tile.type === TileType.CHANCE || tile.type === TileType.COMMUNITY_CHEST) {
            const amount = (Math.floor(Math.random() * 21) - 10) * 10;
            newPlayers[state.currentPlayerIndex].money += amount;
            logs.unshift(`${player.name} landed on ${tile.name}: ${amount >= 0 ? 'Received' : 'Paid'} $${Math.abs(amount)}.`);
            return withSound({ ...state, players: newPlayers, logs, phase: 'TURN_END' }, amount >= 0 ? 'buy' : 'pay');
        }

        if (tile.ownerId !== null && tile.ownerId !== player.id) {
             return gameReducer(state, { type: 'PAY_RENT' });
        }

        if (tile.ownerId === null && (tile.type === TileType.PROPERTY || tile.type === TileType.RAILROAD || tile.type === TileType.UTILITY)) {
            return { ...state, phase: 'ACTION' };
        } 

        return { ...state, phase: 'TURN_END' };
    }

    case 'BUY_PROPERTY': {
        const player = state.players[state.currentPlayerIndex];
        const tile = state.tiles[player.position];
        if (tile.ownerId !== null || player.money < tile.price) return state;
        const newPlayers = [...state.players];
        newPlayers[state.currentPlayerIndex].money -= tile.price;
        const newTiles = [...state.tiles];
        newTiles[player.position] = { ...tile, ownerId: player.id };
        return withSound({ ...state, players: newPlayers, tiles: newTiles, phase: 'TURN_END', logs: [`${player.name} bought ${tile.name} for $${tile.price}.`, ...state.logs] }, 'buy');
    }

    case 'PAY_JAIL_FINE': {
        const player = state.players[state.currentPlayerIndex];
        if (!player.inJail || player.money < 50) return state;
        
        const newPlayers = [...state.players];
        newPlayers[state.currentPlayerIndex] = {
            ...player,
            money: player.money - 50,
            inJail: false,
            jailTurns: 0
        };
        
        return withSound({
            ...state,
            players: newPlayers,
            phase: 'ROLL',
            logs: [`${player.name} paid $50 to leave Jail.`, ...state.logs]
        }, 'pay');
    }

    case 'ATTEMPT_JAIL_ROLL': {
        const player = state.players[state.currentPlayerIndex];
        if (!player.inJail) return state;
        
        const d1 = rollDie();
        const d2 = rollDie();
        const isDoubles = d1 === d2;
        const newPlayers = [...state.players];
        
        if (isDoubles) {
            newPlayers[state.currentPlayerIndex] = {
                ...player,
                inJail: false,
                jailTurns: 0
            };
            return withSound({
                ...state,
                players: newPlayers,
                dice: [d1, d2],
                lastDiceRollDoubles: false, // Don't allow another turn after jail doubles
                phase: 'MOVING',
                logs: [`${player.name} rolled doubles (${d1}, ${d2}) and left Jail!`, ...state.logs]
            }, 'roll');
        } else {
            const nextJailTurns = player.jailTurns + 1;
            if (nextJailTurns >= 3) {
                newPlayers[state.currentPlayerIndex] = {
                    ...player,
                    money: player.money - 50,
                    inJail: false,
                    jailTurns: 0
                };
                return withSound({
                    ...state,
                    players: newPlayers,
                    dice: [d1, d2],
                    phase: 'MOVING',
                    logs: [`${player.name} failed to roll doubles for 3 turns. Paid $50 and moving ${d1+d2} spaces.`, ...state.logs]
                }, 'pay');
            } else {
                newPlayers[state.currentPlayerIndex] = {
                    ...player,
                    jailTurns: nextJailTurns
                };
                return withSound({
                    ...state,
                    players: newPlayers,
                    dice: [d1, d2],
                    phase: 'TURN_END',
                    logs: [`${player.name} failed to roll doubles to leave Jail.`, ...state.logs]
                }, 'roll');
            }
        }
    }

    case 'SKIP_JAIL_TURN': {
        const player = state.players[state.currentPlayerIndex];
        if (!player.inJail) return state;
        
        const newPlayers = [...state.players];
        newPlayers[state.currentPlayerIndex] = {
            ...player,
            jailTurns: player.jailTurns + 1
        };
        
        return {
            ...state,
            players: newPlayers,
            phase: 'TURN_END',
            logs: [`${player.name} stayed in Jail.`, ...state.logs]
        };
    }

    case 'START_AUCTION': {
        const player = state.players[state.currentPlayerIndex];
        const tile = state.tiles[player.position];
        const bidders = state.players.filter(p => !p.isBankrupt).map(p => p.id);
        
        return withSound({
            ...state,
            phase: 'AUCTION',
            auction: {
                tileId: player.position,
                currentBid: 0,
                highestBidderId: null,
                bidders,
                timer: 10,
            },
            logs: [`Auction started for ${tile.name}!`, ...state.logs]
        }, 'modal_open');
    }

    case 'PLACE_BID': {
        const { playerId, amount } = action.payload;
        if (!state.auction || amount <= state.auction.currentBid) return state;
        const bidder = state.players.find(p => p.id === playerId);
        if (!bidder || bidder.money < amount) return state;

        return withSound({
            ...state,
            auction: {
                ...state.auction,
                currentBid: amount,
                highestBidderId: playerId,
                timer: 10,
            },
            logs: [`${bidder.name} bid $${amount} on ${state.tiles[state.auction.tileId].name}.`, ...state.logs]
        }, 'bid');
    }

    case 'DECREMENT_AUCTION_TIMER': {
        if (!state.auction) return state;
        return {
            ...state,
            auction: {
                ...state.auction,
                timer: Math.max(0, state.auction.timer - 1)
            }
        };
    }

    case 'END_AUCTION': {
        if (!state.auction) return state;
        const { highestBidderId, currentBid, tileId } = state.auction;
        
        if (highestBidderId === null) {
            return withSound({
                ...state,
                phase: 'TURN_END',
                auction: null,
                logs: [`Auction for ${state.tiles[tileId].name} ended with no bids.`, ...state.logs]
            }, 'modal_close');
        }

        const newPlayers = state.players.map(p => 
            p.id === highestBidderId ? { ...p, money: p.money - currentBid } : p
        );
        const newTiles = state.tiles.map(t => 
            t.id === tileId ? { ...t, ownerId: highestBidderId } : t
        );

        return withSound({
            ...state,
            players: newPlayers,
            tiles: newTiles,
            phase: 'TURN_END',
            auction: null,
            logs: [`${state.players.find(p => p.id === highestBidderId)?.name} won the auction for ${state.tiles[tileId].name} at $${currentBid}!`, ...state.logs]
        }, 'trade_accept');
    }

    case 'PAY_RENT': {
        const player = state.players[state.currentPlayerIndex];
        const tile = state.tiles[player.position];
        const owner = state.players.find(p => p.id === tile.ownerId);
        if (!owner || owner.isBankrupt || tile.isMortgaged) return { ...state, phase: 'TURN_END' };

        const rent = getRent(tile, state.dice[0] + state.dice[1], state.tiles, owner, state.settings.rules);
        if (rent === 0) return { ...state, phase: 'TURN_END', logs: [`No rent collected from ${tile.name}.`, ...state.logs] };

        const newPlayers = [...state.players];
        newPlayers[state.currentPlayerIndex].money -= rent;
        const ownerIndex = newPlayers.findIndex(p => p.id === owner.id);
        newPlayers[ownerIndex].money += rent;

        return withSound({ ...state, players: newPlayers, phase: 'TURN_END', logs: [`${player.name} paid $${rent} rent to ${owner.name} at ${tile.name}.`, ...state.logs] }, 'pay');
    }

    case 'UPGRADE_PROPERTY': {
        const { tileId } = action.payload;
        const tile = state.tiles[tileId];
        const player = state.players.find(p => p.id === tile.ownerId);
        if (!player || player.money < tile.houseCost || tile.buildingCount >= 5) return state;

        const groupTiles = state.tiles.filter(t => t.group === tile.group);
        const hasMonopoly = groupTiles.every(t => t.ownerId === player.id);
        if (!hasMonopoly) return state;

        if (state.settings.rules.evenBuild) {
            const minBuildings = Math.min(...groupTiles.map(t => t.buildingCount));
            if (tile.buildingCount > minBuildings) return state;
        }

        const newPlayers = [...state.players];
        const pIdx = newPlayers.findIndex(p => p.id === player.id);
        newPlayers[pIdx].money -= tile.houseCost;

        const newTiles = [...state.tiles];
        newTiles[tileId] = { ...tile, buildingCount: tile.buildingCount + 1 };
        return withSound({ ...state, players: newPlayers, tiles: newTiles, logs: [`${player.name} built on ${tile.name}.`, ...state.logs] }, 'upgrade');
    }

    case 'MORTGAGE_PROPERTY': {
        if (!state.settings.rules.mortgageEnabled) return state;
        const { tileId } = action.payload;
        const tile = state.tiles[tileId];
        if (tile.ownerId === null || tile.buildingCount > 0 || tile.isMortgaged) return state;
        const mortgageValue = Math.floor(tile.price / 2);
        const newPlayers = [...state.players];
        const pIdx = newPlayers.findIndex(p => p.id === tile.ownerId);
        newPlayers[pIdx].money += mortgageValue;
        const newTiles = [...state.tiles];
        newTiles[tileId] = { ...tile, isMortgaged: true };
        return withSound({ ...state, players: newPlayers, tiles: newTiles, logs: [`${newPlayers[pIdx].name} mortgaged ${tile.name}.`, ...state.logs] }, 'buy');
    }

    case 'UNMORTGAGE_PROPERTY': {
        const { tileId } = action.payload;
        const tile = state.tiles[tileId];
        if (tile.ownerId === null || !tile.isMortgaged) return state;
        const cost = Math.floor((tile.price / 2) * 1.1);
        const newPlayers = [...state.players];
        const pIdx = newPlayers.findIndex(p => p.id === tile.ownerId);
        if (newPlayers[pIdx].money < cost) return state;
        newPlayers[pIdx].money -= cost;
        const newTiles = [...state.tiles];
        newTiles[tileId] = { ...tile, isMortgaged: false };
        return withSound({ ...state, players: newPlayers, tiles: newTiles, logs: [`${newPlayers[pIdx].name} unmortgaged ${tile.name}.`, ...state.logs] }, 'buy');
    }

    case 'SELL_PROPERTY': {
        const { tileId } = action.payload;
        const tile = state.tiles[tileId];
        if (tile.ownerId === null || tile.buildingCount > 0 || tile.isMortgaged) return state;
        const sellValue = Math.floor(tile.price / 2);
        const newPlayers = [...state.players];
        const pIdx = newPlayers.findIndex(p => p.id === tile.ownerId);
        newPlayers[pIdx].money += sellValue;
        const newTiles = [...state.tiles];
        newTiles[tileId] = { ...tile, ownerId: null, buildingCount: 0, isMortgaged: false };
        return withSound({ ...state, players: newPlayers, tiles: newTiles, logs: [`${newPlayers[pIdx].name} sold ${tile.name} to bank.`, ...state.logs] }, 'buy');
    }

    case 'PROPOSE_TRADE': {
        const { offerCash, offerPropertyIds, targetTileId } = action.payload;
        const targetTile = state.tiles[targetTileId];
        const targetOwnerId = targetTile.ownerId;
        if (targetOwnerId === null) return state;
        const bot = state.players.find(p => p.id === targetOwnerId);
        if (!bot || !bot.isBot) return state;

        // --- Strategic AI Evaluation ---
        
        // 1. Calculate value of what the bot is giving up
        const targetGroup = state.tiles.filter(t => t.group === targetTile.group);
        const botOwnedInGroup = targetGroup.filter(t => t.ownerId === bot.id).length;
        
        let botLossValue = targetTile.price * 1.2; // Base loss is 120% of price
        if (botOwnedInGroup === targetGroup.length) botLossValue *= 6; // Extremely high value if it breaks a monopoly
        else if (botOwnedInGroup > 1) botLossValue *= 2.5; // High value if it's part of a set the bot is collecting

        // 2. Calculate value of what the bot is receiving
        let botGainValue = offerCash;
        
        // Cash is worth more to the bot if it's low on money
        if (bot.money < 200) botGainValue *= 1.5;
        else if (bot.money < 500) botGainValue *= 1.2;

        offerPropertyIds.forEach(id => {
            const tile = state.tiles[id];
            const group = state.tiles.filter(t => t.group === tile.group);
            const botOwnedInThisGroup = group.filter(t => t.ownerId === bot.id).length;
            
            let tileValue = tile.price;
            if (botOwnedInThisGroup === group.length - 1) tileValue *= 4.5; // Huge value if it completes a monopoly for the bot
            else if (botOwnedInThisGroup > 0) tileValue *= 1.8; // Good value if it adds to a set
            
            botGainValue += tileValue;
        });

        // 3. Penalty if the trade completes a monopoly for the human
        let humanMonopolyPenalty = 0;
        const humanGroup = state.tiles.filter(t => t.group === targetTile.group);
        const humanOwnedInGroup = humanGroup.filter(t => t.ownerId === 0).length;
        if (humanOwnedInGroup === humanGroup.length - 1) {
            // This trade would give the human a monopoly!
            // Penalty increases as the game progresses
            const gameStageMultiplier = state.turnCount > 100 ? 5 : 3;
            humanMonopolyPenalty = targetTile.price * gameStageMultiplier; 
        }

        // Final Decision
        if (botGainValue >= (botLossValue + humanMonopolyPenalty)) {
            const newPlayers = [...state.players];
            const humanIdx = newPlayers.findIndex(p => p.id === 0);
            const botIdx = newPlayers.findIndex(p => p.id === bot.id);
            newPlayers[humanIdx].money -= offerCash;
            newPlayers[botIdx].money += offerCash;

            const newTiles = [...state.tiles];
            newTiles[targetTileId] = { ...targetTile, ownerId: 0 };
            offerPropertyIds.forEach(id => { 
                const tile = newTiles[id];
                newTiles[id] = { ...tile, ownerId: bot.id }; 
            });
            return withSound({ ...state, players: newPlayers, tiles: newTiles, logs: [`Trade accepted by ${bot.name}!`, ...state.logs] }, 'trade_accept');
        }
        
        return withSound({ ...state, logs: [`Trade rejected by ${bot.name}. The offer was not sufficient.`, ...state.logs] }, 'trade_decline');
    }

    case 'END_TURN': {
        const newPlayers = state.players.map(p => (p.money < 0 && !p.isBankrupt) ? { ...p, isBankrupt: true, money: 0 } : p);
        const activePlayers = newPlayers.filter(p => !p.isBankrupt);
        if (activePlayers.length === 1 && state.players.length > 1) {
            return withSound({ ...state, players: newPlayers, winnerId: activePlayers[0].id, logs: [`${activePlayers[0].name} WINS!`, ...state.logs] }, 'win');
        }

        let nextIndex = state.currentPlayerIndex;
        let nextDoublesCount = state.doublesCount;

        if (!state.lastDiceRollDoubles || newPlayers[state.currentPlayerIndex].isBankrupt) {
            nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
            while (newPlayers[nextIndex].isBankrupt) {
                nextIndex = (nextIndex + 1) % state.players.length;
            }
            nextDoublesCount = 0;
        }
        return withSound({ ...state, players: newPlayers, currentPlayerIndex: nextIndex, phase: 'ROLL', turnCount: state.turnCount + 1, auction: null, doublesCount: nextDoublesCount }, 'turn_switch');
    }

    default:
      return state;
  }
};

export const gameReducer = (state: GameState, action: Action): GameState => {
  const newState = coreReducer(state, action);
  
  if (newState.logs.length > state.logs.length) {
    const newLogsCount = newState.logs.length - state.logs.length;
    const addedLogs = newState.logs.slice(0, newLogsCount).reverse();
    // Append new logs to the end of turnLogs for chronological order
    newState.turnLogs = [...state.turnLogs, ...addedLogs];
  } else {
    newState.turnLogs = state.turnLogs;
  }

  // Reset turnLogs when the turn switches to a different player or when a new turn starts (e.g. after doubles)
  if (newState.currentPlayerIndex !== state.currentPlayerIndex || (newState.phase === 'ROLL' && state.phase !== 'ROLL')) {
    newState.turnLogs = [];
  }

  return newState;
};
