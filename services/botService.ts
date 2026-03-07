/**
 * botService.ts
 * IMP-11: All bot decision logic extracted from App.tsx into a dedicated service.
 * Enhanced with:
 *  - Probabilistic decision-making (weighted randomness, risk assessment)
 *  - Board position awareness (danger zones, safe havens)
 *  - Adaptive strategy based on game phase (early/mid/late)
 *  - Smarter building: target 3-house sweet-spot for ROI
 *  - Mortgage prioritization and cash management
 *  - BUG-9 FIX: Bot no longer proposes trades with itself
 */
import { GameState, AuctionState, BotPersonalityType, TileType, ColorGroup, Tile, Player } from '../types';
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

// ─── Constants for game phase detection ────────────────────────────────────
const EARLY_GAME_THRESHOLD = 30;
const MID_GAME_THRESHOLD = 80;

function getGamePhase(turnCount: number): 'early' | 'mid' | 'late' {
  if (turnCount < EARLY_GAME_THRESHOLD) return 'early';
  if (turnCount < MID_GAME_THRESHOLD) return 'mid';
  return 'late';
}

// ─── Probabilistic helper: weighted random decision ────────────────────────
function decide(probability: number): boolean {
  return Math.random() < Math.min(1, Math.max(0, probability));
}

// ─── Helper: Net worth of a player ──────────────────────────────────────────
function getNetWorth(player: Player, tiles: Tile[]): number {
  const propertyValue = tiles
    .filter(t => t.ownerId === player.id)
    .reduce((sum, t) => {
      let val = t.price;
      if (t.buildingCount > 0) val += t.buildingCount * t.houseCost;
      if (t.isMortgaged) val *= 0.5;
      return sum + val;
    }, 0);
  return player.money + propertyValue;
}

// ─── Helper: Calculate how "dangerous" a board region is ────────────────────
function getDangerLevel(position: number, gameState: GameState): number {
  const { tiles, players } = gameState;
  let danger = 0;
  // Check tiles 2-12 spaces ahead (dice roll range)
  for (let offset = 2; offset <= 12; offset++) {
    const tileIndex = (position + offset) % tiles.length;
    const tile = tiles[tileIndex];
    if (tile.ownerId !== null && !tile.isMortgaged) {
      const owner = players.find(p => p.id === tile.ownerId);
      if (owner && !owner.isBankrupt) {
        // Weighted by rent and probability of landing (7 is most common)
        const diceProb = offset <= 7 ? (offset - 1) / 36 : (13 - offset) / 36;
        const rent = tile.rent[tile.buildingCount] || tile.rent[0] || 0;
        danger += rent * diceProb;
      }
    }
  }
  return danger;
}

// ─── Helper: compute strategic value of a tile for a player ────────────────
function tileStrategicValue(tileId: number, playerId: number, gameState: GameState): number {
  const tile = gameState.tiles[tileId];
  const groupTiles = gameState.tiles.filter(t => t.group === tile.group && tile.group !== ColorGroup.NONE);
  if (groupTiles.length === 0) return tile.price;

  const ownedInGroup = groupTiles.filter(t => t.ownerId === playerId).length;
  const totalInGroup = groupTiles.length;
  const phase = getGamePhase(gameState.turnCount);

  let value = tile.price;

  // Monopoly-completing tile is extremely valuable
  if (ownedInGroup === totalInGroup - 1) {
    value *= phase === 'late' ? 7 : 5;
  } else if (ownedInGroup > 0) {
    value *= 2;
  }

  // Higher rent multipliers are more valuable
  if (tile.rent && tile.rent[5]) {
    value += tile.rent[5] * 0.3;
  }

  // Properties with buildings are more valuable
  if (tile.buildingCount > 0) {
    value += tile.buildingCount * tile.houseCost * 0.5;
  }

  // Orange and red groups are statistically most landed on
  if (tile.group === ColorGroup.ORANGE || tile.group === ColorGroup.RED) {
    value *= 1.25;
  }
  // Light blue is cheap and quick ROI
  if (tile.group === ColorGroup.LIGHT_BLUE && phase === 'early') {
    value *= 1.3;
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
    return theirCount === groupTiles.length - 1;
  });
}

