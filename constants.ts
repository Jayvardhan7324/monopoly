import { Tile, TileType, ColorGroup } from './types';

// IMP-10: Centralized game constants — no more magic numbers inline
export const GAME_CONSTANTS = {
  JAIL_FINE: 50,
  GO_BONUS: 200,
  JAIL_POSITION: 10,
  GO_TO_JAIL_POSITION: 30,
  MIN_AUCTION_INCREMENT: 10,
  MAX_JAIL_TURNS: 3,
  MAX_DOUBLES_BEFORE_JAIL: 3,
  AUCTION_TIMER_SECONDS: 10,
  LOG_MAX_ENTRIES: 50,
  MORTGAGE_RATE: 0.5,        // 50% of price
  UNMORTGAGE_FEE: 1.1,       // 110% of mortgage value
  SELL_RATE: 0.5,            // 50% of price
  INCOME_TAX_AMOUNT: 200,
  LUXURY_TAX_AMOUNT: 100,
} as const;

export const PLAYERS_INITIAL_CASH = 1500;
export const BOARD_SIZE = 40;

const createTile = (
  id: number,
  name: string,
  type: TileType,
  price: number = 0,
  group: ColorGroup = ColorGroup.NONE,
  rent: number[] = [],
  houseCost: number = 0,
  countryCode?: string
): Tile => ({
  id,
  name,
  type,
  price,
  rent,
  group,
  ownerId: null,
  buildingCount: 0,
  isMortgaged: false,
  houseCost,
  countryCode,
});

export const INITIAL_TILES: Tile[] = [
  createTile(0, 'START', TileType.CORNER),
  createTile(1, 'Salvador', TileType.PROPERTY, 60, ColorGroup.BROWN, [2, 10, 30, 90, 160, 250], 50, 'br'),
  createTile(2, 'Treasure', TileType.COMMUNITY_CHEST),
  createTile(3, 'Rio', TileType.PROPERTY, 60, ColorGroup.BROWN, [4, 20, 60, 180, 320, 450], 50, 'br'),
  createTile(4, 'Income Tax', TileType.TAX, 0),
  createTile(5, 'TLV Airport', TileType.RAILROAD, 200),
  createTile(6, 'Tel Aviv', TileType.PROPERTY, 100, ColorGroup.LIGHT_BLUE, [6, 30, 90, 270, 400, 550], 50, 'il'),
  createTile(7, 'Surprise', TileType.CHANCE),
  createTile(8, 'Haifa', TileType.PROPERTY, 100, ColorGroup.LIGHT_BLUE, [6, 30, 90, 270, 400, 550], 50, 'il'),
  createTile(9, 'Jerusalem', TileType.PROPERTY, 120, ColorGroup.LIGHT_BLUE, [8, 40, 100, 300, 450, 600], 50, 'il'),
  createTile(10, 'In Prison', TileType.CORNER),
  createTile(11, 'Venice', TileType.PROPERTY, 140, ColorGroup.PINK, [10, 50, 150, 450, 625, 750], 100, 'it'),
  createTile(12, 'Electric Company', TileType.UTILITY, 150),
  createTile(13, 'Milan', TileType.PROPERTY, 140, ColorGroup.PINK, [10, 50, 150, 450, 625, 750], 100, 'it'),
  createTile(14, 'Rome', TileType.PROPERTY, 160, ColorGroup.PINK, [12, 60, 180, 500, 700, 900], 100, 'it'),
  createTile(15, 'MUC Airport', TileType.RAILROAD, 200),
  createTile(16, 'Frankfurt', TileType.PROPERTY, 180, ColorGroup.ORANGE, [14, 70, 200, 550, 750, 950], 100, 'de'),
  createTile(17, 'Treasure', TileType.COMMUNITY_CHEST),
  createTile(18, 'Munich', TileType.PROPERTY, 180, ColorGroup.ORANGE, [14, 70, 200, 550, 750, 950], 100, 'de'),
  createTile(19, 'Berlin', TileType.PROPERTY, 200, ColorGroup.ORANGE, [16, 80, 220, 600, 800, 1000], 100, 'de'),
  createTile(20, 'Vacation', TileType.CORNER),
  createTile(21, 'Shenzhen', TileType.PROPERTY, 220, ColorGroup.YELLOW, [18, 90, 250, 700, 875, 1050], 150, 'cn'),
  createTile(22, 'Surprise', TileType.CHANCE),
  createTile(23, 'Beijing', TileType.PROPERTY, 220, ColorGroup.YELLOW, [18, 90, 250, 700, 875, 1050], 150, 'cn'),
  createTile(24, 'Shanghai', TileType.PROPERTY, 240, ColorGroup.YELLOW, [20, 100, 300, 750, 925, 1100], 150, 'cn'),
  createTile(25, 'CDG Airport', TileType.RAILROAD, 200),
  createTile(26, 'Lyon', TileType.PROPERTY, 260, ColorGroup.GREEN, [22, 110, 330, 800, 975, 1150], 150, 'fr'),
  createTile(27, 'Toulouse', TileType.PROPERTY, 260, ColorGroup.GREEN, [22, 110, 330, 800, 975, 1150], 150, 'fr'),
  createTile(28, 'Water Company', TileType.UTILITY, 150),
  createTile(29, 'Paris', TileType.PROPERTY, 280, ColorGroup.GREEN, [24, 120, 360, 850, 1025, 1200], 150, 'fr'),
  createTile(30, 'Go to prison', TileType.CORNER),
  createTile(31, 'Liverpool', TileType.PROPERTY, 300, ColorGroup.DARK_BLUE, [26, 130, 390, 900, 1100, 1275], 200, 'gb'),
  createTile(32, 'Manchester', TileType.PROPERTY, 300, ColorGroup.DARK_BLUE, [26, 130, 390, 900, 1100, 1275], 200, 'gb'),
  createTile(33, 'Treasure', TileType.COMMUNITY_CHEST),
  createTile(34, 'London', TileType.PROPERTY, 320, ColorGroup.DARK_BLUE, [28, 150, 450, 1000, 1200, 1400], 200, 'gb'),
  createTile(35, 'JFK Airport', TileType.RAILROAD, 200),
  createTile(36, 'Surprise', TileType.CHANCE),
  createTile(37, 'San Francisco', TileType.PROPERTY, 350, ColorGroup.RED, [35, 175, 500, 1100, 1300, 1500], 200, 'us'),
  createTile(38, 'Luxury Tax', TileType.TAX, 0),
  createTile(39, 'New York', TileType.PROPERTY, 400, ColorGroup.RED, [50, 200, 600, 1400, 1700, 2000], 200, 'us'),
];

