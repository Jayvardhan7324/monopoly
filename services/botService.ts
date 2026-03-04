/**
 * botService.ts
 * IMP-11: All bot decision logic extracted from App.tsx into a dedicated service.
 * Enhanced with strategic buying, smarter trade proposals, and personality-driven decisions.
 */
import { GameState, AuctionState, BotPersonalityType, TileType, ColorGroup, Tile } from '../types';
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

// ─── Helper: compute strategic value of a tile for a player ────────────────
function tileStrategicValue(tileId: number, playerId: number, gameState: GameState): number {
  const tile = gameState.tiles[tileId];
  const groupTiles = gameState.tiles.filter(t => t.group === tile.group && tile.group !== ColorGroup.NONE);
  if (groupTiles.length === 0) return tile.price;

  const ownedInGroup = groupTiles.filter(t => t.ownerId === playerId).length;
  const totalInGroup = groupTiles.length;

  let value = tile.price;

  // Monopoly-completing tile is extremely valuable
  if (ownedInGroup === totalInGroup - 1) {
    value *= 5;
  } else if (ownedInGroup > 0) {
    value *= 2;
  }

  // Higher rent multipliers are more valuable
  if (tile.rent && tile.rent[5]) {
    value += tile.rent[5] * 0.3; // Hotel rent as a bonus factor
  }

  // Properties with buildings are more valuable
  if (tile.buildingCount > 0) {
    value += tile.buildingCount * tile.houseCost * 0.5;
  }

  return value;
}