// ─── Cash safety threshold ─────────────────────────────────────────────────
function getSafetyBuffer(bot: Player, gameState: GameState): number {
  const personality = bot.personality || BotPersonalityType.BALANCED;
  const phase = getGamePhase(gameState.turnCount);
  const dangerAhead = getDangerLevel(bot.position, gameState);

  let baseBuffer: number;
  switch (personality) {
    case BotPersonalityType.AGGRESSIVE: baseBuffer = 50; break;
    case BotPersonalityType.CONSERVATIVE: baseBuffer = 300; break;
    case BotPersonalityType.OPPORTUNISTIC: baseBuffer = 150; break;
    default: baseBuffer = 200;
  }

  // Scale buffer by danger and game phase
  if (phase === 'late') baseBuffer += 100;
  baseBuffer += Math.floor(dangerAhead * 0.5);

  return baseBuffer;
}

/**
 * Decide what action the current bot should take given the game state.
 */
export function getBotAction(gameState: GameState): BotAction {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.isBot || gameState.winnerId !== null) return null;
  if (gameState.pendingTrade !== null) return null;

  const { phase, tiles } = gameState;
  const personality = currentPlayer.personality || BotPersonalityType.BALANCED;
  const gPhase = getGamePhase(gameState.turnCount);
  const safetyBuffer = getSafetyBuffer(currentPlayer, gameState);

  // ── ROLL phase ──────────────────────────────────────────────────────────────
  if (phase === 'ROLL') {
    if (currentPlayer.inJail) {
      const myMonopolies = getPlayerMonopolies(currentPlayer.id, gameState);
      const dangerOutside = getDangerLevel(GAME_CONSTANTS.JAIL_POSITION, gameState);

      // Probability-based jail decision
      let payProbability = 0.2; // Base chance

      // Aggressive bots want out quickly
      if (personality === BotPersonalityType.AGGRESSIVE) payProbability += 0.5;
      // Conservative bots stay in jail longer (safe from rent)
      if (personality === BotPersonalityType.CONSERVATIVE) payProbability -= 0.15;
      // If we have monopolies to build on, get out
      if (myMonopolies.length > 0) payProbability += 0.4;
      // Late game: staying in jail can be strategic if lots of danger
      if (gPhase === 'late' && dangerOutside > 200) payProbability -= 0.3;
      // If we have lots of money, we can afford to pay
      if (currentPlayer.money > 800) payProbability += 0.2;
      // Each turn in jail increases urgency
      payProbability += currentPlayer.jailTurns * 0.15;
      // Last turn: must decide
      if (currentPlayer.jailTurns >= GAME_CONSTANTS.MAX_JAIL_TURNS - 1 && currentPlayer.money >= GAME_CONSTANTS.JAIL_FINE) {
        return { type: 'PAY_JAIL_FINE' };
      }

      if (currentPlayer.money >= GAME_CONSTANTS.JAIL_FINE && decide(payProbability)) {
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

    // Calculate buy probability based on many factors
    let buyProbability = 0.7; // Base: bots generally want to buy

    if (isCompletingMonopoly) {
      buyProbability = 0.98; // Almost always buy to complete a set
    } else if (isBlockingOpponent) {
      buyProbability = 0.90; // Block opponents aggressively
    } else if (ownedInGroup > 0) {
      buyProbability = 0.85; // Building towards a set
    } else if (isUtilityOrRailroad) {
      const ownedOfType = tiles.filter(t => t.type === tile.type && t.ownerId === currentPlayer.id).length;
      buyProbability = ownedOfType > 0 ? 0.75 : 0.50; // Utilities less exciting alone
    } else {
      // Brand new color group
      buyProbability = gPhase === 'early' ? 0.65 : 0.45;
    }

    // Personality adjustments
    if (personality === BotPersonalityType.AGGRESSIVE) buyProbability += 0.15;
    if (personality === BotPersonalityType.CONSERVATIVE) buyProbability -= 0.20;
    if (personality === BotPersonalityType.OPPORTUNISTIC && isBlockingOpponent) buyProbability += 0.10;

    // Cash safety: reduce probability if buying would leave us broke
    const remainingCash = currentPlayer.money - tile.price;
    if (remainingCash < safetyBuffer && !isCompletingMonopoly) {
      buyProbability -= 0.3;
    }
    if (remainingCash < 0) buyProbability = 0; // Can't afford

    // Orange/red are premium — boost
    if ((tile.group === ColorGroup.ORANGE || tile.group === ColorGroup.RED) && gPhase !== 'late') {
      buyProbability += 0.1;
    }

    if (tile.price && currentPlayer.money >= tile.price && decide(buyProbability)) {
      return { type: 'BUY_PROPERTY' };
    }

    if (gameState.settings.rules.auctionEnabled) {
      return { type: 'START_AUCTION' };
    }
    return { type: 'END_TURN' };
  }

  // ── TURN_END phase ───────────────────────────────────────────────────────────
  if (phase === 'TURN_END') {
    // 1. Check for upgrades — target the 3-house sweet spot for return on investment
    const monopolyGroups = getPlayerMonopolies(currentPlayer.id, gameState);

    // Sort by ROI: prioritize groups where 3 houses give the biggest rent jump
    const sortedGroups = monopolyGroups.sort((a, b) => {
      const aROI = Math.max(...a.map(t => (t.rent[3] || 0) / (t.houseCost || 1)));
      const bROI = Math.max(...b.map(t => (t.rent[3] || 0) / (t.houseCost || 1)));
      return bROI - aROI;
    });

    for (const group of sortedGroups) {
      const buildableTiles = group
        .filter(t => t.buildingCount < 5 && !t.isMortgaged)
        .sort((a, b) => a.buildingCount - b.buildingCount);

      for (const tile of buildableTiles) {
        // Smart building: prioritize getting to 3 houses (best rent/cost ratio)
        let upgradeProb = 0.6;
        if (tile.buildingCount < 3) upgradeProb = 0.85; // Push to 3 houses aggressively
        if (tile.buildingCount >= 3 && tile.buildingCount < 5) upgradeProb = 0.45; // Hotels are expensive
        if (personality === BotPersonalityType.AGGRESSIVE) upgradeProb += 0.15;
        if (personality === BotPersonalityType.CONSERVATIVE) upgradeProb -= 0.20;

        // Don't build if it leaves us dangerously low
        const afterBuild = currentPlayer.money - tile.houseCost;
        if (afterBuild < safetyBuffer / 2) upgradeProb -= 0.4;

        if (currentPlayer.money >= tile.houseCost && decide(upgradeProb)) {
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

    // 2. Unmortgage properties — prefer monopoly-contributing tiles
    const myTiles = tiles.filter(t => t.ownerId === currentPlayer.id && t.type === TileType.PROPERTY);
    const mortgagedTiles = myTiles.filter(t => t.isMortgaged);
    if (mortgagedTiles.length > 0) {
      const sortedMortgaged = [...mortgagedTiles].sort((a, b) => {
        const aGroup = tiles.filter(t => t.group === a.group);
        const bGroup = tiles.filter(t => t.group === b.group);
        const aOwned = aGroup.filter(t => t.ownerId === currentPlayer.id).length;
        const bOwned = bGroup.filter(t => t.ownerId === currentPlayer.id).length;
        return (bOwned / bGroup.length) - (aOwned / aGroup.length);
      });

      for (const tileToUnmortgage of sortedMortgaged) {
        const cost = Math.floor(tileToUnmortgage.price * GAME_CONSTANTS.MORTGAGE_RATE * GAME_CONSTANTS.UNMORTGAGE_FEE);
        const minKeep = personality === BotPersonalityType.CONSERVATIVE ? 600 : 300;
        if (currentPlayer.money > cost + minKeep && decide(0.7)) {
          return { type: 'UNMORTGAGE_PROPERTY', payload: { tileId: tileToUnmortgage.id } };
        }
      }
    }

    // 3. Propose trades — probabilistic with strategic targeting
    const tradeChance = personality === BotPersonalityType.AGGRESSIVE ? 0.35 :
      personality === BotPersonalityType.OPPORTUNISTIC ? 0.30 :
        personality === BotPersonalityType.CONSERVATIVE ? 0.15 : 0.25;

    if (decide(tradeChance)) {
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
        const singletons = myTiles.filter(t => {
          if (t.isMortgaged || t.buildingCount > 0) return false;
          const group = tiles.filter(g => g.group === t.group);
          const owned = group.filter(g => g.ownerId === currentPlayer.id).length;
          return owned === 1 && group.length > 1;
        }).sort((a, b) => a.price - b.price);

        if (singletons.length > 0 && decide(0.6)) {
          return { type: 'MORTGAGE_PROPERTY', payload: { tileId: singletons[0].id } };
        }
      }
    }

    return { type: 'END_TURN' };
  }

  return null;
}

/**
 * Improved auction bidding logic with probabilistic sniping and bluffing
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
  const gPhase = getGamePhase(gameState.turnCount);

  const groupTiles = gameState.tiles.filter(t => t.group === tile.group);
  const botOwnedInGroup = groupTiles.filter(t => t.ownerId === bot.id).length;
  const totalInGroup = groupTiles.length;

  // 1. Strategic Valuation
  let valuation = tileStrategicValue(tile.id, bot.id, gameState);

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

  // Late game scarcity
  if (gPhase === 'mid') valuation *= 1.15;
  if (gPhase === 'late') valuation *= 1.4;

  // Personality fine-tuning
  if (personality === BotPersonalityType.AGGRESSIVE) valuation *= 1.4;
  if (personality === BotPersonalityType.CONSERVATIVE) valuation *= 0.7;
  if (personality === BotPersonalityType.OPPORTUNISTIC) valuation *= 1.2;

  // 2. Financial Limits
  let moneyLimitPercent = 0.85;
  if (personality === BotPersonalityType.AGGRESSIVE) moneyLimitPercent = 1.0;
  if (personality === BotPersonalityType.CONSERVATIVE) moneyLimitPercent = 0.5;
  if (personality === BotPersonalityType.OPPORTUNISTIC && highestThreatMultiplier > 1) moneyLimitPercent = 0.95;

  const maxBid = Math.min(valuation, bot.money * moneyLimitPercent);
  const nextMinBid = auction.currentBid + GAME_CONSTANTS.MIN_AUCTION_INCREMENT;

  if (nextMinBid > maxBid) return null;

  // 3. Bidding Probability & Timing
  const timeRemaining = auction.timer;
  let bidProbability = 0.35;

  // Sniping behavior: wait till the end
  if (timeRemaining <= 2) bidProbability = 0.92;
  else if (timeRemaining <= 4) bidProbability = 0.65;
  else if (timeRemaining > 8) {
    if (personality === BotPersonalityType.CONSERVATIVE) bidProbability = 0.08;
    if (personality === BotPersonalityType.OPPORTUNISTIC) bidProbability = 0.15;
    if (personality === BotPersonalityType.AGGRESSIVE) bidProbability = 0.75;
  }

  // Competitive: bid more if a rival has the lead
  if (auction.highestBidderId !== null) {
    const leader = gameState.players.find(p => p.id === auction.highestBidderId);
    if (leader && !leader.isBot) bidProbability += 0.15; // Compete harder vs humans
  }

  // Completing monopoly: always bid
  if (botOwnedInGroup === totalInGroup - 1 && totalInGroup > 1) bidProbability = 1.0;

  if (!decide(bidProbability)) return null;

  // 4. Dynamic Increments with bluffing
  let increment: number = GAME_CONSTANTS.MIN_AUCTION_INCREMENT;

  // Bluff/intimidation bid (aggressive bots sometimes overbid to scare)
  const shouldBluffBid =
    (personality === BotPersonalityType.AGGRESSIVE && decide(0.25)) ||
    (highestThreatMultiplier > 2 && decide(0.15));

  if (shouldBluffBid) {
    const gap = maxBid - auction.currentBid;
    if (gap > 100) {
      increment = Math.floor(gap * (0.15 + Math.random() * 0.25));
    } else if (gap > 50) {
      increment = Math.floor(gap * 0.5);
    }
  } else if (timeRemaining <= 2 && decide(0.5)) {
    // Last-second snipe: small extra to edge ahead
    increment += Math.floor(Math.random() * 20);
  }

  increment = Math.max(increment, GAME_CONSTANTS.MIN_AUCTION_INCREMENT);

  let finalBid = Math.min(auction.currentBid + increment, maxBid);
  finalBid = Math.max(finalBid, nextMinBid);

  if (finalBid <= auction.currentBid || finalBid > maxBid) return null;

  return {
    type: 'PLACE_BID',
    payload: { playerId: bot.id, amount: finalBid },
  };
}

/**
 * BUG-9 FIX: Enhanced trade proposal logic — bot never trades with itself
 */
function getBotTradeProposal(gameState: GameState, botId: number): BotAction {
  const bot = gameState.players.find(p => p.id === botId)!;
  const personality = bot.personality || BotPersonalityType.BALANCED;
  const tiles = gameState.tiles;
  const myTiles = tiles.filter(t => t.ownerId === botId);
  const gPhase = getGamePhase(gameState.turnCount);

  // Strategy 1: Try to complete a monopoly by trading for the missing piece
  const targets = tiles.filter(t =>
    t.ownerId !== null && t.ownerId !== botId && !t.isMortgaged &&
    (t.type === TileType.PROPERTY || t.type === TileType.RAILROAD)
  );

  const scoredTargets = targets.map(targetTile => {
    const groupTiles = tiles.filter(t => t.group === targetTile.group);
    const iOwnInGroup = groupTiles.filter(t => t.ownerId === botId).length;
    const totalInGroup = groupTiles.length;
    const completionRatio = totalInGroup > 0 ? iOwnInGroup / totalInGroup : 0;
    return { tile: targetTile, iOwnInGroup, totalInGroup, completionRatio };
  }).sort((a, b) => b.completionRatio - a.completionRatio);

  for (const target of scoredTargets) {
    const { tile: targetTile, iOwnInGroup, totalInGroup } = target;
    if (iOwnInGroup === 0) continue;

    const targetOwner = gameState.players.find(p => p.id === targetTile.ownerId);
    // BUG-9 FIX: Skip if target owner is the bot itself
    if (!targetOwner || targetOwner.isBankrupt || targetOwner.id === botId) continue;

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

    // Prefer offering properties the target would want
    const beneficialProps = myTradeableProps.filter(t => {
      const g = tiles.filter(g2 => g2.group === t.group);
      const targetOwnedInGroup = g.filter(g2 => g2.ownerId === targetOwner.id).length;
      return targetOwnedInGroup > 0;
    });

    const propsToOffer = beneficialProps.length > 0
      ? beneficialProps.slice(0, isCompletingSet ? 2 : 1)
      : myTradeableProps.slice(0, 1);

    const offerPropertyIds = propsToOffer.map(t => t.id);
    const offeredPropertyValue = propsToOffer.reduce((sum, t) => sum + t.price, 0);

    let cashOffer = 0;
    if (isCompletingSet) {
      const premium = personality === BotPersonalityType.AGGRESSIVE ? 2.5 :
        personality === BotPersonalityType.OPPORTUNISTIC ? 2.0 : 1.5;
      cashOffer = Math.max(0, Math.floor(baseOffer * premium - offeredPropertyValue));
      cashOffer = Math.min(cashOffer, Math.floor(bot.money * 0.6));
    } else {
      cashOffer = Math.max(0, Math.floor(baseOffer * 1.2 - offeredPropertyValue));
      cashOffer = Math.min(cashOffer, Math.floor(bot.money * 0.4));
    }

    if (cashOffer === 0 && offerPropertyIds.length === 0) continue;
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

  // Strategy 2: Offer a singleton for cash if we're low on money
  // BUG-9 FIX: Only propose to OTHER players (check targetOwner !== botId)
  if (bot.money < 300 && personality !== BotPersonalityType.CONSERVATIVE) {
    const singletons = myTiles.filter(t => {
      if (t.isMortgaged || t.buildingCount > 0) return false;
      const g = tiles.filter(g2 => g2.group === t.group);
      const myCount = g.filter(g2 => g2.ownerId === botId).length;
      return myCount === 1 && g.length > 1;
    });

    for (const singleton of singletons) {
      const g = tiles.filter(g2 => g2.group === singleton.group);
      for (const player of gameState.players) {
        if (player.id === botId || player.isBankrupt) continue;
        const theirCount = g.filter(g2 => g2.ownerId === player.id).length;
        if (theirCount >= g.length - 2 && theirCount > 0) {
          const askPrice = Math.floor(singleton.price * 1.5);
          if (player.money >= askPrice) {
            // Find a tile owned by this player to "target" for the trade
            const theirTile = g.find(g2 => g2.ownerId === player.id);
            if (!theirTile) continue;
            return {
              type: 'PROPOSE_TRADE',
              payload: {
                offerCash: 0,
                offerPropertyIds: [singleton.id],
                targetTileId: theirTile.id,
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