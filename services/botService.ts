/**
 * botService.ts
 * IMP-11: All bot decision logic extracted from App.tsx into a dedicated service.
 */
import { GameState, AuctionState, BotPersonalityType, TileType, ColorGroup } from '../types';
import { GAME_CONSTANTS } from '../constants';

export type BotAction =
  | { type: 'ROLL_DICE' }
  | { type: 'PAY_JAIL_FINE' }
  | { type: 'ATTEMPT_JAIL_ROLL' }
  | { type: 'BUY_PROPERTY' }
  | { type: 'START_AUCTION' }
  | { type: 'END_TURN' }
  | { type: 'PLACE_BID'; payload: { playerId: number; amount: number } }
  | { type: 'UPGRADE_PROPERTY'; payload: { tileId: number } }
  | { type: 'MORTGAGE_PROPERTY'; payload: { tileId: number } }
  | { type: 'UNMORTGAGE_PROPERTY'; payload: { tileId: number } }
  | { type: 'PROPOSE_TRADE'; payload: { offerCash: number; offerPropertyIds: number[]; targetTileId: number; requestCash: number } }
  | null;

/**
 * Decide what action the current bot should take given the game state.
 */
export function getBotAction(gameState: GameState): BotAction {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.isBot || gameState.winnerId !== null) return null;

  const { phase, tiles } = gameState;
  const personality = currentPlayer.personality || BotPersonalityType.BALANCED;

  // ── ROLL phase ──────────────────────────────────────────────────────────────
  if (phase === 'ROLL') {
    if (currentPlayer.inJail) {
      // Aggressive bots want out ASAP
      if (personality === BotPersonalityType.AGGRESSIVE && currentPlayer.money > 100) {
        return { type: 'PAY_JAIL_FINE' };
      }
      // Conservative bots only pay if they have lots of money
      if (personality === BotPersonalityType.CONSERVATIVE && currentPlayer.money > 1000) {
        return { type: 'PAY_JAIL_FINE' };
      }
      // Balanced/Opportunistic
      if (currentPlayer.money > 500 && currentPlayer.jailTurns >= 1) {
        return { type: 'PAY_JAIL_FINE' };
      }
      return { type: 'ATTEMPT_JAIL_ROLL' };
    }
    return { type: 'ROLL_DICE' };
  }

  // ── ACTION phase ─────────────────────────────────────────────────────────────
  if (phase === 'ACTION') {
    const tile = tiles[currentPlayer.position];
    
    // Buffer depends on personality
    let buffer = 200;
    if (personality === BotPersonalityType.AGGRESSIVE) buffer = 50;
    if (personality === BotPersonalityType.CONSERVATIVE) buffer = 500;
    if (personality === BotPersonalityType.OPPORTUNISTIC) {
      // Check if this tile completes a set or blocks someone
      const groupTiles = tiles.filter(t => t.group === tile.group);
      const isBlocking = groupTiles.some(t => t.ownerId !== null && t.ownerId !== currentPlayer.id);
      const isCompleting = groupTiles.filter(t => t.ownerId === currentPlayer.id).length === groupTiles.length - 1;
      if (isBlocking || isCompleting) buffer = 0; // Buy at all costs
    }

    if (tile.price && currentPlayer.money >= tile.price + buffer) {
      return { type: 'BUY_PROPERTY' };
    }

    if (gameState.settings.rules.auctionEnabled) {
      return { type: 'START_AUCTION' };
    }
    return { type: 'END_TURN' };
  }

  // ── TURN_END phase ───────────────────────────────────────────────────────────
  if (phase === 'TURN_END') {
    // 1. Check for upgrades
    const myTiles = tiles.filter(t => t.ownerId === currentPlayer.id && t.type === TileType.PROPERTY);
    for (const tile of myTiles) {
      const groupTiles = tiles.filter(t => t.group === tile.group);
      const hasMonopoly = groupTiles.every(t => t.ownerId === currentPlayer.id);
      
      if (hasMonopoly && tile.buildingCount < 5) {
        let upgradeBuffer = 300;
        if (personality === BotPersonalityType.AGGRESSIVE) upgradeBuffer = 100;
        if (personality === BotPersonalityType.CONSERVATIVE) upgradeBuffer = 600;

        if (currentPlayer.money >= tile.houseCost + upgradeBuffer) {
          // Check even build rule
          if (gameState.settings.rules.evenBuild) {
            const minBuildings = Math.min(...groupTiles.map(t => t.buildingCount));
            if (tile.buildingCount === minBuildings) {
              return { type: 'UPGRADE_PROPERTY', payload: { tileId: tile.id } };
            }
          } else {
            return { type: 'UPGRADE_PROPERTY', payload: { tileId: tile.id } };
          }
        }
      }
    }

    // 2. Check for unmortgaging
    const mortgagedTiles = myTiles.filter(t => t.isMortgaged);
    if (mortgagedTiles.length > 0) {
      const tileToUnmortgage = mortgagedTiles[0];
      const cost = Math.floor(tileToUnmortgage.price * 0.5 * 1.1);
      if (currentPlayer.money > cost + 400) {
        return { type: 'UNMORTGAGE_PROPERTY', payload: { tileId: tileToUnmortgage.id } };
      }
    }

    // 3. Propose trades (occasionally)
    if (Math.random() < 0.1) {
      const tradeAction = getBotTradeProposal(gameState, currentPlayer.id);
      if (tradeAction) return tradeAction;
    }

    return { type: 'END_TURN' };
  }

  return null;
}