// ─── Helper: find which opponent would be most threatened by a purchase ────
function wouldBlockOpponent(tileId: number, playerId: number, gameState: GameState): boolean {
  const tile = gameState.tiles[tileId];
  if (tile.group === ColorGroup.NONE) return false;
  const groupTiles = gameState.tiles.filter(t => t.group === tile.group);
  return gameState.players.some(p => {
    if (p.id === playerId || p.isBankrupt) return false;
    const theirCount = groupTiles.filter(t => t.ownerId === p.id).length;
    return theirCount === groupTiles.length - 1; // They'd complete a monopoly if they get this
  });
}

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
      // Consider board state: if bot has monopolies and buildings matter, get out faster
      const myMonopolies = getPlayerMonopolies(currentPlayer.id, gameState);

      // Aggressive bots want out ASAP
      if (personality === BotPersonalityType.AGGRESSIVE && currentPlayer.money > 100) {
        return { type: 'PAY_JAIL_FINE' };
      }
      // Conservative bots only pay if they have lots of money or are late game
      if (personality === BotPersonalityType.CONSERVATIVE && currentPlayer.money > 1000) {
        return { type: 'PAY_JAIL_FINE' };
      }
      // If we have monopolies and can build, escaping jail is more urgent
      if (myMonopolies.length > 0 && currentPlayer.money > 400) {
        return { type: 'PAY_JAIL_FINE' };
      }
      // Balanced/Opportunistic — pay after 1 turn in jail if affordable
      if (currentPlayer.money > 500 && currentPlayer.jailTurns >= 1) {
        return { type: 'PAY_JAIL_FINE' };
      }
      // Last chance — must pay on final jail turn
      if (currentPlayer.jailTurns >= GAME_CONSTANTS.MAX_JAIL_TURNS - 1 && currentPlayer.money >= GAME_CONSTANTS.JAIL_FINE) {
        return { type: 'PAY_JAIL_FINE' };
      }
      return { type: 'ATTEMPT_JAIL_ROLL' };
    }
    return { type: 'ROLL_DICE' };
  }

  // ── ACTION phase ─────────────────────────────────────────────────────────────
  if (phase === 'ACTION') {
    const tile = tiles[currentPlayer.position];
    const groupTiles = tiles.filter(t => t.group === tile.group && tile.group !== ColorGroup.NONE);
    const ownedInGroup = groupTiles.filter(t => t.ownerId === currentPlayer.id).length;
    const totalInGroup = groupTiles.length;
    const isCompletingMonopoly = ownedInGroup === totalInGroup - 1 && totalInGroup > 1;
    const isBlockingOpponent = wouldBlockOpponent(tile.id, currentPlayer.id, gameState);
    const isUtilityOrRailroad = tile.type === TileType.RAILROAD || tile.type === TileType.UTILITY;

    // Strategic buying buffer — depends on property importance
    let buffer = 200;

    if (isCompletingMonopoly) {
      // Completing a monopoly: buy at almost any cost
      buffer = 0;
      // Even mortgage other properties to afford it
      if (currentPlayer.money < tile.price && currentPlayer.money + getMortgageableValue(currentPlayer.id, gameState) >= tile.price) {
        // Will buy — the auto-mortgage in reducer should handle it
        buffer = 0;
      }
    } else if (isBlockingOpponent) {
      // Blocking an opponent's monopoly: slightly more aggressive
      buffer = personality === BotPersonalityType.CONSERVATIVE ? 100 : 0;
    } else if (ownedInGroup > 0) {
      // Building towards a set
      buffer = personality === BotPersonalityType.AGGRESSIVE ? 50 : 150;
    } else if (isUtilityOrRailroad) {
      // Utilities and railroads: modest value
      const railroads = tiles.filter(t => t.type === tile.type && t.ownerId === currentPlayer.id).length;
      buffer = railroads > 0 ? 100 : 300; // Buy more eagerly if we already own some
    } else {
      // New color group with no existing ownership
      switch (personality) {
        case BotPersonalityType.AGGRESSIVE: buffer = 50; break;
        case BotPersonalityType.CONSERVATIVE: buffer = 500; break;
        case BotPersonalityType.OPPORTUNISTIC: buffer = 200; break;
        default: buffer = 200;
      }
    }

    // Late game: bots should be more cautious about going broke
    if (gameState.turnCount > 80) {
      buffer += 100;
      if (isCompletingMonopoly || isBlockingOpponent) buffer -= 100; // Still aggressive for key buys
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
    // 1. Check for upgrades — prioritize highest-value monopolies
    const myTiles = tiles.filter(t => t.ownerId === currentPlayer.id && t.type === TileType.PROPERTY);
    const monopolyGroups = getPlayerMonopolies(currentPlayer.id, gameState);

    // Sort monopoly groups by potential value (hotel rent)
    const sortedGroups = monopolyGroups.sort((a, b) => {
      const aMaxRent = Math.max(...a.map(t => t.rent[5] || 0));
      const bMaxRent = Math.max(...b.map(t => t.rent[5] || 0));
      return bMaxRent - aMaxRent;
    });

    for (const group of sortedGroups) {
      // Find the tile with the lowest building count (even build rule or just balanced)
      const buildableTiles = group
        .filter(t => t.buildingCount < 5 && !t.isMortgaged)
        .sort((a, b) => a.buildingCount - b.buildingCount);

      for (const tile of buildableTiles) {
        let upgradeBuffer = 200;
        if (personality === BotPersonalityType.AGGRESSIVE) upgradeBuffer = 50;
        if (personality === BotPersonalityType.CONSERVATIVE) upgradeBuffer = 400;

        if (currentPlayer.money >= tile.houseCost + upgradeBuffer) {
          // Check even build rule
          if (gameState.settings.rules.evenBuild) {
            const minBuildings = Math.min(...group.map(t => t.buildingCount));
            if (tile.buildingCount === minBuildings) {
              return { type: 'UPGRADE_PROPERTY', payload: { tileId: tile.id } };
            }
          } else {
            return { type: 'UPGRADE_PROPERTY', payload: { tileId: tile.id } };
          }
        }
      }
    }

    // 2. Check for unmortgaging — prioritize properties that could form monopolies
    const mortgagedTiles = myTiles.filter(t => t.isMortgaged);
    if (mortgagedTiles.length > 0) {
      // Prioritize: unmortgage tiles that would complete or contribute to a monopoly
      const sortedMortgaged = [...mortgagedTiles].sort((a, b) => {
        const aGroup = tiles.filter(t => t.group === a.group);
        const bGroup = tiles.filter(t => t.group === b.group);
        const aOwned = aGroup.filter(t => t.ownerId === currentPlayer.id).length;
        const bOwned = bGroup.filter(t => t.ownerId === currentPlayer.id).length;
        return (bOwned / bGroup.length) - (aOwned / aGroup.length);
      });

      for (const tileToUnmortgage of sortedMortgaged) {
        const cost = Math.floor(tileToUnmortgage.price * 0.5 * 1.1);
        const minKeepMoney = personality === BotPersonalityType.CONSERVATIVE ? 600 : 300;
        if (currentPlayer.money > cost + minKeepMoney) {
          return { type: 'UNMORTGAGE_PROPERTY', payload: { tileId: tileToUnmortgage.id } };
        }
      }
    }

    // 3. Propose trades — more frequently and strategically
    const tradeChance = personality === BotPersonalityType.AGGRESSIVE ? 0.35 :
      personality === BotPersonalityType.OPPORTUNISTIC ? 0.30 :
        personality === BotPersonalityType.CONSERVATIVE ? 0.15 : 0.25;

    if (Math.random() < tradeChance) {
      const tradeAction = getBotTradeProposal(gameState, currentPlayer.id);
      if (tradeAction) return tradeAction;
    }

    // 4. Strategic mortgaging: mortgage low-value singles to fund upgrades
    if (monopolyGroups.length > 0) {
      const cheapestUpgrade = monopolyGroups
        .flat()
        .filter(t => t.buildingCount < 5 && !t.isMortgaged)
        .sort((a, b) => a.houseCost - b.houseCost)[0];

      if (cheapestUpgrade && currentPlayer.money < cheapestUpgrade.houseCost) {
        // Find a singleton property to mortgage
        const singletons = myTiles.filter(t => {
          if (t.isMortgaged || t.buildingCount > 0) return false;
          const group = tiles.filter(g => g.group === t.group);
          const owned = group.filter(g => g.ownerId === currentPlayer.id).length;
          return owned === 1 && group.length > 1; // Singleton in its group
        }).sort((a, b) => a.price - b.price);

        if (singletons.length > 0) {
          return { type: 'MORTGAGE_PROPERTY', payload: { tileId: singletons[0].id } };
        }
      }
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
    valuation *= 5; // Completing a monopoly is top priority
  } else if (botOwnedInGroup > 0) {
    valuation *= 2.5; // Adding to an existing set
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

  // Late game multiplier — properties are more scarce
  if (gameState.turnCount > 50) valuation *= 1.2;
  if (gameState.turnCount > 100) valuation *= 1.4;

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

  // Completing monopoly: always bid
  if (botOwnedInGroup === totalInGroup - 1 && totalInGroup > 1) bidProbability = 1.0;

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
  let finalBid = Math.min(auction.currentBid + increment, maxBid);

  // BUG-M3: Ensure the bid is always at least MIN_AUCTION_INCREMENT above the current bid
  finalBid = Math.max(finalBid, nextMinBid);

  // Only bid if it's actually higher than current and we can afford it
  if (finalBid <= auction.currentBid || finalBid > maxBid) return null;

  return {
    type: 'PLACE_BID',
    payload: { playerId: bot.id, amount: finalBid },
  };
}

/**
 * Enhanced trade proposal logic with strategic valuation
 */
function getBotTradeProposal(gameState: GameState, botId: number): BotAction {
  const bot = gameState.players.find(p => p.id === botId)!;
  const personality = bot.personality || BotPersonalityType.BALANCED;
  const tiles = gameState.tiles;
  const myTiles = tiles.filter(t => t.ownerId === botId);

  // Strategy 1: Try to complete a monopoly by trading for the missing piece
  const targets = tiles.filter(t =>
    t.ownerId !== null && t.ownerId !== botId && !t.isMortgaged &&
    (t.type === TileType.PROPERTY || t.type === TileType.RAILROAD)
  );

  // Sort targets by how close we are to completing their group
  const scoredTargets = targets.map(targetTile => {
    const groupTiles = tiles.filter(t => t.group === targetTile.group);
    const iOwnInGroup = groupTiles.filter(t => t.ownerId === botId).length;
    const totalInGroup = groupTiles.length;
    const completionRatio = totalInGroup > 0 ? iOwnInGroup / totalInGroup : 0;
    return { tile: targetTile, iOwnInGroup, totalInGroup, completionRatio };
  }).sort((a, b) => b.completionRatio - a.completionRatio);

  for (const target of scoredTargets) {
    const { tile: targetTile, iOwnInGroup, totalInGroup } = target;

    // Only propose trades for tiles where we own at least one other in the group
    if (iOwnInGroup === 0) continue;

    const targetOwner = gameState.players.find(p => p.id === targetTile.ownerId);
    if (!targetOwner || targetOwner.isBankrupt) continue;

    // Calculate what we're willing to offer
    const isCompletingSet = iOwnInGroup >= totalInGroup - 1;
    const baseOffer = targetTile.price;

    // Find properties to offer: prefer singletons in groups we don't care about
    const myTradeableProps = myTiles.filter(t => {
      if (t.isMortgaged || t.buildingCount > 0) return false;
      const g = tiles.filter(g2 => g2.group === t.group);
      const myCountInGroup = g.filter(g2 => g2.ownerId === botId).length;
      // Don't offer from groups where we're building towards a monopoly
      if (myCountInGroup >= g.length - 1 && g.length > 1) return false;
      return true;
    });

    // Prefer offering properties that would benefit the target player
    const beneficialProps = myTradeableProps.filter(t => {
      const g = tiles.filter(g2 => g2.group === t.group);
      const targetOwnedInGroup = g.filter(g2 => g2.ownerId === targetOwner.id).length;
      return targetOwnedInGroup > 0; // The target also has properties in this group
    });

    const propsToOffer = beneficialProps.length > 0
      ? beneficialProps.slice(0, isCompletingSet ? 2 : 1)
      : myTradeableProps.slice(0, 1);

    const offerPropertyIds = propsToOffer.map(t => t.id);
    const offeredPropertyValue = propsToOffer.reduce((sum, t) => sum + t.price, 0);

    // Calculate cash offer
    let cashOffer = 0;
    if (isCompletingSet) {
      // We really want this: offer more cash
      const premium = personality === BotPersonalityType.AGGRESSIVE ? 2.5 :
        personality === BotPersonalityType.OPPORTUNISTIC ? 2.0 : 1.5;
      cashOffer = Math.max(0, Math.floor(baseOffer * premium - offeredPropertyValue));
      cashOffer = Math.min(cashOffer, Math.floor(bot.money * 0.6)); // Don't go broke
    } else {
      cashOffer = Math.max(0, Math.floor(baseOffer * 1.2 - offeredPropertyValue));
      cashOffer = Math.min(cashOffer, Math.floor(bot.money * 0.4));
    }

    // Don't propose empty trades
    if (cashOffer === 0 && offerPropertyIds.length === 0) continue;

    // Don't propose if we can't afford it
    if (cashOffer > bot.money) continue;

    return {
      type: 'PROPOSE_TRADE',
      payload: {
        offerCash: cashOffer,
        offerPropertyIds,
        targetTileId: targetTile.id,
        requestCash: 0
      }
    };
  }

  // Strategy 2: Request cash for a property someone might want
  if (bot.money < 300 && personality !== BotPersonalityType.CONSERVATIVE) {
    const singletons = myTiles.filter(t => {
      if (t.isMortgaged || t.buildingCount > 0) return false;
      const g = tiles.filter(g2 => g2.group === t.group);
      const myCount = g.filter(g2 => g2.ownerId === botId).length;
      return myCount === 1 && g.length > 1;
    });

    for (const singleton of singletons) {
      const g = tiles.filter(g2 => g2.group === singleton.group);
      // Find a player who wants this
      for (const player of gameState.players) {
        if (player.id === botId || player.isBankrupt) continue;
        const theirCount = g.filter(g2 => g2.ownerId === player.id).length;
        if (theirCount >= g.length - 2 && theirCount > 0) {
          // They might want this — ask for cash
          const askPrice = Math.floor(singleton.price * 1.5);
          if (player.money >= askPrice) {
            // Offer our singleton for their property in a different group + cash
            return {
              type: 'PROPOSE_TRADE',
              payload: {
                offerCash: 0,
                offerPropertyIds: [],
                targetTileId: singleton.id, // This is hacky but the trade system handles it
                requestCash: askPrice
              }
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Get all monopoly groups for a player
 */
function getPlayerMonopolies(playerId: number, gameState: GameState): Tile[][] {
  const myTiles = gameState.tiles.filter(t => t.ownerId === playerId && t.type === TileType.PROPERTY);
  const groups = new Map<string, Tile[]>();

  for (const tile of myTiles) {
    if (tile.group === ColorGroup.NONE) continue;
    const groupTiles = gameState.tiles.filter(t => t.group === tile.group);
    const allOwned = groupTiles.every(t => t.ownerId === playerId);
    if (allOwned && !groups.has(tile.group)) {
      groups.set(tile.group, groupTiles);
    }
  }

  return Array.from(groups.values());
}

/**
 * Calculate total value of mortgageable properties for a player
 */
function getMortgageableValue(playerId: number, gameState: GameState): number {
  return gameState.tiles
    .filter(t => t.ownerId === playerId && !t.isMortgaged && t.buildingCount === 0)
    .reduce((sum, t) => sum + Math.floor(t.price * GAME_CONSTANTS.MORTGAGE_RATE), 0);
}