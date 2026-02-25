
import { Tile, TileType, ColorGroup } from './types';

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
  countryCode
});

export const INITIAL_TILES: Tile[] = [
  // Top Row (0-10)
  createTile(0, "START", TileType.CORNER),
  createTile(1, "Salvador", TileType.PROPERTY, 60, ColorGroup.BROWN, [2, 10, 30, 90, 160, 250], 50, 'br'),
  createTile(2, "Treasure", TileType.COMMUNITY_CHEST),
  createTile(3, "Rio", TileType.PROPERTY, 60, ColorGroup.BROWN, [4, 20, 60, 180, 320, 450], 50, 'br'),
  createTile(4, "Income Tax", TileType.TAX, 0),
  createTile(5, "TLV Airport", TileType.RAILROAD, 200),
  createTile(6, "Tel Aviv", TileType.PROPERTY, 100, ColorGroup.LIGHT_BLUE, [6, 30, 90, 270, 400, 550], 50, 'il'),
  createTile(7, "Surprise", TileType.CHANCE),
  createTile(8, "Haifa", TileType.PROPERTY, 100, ColorGroup.LIGHT_BLUE, [6, 30, 90, 270, 400, 550], 50, 'il'),
  createTile(9, "Jerusalem", TileType.PROPERTY, 120, ColorGroup.LIGHT_BLUE, [8, 40, 100, 300, 450, 600], 50, 'il'),
  createTile(10, "In Prison", TileType.CORNER),

  // Right Column (11-19)
  createTile(11, "Venice", TileType.PROPERTY, 140, ColorGroup.PINK, [10, 50, 150, 450, 625, 750], 100, 'it'),
  createTile(12, "Electric Company", TileType.UTILITY, 150),
  createTile(13, "Milan", TileType.PROPERTY, 140, ColorGroup.PINK, [10, 50, 150, 450, 625, 750], 100, 'it'),
  createTile(14, "Rome", TileType.PROPERTY, 160, ColorGroup.PINK, [12, 60, 180, 500, 700, 900], 100, 'it'),
  createTile(15, "MUC Airport", TileType.RAILROAD, 200),
  createTile(16, "Frankfurt", TileType.PROPERTY, 180, ColorGroup.ORANGE, [14, 70, 200, 550, 750, 950], 100, 'de'),
  createTile(17, "Treasure", TileType.COMMUNITY_CHEST),
  createTile(18, "Munich", TileType.PROPERTY, 180, ColorGroup.ORANGE, [14, 70, 200, 550, 750, 950], 100, 'de'),
  createTile(19, "Berlin", TileType.PROPERTY, 200, ColorGroup.ORANGE, [16, 80, 220, 600, 800, 1000], 100, 'de'),

  // Bottom Row (20-30)
  createTile(20, "Vacation", TileType.CORNER),
  createTile(21, "Shenzhen", TileType.PROPERTY, 220, ColorGroup.YELLOW, [18, 90, 250, 700, 875, 1050], 150, 'cn'),
  createTile(22, "Surprise", TileType.CHANCE),
  createTile(23, "Beijing", TileType.PROPERTY, 220, ColorGroup.YELLOW, [18, 90, 250, 700, 875, 1050], 150, 'cn'),
  createTile(24, "Shanghai", TileType.PROPERTY, 240, ColorGroup.YELLOW, [20, 100, 300, 750, 925, 1100], 150, 'cn'),
  createTile(25, "CDG Airport", TileType.RAILROAD, 200),
  createTile(26, "Lyon", TileType.PROPERTY, 260, ColorGroup.GREEN, [22, 110, 330, 800, 975, 1150], 150, 'fr'),
  createTile(27, "Toulouse", TileType.PROPERTY, 260, ColorGroup.GREEN, [22, 110, 330, 800, 975, 1150], 150, 'fr'),
  createTile(28, "Water Company", TileType.UTILITY, 150),
  createTile(29, "Paris", TileType.PROPERTY, 280, ColorGroup.GREEN, [24, 120, 360, 850, 1025, 1200], 150, 'fr'),
  createTile(30, "Go to prison", TileType.CORNER),

  // Left Column (31-39)
  createTile(31, "Liverpool", TileType.PROPERTY, 300, ColorGroup.DARK_BLUE, [26, 130, 390, 900, 1100, 1275], 200, 'gb'),
  createTile(32, "Manchester", TileType.PROPERTY, 300, ColorGroup.DARK_BLUE, [26, 130, 390, 900, 1100, 1275], 200, 'gb'),
  createTile(33, "Treasure", TileType.COMMUNITY_CHEST),
  createTile(34, "London", TileType.PROPERTY, 320, ColorGroup.DARK_BLUE, [28, 150, 450, 1000, 1200, 1400], 200, 'gb'),
  createTile(35, "JFK Airport", TileType.RAILROAD, 200),
  createTile(36, "Surprise", TileType.CHANCE),
  createTile(37, "San Francisco", TileType.PROPERTY, 350, ColorGroup.RED, [35, 175, 500, 1100, 1300, 1500], 200, 'us'),
  createTile(38, "Luxury Tax", TileType.TAX, 0),
  createTile(39, "New York", TileType.PROPERTY, 400, ColorGroup.RED, [50, 200, 600, 1400, 1700, 2000], 200, 'us'),
];

export const PLAYER_COLORS = [
  '#ef4444',
  '#3b82f6',
  '#22c55e',
  '#eab308',
];
