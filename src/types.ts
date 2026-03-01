export enum TileType {
  PROPERTY = 'PROPERTY',
  RAILROAD = 'RAILROAD',
  UTILITY = 'UTILITY',
  CHANCE = 'CHANCE',
  COMMUNITY_CHEST = 'COMMUNITY_CHEST',
  TAX = 'TAX',
  CORNER = 'CORNER'
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
  NONE = 'NONE'
}

export interface Tile {
  id: number;
  name: string;
  type: TileType;
  group: ColorGroup;
  price: number;
  rent: number[];
  houseCost: number;
  ownerId: number | null;
  buildingCount: number;
  isMortgaged: boolean;
  countryCode?: string;
}

export interface Player {
  id: number;
  name: string;
  money: number;
  position: number;
  color: string;
  avatarId: number;
  isBankrupt: boolean;
  inJail: boolean;
  jailTurns: number;
  properties: number[];
  isBot: boolean;
}

export interface Auction {
  tileId: number;
  currentBid: number;
  highestBidderId: number | null;
  bidders: number[];
  timer: number;
}

export interface GameSettings {
  rules: {
    auctionEnabled: boolean;
    doubleRentOnMonopoly: boolean;
    evenBuild: boolean;
  };
}

export interface GameState {
  tiles: Tile[];
  players: Player[];
  currentPlayerIndex: number;
  dice: [number, number];
  phase: 'ROLL' | 'MOVING' | 'ACTION' | 'RESOLVING' | 'TURN_END' | 'AUCTION';
  logs: string[];
  turnLogs: string[];
  winnerId: number | null;
  taxPool: number;
  auction: Auction | null;
  settings: GameSettings;
}
