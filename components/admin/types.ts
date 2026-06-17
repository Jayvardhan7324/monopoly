import { TileType, ColorGroup } from '../../types';

export interface CustomTile {
  position: number;
  name: string;
  type: TileType;
  group: ColorGroup;
  price: number;
  rent: number[];         // [bare, 1H, 2H, 3H, 4H, hotel]
  houseCost: number;
  countryCode?: string;
  priceTagPosition: 'top' | 'bottom' | 'left' | 'right';
}

export interface CustomBoard {
  id: string;
  name: string;
  boardSize: number;     // N — cells per side (total tiles = 4*(N-1))
  tiles: CustomTile[];
  createdAt: number;
}
