/**
 * botService.ts
 * IMP-11: All bot decision logic extracted from App.tsx into a dedicated service.
 */
import { GameState, AuctionState } from '../types';
import { GAME_CONSTANTS } from '../constants';

export type BotAction =
  | { type: 'ROLL_DICE' }
  | { type: 'PAY_JAIL_FINE' }
  | { type: 'ATTEMPT_JAIL_ROLL' }
  | { type: 'BUY_PROPERTY' }
  | { type: 'START_AUCTION' }
  | { type: 'END_TURN' }
  | { type: 'PLACE_BID'; payload: { playerId: number; amount: number } }
  | null;

/**
 * Decide what action the current bot should take given the game state.
 * Returns null if no action is needed right now.
 */
export function getBotAction(gameState: GameState): BotAction {
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  if (!currentPlayer || !currentPlayer.isBot || gameState.winnerId !== null) return null;

  const { phase } = gameState;

  // ── ROLL phase ──────────────────────────────────────────────────────────────
  if (phase === 'ROLL') {
    if (currentPlayer.inJail) {
      // Only pay fine if we have plenty of money AND we've already tried rolling at least once
      if (currentPlayer.money > 500 && currentPlayer.jailTurns >= 1) {
        return { type: 'PAY_JAIL_FINE' };
      }
      // On turn 3 the reducer forces exit anyway, so always roll
      return { type: 'ATTEMPT_JAIL_ROLL' };
    }
    return { type: 'ROLL_DICE' };
  }

  // ── ACTION phase ─────────────────────────────────────────────────────────────
  if (phase === 'ACTION') {
    const tile = gameState.tiles[currentPlayer.position];
    // Buy if we can afford it comfortably (keep $200 buffer)
    if (tile.price && currentPlayer.money >= tile.price + 200) {
      return { type: 'BUY_PROPERTY' };
    }
    if (gameState.settings.rules.auctionEnabled) {
      return { type: 'START_AUCTION' };
    }
    return { type: 'END_TURN' };
  }

  // ── TURN_END phase ───────────────────────────────────────────────────────────
  if (phase === 'TURN_END') {
    return { type: 'END_TURN' };
  }

  return null;
}

/**
 * Decide whether a bot should place an auction bid.
 * Returns a PLACE_BID action or null.
 */
export function getBotBidAction(
  gameState: GameState,
  botId: number,
  auction: AuctionState
): BotAction {
  const bot = gameState.players.find(p => p.id === botId);
  if (!bot || bot.isBankrupt || bot.id === auction.highestBidderId) return null;

  const tile = gameState.tiles[auction.tileId];
  const groupTiles = gameState.tiles.filter(t => t.group === tile.group);
  const botOwnedInGroup = groupTiles.filter(t => t.ownerId === bot.id).length;
  const totalInGroup = groupTiles.length;

  // Base valuation
  let valuation = tile.price;

  if (botOwnedInGroup === totalInGroup - 1) {
    valuation *= 3.5; // Completing a monopoly — very valuable
  } else if (botOwnedInGroup > 0) {
    valuation *= 1.8; // Adding to an existing set
  }

  // Denial bidding: prevent opponents from completing monopolies
  const otherPlayers = gameState.players.filter(p => p.id !== bot.id && !p.isBankrupt);
  for (const other of otherPlayers) {
    const otherOwned = groupTiles.filter(t => t.ownerId === other.id).length;
    if (otherOwned === totalInGroup - 1) {
      valuation = Math.max(valuation, tile.price * 2.5);
    }
  }

  // Late-game multiplier
  if (gameState.turnCount > 100) valuation *= 1.5;

  // Don't exceed valuation or 90% of current money
  const maxBid = Math.min(valuation, bot.money * 0.9);
  const nextBid = auction.currentBid + GAME_CONSTANTS.MIN_AUCTION_INCREMENT;

  if (nextBid > maxBid) return null;

  // Urgency increases as timer runs low
  const urgency = auction.timer <= 3 ? 0.8 : 0.4;
  if (Math.random() >= urgency) return null;

  // Occasionally place larger bids to intimidate
  const increment =
    Math.random() > 0.8 && bot.money > auction.currentBid + 100
      ? 50
      : GAME_CONSTANTS.MIN_AUCTION_INCREMENT;

  return {
    type: 'PLACE_BID',
    payload: { playerId: bot.id, amount: auction.currentBid + increment },
  };
}