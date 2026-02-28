export enum TileType {
  PROPERTY = 'PROPERTY',
  RAILROAD = 'RAILROAD',
  UTILITY = 'UTILITY',
  CHANCE = 'CHANCE',
  COMMUNITY_CHEST = 'COMMUNITY_CHEST',
  TAX = 'TAX',
  CORNER = 'CORNER',
}

export enum ColorGroup {
  BROWN = 'BROWN',
  LIGHT_BLUE = 'LIGHT_BLUE',
  PINK = 'PINK',
  ORANGE = 'ORANGE',
  RED = 'RED',
  YELLOW = 'YELLOW',
  GREEN = 'GREEN',
  DARK_BLUE = 'DARK_BLUE',
  NONE = 'NONE',
}

export interface Tile {
  id: number;
  name: string;
  type: TileType;
  price: number;
  rent: number[];
  group: ColorGroup;
  ownerId: number | null;
  buildingCount: number;
  isMortgaged: boolean;
  houseCost: number;
  countryCode?: string;
}

export enum BotPersonalityType {
  AGGRESSIVE = 'AGGRESSIVE',
  CONSERVATIVE = 'CONSERVATIVE',
  BALANCED = 'BALANCED',
  OPPORTUNISTIC = 'OPPORTUNISTIC',
}

export interface Player {
  id: number;
  name: string;
  color: string;
  money: number;
  position: number;
  isBot: boolean;
  isBankrupt: boolean;
  inJail: boolean;
  jailTurns: number;
  personality?: BotPersonalityType;
  avatarId?: number;
}

export interface GameRules {
  doubleRentOnFullSet: boolean;
  vacationCash: boolean;
  auctionEnabled: boolean;
  noRentInJail: boolean;
  mortgageEnabled: boolean;
  evenBuild: boolean;
  startingCash: number;
  randomizeOrder: boolean;
}

export interface GameSettings {
  maxPlayers: number;
  isPrivate: boolean; // BUG-N3: Change from false to boolean
  allowBots: boolean;
  boardMap: string;
  rules: GameRules;
}

export type GamePhase = 'ROLL' | 'MOVING' | 'RESOLVING' | 'ACTION' | 'TURN_END' | 'AUCTION';

export type SoundEffectType =
  | 'roll'
  | 'buy'
  | 'pay'
  | 'upgrade'
  | 'turn_switch'
  | 'win'
  | 'land'
  | 'trade'
  | 'bid'
  | 'ui_click'
  | 'ui_hover'
  | 'modal_open'
  | 'modal_close'
  | 'trade_offer'
  | 'trade_accept'
  | 'trade_decline'
  | 'notification'
  | 'error';

export interface AuctionState {
  tileId: number;
  currentBid: number;
  highestBidderId: number | null;
  bidders: number[];
  timer: number;
}

export interface TradeOffer {
  proposerId: number;
  targetId: number;
  offerCash: number;
  offerPropertyIds: number[];
  targetPropertyId: number;
  requestCash: number;
}

export interface GameState {
  players: Player[];
  tiles: Tile[];
  currentPlayerIndex: number;
  dice: [number, number];
  lastDiceRollDoubles: boolean;
  doublesCount: number;
  phase: GamePhase;
  logs: string[];
  turnLogs: string[];
  winnerId: number | null;
  turnCount: number;
  lastSoundEffect: { type: SoundEffectType; id: number } | null;
  taxPool: number;
  settings: GameSettings;
  auction: AuctionState | null;
  pendingTrade: TradeOffer | null;
}

export interface LogEntry {
  message: string;
  timestamp: number;
}