export const PLAYER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#f97316', '#14b8a6'];

// Chance/Community Chest card definitions — IMP-02/03
export type CardType = 'MOVE' | 'MONEY' | 'JAIL' | 'JAIL_FREE';

export interface Card {
  description: string;
  type: CardType;
  value?: number;        // money delta or target position
  perPlayer?: boolean;   // pay/collect from each player
}

export const CHANCE_CARDS: Card[] = [
  { description: 'Advance to GO. Collect $200.', type: 'MOVE', value: 0 },
  { description: 'Go to Jail. Do not pass GO.', type: 'JAIL' },
  { description: 'Bank pays you dividend of $50.', type: 'MONEY', value: 50 },
  { description: 'Your building loan matures. Receive $150.', type: 'MONEY', value: 150 },
  { description: 'Pay poor tax of $15.', type: 'MONEY', value: -15 },
  { description: 'You have won a crossword competition. Collect $100.', type: 'MONEY', value: 100 },
  { description: 'Speeding fine — pay $15.', type: 'MONEY', value: -15 },
  { description: 'Pay each player $50.', type: 'MONEY', value: -50, perPlayer: true },
  { description: 'Collect $150 from the bank.', type: 'MONEY', value: 150 },
  { description: 'Get out of Jail free.', type: 'JAIL_FREE' },
  { description: 'Pay school fees of $150.', type: 'MONEY', value: -150 },
  { description: 'Receive $25 consultancy fee.', type: 'MONEY', value: 25 },
  { description: 'You are assessed for street repairs — pay $100.', type: 'MONEY', value: -100 },
];

export const COMMUNITY_CHEST_CARDS: Card[] = [
  { description: 'Advance to GO. Collect $200.', type: 'MOVE', value: 0 },
  { description: 'Go to Jail. Do not pass GO.', type: 'JAIL' },
  { description: 'Bank error in your favour — collect $200.', type: 'MONEY', value: 200 },
  { description: 'Doctor\'s fees — pay $50.', type: 'MONEY', value: -50 },
  { description: 'From sale of stock, you get $50.', type: 'MONEY', value: 50 },
  { description: 'Holiday fund matures — receive $100.', type: 'MONEY', value: 100 },
  { description: 'Income tax refund — collect $20.', type: 'MONEY', value: 20 },
  { description: 'It is your birthday — collect $10 from every player.', type: 'MONEY', value: 10, perPlayer: true },
  { description: 'Life insurance matures — collect $100.', type: 'MONEY', value: 100 },
  { description: 'Hospital fees — pay $100.', type: 'MONEY', value: -100 },
  { description: 'School fees — pay $150.', type: 'MONEY', value: -150 },
  { description: 'Receive $25 consultancy fee.', type: 'MONEY', value: 25 },
  { description: 'You have won second prize in a beauty contest — collect $10.', type: 'MONEY', value: 10 },
  { description: 'Inherit $100.', type: 'MONEY', value: 100 },
  { description: 'Get out of Jail free.', type: 'JAIL_FREE' },
];