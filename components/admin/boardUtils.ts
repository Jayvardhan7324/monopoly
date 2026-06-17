import { TileType, ColorGroup } from '../../types';
import type { CustomTile } from './types';

export const COLOR_GROUP_HEX: Record<ColorGroup, string> = {
  [ColorGroup.BROWN]:      '#92400e',
  [ColorGroup.LIGHT_BLUE]: '#7dd3fc',
  [ColorGroup.PINK]:       '#f472b6',
  [ColorGroup.ORANGE]:     '#fb923c',
  [ColorGroup.RED]:        '#ef4444',
  [ColorGroup.YELLOW]:     '#eab308',
  [ColorGroup.GREEN]:      '#22c55e',
  [ColorGroup.DARK_BLUE]:  '#3b82f6',
  [ColorGroup.NONE]:       '#6b7280',
};

export const COUNTRIES = [
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'de', name: 'Germany' },
  { code: 'fr', name: 'France' },
  { code: 'it', name: 'Italy' },
  { code: 'es', name: 'Spain' },
  { code: 'jp', name: 'Japan' },
  { code: 'cn', name: 'China' },
  { code: 'br', name: 'Brazil' },
  { code: 'in', name: 'India' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'ru', name: 'Russia' },
  { code: 'mx', name: 'Mexico' },
  { code: 'kr', name: 'South Korea' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'se', name: 'Sweden' },
  { code: 'no', name: 'Norway' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'ar', name: 'Argentina' },
  { code: 'za', name: 'South Africa' },
  { code: 'sg', name: 'Singapore' },
  { code: 'ae', name: 'UAE' },
  { code: 'sa', name: 'Saudi Arabia' },
  { code: 'tr', name: 'Turkey' },
  { code: 'th', name: 'Thailand' },
  { code: 'id', name: 'Indonesia' },
  { code: 'my', name: 'Malaysia' },
  { code: 'ph', name: 'Philippines' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'eg', name: 'Egypt' },
  { code: 'pk', name: 'Pakistan' },
  { code: 'pt', name: 'Portugal' },
  { code: 'pl', name: 'Poland' },
  { code: 'be', name: 'Belgium' },
  { code: 'at', name: 'Austria' },
  { code: 'dk', name: 'Denmark' },
  { code: 'fi', name: 'Finland' },
  { code: 'gr', name: 'Greece' },
  { code: 'cz', name: 'Czech Republic' },
  { code: 'ro', name: 'Romania' },
  { code: 'hu', name: 'Hungary' },
  { code: 'il', name: 'Israel' },
  { code: 'ua', name: 'Ukraine' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'cl', name: 'Chile' },
  { code: 'co', name: 'Colombia' },
  { code: 've', name: 'Venezuela' },
  { code: 'pe', name: 'Peru' },
  { code: 'ie', name: 'Ireland' },
];

/** Convert ISO 2-letter code → flag emoji */
export function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

/**
 * Get which 1-indexed CSS Grid row/col a tile at `tileIdx` belongs to,
 * for an N-cells-per-side board.
 */
export function getTileGridPos(tileIdx: number, N: number): { row: number; col: number } {
  if (tileIdx <= N - 1) {
    // Bottom row: 0..N-1  →  grid row N, col 1..N
    return { row: N, col: tileIdx + 1 };
  } else if (tileIdx <= 2 * N - 3) {
    // Right column: N..2N-3  →  grid rows N-1..2, col N
    return { row: N - (tileIdx - N + 1), col: N };
  } else if (tileIdx <= 3 * N - 3) {
    // Top row: 2N-2..3N-3  →  grid row 1, cols N..1
    return { row: 1, col: N - (tileIdx - (2 * N - 2)) };
  } else {
    // Left column: 3N-2..4N-5  →  grid rows 2..N-1, col 1
    return { row: tileIdx - (3 * N - 2) + 2, col: 1 };
  }
}

