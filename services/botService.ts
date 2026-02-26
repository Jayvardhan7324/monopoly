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
 * Improved auction bidding logic with nuanced strategies and personalities
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

  // 1. Strategic Valuation
  let valuation = tile.price;

  // Multipliers based on strategic value
  if (botOwnedInGroup === totalInGroup - 1 && totalInGroup > 1) {
    valuation *= 4.5; // Completing a monopoly is top priority
  } else if (botOwnedInGroup > 0) {
    valuation *= 2.2; // Adding to an existing set
  }

  // Denial bidding: prevent others from completing sets
  const otherPlayers = gameState.players.filter(p => p.id !== bot.id && !p.isBankrupt);
  let highestThreatMultiplier = 1.0;
  for (const other of otherPlayers) {
    const otherOwned = groupTiles.filter(t => t.ownerId === other.id).length;
    if (otherOwned === totalInGroup - 1 && totalInGroup > 1) {
      highestThreatMultiplier = Math.max(highestThreatMultiplier, 3.5);
    }
  }
  valuation *= highestThreatMultiplier;

  // Personality adjustments to valuation
  if (personality === BotPersonalityType.AGGRESSIVE) valuation *= 1.4;
  if (personality === BotPersonalityType.CONSERVATIVE) valuation *= 0.75;
  if (personality === BotPersonalityType.OPPORTUNISTIC) valuation *= 1.25;

  // 2. Financial Limits
  let moneyLimitPercent = 0.85;
  if (personality === BotPersonalityType.AGGRESSIVE) moneyLimitPercent = 1.0;
  if (personality === BotPersonalityType.CONSERVATIVE) moneyLimitPercent = 0.5;
  if (personality === BotPersonalityType.OPPORTUNISTIC && highestThreatMultiplier > 1) moneyLimitPercent = 0.95;

  const maxBid = Math.min(valuation, bot.money * moneyLimitPercent);
  const nextMinBid = auction.currentBid + GAME_CONSTANTS.MIN_AUCTION_INCREMENT;

  if (nextMinBid > maxBid) return null;

  // 3. Bidding Behavior & Timing
  const timeRemaining = auction.timer;
  const isHumanHighest = auction.highestBidderId === 0;
  
  // Probability to bid based on timer and personality
  let bidProbability = 0.4;
  
  if (timeRemaining <= 2) {
    bidProbability = 0.95; // High urgency at the end (sniping)
  } else if (timeRemaining <= 5) {
    bidProbability = 0.7;
  } else if (timeRemaining > 8) {
    // Early auction: some bots wait to see interest
    if (personality === BotPersonalityType.CONSERVATIVE) bidProbability = 0.1;
    if (personality === BotPersonalityType.OPPORTUNISTIC) bidProbability = 0.2;
    if (personality === BotPersonalityType.AGGRESSIVE) bidProbability = 0.8; // Aggressive bots jump in early
  }

  // Increase probability if a human is winning (competitive)
  if (isHumanHighest) bidProbability += 0.2;

  if (Math.random() > bidProbability) return null;

  // 4. Dynamic Increments
  let increment: number = GAME_CONSTANTS.MIN_AUCTION_INCREMENT;
  
  // Decide if we should "jump bid" to intimidate
  const shouldJumpBid = 
    (personality === BotPersonalityType.AGGRESSIVE && Math.random() > 0.6) ||
    (highestThreatMultiplier > 2 && Math.random() > 0.8) ||
    (botOwnedInGroup === totalInGroup - 1 && Math.random() > 0.7);

  if (shouldJumpBid) {
    // Jump bid is a percentage of the remaining valuation gap
    const gap = maxBid - auction.currentBid;
    if (gap > 100) {
      increment = Math.floor(gap * (0.1 + Math.random() * 0.2));
    } else if (gap > 50) {
      increment = 20;
    }
  } else if (timeRemaining <= 2 && Math.random() > 0.5) {
    // Small extra increment at the end to beat other snipers
    increment += Math.floor(Math.random() * 15);
  }

  // Ensure increment is at least the minimum
  increment = Math.max(increment, GAME_CONSTANTS.MIN_AUCTION_INCREMENT);
  
  // Final bid amount
  const finalBid = Math.min(auction.currentBid + increment, maxBid);
  
  // Only bid if it's actually higher than current
  if (finalBid <= auction.currentBid) return null;

  return {
    type: 'PLACE_BID',
    payload: { playerId: bot.id, amount: finalBid },
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