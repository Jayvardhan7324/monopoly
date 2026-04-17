/**
 * gameReducer.ts
 *
 * Bug fixes applied:
 *  BUG-01  Bankruptcy now triggers mid-turn in PAY_RENT; assets forfeited (IMP-01)
 *  BUG-02  B2: UPGRADE_PROPERTY blocked if any group tile is mortgaged
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
  BotPersonalityType,
  TradeLog,
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
import { APPEARANCE_COLORS } from '../components/Avatar';

export type Action =
  | { type: 'START_GAME'; payload: { humanName: string; settings: GameSettings; lobbyPlayers?: any[] | null; selectedAvatar?: number; customTiles?: Tile[]; profileImage?: string } }
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
  | { type: 'PROPOSE_TRADE'; payload: { proposerId: number; offerCash: number; offerPropertyIds: number[]; targetTileId: number | null; targetPlayerId?: number; requestCash: number } }
  | { type: 'ACCEPT_TRADE' }
  | { type: 'DECLINE_TRADE' }
  | { type: 'CANCEL_TRADE' }
  | { type: 'PAY_JAIL_FINE' }
  | { type: 'USE_JAIL_CARD' }
  | { type: 'ATTEMPT_JAIL_ROLL' }
  | { type: 'SKIP_JAIL_TURN' }
  | { type: 'START_AUCTION' }
  | { type: 'PLACE_BID'; payload: { playerId: number; amount: number } }
  | { type: 'DECREMENT_AUCTION_TIMER' }
  | { type: 'END_AUCTION' }
  | { type: 'KICK_PLAYER'; payload: { playerId: number } }
  | { type: 'DECLARE_BANKRUPT' }
  | { type: 'DOWNGRADE_PROPERTY'; payload: { tileId: number } }
  | { type: 'VOTE_KICK'; payload: { targetId: number; voterId: number; expiresAt?: number } }
  | { type: 'CHECK_VOTEKICKS'; payload?: { now?: number } }
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'FORCE_END_TURN'; payload: { removedPlayerId: string } }
  | { type: 'RESET_GAME' };

export const initialState: GameState = {
  players: [],
  tiles: INITIAL_TILES,
  currentPlayerIndex: 0,
  dice: [1, 1],
  lastDiceRollDoubles: false,
  doublesCount: 0,
  phase: 'TURN_END',
  logs: ['Welcome to Cashly! Configure your game and start.'],
  turnLogs: [],
  winnerId: null,
  turnCount: 0,
  lastSoundEffect: null,
  taxPool: 0,
  auction: null,
  pendingTrade: null,
  lastTradeLog: null,
  votekicks: [],
  settings: {
    maxPlayers: 4,
    isPrivate: false,
    allowBots: false,
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
const addLog = (logs: string[], ...entries: string[]): string[] => {
  // BUG-N2: Reverse logs so they appear chronologically in the prepended block
  const reversedEntries = [...entries].reverse();
  return [...reversedEntries, ...logs].slice(0, GAME_CONSTANTS.LOG_MAX_ENTRIES);
};

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
    // 1 utility = 5× dice, 2 utilities = 20× dice (no base price)
    return diceSum * (ownerUtilities.length === 2 ? 20 : 5);
  }
  if (tile.type === TileType.RAILROAD) {
    const ownerRailroads = allTiles.filter(
      t => t.ownerId === tile.ownerId && t.type === TileType.RAILROAD
    );
    // Fixed airport rent: 1=$50, 2=$100, 3=$150, 4=$200
    const airportRent = [50, 100, 150, 200];
    return airportRent[Math.min(ownerRailroads.length - 1, 3)];
  }
  if (tile.type === TileType.PROPERTY && tile.rent.length > 0) {
    if (tile.buildingCount === 0) {
      const groupTiles = allTiles.filter(t => t.group === tile.group);
      const isMonopoly = groupTiles.every(t => t.ownerId === tile.ownerId && !t.isMortgaged);
      return isMonopoly && rules.doubleRentOnFullSet ? tile.rent[0] * 2 : tile.rent[0];
    }
    return tile.rent[Math.min(tile.buildingCount, tile.rent.length - 1)];
  }
  return 0;
};

/**
 * Check if the game has a winner (one active player remaining).
 * Returns the winner's id or null.
 */
const getWinnerId = (players: Player[]): number | null => {
  const active = players.filter(p => !p.isBankrupt);
  if (active.length === 1 && players.length > 1) return active[0].id;
  return null;
};

/**
 * Declare a player bankrupt — all their assets return to the bank.
 * No creditor transfer: players get a chance to sell/mortgage/trade
 * before reaching this point.
 */
const declareBankruptcy = (
  state: GameState,
  bankruptPlayerId: number
): { players: Player[]; tiles: Tile[]; logs: string[] } => {
  const newPlayers = state.players.map(p =>
    p.id === bankruptPlayerId ? { ...p, isBankrupt: true, money: 0, inJail: false, jailTurns: 0 } : p
  );
  const newTiles = state.tiles.map(t => {
    if (t.ownerId !== bankruptPlayerId) return t;
    return { ...t, ownerId: null, buildingCount: 0, isMortgaged: false };
  });
  const bankruptName = state.players.find(p => p.id === bankruptPlayerId)?.name ?? 'Player';
  const logs = addLog(state.logs, `${bankruptName} is BANKRUPT! All properties returned to the bank.`);
  return { players: newPlayers, tiles: newTiles, logs };
};