const PROPERTY_GROUPS = [
  ColorGroup.BROWN,
  ColorGroup.LIGHT_BLUE,
  ColorGroup.PINK,
  ColorGroup.ORANGE,
  ColorGroup.RED,
  ColorGroup.YELLOW,
  ColorGroup.GREEN,
  ColorGroup.DARK_BLUE,
];

const BASE_PRICES = [60, 100, 140, 180, 220, 260, 300, 350];

/** Build default tiles when creating a new board of size N */
export function generateDefaultTiles(N: number): CustomTile[] {
  const total = 4 * (N - 1);
  const corners = [0, N - 1, 2 * N - 2, 3 * N - 3];
  const cornerNames = ['START', 'In Prison', 'Vacation', 'Go to Prison'];

  // Evenly space 4 railroads (not on corners)
  const nonCornerCount = total - 4;
  const step = Math.floor(nonCornerCount / 4);

  // positions of special tiles (approximate)
  const railroadPositions = new Set<number>();
  const chancePositions = new Set<number>();
  const taxPositions = new Set<number>();

  // railroads at ~25%, 50%, 75% of each side
  [Math.round(total * 0.125), Math.round(total * 0.375), Math.round(total * 0.625), Math.round(total * 0.875)]
    .forEach(p => { if (!corners.includes(p)) railroadPositions.add(p); });

  [Math.round(total * 0.175), Math.round(total * 0.55)]
    .forEach(p => { if (!corners.includes(p) && !railroadPositions.has(p)) chancePositions.add(p); });

  [Math.round(total * 0.1), Math.round(total * 0.95)]
    .forEach(p => { if (!corners.includes(p) && !railroadPositions.has(p) && !chancePositions.has(p)) taxPositions.add(p); });

  let propIdx = 0;
  return Array.from({ length: total }, (_, i) => {
    const cornerIdx = corners.indexOf(i);
    if (cornerIdx !== -1) {
      return {
        position: i,
        name: cornerNames[cornerIdx],
        type: TileType.CORNER,
        group: ColorGroup.NONE,
        price: 0,
        rent: [],
        houseCost: 0,
        priceTagPosition: 'bottom',
      } satisfies CustomTile;
    }
    if (railroadPositions.has(i)) {
      return {
        position: i,
        name: `Airport ${i}`,
        type: TileType.RAILROAD,
        group: ColorGroup.NONE,
        price: 200,
        rent: [],
        houseCost: 0,
        priceTagPosition: 'bottom',
      } satisfies CustomTile;
    }
    if (chancePositions.has(i)) {
      return {
        position: i,
        name: 'Surprise',
        type: TileType.CHANCE,
        group: ColorGroup.NONE,
        price: 0,
        rent: [],
        houseCost: 0,
        priceTagPosition: 'bottom',
      } satisfies CustomTile;
    }
    if (taxPositions.has(i)) {
      return {
        position: i,
        name: 'Tax',
        type: TileType.TAX,
        group: ColorGroup.NONE,
        price: 0,
        rent: [],
        houseCost: 0,
        priceTagPosition: 'bottom',
      } satisfies CustomTile;
    }

    // PROPERTY tile
    const groupIdx = Math.min(
      Math.floor((propIdx / Math.max(nonCornerCount - railroadPositions.size - chancePositions.size - taxPositions.size, 1)) * PROPERTY_GROUPS.length),
      PROPERTY_GROUPS.length - 1,
    );
    const group = PROPERTY_GROUPS[groupIdx];
    const basePrice = BASE_PRICES[groupIdx];
    const houseCost = groupIdx < 4 ? 50 : groupIdx < 6 ? 100 : 150;
    propIdx++;

    return {
      position: i,
      name: `Property ${i}`,
      type: TileType.PROPERTY,
      group,
      price: basePrice,
      rent: [
        Math.round(basePrice * 0.03),
        Math.round(basePrice * 0.17),
        Math.round(basePrice * 0.5),
        Math.round(basePrice * 1.5),
        Math.round(basePrice * 2.5),
        Math.round(basePrice * 4),
      ],
      houseCost,
      countryCode: undefined,
      priceTagPosition: 'bottom',
    } satisfies CustomTile;
  });
}