/**
 * Improved auction bidding logic with personalities
 */
export function getBotBidAction(
  gameState: GameState,
  botId: number,
  auction: AuctionState
): BotAction {
  const bot = gameState.players.find(p => p.id === botId);
  if (!bot || bot.isBankrupt || bot.id === auction.highestBidderId) return null;

  const tile = gameState.tiles[auction.tileId];
  const personality = bot.personality || BotPersonalityType.BALANCED;
  
  const groupTiles = gameState.tiles.filter(t => t.group === tile.group);
  const botOwnedInGroup = groupTiles.filter(t => t.ownerId === bot.id).length;
  const totalInGroup = groupTiles.length;

  // Base valuation
  let valuation = tile.price;

  // Multipliers based on strategic value
  if (botOwnedInGroup === totalInGroup - 1) {
    valuation *= 4.0; // Completing a monopoly
  } else if (botOwnedInGroup > 0) {
    valuation *= 2.0; // Adding to an existing set
  }

  // Denial bidding
  const otherPlayers = gameState.players.filter(p => p.id !== bot.id && !p.isBankrupt);
  for (const other of otherPlayers) {
    const otherOwned = groupTiles.filter(t => t.ownerId === other.id).length;
    if (otherOwned === totalInGroup - 1) {
      valuation = Math.max(valuation, tile.price * 3.0);
    }
  }

  // Personality adjustments
  if (personality === BotPersonalityType.AGGRESSIVE) valuation *= 1.5;
  if (personality === BotPersonalityType.CONSERVATIVE) valuation *= 0.8;
  if (personality === BotPersonalityType.OPPORTUNISTIC) valuation *= 1.2;

  // Don't exceed valuation or personality-based money limit
  let moneyLimit = 0.9;
  if (personality === BotPersonalityType.AGGRESSIVE) moneyLimit = 1.0;
  if (personality === BotPersonalityType.CONSERVATIVE) moneyLimit = 0.6;

  const maxBid = Math.min(valuation, bot.money * moneyLimit);
  const nextBid = auction.currentBid + GAME_CONSTANTS.MIN_AUCTION_INCREMENT;

  if (nextBid > maxBid) return null;

  // Urgency increases as timer runs low
  const urgency = auction.timer <= 3 ? 0.9 : 0.3;
  if (Math.random() >= urgency) return null;

  // Intimidation bids
  let increment: number = GAME_CONSTANTS.MIN_AUCTION_INCREMENT;
  if (personality === BotPersonalityType.AGGRESSIVE && Math.random() > 0.7) {
    increment = 50;
  }

  return {
    type: 'PLACE_BID',
    payload: { playerId: bot.id, amount: auction.currentBid + increment },
  };
}

/**
 * Logic for bots to propose trades
 */
function getBotTradeProposal(gameState: GameState, botId: number): BotAction {
  const bot = gameState.players.find(p => p.id === botId)!;
  const myTiles = gameState.tiles.filter(t => t.ownerId === botId);
  
  // Find a property someone else has that would complete a set for me
  const targets = gameState.tiles.filter(t => t.ownerId !== null && t.ownerId !== botId && t.type === TileType.PROPERTY);
  
  for (const targetTile of targets) {
    const groupTiles = gameState.tiles.filter(t => t.group === targetTile.group);
    const iOwnInGroup = groupTiles.filter(t => t.ownerId === botId).length;
    
    // If I have most of the group, try to trade for the missing piece
    if (iOwnInGroup >= groupTiles.length - 1) {
      const owner = gameState.players.find(p => p.id === targetTile.ownerId)!;
      
      // Offer cash or a property I don't need
      const myUselessTiles = myTiles.filter(t => {
        const g = gameState.tiles.filter(tile => tile.group === t.group);
        return g.filter(tile => tile.ownerId === botId).length === 1; // I only have this one
      });

      const offerCash = Math.min(bot.money * 0.5, targetTile.price * 2);
      const offerPropertyIds = myUselessTiles.slice(0, 1).map(t => t.id);

      return {
        type: 'PROPOSE_TRADE',
        payload: {
          offerCash,
          offerPropertyIds,
          targetTileId: targetTile.id,
          requestCash: 0
        }
      };
    }
  }

  return null;
}