// ─────────────────────────────────────────────────────────────────────────────
// Core reducer
// ─────────────────────────────────────────────────────────────────────────────
const coreReducer = (state: GameState, action: Action): GameState => {
  switch (action.type) {
    // ─── START_GAME ────────────────────────────────────────────────────────────
    case 'SYNC_STATE': {
      // Defensively ensure votekicks is always an array even if synced state is from an older client
      return { votekicks: [], ...action.payload };
    }

    case 'START_GAME': {
      if (!action.payload) return state;
      const { humanName, settings, lobbyPlayers, selectedAvatar, profileImage } = action.payload;

      let players: Player[] = [];

      // Assign each player their chosen appearance color (from APPEARANCE_COLORS palette
      // selected in the lobby). Bots pick unused slots. Fallback cycles if exhausted.
      const usedColors = new Set<string>();
      const colorFromAvatar = (avatarIdx: number): string => {
        const color = APPEARANCE_COLORS[(avatarIdx ?? 0) % APPEARANCE_COLORS.length];
        usedColors.add(color);
        return color;
      };
      const nextUnusedColor = (): string => {
        const pick = APPEARANCE_COLORS.find(c => !usedColors.has(c));
        if (pick) { usedColors.add(pick); return pick; }
        const fallback = APPEARANCE_COLORS[usedColors.size % APPEARANCE_COLORS.length];
        usedColors.add(fallback);
        return fallback;
      };

      if (lobbyPlayers && lobbyPlayers.length > 0) {
        // Online multiplayer setup — use each player's chosen avatar color
        players = lobbyPlayers
          .filter((p: any) => !p.isSpectator)
          .map((p: any) => ({
            id: players.length,  // will be reassigned below via index
            name: p.name,
            color: colorFromAvatar(p.avatar ?? 0),
            money: settings.rules.startingCash,
            position: 0,
            isBot: false,
            isBankrupt: false,
            inJail: false,
            jailTurns: 0,
            avatarId: p.avatar,
            profileImage: p.profileImage ?? undefined,
          }))
          .map((p: any, i: number) => ({ ...p, id: i }));
      } else {
        // Local game setup — use the player's chosen avatar color
        players = [
          {
            id: 0,
            name: humanName || 'Player 1',
            color: colorFromAvatar(selectedAvatar ?? 0),
            money: settings.rules.startingCash,
            position: 0,
            isBot: false,
            isBankrupt: false,
            inJail: false,
            jailTurns: 0,
            avatarId: selectedAvatar,
            profileImage: profileImage ?? undefined,
          },
        ];
      }

      const botCount = settings.allowBots ? settings.maxPlayers - players.length : 0;

      // Generate gamertag-style bot names (same style as the human auto-name)
      const BOT_ADJ = ['Swift','Brave','Fierce','Bold','Dark','Iron','Stone','Silent','Shadow','Crimson','Silver','Golden','Arctic','Cosmic','Neon','Phantom','Rogue','Thunder','Velvet','Blazing','Crystal','Electric','Sacred','Frozen','Obsidian','Scarlet','Astral','Hollow','Ember','Void'];
      const BOT_NOUN = ['Falcon','Wolf','Panther','Dragon','Phoenix','Hawk','Blade','Shield','Ghost','Viper','Tiger','Lion','Fox','Raven','Eagle','Cobra','Titan','Ranger','Knight','Wizard','Ninja','Viking','Warrior','Samurai','Mage','Archer','Scout','Cipher','Wraith','Oracle'];
      const usedNames = new Set(players.map((p: any) => p.name));
      const genBotName = (): string => {
        let name = '';
        let attempts = 0;
        do {
          name = BOT_ADJ[Math.floor(Math.random() * BOT_ADJ.length)] + ' ' + BOT_NOUN[Math.floor(Math.random() * BOT_NOUN.length)];
          attempts++;
        } while (usedNames.has(name) && attempts < 30);
        usedNames.add(name);
        return name;
      };

      const botPersonalities = [
        BotPersonalityType.AGGRESSIVE,
        BotPersonalityType.CONSERVATIVE,
        BotPersonalityType.BALANCED,
        BotPersonalityType.OPPORTUNISTIC,
      ];

      for (let i = 0; i < botCount; i++) {
        const botId = players.length;
        players.push({
          id: botId,
          name: genBotName(),
          color: nextUnusedColor(),
          money: settings.rules.startingCash,
          position: 0,
          isBot: true,
          isBankrupt: false,
          inJail: false,
          jailTurns: 0,
          personality: botPersonalities[i % botPersonalities.length],
          avatarId: Math.floor(Math.random() * 12),
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
          tiles: JSON.parse(JSON.stringify(action.payload.customTiles ?? INITIAL_TILES)),
          currentPlayerIndex: 0,
          phase: 'ROLL',
          lastDiceRollDoubles: false,
          doublesCount: 0,
          taxPool: 0,
          logs: ['Game started!'],
          turnLogs: [],
          auction: null,
          pendingTrade: null,
          lastTradeLog: null,
          votekicks: [],
          winnerId: null,
          turnCount: 0,
        },
        'turn_switch'
      );
    }

    // ─── ROLL_DICE ─────────────────────────────────────────────────────────────
    case 'ROLL_DICE': {
      if (state.phase !== 'ROLL') return state;
      if (state.winnerId !== null) return state;
      // Jailed players must use ATTEMPT_JAIL_ROLL, PAY_JAIL_FINE, or SKIP_JAIL_TURN
      if (state.players[state.currentPlayerIndex]?.inJail) return state;
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
      if (state.phase !== 'MOVING') return state;
      const player = state.players[state.currentPlayerIndex];
      // Defence-in-depth: jailed players don't move via normal MOVE_PLAYER
      if (player?.inJail) return state;
      const moveAmount = state.dice[0] + state.dice[1];
      let newPos = player.position + moveAmount;
      let passGoBonus = 0;
      let landedOnStart = false;

      const effectiveBoardSize = state.tiles.length || BOARD_SIZE;
      if (newPos >= effectiveBoardSize) {
        newPos -= effectiveBoardSize;
        if (newPos === 0) {
          passGoBonus = 300;
          landedOnStart = true;
        } else {
          passGoBonus = GAME_CONSTANTS.GO_BONUS;
        }
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
              ? addLog(state.logs, landedOnStart
                  ? `${player.name} landed on START and collected $300!`
                  : `${player.name} passed GO and collected $${GAME_CONSTANTS.GO_BONUS}.`)
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
            player.id
          );
          // BUG-12: Advance turn past the now-bankrupt player so the game doesn't freeze
          const activePlayers = bp.filter(p => !p.isBankrupt);
          if (activePlayers.length === 1 && state.players.length > 1) {
            return withSound(
              { ...state, players: bp, tiles: bt, taxPool: newTaxPool, logs: addLog(bl, `${activePlayers[0].name} WINS!`), winnerId: activePlayers[0].id, phase: 'TURN_END' },
              'win'
            );
          }
          let nextIdx = (state.currentPlayerIndex + 1) % bp.length;
          let loopGuard = 0;
          while (bp[nextIdx]?.isBankrupt && loopGuard < bp.length) {
            nextIdx = (nextIdx + 1) % bp.length;
            loopGuard++;
          }
          return withSound(
            { ...state, players: bp, tiles: bt, taxPool: newTaxPool, logs: bl, phase: 'ROLL', currentPlayerIndex: nextIdx, doublesCount: 0, auction: null, turnCount: state.turnCount + 1 },
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
        if (tile.name === 'Vacation') {
          // Landing on Vacation ends the doubles chain and skips player's next turn
          newPlayers[state.currentPlayerIndex] = {
            ...newPlayers[state.currentPlayerIndex],
            onVacation: true,
          };
          if (state.settings.rules.vacationCash && state.taxPool > 0) {
            const winAmount = state.taxPool;
            newPlayers[state.currentPlayerIndex] = {
              ...newPlayers[state.currentPlayerIndex],
              money: player.money + winAmount,
              onVacation: true,
            };
            logs = addLog(logs, `${player.name} landed on Vacation, collected the $${winAmount} pool, and will rest next turn!`);
            return withSound({ ...state, players: newPlayers, taxPool: 0, logs, phase: 'TURN_END', lastDiceRollDoubles: false, doublesCount: 0 }, 'buy');
          }
          logs = addLog(logs, `${player.name} is on Vacation and will skip their next turn!`);
          return withSound({ ...state, players: newPlayers, logs, phase: 'TURN_END', lastDiceRollDoubles: false, doublesCount: 0 }, 'land');
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
          const currentPos = updatedPlayers[state.currentPlayerIndex].position;
          const passedGo = targetPos < currentPos && targetPos !== GAME_CONSTANTS.JAIL_POSITION;
          // Landing exactly on START pays $300 (same as rolling there); passing pays GO_BONUS
          const goBonus = targetPos === 0 ? 300 : passedGo ? GAME_CONSTANTS.GO_BONUS : 0;
          updatedPlayers[state.currentPlayerIndex] = {
            ...updatedPlayers[state.currentPlayerIndex],
            position: targetPos,
            money: updatedPlayers[state.currentPlayerIndex].money + goBonus,
          };
          logs = addLog(logs, `${player.name} drew: "${card.description}"`);
          return withSound({ ...state, players: updatedPlayers, logs, phase: 'RESOLVING' }, 'land');
        }

        if (card.type === 'JAIL_FREE') {
          // GL-11: Proper "Get Out of Jail Free" — add to the player's held count. Consumed
          // later via USE_JAIL_CARD (player choice) or auto-applied on forced jail exit.
          const currentCards = updatedPlayers[state.currentPlayerIndex].jailFreeCards ?? 0;
          updatedPlayers[state.currentPlayerIndex] = {
            ...updatedPlayers[state.currentPlayerIndex],
            jailFreeCards: currentCards + 1,
          };
          logs = addLog(logs, `${player.name} drew: "${card.description}"`);
          return withSound({ ...state, players: updatedPlayers, logs, phase: 'TURN_END' }, 'buy');
        }

        if (card.type === 'MONEY' && card.value !== undefined) {
          // If the card takes money from the player and sends it to the bank (not perPlayer), it feeds the vacation pool
          if (!card.perPlayer && card.value < 0 && state.settings.rules.vacationCash) {
            newTaxPool += Math.abs(card.value);
          }
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
            // BUG-6 FIX: Check bankruptcy for victims who went negative from per-player card
            let tempState = { ...state, players: updatedPlayers };
            for (const victim of updatedPlayers) {
              if (victim.id !== player.id && !victim.isBankrupt && victim.money < 0) {
                const { players: bp, tiles: bt, logs: bl } = declareBankruptcy(
                  tempState,
                  victim.id
                );
                tempState = { ...tempState, players: bp, tiles: bt, logs: bl };
              }
            }
            updatedPlayers = tempState.players;
            logs = addLog(
              tempState.logs,
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
              player.id
            );
            return withSound(
              { ...state, players: bp, tiles: bt, taxPool: newTaxPool, logs: bl, phase: 'TURN_END' },
              'pay'
            );
          }

          return withSound(
            { ...state, players: updatedPlayers, taxPool: newTaxPool, logs, phase: 'TURN_END' },
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
      if (state.phase !== 'ACTION') return state;
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
      const jailFinePool = state.settings.rules.vacationCash ? state.taxPool + GAME_CONSTANTS.JAIL_FINE : state.taxPool;
      return withSound(
        {
          ...state,
          players: newPlayers,
          taxPool: jailFinePool,
          phase: 'ROLL',
          logs: addLog(state.logs, `${player.name} paid $${GAME_CONSTANTS.JAIL_FINE} to leave Jail.`),
        },
        'pay'
      );
    }

    // ─── USE_JAIL_CARD ─────────────────────────────────────────────────────────
    // GL-11: Consume a held "Get Out of Jail Free" card to leave jail without paying.
    case 'USE_JAIL_CARD': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail) return state;
      const held = player.jailFreeCards ?? 0;
      if (held <= 0) return state;
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayerIndex] = {
        ...player,
        inJail: false,
        jailTurns: 0,
        jailFreeCards: held - 1,
      };
      return withSound(
        {
          ...state,
          players: newPlayers,
          phase: 'ROLL',
          logs: addLog(state.logs, `${player.name} used a "Get Out of Jail Free" card!`),
        },
        'buy'
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
        const newMoney = player.money - GAME_CONSTANTS.JAIL_FINE;
        newPlayers[state.currentPlayerIndex] = {
          ...player,
          money: newMoney,
          inJail: false,
          jailTurns: 0,
        };
        // BUG-1 FIX: Check for bankruptcy after forced jail fine
        if (newMoney < 0) {
          const { players: bp, tiles: bt, logs: bl } = declareBankruptcy(
            { ...state, players: newPlayers, logs: addLog(state.logs, `${player.name} couldn't afford the jail fine!`) },
            player.id
          );
          return withSound({ ...state, players: bp, tiles: bt, logs: bl, phase: 'TURN_END' }, 'pay');
        }
        return withSound(
          {
            ...state,
            players: newPlayers,
            taxPool: state.settings.rules.vacationCash ? state.taxPool + GAME_CONSTANTS.JAIL_FINE : state.taxPool,
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
      const nextJailTurns = player.jailTurns + 1;
      // BUG-9: Force exit at MAX_JAIL_TURNS so players can't skip indefinitely
      if (nextJailTurns >= GAME_CONSTANTS.MAX_JAIL_TURNS) {
        const fine = GAME_CONSTANTS.JAIL_FINE;
        const newMoney = player.money - fine;
        const newPlayers = [...state.players];
        newPlayers[state.currentPlayerIndex] = { ...player, inJail: false, jailTurns: 0, money: newMoney };
        const jailFinePool = state.settings.rules.vacationCash ? state.taxPool + fine : state.taxPool;
        return withSound(
          {
            ...state,
            players: newPlayers,
            taxPool: jailFinePool,
            phase: 'ROLL',
            logs: addLog(state.logs, `${player.name} has skipped too many turns — forced to pay $${fine} and leave Jail.`),
          },
          'pay'
        );
      }
      const newPlayers = [...state.players];
      newPlayers[state.currentPlayerIndex] = { ...player, jailTurns: nextJailTurns };
      return {
        ...state,
        players: newPlayers,
        phase: 'TURN_END',
        logs: addLog(state.logs, `${player.name} stayed in Jail (turn ${nextJailTurns}/${GAME_CONSTANTS.MAX_JAIL_TURNS}).`),
      };
    }

    // ─── START_AUCTION ─────────────────────────────────────────────────────────
    case 'START_AUCTION': {
      const player = state.players[state.currentPlayerIndex];
      const tile = state.tiles[player.position];
      const eligibleBidders = state.players.filter(p => !p.isBankrupt);
      // B11: If fewer than 2 eligible bidders, skip the auction entirely
      if (eligibleBidders.length < 2) {
        return withSound(
          { ...state, phase: 'TURN_END', logs: addLog(state.logs, `Auction for ${tile.name} skipped — not enough players.`) },
          'modal_close'
        );
      }
      const bidders = eligibleBidders.map(p => p.id);
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
      if (state.winnerId !== null) return state;
      const { playerId, amount } = action.payload;
      if (!state.auction || state.auction.tileId < 0 || state.auction.tileId >= state.tiles.length) return state;
      if (amount <= state.auction.currentBid) return state;
      const bidder = state.players.find(p => p.id === playerId);
      if (!bidder || bidder.money < amount || bidder.isBankrupt) return state;
      // BUG-5: Only eligible bidders (set at auction start) can place bids
      if (!state.auction.bidders.includes(playerId)) return state;
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
        // Player can't afford rent — deduct full amount (goes negative) and give creditor the rent.
        // Player keeps all properties and must mortgage/trade to recover. No auto-bankruptcy.
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
            logs: addLog(state.logs, `${player.name} owes $${rent} rent to ${owner.name} at ${tile.name} and is now in debt!`),
          },
          'pay'
        );
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
      // Can only build on your own turn (ACTION or TURN_END phase)
      if (state.phase !== 'ACTION' && state.phase !== 'TURN_END') return state;
      if (state.players[state.currentPlayerIndex]?.id !== tile.ownerId) return state;
      const player = state.players.find(p => p.id === tile.ownerId);
      if (!player || player.money < tile.houseCost || tile.buildingCount >= 5) return state;

      const groupTiles = state.tiles.filter(t => t.group === tile.group);
      const hasMonopoly = groupTiles.every(t => t.ownerId === player.id);
      if (!hasMonopoly) return state;

      // B2: Cannot build while any property in the color group is mortgaged
      if (groupTiles.some(t => t.isMortgaged)) return state;

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
      if (state.phase !== 'ACTION' && state.phase !== 'TURN_END') return state;
      if (!state.settings.rules.mortgageEnabled) return state;
      const { tileId } = action.payload;
      const tile = state.tiles[tileId];
      if (tile.ownerId === null || tile.isMortgaged) return state;
      const mortgageValue = Math.floor(tile.price * GAME_CONSTANTS.MORTGAGE_RATE);
      // If buildings exist, sell them at half the house cost before mortgaging
      const buildingRefund = tile.buildingCount > 0
        ? Math.floor(tile.houseCost * tile.buildingCount * 0.5)
        : 0;
      const newPlayers = [...state.players];
      const pIdx = newPlayers.findIndex(p => p.id === tile.ownerId);
      newPlayers[pIdx] = { ...newPlayers[pIdx], money: newPlayers[pIdx].money + mortgageValue + buildingRefund };
      const newTiles = [...state.tiles];
      newTiles[tileId] = { ...tile, isMortgaged: true, buildingCount: 0 };
      const logMsg = tile.buildingCount > 0
        ? `${newPlayers[pIdx].name} sold ${tile.buildingCount} building(s) on ${tile.name} (+$${buildingRefund}) and mortgaged it (+$${mortgageValue}).`
        : `${newPlayers[pIdx].name} mortgaged ${tile.name} (+$${mortgageValue}).`;
      return withSound(
        { ...state, players: newPlayers, tiles: newTiles, logs: addLog(state.logs, logMsg) },
        'buy'
      );
    }

    // ─── UNMORTGAGE_PROPERTY ──────────────────────────────────────────────────
    case 'UNMORTGAGE_PROPERTY': {
      if (state.phase !== 'ACTION' && state.phase !== 'TURN_END') return state;
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
      if (state.phase !== 'ACTION' && state.phase !== 'TURN_END') return state;
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

    // ─── DOWNGRADE_PROPERTY ───────────────────────────────────────────────────
    case 'DOWNGRADE_PROPERTY': {
      if (state.phase !== 'ACTION' && state.phase !== 'TURN_END') return state;
      const { tileId } = action.payload;
      const tile = state.tiles[tileId];
      if (!tile || tile.buildingCount === 0 || tile.ownerId === null) return state;
      // Only the current player can downgrade their own buildings
      if (tile.ownerId !== state.players[state.currentPlayerIndex]?.id) return state;

      // GL-3: Mirror UPGRADE's evenBuild gate. Enforce even-build on sell only when the
      // rule is enabled — can only sell from the tile with the MOST buildings in its group.
      if (state.settings.rules.evenBuild) {
        const groupTiles = state.tiles.filter(t => t.group === tile.group && t.ownerId === tile.ownerId);
        const maxBuildings = Math.max(...groupTiles.map(t => t.buildingCount));
        if (tile.buildingCount < maxBuildings) return state;
      }

      const refund = Math.floor(tile.houseCost * 0.5);
      const newPlayers = [...state.players];
      const pIdx = newPlayers.findIndex(p => p.id === tile.ownerId);
      newPlayers[pIdx] = { ...newPlayers[pIdx], money: newPlayers[pIdx].money + refund };
      const newTiles = [...state.tiles];
      newTiles[tileId] = { ...tile, buildingCount: tile.buildingCount - 1 };
      const buildingLabel = tile.buildingCount === 1 ? 'house' : tile.buildingCount === 5 ? 'hotel' : 'house';
      return withSound(
        {
          ...state,
          players: newPlayers,
          tiles: newTiles,
          logs: addLog(state.logs, `${newPlayers[pIdx].name} sold a ${buildingLabel} on ${tile.name} (+$${refund}).`),
        },
        'buy'
      );
    }

    // ─── PROPOSE_TRADE ────────────────────────────────────────────────────────
    case 'PROPOSE_TRADE': {
      const { proposerId, offerCash, offerPropertyIds, targetTileId, targetPlayerId: explicitTargetPlayerId, requestCash } = action.payload;

      // Resolve target player: either from the tile they own, or directly by id (cash-only trades)
      const targetTile = targetTileId !== null ? state.tiles[targetTileId] : null;
      const targetOwnerId = targetTile ? targetTile.ownerId : (explicitTargetPlayerId ?? null);
      if (targetOwnerId === null) return state;
      const targetPlayer = state.players.find(p => p.id === targetOwnerId);
      if (!targetPlayer) return state;

      const proposer = state.players.find(p => p.id === proposerId);
      if (!proposer || proposer.isBankrupt) return state;
      // Cannot trade with yourself or a bankrupt player
      if (proposerId === targetOwnerId) return state;
      if (targetPlayer.isBankrupt) return state;

      // BUG-3: Reject negative cash values — would grant money instead of costing it
      if ((offerCash ?? 0) < 0 || (requestCash ?? 0) < 0) return state;

      // BUG-12: Proposer must own all properties they are offering
      const offerContainsUnowned = offerPropertyIds.some(id => state.tiles[id]?.ownerId !== proposerId);
      if (offerContainsUnowned) return state;

      // BUG-03 / BUG-13: Do not allow offering mortgaged properties (applies to all trades, not just bot)
      const offerContainsMortgaged = offerPropertyIds.some(id => state.tiles[id].isMortgaged);
      if (offerContainsMortgaged) {
        return withSound(
          { ...state, logs: addLog(state.logs, 'Cannot offer mortgaged properties in a trade.') },
          'error'
        );
      }

      // BUG-14: Proposer must have enough cash to cover their cash offer
      if (offerCash > 0 && proposer.money < offerCash) {
        return withSound({ ...state, logs: addLog(state.logs, 'Insufficient funds to make this trade offer.') }, 'error');
      }

      // Build descriptive log string showing what's being traded
      const offerParts: string[] = [];
      if (offerCash > 0) offerParts.push(`$${offerCash}`);
      offerPropertyIds.forEach(id => { const t = state.tiles[id]; if (t) offerParts.push(t.name); });
      const requestParts: string[] = [];
      if (requestCash > 0) requestParts.push(`$${requestCash}`);
      if (targetTile) requestParts.push(targetTile.name);
      const tradeDesc = `${proposer.name} offered [${offerParts.join(' + ') || 'nothing'}] to ${targetPlayer.name} for [${requestParts.join(' + ') || 'nothing'}].`;

      // If target is human, store as pending
      if (!targetPlayer.isBot) {
        return withSound(
          {
            ...state,
            pendingTrade: {
              proposerId: proposer.id,
              targetId: targetPlayer.id,
              offerCash,
              offerPropertyIds,
              targetPropertyId: targetTileId,
              requestCash
            },
            logs: addLog(state.logs, tradeDesc)
          },
          'trade_offer'
        );
      }

      // If target is bot, evaluate immediately
      const bot = targetPlayer;
      const personality = bot.personality || BotPersonalityType.BALANCED;

      // ── Strategic AI valuation ──────────────────────────────────────────────
      let botLossValue = requestCash;
      let proposerMonopolyPenalty = 0;

      if (targetTile) {
        const targetGroup = state.tiles.filter(t => t.group === targetTile.group);
        const botOwnedInGroup = targetGroup.filter(t => t.ownerId === bot.id).length;
        botLossValue += targetTile.price * 1.2;
        if (botOwnedInGroup === targetGroup.length) botLossValue *= 6;
        else if (botOwnedInGroup > 1) botLossValue *= 2.5;
        const proposerOwnedInGroup = targetGroup.filter(t => t.ownerId === proposer.id).length;
        if (proposerOwnedInGroup === targetGroup.length - 1) {
          proposerMonopolyPenalty = targetTile.price * (state.turnCount > 100 ? 5 : 3);
        }
      }

      // Bot is more reluctant to give away cash if it's low
      if (bot.money < requestCash + 100) botLossValue *= 2;

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

      // Personality adjustments to the final decision
      let threshold = 1.0;
      if (personality === BotPersonalityType.AGGRESSIVE) threshold = 0.8; // More likely to accept
      if (personality === BotPersonalityType.CONSERVATIVE) threshold = 1.2; // Less likely to accept
      if (personality === BotPersonalityType.OPPORTUNISTIC) {
        // If the trade helps the bot complete a set, they are very likely to accept
        const helpsBotCompleteSet = offerPropertyIds.some(id => {
          const t = state.tiles[id];
          const g = state.tiles.filter(tile => tile.group === t.group);
          return g.filter(tile => tile.ownerId === bot.id).length === g.length - 1;
        });
        if (helpsBotCompleteSet) threshold = 0.5;
      }

      // Bot decision is pre-computed here but resolved via App.tsx after a 1.5s delay
      // so all players can see the trade in the trades section before it resolves.
      const botAccepts = botGainValue >= (botLossValue + proposerMonopolyPenalty) * threshold;
      return withSound(
        {
          ...state,
          pendingTrade: {
            proposerId: proposer.id,
            targetId: bot.id,
            offerCash,
            offerPropertyIds,
            targetPropertyId: targetTileId,
            requestCash,
            botDecision: botAccepts ? 'accept' : 'decline',
          },
          logs: addLog(state.logs, tradeDesc),
        },
        'trade_offer'
      );
    }

    // ─── ACCEPT_TRADE ──────────────────────────────────────────────────────────
    case 'ACCEPT_TRADE': {
      if (state.winnerId !== null) return state;
      if (!state.pendingTrade) return state;
      // B12: Reject trade acceptance during incompatible phases (e.g. mid-roll, auction)
      if (state.phase !== 'ACTION' && state.phase !== 'TURN_END') return state;
      const { proposerId, targetId, offerCash, offerPropertyIds, targetPropertyId, requestCash } = state.pendingTrade;

      const proposer = state.players.find(p => p.id === proposerId);
      const target = state.players.find(p => p.id === targetId);
      if (!proposer || !target) return { ...state, pendingTrade: null };

      // B3 FIX: Cancel trade if either party went bankrupt between propose and accept
      if (proposer.isBankrupt || target.isBankrupt) {
        return withSound({ ...state, pendingTrade: null, logs: addLog(state.logs, `Trade cancelled — a party is no longer in the game.`) }, 'error');
      }

      // BUG-2 FIX: Validate both parties can still afford the trade
      if (proposer.money < offerCash) {
        return withSound({ ...state, pendingTrade: null, logs: addLog(state.logs, `Trade cancelled — ${proposer.name} can no longer afford the offer.`) }, 'error');
      }
      if (target.money < requestCash) {
        return withSound({ ...state, pendingTrade: null, logs: addLog(state.logs, `Trade cancelled — ${target.name} can no longer afford the request.`) }, 'error');
      }
      // Validate property ownership hasn't changed
      const targetTileStillOwned = targetPropertyId === null || state.tiles[targetPropertyId]?.ownerId === targetId;
      const offerTilesStillOwned = offerPropertyIds.every(id => state.tiles[id]?.ownerId === proposerId);
      if (!targetTileStillOwned || !offerTilesStillOwned) {
        return withSound({ ...state, pendingTrade: null, logs: addLog(state.logs, `Trade cancelled — property ownership changed.`) }, 'error');
      }

      // B4 FIX: Warn if any traded property was mortgaged after the proposal was made
      const anyMortgaged = (targetPropertyId !== null && state.tiles[targetPropertyId]?.isMortgaged) ||
        offerPropertyIds.some(id => state.tiles[id]?.isMortgaged);
      const mortgageWarning = anyMortgaged
        ? addLog(state.logs, `Note: this trade includes a mortgaged property — the new owner inherits the mortgage.`)
        : state.logs;

      const newPlayers = state.players.map(p => {
        if (p.id === proposerId) return { ...p, money: p.money - offerCash + requestCash };
        if (p.id === targetId) return { ...p, money: p.money + offerCash - requestCash };
        return p;
      });

      const newTiles = state.tiles.map(t => {
        if (targetPropertyId !== null && t.id === targetPropertyId) return { ...t, ownerId: proposerId };
        if (offerPropertyIds.includes(t.id)) return { ...t, ownerId: targetId };
        return t;
      });

      // Build descriptive accepted-trade log
      const offeredPropNames = offerPropertyIds.map(id => state.tiles[id]?.name).filter(Boolean);
      const targetPropName = targetPropertyId !== null ? (state.tiles[targetPropertyId]?.name ?? '') : '';
      const accOfferParts: string[] = [];
      if (offerCash > 0) accOfferParts.push(`$${offerCash}`);
      offeredPropNames.forEach(n => accOfferParts.push(n as string));
      const accRequestParts: string[] = [];
      if (requestCash > 0) accRequestParts.push(`$${requestCash}`);
      if (targetPropName) accRequestParts.push(targetPropName);
      const acceptMsg = `Trade done! ${proposer.name} gave [${accOfferParts.join(' + ') || 'nothing'}], got [${accRequestParts.join(' + ') || 'nothing'}].`;

      const acceptLog: TradeLog = {
        proposerName: proposer.name,
        targetName: target.name,
        result: 'accepted',
        offerCash,
        requestCash,
        offerPropertyCount: offerPropertyIds.length,
        targetPropertyName: targetPropName,
      };
      return withSound(
        {
          ...state,
          players: newPlayers,
          tiles: newTiles,
          pendingTrade: null,
          lastTradeLog: acceptLog,
          logs: addLog(mortgageWarning, acceptMsg),
        },
        'trade_accept'
      );
    }

    // ─── DECLINE_TRADE ──────────────────────────────────────────────────────────
    case 'DECLINE_TRADE': {
      if (state.winnerId !== null) return state;
      if (!state.pendingTrade) return state;
      const target = state.players.find(p => p.id === state.pendingTrade!.targetId)!;
      const proposerForDecline = state.players.find(p => p.id === state.pendingTrade!.proposerId);
      const declineLog: TradeLog = {
        proposerName: proposerForDecline?.name ?? '',
        targetName: target.name,
        result: 'declined',
        offerCash: state.pendingTrade.offerCash,
        requestCash: state.pendingTrade.requestCash,
        offerPropertyCount: state.pendingTrade.offerPropertyIds.length,
        targetPropertyName: state.pendingTrade.targetPropertyId !== null ? (state.tiles[state.pendingTrade.targetPropertyId]?.name ?? '') : '',
      };
      return withSound(
        {
          ...state,
          pendingTrade: null,
          lastTradeLog: declineLog,
          logs: addLog(state.logs, `Trade declined by ${target.name}.`),
        },
        'trade_decline'
      );
    }

    // ─── CANCEL_TRADE ───────────────────────────────────────────────────────────
    case 'CANCEL_TRADE': {
      if (!state.pendingTrade) return state;
      const proposerName = state.players.find(p => p.id === state.pendingTrade!.proposerId)?.name ?? 'A player';
      const targetForCancel = state.players.find(p => p.id === state.pendingTrade!.targetId);
      const cancelLog: TradeLog = {
        proposerName,
        targetName: targetForCancel?.name ?? '',
        result: 'cancelled',
        offerCash: state.pendingTrade.offerCash,
        requestCash: state.pendingTrade.requestCash,
        offerPropertyCount: state.pendingTrade.offerPropertyIds.length,
        targetPropertyName: state.pendingTrade.targetPropertyId !== null ? (state.tiles[state.pendingTrade.targetPropertyId]?.name ?? '') : '',
      };
      return withSound(
        { ...state, pendingTrade: null, lastTradeLog: cancelLog, logs: addLog(state.logs, `${proposerName} cancelled their trade offer.`) },
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
            p.id
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
        // BUG-3 FIX: Loop guard to prevent infinite loop if all players are bankrupt
        let loopGuard = 0;
        while (processedPlayers[nextIndex].isBankrupt && loopGuard < processedPlayers.length) {
          nextIndex = (nextIndex + 1) % processedPlayers.length;
          loopGuard++;
        }
        // Safety: if all players ended up bankrupt, declare whoever has most money as winner
        if (processedPlayers[nextIndex]?.isBankrupt) {
          const richest = processedPlayers.reduce((a, b) => (a.money >= b.money ? a : b));
          return { ...state, players: processedPlayers, winnerId: richest.id };
        }
        nextDoublesCount = 0;
      }

      // Player completed their turn — clear any active votekick against them
      const currentPlayerId = state.players[state.currentPlayerIndex].id;
      const votekicksAfterTurn = state.votekicks.filter(v => v.targetId !== currentPlayerId);

      // BUG-7: Loop so consecutive vacation players are all skipped (not just the first)
      let finalIndex = nextIndex;
      let vacationSkipLogs = processedLogs;
      let vacationGuard = 0;
      while (processedPlayers[finalIndex]?.onVacation && vacationGuard < processedPlayers.length) {
        const vacationPlayerName = processedPlayers[finalIndex].name;
        processedPlayers = processedPlayers.map((p, i) =>
          i === finalIndex ? { ...p, onVacation: false } : p
        );
        vacationSkipLogs = addLog(vacationSkipLogs, `${vacationPlayerName} is resting on Vacation — turn skipped!`);
        finalIndex = (finalIndex + 1) % processedPlayers.length;
        // Skip bankrupt players in the advance
        let loopGuard2 = 0;
        while (processedPlayers[finalIndex].isBankrupt && loopGuard2 < processedPlayers.length) {
          finalIndex = (finalIndex + 1) % processedPlayers.length;
          loopGuard2++;
        }
        vacationGuard++;
      }

      return withSound(
        {
          ...state,
          players: processedPlayers,
          tiles: processedTiles,
          logs: vacationSkipLogs,
          currentPlayerIndex: finalIndex,
          phase: 'ROLL',
          turnCount: state.turnCount + 1,
          auction: null,
          pendingTrade: null,
          doublesCount: nextDoublesCount,
          votekicks: votekicksAfterTurn,
        },
        'turn_switch'
      );
    }

    // ─── KICK_PLAYER ────────────────────────────────────────────────────────────
    case 'KICK_PLAYER': {
      const { playerId } = action.payload;
      const kicked = state.players.find(p => p.id === playerId);
      if (!kicked || kicked.isBankrupt) return state;
      const { players, tiles, logs } = declareBankruptcy(state, playerId);
      const isActivePlayer = state.players[state.currentPlayerIndex]?.id === playerId;
      const winnerId = getWinnerId(players);
      if (winnerId !== null) {
        return withSound(
          { ...state, players, tiles, logs: addLog(logs, `${players.find(p => p.id === winnerId)?.name} WINS!`), winnerId, phase: 'TURN_END' },
          'win'
        );
      }
      return withSound({ ...state, players, tiles, logs, phase: isActivePlayer ? 'TURN_END' : state.phase }, 'pay');
    }

    // ─── DECLARE_BANKRUPT ──────────────────────────────────────────────────────
    case 'DECLARE_BANKRUPT': {
      // BUG-11: Only valid during ACTION or TURN_END; not during AUCTION/MOVING/RESOLVING
      if (state.phase !== 'ACTION' && state.phase !== 'TURN_END') return state;
      const player = state.players[state.currentPlayerIndex];
      if (player.isBankrupt) return state;
      const { players, tiles, logs } = declareBankruptcy(state, player.id);
      const winnerId = getWinnerId(players);
      if (winnerId !== null) {
        return withSound(
          { ...state, players, tiles, logs: addLog(logs, `${players.find(p => p.id === winnerId)?.name} WINS!`), winnerId, phase: 'TURN_END' },
          'win'
        );
      }
      return withSound({ ...state, players, tiles, logs, phase: 'TURN_END' }, 'pay');
    }

    // ─── VOTE_KICK ──────────────────────────────────────────────────────────────
    case 'VOTE_KICK': {
      const { targetId, voterId } = action.payload;
      const target = state.players.find(p => p.id === targetId);
      const voter = state.players.find(p => p.id === voterId);
      if (!target || target.isBankrupt || !voter || voter.isBankrupt) return state;

      let newVotekicks = [...state.votekicks];
      let existingVote = newVotekicks.find(v => v.targetId === targetId);

      if (!existingVote) {
        existingVote = {
          targetId,
          voterIds: [voterId],
          // BUG-06: Accept timestamp from payload so reducer stays deterministic
          expiresAt: action.payload.expiresAt ?? Date.now() + 120000,
        };
        newVotekicks.push(existingVote);
      } else {
        if (!existingVote.voterIds.includes(voterId)) {
          existingVote = { ...existingVote, voterIds: [...existingVote.voterIds, voterId] };
          newVotekicks = newVotekicks.map(v => v.targetId === targetId ? existingVote! : v);
        }
      }

      // Check unanimous vote
      const activePlayersCount = state.players.filter(p => !p.isBankrupt).length;
      const requiredVotes = activePlayersCount - 1;

      if (existingVote!.voterIds.length >= requiredVotes && requiredVotes > 0) {
        const { players, tiles, logs } = declareBankruptcy(state, targetId);
        newVotekicks = newVotekicks.filter(v => v.targetId !== targetId);
        const kickLogs = addLog(logs, `${target.name} was kicked by unanimous vote.`);
        const winnerId = getWinnerId(players);
        if (winnerId !== null) {
          return withSound(
            { ...state, players, tiles, votekicks: newVotekicks, logs: addLog(kickLogs, `${players.find(p => p.id === winnerId)?.name} WINS!`), winnerId, phase: 'TURN_END' },
            'win'
          );
        }
        return withSound({ ...state, players, tiles, votekicks: newVotekicks, logs: kickLogs }, 'error');
      }

      const logMsg = existingVote!.voterIds.length === 1
        ? `${voter.name} started a votekick against ${target.name}.`
        : `${voter.name} voted to kick ${target.name} (${existingVote!.voterIds.length}/${requiredVotes}).`;

      return withSound({ ...state, votekicks: newVotekicks, logs: [logMsg, ...state.logs] }, 'notification');
    }

    // ─── CHECK_VOTEKICKS ────────────────────────────────────────────────────────
    case 'CHECK_VOTEKICKS': {
      let nextState = { ...state };
      const expiredTargetIds: number[] = [];

      // BUG-07: Use timestamp from payload so reducer stays deterministic across host/client
      const checkNow = action.payload?.now ?? Date.now();
      for (const vote of state.votekicks) {
        if (checkNow >= vote.expiresAt) {
          expiredTargetIds.push(vote.targetId);
        }
      }

      if (expiredTargetIds.length > 0) {
        let currentLogs = [...state.logs];
        for (const tid of expiredTargetIds) {
          const target = nextState.players.find(p => p.id === tid);
          if (target && !target.isBankrupt) {
            const { players, tiles, logs } = declareBankruptcy(nextState, tid);
            nextState = { ...nextState, players, tiles };
            currentLogs = addLog(logs, `${target.name} was kicked (timer expired).`);
          }
        }
        nextState.logs = currentLogs;
        nextState.votekicks = nextState.votekicks.filter(v => !expiredTargetIds.includes(v.targetId));
        const winnerId = getWinnerId(nextState.players);
        if (winnerId !== null) {
          return withSound(
            { ...nextState, logs: addLog(nextState.logs, `${nextState.players.find(p => p.id === winnerId)?.name} WINS!`), winnerId, phase: 'TURN_END' },
            'win'
          );
        }
        return withSound(nextState, 'error');
      }
      return state;
    }

    // ─── FORCE_END_TURN (server-triggered when a player is permanently removed) ─
    case 'FORCE_END_TURN': {
      // Advance past whoever was removed — same logic as END_TURN but unconditional
      let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
      let guard = 0;
      while (state.players[nextIndex]?.isBankrupt && guard < state.players.length) {
        nextIndex = (nextIndex + 1) % state.players.length;
        guard++;
      }
      const winnerId = getWinnerId(state.players);
      if (winnerId !== null) {
        return { ...state, winnerId, phase: 'TURN_END' };
      }
      return { ...state, currentPlayerIndex: nextIndex, phase: 'ROLL', doublesCount: 0, auction: null, pendingTrade: null, turnLogs: [] };
    }

    // ─── RESET_GAME (rematch — returns to home without page reload) ────────────
    case 'RESET_GAME':
      return { ...initialState };

    default:
      return state;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper: manages turnLogs
// ─────────────────────────────────────────────────────────────────────────────
export const gameReducer = (state: GameState, action: Action): GameState => {
  const newState = coreReducer(state, action);

  // Accumulate new log entries into turnLogs
  // BUG-04 fix: compare newest entry (not length) — length-diff breaks when log hits LOG_MAX_ENTRIES capacity
  const newestNew = newState.logs[0];
  const newestOld = state.logs[0];
  if (newestNew && newestNew !== newestOld) {
    const newEntries = newState.logs.filter(e => !state.logs.includes(e));
    newState.turnLogs = [...state.turnLogs, ...newEntries.reverse()];
  } else {
    newState.turnLogs = state.turnLogs;
  }

  // BUG-M1 fix: turnLogs is wiped in END_TURN inside coreReducer, but we also need to handle the wrapper logic
  if (action.type === 'END_TURN') {
    newState.turnLogs = [];
  }

  return newState;
};