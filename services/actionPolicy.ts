// CQ-8: Single source of truth for which action types non-host players may submit.
// Imported by both server.ts (socket gate) and App.tsx (host gate) so they can never
// drift. Any new action that should be playable by a non-host must be added here.

export const PLAYER_ALLOWED_ACTIONS: ReadonlySet<string> = new Set<string>([
  'ROLL_DICE',
  'BUY_PROPERTY',
  'ATTEMPT_JAIL_ROLL',
  'SKIP_JAIL_TURN',
  'PAY_JAIL_FINE',
  'USE_JAIL_CARD',
  'MORTGAGE_PROPERTY',
  'UNMORTGAGE_PROPERTY',
  'UPGRADE_PROPERTY',
  'DOWNGRADE_PROPERTY',
  'SELL_PROPERTY',
  'PROPOSE_TRADE',
  'ACCEPT_TRADE',
  'DECLINE_TRADE',
  'CANCEL_TRADE',
  'PLACE_BID',
  'PASS_AUCTION',
  'END_TURN',
  'DECLARE_BANKRUPT',
  'VOTE_KICK',
]);
