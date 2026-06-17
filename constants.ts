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
  createTile(0, 'GO', TileType.CORNER),
  createTile(1, 'Mediterranean Avenue', TileType.PROPERTY, 60, ColorGroup.BROWN, [2, 10, 30, 90, 160, 250], 50, 'us'),
  createTile(2, 'Community Chest', TileType.COMMUNITY_CHEST),
  createTile(3, 'Baltic Avenue', TileType.PROPERTY, 60, ColorGroup.BROWN, [4, 20, 60, 180, 320, 450], 50, 'us'),
  createTile(4, 'Income Tax', TileType.TAX, 0),
  createTile(5, 'Reading Railroad', TileType.RAILROAD, 200),
  createTile(6, 'Oriental Avenue', TileType.PROPERTY, 100, ColorGroup.LIGHT_BLUE, [6, 30, 90, 270, 400, 550], 50, 'us'),
  createTile(7, 'Chance', TileType.CHANCE),
  createTile(8, 'Vermont Avenue', TileType.PROPERTY, 100, ColorGroup.LIGHT_BLUE, [6, 30, 90, 270, 400, 550], 50, 'us'),
  createTile(9, 'Connecticut Avenue', TileType.PROPERTY, 120, ColorGroup.LIGHT_BLUE, [8, 40, 100, 300, 450, 600], 50, 'us'),
  createTile(10, 'Jail / Just Visiting', TileType.CORNER),
  createTile(11, 'St. Charles Place', TileType.PROPERTY, 140, ColorGroup.PINK, [10, 50, 150, 450, 625, 750], 100, 'us'),
  createTile(12, 'Electric Company', TileType.UTILITY, 150),
  createTile(13, 'States Avenue', TileType.PROPERTY, 140, ColorGroup.PINK, [10, 50, 150, 450, 625, 750], 100, 'us'),
  createTile(14, 'Virginia Avenue', TileType.PROPERTY, 160, ColorGroup.PINK, [12, 60, 180, 500, 700, 900], 100, 'us'),
  createTile(15, 'Pennsylvania Railroad', TileType.RAILROAD, 200),
  createTile(16, 'St. James Place', TileType.PROPERTY, 180, ColorGroup.ORANGE, [14, 70, 200, 550, 750, 950], 100, 'us'),
  createTile(17, 'Community Chest', TileType.COMMUNITY_CHEST),
  createTile(18, 'Tennessee Avenue', TileType.PROPERTY, 180, ColorGroup.ORANGE, [14, 70, 200, 550, 750, 950], 100, 'us'),
  createTile(19, 'New York Avenue', TileType.PROPERTY, 200, ColorGroup.ORANGE, [16, 80, 220, 600, 800, 1000], 100, 'us'),
  createTile(20, 'Free Parking', TileType.CORNER),
  createTile(21, 'Kentucky Avenue', TileType.PROPERTY, 220, ColorGroup.RED, [18, 90, 250, 700, 875, 1050], 150, 'us'),
  createTile(22, 'Chance', TileType.CHANCE),
  createTile(23, 'Indiana Avenue', TileType.PROPERTY, 220, ColorGroup.RED, [18, 90, 250, 700, 875, 1050], 150, 'us'),
  createTile(24, 'Illinois Avenue', TileType.PROPERTY, 240, ColorGroup.RED, [20, 100, 300, 750, 925, 1100], 150, 'us'),
  createTile(25, 'B. & O. Railroad', TileType.RAILROAD, 200),
  createTile(26, 'Atlantic Avenue', TileType.PROPERTY, 260, ColorGroup.YELLOW, [22, 110, 330, 800, 975, 1150], 150, 'us'),
  createTile(27, 'Ventnor Avenue', TileType.PROPERTY, 260, ColorGroup.YELLOW, [22, 110, 330, 800, 975, 1150], 150, 'us'),
  createTile(28, 'Water Company', TileType.UTILITY, 150),
  createTile(29, 'Marvin Gardens', TileType.PROPERTY, 280, ColorGroup.YELLOW, [24, 120, 360, 850, 1025, 1200], 150, 'us'),
  createTile(30, 'Go to Jail', TileType.CORNER),
  createTile(31, 'Pacific Avenue', TileType.PROPERTY, 300, ColorGroup.GREEN, [26, 130, 390, 900, 1100, 1275], 200, 'us'),
  createTile(32, 'North Carolina Avenue', TileType.PROPERTY, 300, ColorGroup.GREEN, [26, 130, 390, 900, 1100, 1275], 200, 'us'),
  createTile(33, 'Community Chest', TileType.COMMUNITY_CHEST),
  createTile(34, 'Pennsylvania Avenue', TileType.PROPERTY, 320, ColorGroup.GREEN, [28, 150, 450, 1000, 1200, 1400], 200, 'us'),
  createTile(35, 'Short Line', TileType.RAILROAD, 200),
  createTile(36, 'Chance', TileType.CHANCE),
  createTile(37, 'Park Place', TileType.PROPERTY, 350, ColorGroup.DARK_BLUE, [35, 175, 500, 1100, 1300, 1500], 200, 'us'),
  createTile(38, 'Luxury Tax', TileType.TAX, 0),
  createTile(39, 'Boardwalk', TileType.PROPERTY, 400, ColorGroup.DARK_BLUE, [50, 200, 600, 1400, 1700, 2000], 200, 'us'),
];

