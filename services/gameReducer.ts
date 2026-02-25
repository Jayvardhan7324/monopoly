/**
 * gameReducer.ts
 *
 * Bug fixes applied:
 *  BUG-01  Bankruptcy now triggers mid-turn in PAY_RENT; assets forfeited (IMP-01)
 *  BUG-04  turnLogs now resets ONLY on END_TURN action, not on phase cycling
 *  BUG-05  "Go to prison" tile now resets doublesCount & lastDiceRollDoubles
 *  BUG-06  Auction timer effect guarded by winnerId in App.tsx (flag set here)
 *  BUG-07  END_AUCTION verifies winner still has funds; falls back to no-winner
 *  IMP-01  Bankrupt player assets transfer to creditor on PAY_RENT
 *  IMP-02/03 Chance & Community Chest use real card deck from constants
 *  IMP-10  Magic numbers replaced with GAME_CONSTANTS
 *  IMP-13  logs array capped at LOG_MAX_ENTRIES
 */
import {
  GameState,
  Player,
  Tile,
  TileType,
  ColorGroup,
  GamePhase,
  SoundEffectType,
  GameSettings,
  AuctionState,
} from '../types';
import {
  INITIAL_TILES,
  PLAYERS_INITIAL_CASH,
  BOARD_SIZE,
  GAME_CONSTANTS,
  CHANCE_CARDS,
  COMMUNITY_CHEST_CARDS,
  Card,
} from '../constants';

export type Action =
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
      startingCash: PLAYERS_INITIAL_CASH,
      randomizeOrder: true,
    },
  },
};

const rollDie = () => Math.floor(Math.random() * 6) + 1;

/** Attach a sound effect to a state update */
const withSound = (state: GameState, type: SoundEffectType): GameState => ({
  ...state,
  lastSoundEffect: { type, id: Date.now() },
});

/** Cap the log array so it never grows unbounded (IMP-13) */
const addLog = (logs: string[], ...entries: string[]): string[] =>
  [...entries, ...logs].slice(0, GAME_CONSTANTS.LOG_MAX_ENTRIES);

/** Pick a random card and return it */
const drawCard = (cards: Card[]): Card => cards[Math.floor(Math.random() * cards.length)];

const getRent = (
  tile: Tile,
  diceSum: number,
  allTiles: Tile[],
  owner: Player | undefined,
  rules: GameSettings['rules']
) => {
  if (tile.isMortgaged) return 0;
  if (rules.noRentInJail && owner?.inJail) return 0;

  if (tile.type === TileType.UTILITY) {
    const ownerUtilities = allTiles.filter(
      t => t.ownerId === tile.ownerId && t.type === TileType.UTILITY
    );
    return diceSum * (ownerUtilities.length === 2 ? 10 : 4);
  }
  if (tile.type === TileType.RAILROAD) {
    const ownerRailroads = allTiles.filter(
      t => t.ownerId === tile.ownerId && t.type === TileType.RAILROAD
    );
    return 25 * Math.pow(2, ownerRailroads.length - 1);
  }
  if (tile.type === TileType.PROPERTY && tile.rent.length > 0) {
    if (tile.buildingCount === 0) {
      const groupTiles = allTiles.filter(t => t.group === tile.group);
      const isMonopoly = groupTiles.every(t => t.ownerId === tile.ownerId);
      return isMonopoly && rules.doubleRentOnFullSet ? tile.rent[0] * 2 : tile.rent[0];
    }
    return tile.rent[tile.buildingCount];
  }
  return 0;
};

/**
 * IMP-01 / BUG-01: Declare a player bankrupt and transfer their assets.
 * If creditorId is provided, properties go to them (rent bankruptcy).
 * Otherwise they revert to the bank.
 */
const declareBankruptcy = (
  state: GameState,
  bankruptPlayerId: number,
  creditorId: number | null
): { players: Player[]; tiles: Tile[]; logs: string[] } => {
  const newPlayers = state.players.map(p =>
    p.id === bankruptPlayerId ? { ...p, isBankrupt: true, money: 0 } : p
  );

  const newTiles = state.tiles.map(t => {
    if (t.ownerId !== bankruptPlayerId) return t;
    if (creditorId !== null) {
      // Transfer to creditor — unmortgaged, buildings removed (house value lost)
      return { ...t, ownerId: creditorId, buildingCount: 0, isMortgaged: false };
    }
    // Return to bank
    return { ...t, ownerId: null, buildingCount: 0, isMortgaged: false };
  });

  const bankruptName = state.players.find(p => p.id === bankruptPlayerId)?.name ?? 'Player';
  const creditorName = creditorId !== null
    ? state.players.find(p => p.id === creditorId)?.name ?? 'Bank'
    : 'the bank';

  const logs = addLog(state.logs, `${bankruptName} is BANKRUPT! Assets transferred to ${creditorName}.`);
  return { players: newPlayers, tiles: newTiles, logs };
};