export const BOARD_PRESETS: Array<{ id: string; name: string; description: string; tiles: Tile[] }> = [
  {
    id: 'atlantic-classic',
    name: 'Atlantic Classic',
    description: 'A classic 40-space Atlantic City style economy board.',
    tiles: INITIAL_TILES,
  },
  {
    id: 'london-classic',
    name: 'London Classic',
    description: 'A UK-style 40-space board with familiar streets and stations.',
    tiles: [
      createTile(0, 'GO', TileType.CORNER),
      createTile(1, 'Old Kent Road', TileType.PROPERTY, 60, ColorGroup.BROWN, [2, 10, 30, 90, 160, 250], 50, 'gb'),
      createTile(2, 'Community Chest', TileType.COMMUNITY_CHEST),
      createTile(3, 'Whitechapel Road', TileType.PROPERTY, 60, ColorGroup.BROWN, [4, 20, 60, 180, 320, 450], 50, 'gb'),
      createTile(4, 'Income Tax', TileType.TAX, 0),
      createTile(5, "King's Cross Station", TileType.RAILROAD, 200),
      createTile(6, 'The Angel Islington', TileType.PROPERTY, 100, ColorGroup.LIGHT_BLUE, [6, 30, 90, 270, 400, 550], 50, 'gb'),
      createTile(7, 'Chance', TileType.CHANCE),
      createTile(8, 'Euston Road', TileType.PROPERTY, 100, ColorGroup.LIGHT_BLUE, [6, 30, 90, 270, 400, 550], 50, 'gb'),
      createTile(9, 'Pentonville Road', TileType.PROPERTY, 120, ColorGroup.LIGHT_BLUE, [8, 40, 100, 300, 450, 600], 50, 'gb'),
      createTile(10, 'Jail / Just Visiting', TileType.CORNER),
      createTile(11, 'Pall Mall', TileType.PROPERTY, 140, ColorGroup.PINK, [10, 50, 150, 450, 625, 750], 100, 'gb'),
      createTile(12, 'Electric Company', TileType.UTILITY, 150),
      createTile(13, 'Whitehall', TileType.PROPERTY, 140, ColorGroup.PINK, [10, 50, 150, 450, 625, 750], 100, 'gb'),
      createTile(14, 'Northumberland Avenue', TileType.PROPERTY, 160, ColorGroup.PINK, [12, 60, 180, 500, 700, 900], 100, 'gb'),
      createTile(15, 'Marylebone Station', TileType.RAILROAD, 200),
      createTile(16, 'Bow Street', TileType.PROPERTY, 180, ColorGroup.ORANGE, [14, 70, 200, 550, 750, 950], 100, 'gb'),
      createTile(17, 'Community Chest', TileType.COMMUNITY_CHEST),
      createTile(18, 'Marlborough Street', TileType.PROPERTY, 180, ColorGroup.ORANGE, [14, 70, 200, 550, 750, 950], 100, 'gb'),
      createTile(19, 'Vine Street', TileType.PROPERTY, 200, ColorGroup.ORANGE, [16, 80, 220, 600, 800, 1000], 100, 'gb'),
      createTile(20, 'Free Parking', TileType.CORNER),
      createTile(21, 'Strand', TileType.PROPERTY, 220, ColorGroup.RED, [18, 90, 250, 700, 875, 1050], 150, 'gb'),
      createTile(22, 'Chance', TileType.CHANCE),
      createTile(23, 'Fleet Street', TileType.PROPERTY, 220, ColorGroup.RED, [18, 90, 250, 700, 875, 1050], 150, 'gb'),
      createTile(24, 'Trafalgar Square', TileType.PROPERTY, 240, ColorGroup.RED, [20, 100, 300, 750, 925, 1100], 150, 'gb'),
      createTile(25, 'Fenchurch Street Station', TileType.RAILROAD, 200),
      createTile(26, 'Leicester Square', TileType.PROPERTY, 260, ColorGroup.YELLOW, [22, 110, 330, 800, 975, 1150], 150, 'gb'),
      createTile(27, 'Coventry Street', TileType.PROPERTY, 260, ColorGroup.YELLOW, [22, 110, 330, 800, 975, 1150], 150, 'gb'),
      createTile(28, 'Water Works', TileType.UTILITY, 150),
      createTile(29, 'Piccadilly', TileType.PROPERTY, 280, ColorGroup.YELLOW, [24, 120, 360, 850, 1025, 1200], 150, 'gb'),
      createTile(30, 'Go to Jail', TileType.CORNER),
      createTile(31, 'Regent Street', TileType.PROPERTY, 300, ColorGroup.GREEN, [26, 130, 390, 900, 1100, 1275], 200, 'gb'),
      createTile(32, 'Oxford Street', TileType.PROPERTY, 300, ColorGroup.GREEN, [26, 130, 390, 900, 1100, 1275], 200, 'gb'),
      createTile(33, 'Community Chest', TileType.COMMUNITY_CHEST),
      createTile(34, 'Bond Street', TileType.PROPERTY, 320, ColorGroup.GREEN, [28, 150, 450, 1000, 1200, 1400], 200, 'gb'),
      createTile(35, 'Liverpool Street Station', TileType.RAILROAD, 200),
      createTile(36, 'Chance', TileType.CHANCE),
      createTile(37, 'Park Lane', TileType.PROPERTY, 350, ColorGroup.DARK_BLUE, [35, 175, 500, 1100, 1300, 1500], 200, 'gb'),
      createTile(38, 'Luxury Tax', TileType.TAX, 0),
      createTile(39, 'Mayfair', TileType.PROPERTY, 400, ColorGroup.DARK_BLUE, [50, 200, 600, 1400, 1700, 2000], 200, 'gb'),
    ],
  },
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
  { description: 'Crypto crash! Lose $200.', type: 'MONEY', value: -200 },
  { description: "Your startup IPO'd! Collect $300 from the bank.", type: 'MONEY', value: 300 },
  { description: 'Flash sale! Collect $75 from every player.', type: 'MONEY', value: 75, perPlayer: true },
  { description: 'Tax audit — pay the bank $250.', type: 'MONEY', value: -250 },
  { description: 'Influencer deal pays off — collect $180.', type: 'MONEY', value: 180 },
  { description: 'Stock market dip — pay $80.', type: 'MONEY', value: -80 },
  { description: 'Lottery win! Collect $500 from the bank.', type: 'MONEY', value: 500 },
  { description: 'Parking ticket — pay $40.', type: 'MONEY', value: -40 },
  { description: 'Your investment portfolio surges — collect $220.', type: 'MONEY', value: 220 },
  { description: 'Insurance claim pays out — collect $120.', type: 'MONEY', value: 120 },
  { description: 'You threw a legendary party — pay each player $30.', type: 'MONEY', value: -30, perPlayer: true },
  { description: 'Go back to START.', type: 'MOVE', value: 0 },
  { description: 'Caught speeding — pay $60 fine.', type: 'MONEY', value: -60 },
  { description: 'Bank glitch adds $50 to your account. Lucky you!', type: 'MONEY', value: 50 },
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
  { description: 'Viral post earns you $150 in sponsorships!', type: 'MONEY', value: 150 },
  { description: 'Plumbing disaster — pay $120 for repairs.', type: 'MONEY', value: -120 },
  { description: 'Community grant awarded — collect $175.', type: 'MONEY', value: 175 },
  { description: 'Caught jaywalking — pay $25 fine.', type: 'MONEY', value: -25 },
  { description: 'Your side hustle blows up — collect $200.', type: 'MONEY', value: 200 },
  { description: 'Surprise property tax — pay $90.', type: 'MONEY', value: -90 },
  { description: 'Sold old furniture — collect $60.', type: 'MONEY', value: 60 },
  { description: 'Owe back rent to the city — pay $80.', type: 'MONEY', value: -80 },
  { description: 'You\'re elected mayor! Collect $50 from each player.', type: 'MONEY', value: 50, perPlayer: true },
  { description: 'Hacker drains $175 from your account.', type: 'MONEY', value: -175 },
  { description: 'Real estate seminar pays off — collect $250.', type: 'MONEY', value: 250 },
  { description: 'Water leak in your building — pay $110 for repairs.', type: 'MONEY', value: -110 },
  { description: 'Bonus from work! Collect $130.', type: 'MONEY', value: 130 },
  { description: 'Traffic fine — pay $35.', type: 'MONEY', value: -35 },
  { description: 'Crowdfunding campaign succeeds — collect $300.', type: 'MONEY', value: 300 },
];