// ─────────────────────────────────────────────────────────────────────────────
// Core reducer
// ─────────────────────────────────────────────────────────────────────────────
const coreReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    // ─── START_GAME ────────────────────────────────────────────────────────────
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

      return withSound(
        {
          ...state,
          players,
          settings,
          tiles: JSON.parse(JSON.stringify(INITIAL_TILES)),
          currentPlayerIndex: 0,
          phase: 'ROLL',
          lastDiceRollDoubles: false,
          doublesCount: 0,
          taxPool: 0,
          logs: ['Game started!'],
          turnLogs: [],
          auction: null,
          winnerId: null,
          turnCount: 0,
        },
        'turn_switch'
      );
    }

    // ─── ROLL_DICE ─────────────────────────────────────────────────────────────
    case 'ROLL_DICE': {
      const d1 = rollDie();
      const d2 = rollDie();
      const isDoubles = d1 === d2;
      const newDoublesCount = isDoubles ? state.doublesCount + 1 : 0;

      if (newDoublesCount >= GAME_CONSTANTS.MAX_DOUBLES_BEFORE_JAIL) {
        const newPlayers = [...state.players];
        newPlayers[state.currentPlayerIndex] = {
          ...newPlayers[state.currentPlayerIndex],
          position: GAME_CONSTANTS.JAIL_POSITION,
          inJail: true,
          jailTurns: 0,
        };
        return withSound(
          {
            ...state,
            players: newPlayers,
            dice: [d1, d2],
            lastDiceRollDoubles: false,
            doublesCount: 0,
            phase: 'TURN_END',
            logs: addLog(
              state.logs,
              `${state.players[state.currentPlayerIndex].name} rolled doubles 3 times! Sent to Jail.`
            ),
          },
          'pay'
        );
      }

      return withSound(
        {
          ...state,
          dice: [d1, d2],
          lastDiceRollDoubles: isDoubles,
          doublesCount: newDoublesCount,
          phase: 'MOVING',
          logs: addLog(
            state.logs,
            `${state.players[state.currentPlayerIndex].name} rolled ${d1 + d2}${isDoubles ? ' (Doubles!)' : ''}.`
          ),
        },
        'roll'
      );
    }

    // ─── MOVE_PLAYER ───────────────────────────────────────────────────────────
    case 'MOVE_PLAYER': {
      const player = state.players[state.currentPlayerIndex];
      const moveAmount = state.dice[0] + state.dice[1];
      let newPos = player.position + moveAmount;
      let passGoBonus = 0;

      if (newPos >= BOARD_SIZE) {
        newPos -= BOARD_SIZE;
        passGoBonus = GAME_CONSTANTS.GO_BONUS;
      }

      const newPlayers = [...state.players];
      newPlayers[state.currentPlayerIndex] = {
        ...player,
        position: newPos,
        money: player.money + passGoBonus,
      };

      return withSound(
        {
          ...state,
          players: newPlayers,
          phase: 'RESOLVING',
          logs:
            passGoBonus > 0
              ? addLog(state.logs, `${player.name} passed GO and collected $${GAME_CONSTANTS.GO_BONUS}.`)
              : state.logs,
        },
        'land'
      );
    }

    // ─── LAND_ON_TILE ──────────────────────────────────────────────────────────
    case 'LAND_ON_TILE': {
      const player = state.players[state.currentPlayerIndex];
      const tile = state.tiles[player.position];
      const newPlayers = [...state.players];
      let newTaxPool = state.taxPool;
      let logs = state.logs;

      // ── Tax tiles ────────────────────────────────────────────────────────────
      if (tile.type === TileType.TAX) {
        const taxAmount =
          tile.name === 'Income Tax'
            ? GAME_CONSTANTS.INCOME_TAX_AMOUNT
            : GAME_CONSTANTS.LUXURY_TAX_AMOUNT;
        newPlayers[state.currentPlayerIndex] = {
          ...newPlayers[state.currentPlayerIndex],
          money: player.money - taxAmount,
        };
        if (state.settings.rules.vacationCash) newTaxPool += taxAmount;
        logs = addLog(logs, `${player.name} paid ${tile.name} ($${taxAmount}).`);

        // BUG-01: Check for immediate bankruptcy after tax payment
        if (newPlayers[state.currentPlayerIndex].money < 0) {
          const { players: bp, tiles: bt, logs: bl } = declareBankruptcy(
            { ...state, players: newPlayers, logs },
            player.id,
            null
          );
          return withSound(
            { ...state, players: bp, tiles: bt, taxPool: newTaxPool, logs: bl, phase: 'TURN_END' },
            'pay'
          );
        }
        return withSound({ ...state, players: newPlayers, taxPool: newTaxPool, logs, phase: 'TURN_END' }, 'pay');
      }

      // ── Corner tiles ─────────────────────────────────────────────────────────
      if (tile.type === TileType.CORNER) {
        if (tile.name === 'Go to prison') {
          newPlayers[state.currentPlayerIndex] = {
            ...newPlayers[state.currentPlayerIndex],
            position: GAME_CONSTANTS.JAIL_POSITION,
            inJail: true,
            jailTurns: 0,
          };
          logs = addLog(logs, `${player.name} sent to Jail!`);
          // BUG-05: Reset doubles count when sent to jail via tile
          return withSound(
            { ...state, players: newPlayers, logs, phase: 'TURN_END', lastDiceRollDoubles: false, doublesCount: 0 },
            'pay'
          );
        }
        if (
          tile.name === 'Vacation' &&
          state.settings.rules.vacationCash &&
          state.taxPool > 0
        ) {
          const winAmount = state.taxPool;
          newPlayers[state.currentPlayerIndex] = {
            ...newPlayers[state.currentPlayerIndex],
            money: player.money + winAmount,
          };
          logs = addLog(logs, `${player.name} landed on Vacation and won the tax pool of $${winAmount}!`);
          return withSound({ ...state, players: newPlayers, taxPool: 0, logs, phase: 'TURN_END' }, 'buy');
        }
        return { ...state, phase: 'TURN_END' };
      }

      // ── Chance / Community Chest ─────────────────────────────────────────────
      // IMP-02/03: Real card system
      if (tile.type === TileType.CHANCE || tile.type === TileType.COMMUNITY_CHEST) {
        const deck = tile.type === TileType.CHANCE ? CHANCE_CARDS : COMMUNITY_CHEST_CARDS;
        const card = drawCard(deck);
        let updatedPlayers = [...state.players];

        if (card.type === 'JAIL') {
          updatedPlayers[state.currentPlayerIndex] = {
            ...updatedPlayers[state.currentPlayerIndex],
            position: GAME_CONSTANTS.JAIL_POSITION,
            inJail: true,
            jailTurns: 0,
          };
          logs = addLog(logs, `${player.name} drew: "${card.description}" — Sent to Jail!`);
          return withSound(
            { ...state, players: updatedPlayers, logs, phase: 'TURN_END', lastDiceRollDoubles: false, doublesCount: 0 },
            'pay'
          );
        }

        if (card.type === 'MOVE' && card.value !== undefined) {
          const targetPos = card.value;
          const passedGo = targetPos < updatedPlayers[state.currentPlayerIndex].position;
          updatedPlayers[state.currentPlayerIndex] = {
            ...updatedPlayers[state.currentPlayerIndex],
            position: targetPos,
            money: updatedPlayers[state.currentPlayerIndex].money + (passedGo ? GAME_CONSTANTS.GO_BONUS : 0),
          };
          logs = addLog(logs, `${player.name} drew: "${card.description}"`);
          return withSound({ ...state, players: updatedPlayers, logs, phase: 'RESOLVING' }, 'land');
        }

        if (card.type === 'JAIL_FREE') {
          // For simplicity: give them $50 as a stand-in (full GOOJF tracking is a future feature)
          updatedPlayers[state.currentPlayerIndex] = {
            ...updatedPlayers[state.currentPlayerIndex],
            money: updatedPlayers[state.currentPlayerIndex].money + 50,
          };
          logs = addLog(logs, `${player.name} drew: "${card.description}" (+$50 equivalent)`);
          return withSound({ ...state, players: updatedPlayers, logs, phase: 'TURN_END' }, 'buy');
        }

        if (card.type === 'MONEY' && card.value !== undefined) {
          if (card.perPlayer) {
            // Collect from / pay each other player
            const activePlayers = updatedPlayers.filter(p => !p.isBankrupt && p.id !== player.id);
            const perPlayerAmount = card.value; // negative = pay out, positive = collect
            updatedPlayers = updatedPlayers.map(p => {
              if (p.id === player.id) {
                return { ...p, money: p.money + perPlayerAmount * activePlayers.length };
              }
              if (!p.isBankrupt) {
                return { ...p, money: p.money - perPlayerAmount };
              }
              return p;
            });
            logs = addLog(
              logs,
              `${player.name} drew: "${card.description}" (${perPlayerAmount > 0 ? '+' : ''}$${perPlayerAmount} per player)`
            );
          } else {
            updatedPlayers[state.currentPlayerIndex] = {
              ...updatedPlayers[state.currentPlayerIndex],
              money: updatedPlayers[state.currentPlayerIndex].money + card.value,
            };
            logs = addLog(
              logs,
              `${player.name} drew: "${card.description}" (${card.value >= 0 ? '+' : ''}$${card.value})`
            );
          }

          // BUG-01: Check bankruptcy after card money loss
          if (updatedPlayers[state.currentPlayerIndex].money < 0) {
            const { players: bp, tiles: bt, logs: bl } = declareBankruptcy(
              { ...state, players: updatedPlayers, logs },
              player.id,
              null
            );
            return withSound(
              { ...state, players: bp, tiles: bt, logs: bl, phase: 'TURN_END' },
              'pay'
            );
          }

          return withSound(
            { ...state, players: updatedPlayers, logs, phase: 'TURN_END' },
            card.value >= 0 ? 'buy' : 'pay'
          );
        }

        return { ...state, phase: 'TURN_END' };
      }

      // ── Owned property — pay rent ─────────────────────────────────────────────
      if (tile.ownerId !== null && tile.ownerId !== player.id) {
        return gameReducer(state, { type: 'PAY_RENT' });
      }

      // ── Unowned purchasable tile ──────────────────────────────────────────────
      if (
        tile.ownerId === null &&
        (tile.type === TileType.PROPERTY ||
          tile.type === TileType.RAILROAD ||
          tile.type === TileType.UTILITY)
      ) {
        return { ...state, phase: 'ACTION' };
      }

      return { ...state, phase: 'TURN_END' };
    }

    // ─── BUY_PROPERTY ──────────────────────────────────────────────────────────
    case 'BUY_PROPERTY': {
      const player = state.players[state.currentPlayerIndex];
      const tile = state.tiles[player.position];
      if (tile.ownerId !== null || player.money < tile.price) return state;
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayerIndex] = { ...player, money: player.money - tile.price };
      const newTiles = [...state.tiles];
      newTiles[player.position] = { ...tile, ownerId: player.id };
      return withSound(
        {
          ...state,
          players: newPlayers,
          tiles: newTiles,
          phase: 'TURN_END',
          logs: addLog(state.logs, `${player.name} bought ${tile.name} for $${tile.price}.`),
        },
        'buy'
      );
    }

    // ─── PAY_JAIL_FINE ─────────────────────────────────────────────────────────
    case 'PAY_JAIL_FINE': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail || player.money < GAME_CONSTANTS.JAIL_FINE) return state;
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayerIndex] = {
        ...player,
        money: player.money - GAME_CONSTANTS.JAIL_FINE,
        inJail: false,
        jailTurns: 0,
      };
      return withSound(
        {
          ...state,
          players: newPlayers,
          phase: 'ROLL',
          logs: addLog(state.logs, `${player.name} paid $${GAME_CONSTANTS.JAIL_FINE} to leave Jail.`),
        },
        'pay'
      );
    }

    // ─── ATTEMPT_JAIL_ROLL ─────────────────────────────────────────────────────
    case 'ATTEMPT_JAIL_ROLL': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail) return state;
      const d1 = rollDie();
      const d2 = rollDie();
      const isDoubles = d1 === d2;
      const newPlayers = [...state.players];

      if (isDoubles) {
        newPlayers[state.currentPlayerIndex] = { ...player, inJail: false, jailTurns: 0 };
        return withSound(
          {
            ...state,
            players: newPlayers,
            dice: [d1, d2],
            lastDiceRollDoubles: false, // No extra turn after jail doubles
            phase: 'MOVING',
            logs: addLog(state.logs, `${player.name} rolled doubles (${d1}, ${d2}) and left Jail!`),
          },
          'roll'
        );
      }

      const nextJailTurns = player.jailTurns + 1;
      if (nextJailTurns >= GAME_CONSTANTS.MAX_JAIL_TURNS) {
        // Forced exit — pay the fine
        newPlayers[state.currentPlayerIndex] = {
          ...player,
          money: player.money - GAME_CONSTANTS.JAIL_FINE,
          inJail: false,
          jailTurns: 0,
        };
        return withSound(
          {
            ...state,
            players: newPlayers,
            dice: [d1, d2],
            phase: 'MOVING',
            logs: addLog(
              state.logs,
              `${player.name} failed to roll doubles for ${GAME_CONSTANTS.MAX_JAIL_TURNS} turns. Paid $${GAME_CONSTANTS.JAIL_FINE} and moving ${d1 + d2} spaces.`
            ),
          },
          'pay'
        );
      }

      newPlayers[state.currentPlayerIndex] = { ...player, jailTurns: nextJailTurns };
      return withSound(
        {
          ...state,
          players: newPlayers,
          dice: [d1, d2],
          phase: 'TURN_END',
          logs: addLog(state.logs, `${player.name} failed to roll doubles to leave Jail (turn ${nextJailTurns}/${GAME_CONSTANTS.MAX_JAIL_TURNS}).`),
        },
        'roll'
      );
    }

    // ─── SKIP_JAIL_TURN ────────────────────────────────────────────────────────
    case 'SKIP_JAIL_TURN': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail) return state;
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayerIndex] = { ...player, jailTurns: player.jailTurns + 1 };
      return {
        ...state,
        players: newPlayers,
        phase: 'TURN_END',
        logs: addLog(state.logs, `${player.name} stayed in Jail.`),
      };
    }

    // ─── START_AUCTION ─────────────────────────────────────────────────────────
    case 'START_AUCTION': {
      const player = state.players[state.currentPlayerIndex];
      const tile = state.tiles[player.position];
      const bidders = state.players.filter(p => !p.isBankrupt).map(p => p.id);
      return withSound(
        {
          ...state,
          phase: 'AUCTION',
          auction: {
            tileId: player.position,
            currentBid: 0,
            highestBidderId: null,
            bidders,
            timer: GAME_CONSTANTS.AUCTION_TIMER_SECONDS,
          },
          logs: addLog(state.logs, `Auction started for ${tile.name}!`),
        },
        'modal_open'
      );
    }

    // ─── PLACE_BID ─────────────────────────────────────────────────────────────
    case 'PLACE_BID': {
      const { playerId, amount } = action.payload;
      if (!state.auction || amount <= state.auction.currentBid) return state;
      const bidder = state.players.find(p => p.id === playerId);
      if (!bidder || bidder.money < amount || bidder.isBankrupt) return state;
      return withSound(
        {
          ...state,
          auction: {
            ...state.auction,
            currentBid: amount,
            highestBidderId: playerId,
            timer: GAME_CONSTANTS.AUCTION_TIMER_SECONDS,
          },
          logs: addLog(
            state.logs,
            `${bidder.name} bid $${amount} on ${state.tiles[state.auction.tileId].name}.`
          ),
        },
        'bid'
      );
    }

    // ─── DECREMENT_AUCTION_TIMER ───────────────────────────────────────────────
    case 'DECREMENT_AUCTION_TIMER': {
      if (!state.auction) return state;
      return {
        ...state,
        auction: { ...state.auction, timer: Math.max(0, state.auction.timer - 1) },
      };
    }

    // ─── END_AUCTION ───────────────────────────────────────────────────────────
    case 'END_AUCTION': {
      if (!state.auction) return state;
      const { highestBidderId, currentBid, tileId } = state.auction;

      if (highestBidderId === null) {
        return withSound(
          {
            ...state,
            phase: 'TURN_END',
            auction: null,
            logs: addLog(state.logs, `Auction for ${state.tiles[tileId].name} ended with no bids.`),
          },
          'modal_close'
        );
      }

      // BUG-07: Verify winner still has enough funds
      const winner = state.players.find(p => p.id === highestBidderId);
      if (!winner || winner.money < currentBid) {
        return withSound(
          {
            ...state,
            phase: 'TURN_END',
            auction: null,
            logs: addLog(
              state.logs,
              `Auction cancelled — ${winner?.name ?? 'winner'} could no longer afford the bid.`
            ),
          },
          'modal_close'
        );
      }

      const newPlayers = state.players.map(p =>
        p.id === highestBidderId ? { ...p, money: p.money - currentBid } : p
      );
      const newTiles = state.tiles.map(t =>
        t.id === tileId ? { ...t, ownerId: highestBidderId } : t
      );

      return withSound(
        {
          ...state,
          players: newPlayers,
          tiles: newTiles,
          phase: 'TURN_END',
          auction: null,
          logs: addLog(
            state.logs,
            `${winner.name} won the auction for ${state.tiles[tileId].name} at $${currentBid}!`
          ),
        },
        'trade_accept'
      );
    }

    // ─── PAY_RENT ─────────────────────────────────────────────────────────────
    // BUG-01: Immediate bankruptcy + asset transfer if player can't cover rent
    case 'PAY_RENT': {
      const player = state.players[state.currentPlayerIndex];
      const tile = state.tiles[player.position];
      const owner = state.players.find(p => p.id === tile.ownerId);
      if (!owner || owner.isBankrupt || tile.isMortgaged) return { ...state, phase: 'TURN_END' };

      const rent = getRent(tile, state.dice[0] + state.dice[1], state.tiles, owner, state.settings.rules);
      if (rent === 0) {
        return {
          ...state,
          phase: 'TURN_END',
          logs: addLog(state.logs, `No rent collected from ${tile.name}.`),
        };
      }

      const canAfford = player.money >= rent;

      if (!canAfford) {
        // Pay what they have, then go bankrupt — assets to creditor
        const newPlayers = state.players.map(p => {
          if (p.id === player.id) return { ...p, money: p.money - rent }; // goes negative
          if (p.id === owner.id) return { ...p, money: p.money + player.money }; // gets what's left
          return p;
        });
        const partialState = { ...state, players: newPlayers };
        const { players: bp, tiles: bt, logs: bl } = declareBankruptcy(
          {
            ...partialState,
            logs: addLog(state.logs, `${player.name} paid $${rent} rent to ${owner.name} at ${tile.name}.`),
          },
          player.id,
          owner.id
        );
        return withSound({ ...state, players: bp, tiles: bt, logs: bl, phase: 'TURN_END' }, 'pay');
      }

      const newPlayers = state.players.map(p => {
        if (p.id === player.id) return { ...p, money: p.money - rent };
        if (p.id === owner.id) return { ...p, money: p.money + rent };
        return p;
      });
      return withSound(
        {
          ...state,
          players: newPlayers,
          phase: 'TURN_END',
          logs: addLog(state.logs, `${player.name} paid $${rent} rent to ${owner.name} at ${tile.name}.`),
        },
        'pay'
      );
    }

    // ─── UPGRADE_PROPERTY ─────────────────────────────────────────────────────
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
      newPlayers[pIdx] = { ...newPlayers[pIdx], money: newPlayers[pIdx].money - tile.houseCost };

      const newTiles = [...state.tiles];
      newTiles[tileId] = { ...tile, buildingCount: tile.buildingCount + 1 };
      return withSound(
        {
          ...state,
          players: newPlayers,
          tiles: newTiles,
          logs: addLog(state.logs, `${player.name} built on ${tile.name}.`),
        },
        'upgrade'
      );
    }

    // ─── MORTGAGE_PROPERTY ────────────────────────────────────────────────────
    case 'MORTGAGE_PROPERTY': {
      if (!state.settings.rules.mortgageEnabled) return state;
      const { tileId } = action.payload;
      const tile = state.tiles[tileId];
      if (tile.ownerId === null || tile.buildingCount > 0 || tile.isMortgaged) return state;
      const mortgageValue = Math.floor(tile.price * GAME_CONSTANTS.MORTGAGE_RATE);
      const newPlayers = [...state.players];
      const pIdx = newPlayers.findIndex(p => p.id === tile.ownerId);
      newPlayers[pIdx] = { ...newPlayers[pIdx], money: newPlayers[pIdx].money + mortgageValue };
      const newTiles = [...state.tiles];
      newTiles[tileId] = { ...tile, isMortgaged: true };
      return withSound(
        {
          ...state,
          players: newPlayers,
          tiles: newTiles,
          logs: addLog(state.logs, `${newPlayers[pIdx].name} mortgaged ${tile.name} (+$${mortgageValue}).`),
        },
        'buy'
      );
    }

    // ─── UNMORTGAGE_PROPERTY ──────────────────────────────────────────────────
    case 'UNMORTGAGE_PROPERTY': {
      const { tileId } = action.payload;
      const tile = state.tiles[tileId];
      if (tile.ownerId === null || !tile.isMortgaged) return state;
      const cost = Math.floor(tile.price * GAME_CONSTANTS.MORTGAGE_RATE * GAME_CONSTANTS.UNMORTGAGE_FEE);
      const newPlayers = [...state.players];
      const pIdx = newPlayers.findIndex(p => p.id === tile.ownerId);
      if (newPlayers[pIdx].money < cost) return state;
      newPlayers[pIdx] = { ...newPlayers[pIdx], money: newPlayers[pIdx].money - cost };
      const newTiles = [...state.tiles];
      newTiles[tileId] = { ...tile, isMortgaged: false };
      return withSound(
        {
          ...state,
          players: newPlayers,
          tiles: newTiles,
          logs: addLog(state.logs, `${newPlayers[pIdx].name} unmortgaged ${tile.name} (-$${cost}).`),
        },
        'buy'
      );
    }

    // ─── SELL_PROPERTY ────────────────────────────────────────────────────────
    case 'SELL_PROPERTY': {
      const { tileId } = action.payload;
      const tile = state.tiles[tileId];
      if (tile.ownerId === null || tile.buildingCount > 0 || tile.isMortgaged) return state;
      const sellValue = Math.floor(tile.price * GAME_CONSTANTS.SELL_RATE);
      const newPlayers = [...state.players];
      const pIdx = newPlayers.findIndex(p => p.id === tile.ownerId);
      newPlayers[pIdx] = { ...newPlayers[pIdx], money: newPlayers[pIdx].money + sellValue };
      const newTiles = [...state.tiles];
      newTiles[tileId] = { ...tile, ownerId: null, buildingCount: 0, isMortgaged: false };
      return withSound(
        {
          ...state,
          players: newPlayers,
          tiles: newTiles,
          logs: addLog(state.logs, `${newPlayers[pIdx].name} sold ${tile.name} to bank (+$${sellValue}).`),
        },
        'buy'
      );
    }

    // ─── PROPOSE_TRADE ────────────────────────────────────────────────────────
    case 'PROPOSE_TRADE': {
      const { offerCash, offerPropertyIds, targetTileId } = action.payload;
      const targetTile = state.tiles[targetTileId];
      const targetOwnerId = targetTile.ownerId;
      if (targetOwnerId === null) return state;
      const bot = state.players.find(p => p.id === targetOwnerId);
      if (!bot || !bot.isBot) return state;

      // BUG-03: Do not allow offering mortgaged properties (guard on reducer side too)
      const offerContainsMortgaged = offerPropertyIds.some(id => state.tiles[id].isMortgaged);
      if (offerContainsMortgaged) {
        return withSound(
          { ...state, logs: addLog(state.logs, 'Cannot offer mortgaged properties in a trade.') },
          'error'
        );
      }

      // ── Strategic AI valuation ──────────────────────────────────────────────
      const targetGroup = state.tiles.filter(t => t.group === targetTile.group);
      const botOwnedInGroup = targetGroup.filter(t => t.ownerId === bot.id).length;

      let botLossValue = targetTile.price * 1.2;
      if (botOwnedInGroup === targetGroup.length) botLossValue *= 6;
      else if (botOwnedInGroup > 1) botLossValue *= 2.5;

      let botGainValue = offerCash;
      if (bot.money < 200) botGainValue *= 1.5;
      else if (bot.money < 500) botGainValue *= 1.2;

      offerPropertyIds.forEach(id => {
        const offeredTile = state.tiles[id];
        const group = state.tiles.filter(t => t.group === offeredTile.group);
        const botOwnedInThisGroup = group.filter(t => t.ownerId === bot.id).length;
        let tileValue = offeredTile.price;
        if (botOwnedInThisGroup === group.length - 1) tileValue *= 4.5;
        else if (botOwnedInThisGroup > 0) tileValue *= 1.8;
        // Discount mortgaged tiles in the valuation
        if (offeredTile.isMortgaged) tileValue *= 0.4;
        botGainValue += tileValue;
      });

      // Penalty for granting human a monopoly
      let humanMonopolyPenalty = 0;
      const humanOwnedInGroup = targetGroup.filter(t => t.ownerId === 0).length;
      if (humanOwnedInGroup === targetGroup.length - 1) {
        humanMonopolyPenalty = targetTile.price * (state.turnCount > 100 ? 5 : 3);
      }

      if (botGainValue >= botLossValue + humanMonopolyPenalty) {
        const newPlayers = state.players.map(p => {
          if (p.id === 0) return { ...p, money: p.money - offerCash };
          if (p.id === bot.id) return { ...p, money: p.money + offerCash };
          return p;
        });
        const newTiles = state.tiles.map(t => {
          if (t.id === targetTileId) return { ...t, ownerId: 0 };
          if (offerPropertyIds.includes(t.id)) return { ...t, ownerId: bot.id };
          return t;
        });
        return withSound(
          {
            ...state,
            players: newPlayers,
            tiles: newTiles,
            logs: addLog(state.logs, `Trade accepted by ${bot.name}!`),
          },
          'trade_accept'
        );
      }

      return withSound(
        { ...state, logs: addLog(state.logs, `Trade rejected by ${bot.name}. Offer insufficient.`) },
        'trade_decline'
      );
    }

    // ─── END_TURN ─────────────────────────────────────────────────────────────
    case 'END_TURN': {
      // Mark any player with negative money as bankrupt (assets to bank)
      let processedPlayers = [...state.players];
      let processedTiles = [...state.tiles];
      let processedLogs = state.logs;

      for (const p of processedPlayers) {
        if (p.money < 0 && !p.isBankrupt) {
          const partial = declareBankruptcy(
            { ...state, players: processedPlayers, tiles: processedTiles, logs: processedLogs },
            p.id,
            null
          );
          processedPlayers = partial.players;
          processedTiles = partial.tiles;
          processedLogs = partial.logs;
        }
      }

      const activePlayers = processedPlayers.filter(p => !p.isBankrupt);
      if (activePlayers.length === 1 && state.players.length > 1) {
        return withSound(
          {
            ...state,
            players: processedPlayers,
            tiles: processedTiles,
            logs: addLog(processedLogs, `${activePlayers[0].name} WINS!`),
            winnerId: activePlayers[0].id,
          },
          'win'
        );
      }

      let nextIndex = state.currentPlayerIndex;
      let nextDoublesCount = state.doublesCount;

      if (!state.lastDiceRollDoubles || processedPlayers[state.currentPlayerIndex].isBankrupt) {
        nextIndex = (state.currentPlayerIndex + 1) % processedPlayers.length;
        while (processedPlayers[nextIndex].isBankrupt) {
          nextIndex = (nextIndex + 1) % processedPlayers.length;
        }
        nextDoublesCount = 0;
      }

      return withSound(
        {
          ...state,
          players: processedPlayers,
          tiles: processedTiles,
          logs: processedLogs,
          currentPlayerIndex: nextIndex,
          phase: 'ROLL',
          turnCount: state.turnCount + 1,
          auction: null,
          doublesCount: nextDoublesCount,
        },
        'turn_switch'
      );
    }

    default:
      return state;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper: manages turnLogs
// BUG-04: turnLogs reset ONLY on END_TURN, not on phase cycling
// ─────────────────────────────────────────────────────────────────────────────
export const gameReducer = (state: GameState, action: Action): GameState => {
  const newState = coreReducer(state, action);

  // Accumulate new log entries into turnLogs
  if (newState.logs.length > state.logs.length) {
    const newLogsCount = newState.logs.length - state.logs.length;
    const addedLogs = newState.logs.slice(0, newLogsCount).reverse();
    newState.turnLogs = [...state.turnLogs, ...addedLogs];
  } else {
    newState.turnLogs = state.turnLogs;
  }

  // BUG-04 fix: only wipe turnLogs when the END_TURN action actually fires
  if (action.type === 'END_TURN') {
    newState.turnLogs = [];
  }

  return newState;
};