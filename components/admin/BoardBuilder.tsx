import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X, Pencil, LayoutGrid, List } from 'lucide-react';
import CellEditor from './CellEditor';
import type { CustomBoard, CustomTile } from './types';
import {
  getTileGridPos,
  generateDefaultTiles,
  COLOR_GROUP_HEX,
  flagEmoji,
} from './boardUtils';
import { TileType, ColorGroup } from '../../types';

interface Props {
  initialBoard: CustomBoard | null;
  onSave: (board: Omit<CustomBoard, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

const TILE_TYPE_COLOR: Record<TileType, string> = {
  [TileType.PROPERTY]:        '',      // uses group color
  [TileType.RAILROAD]:        '#1e293b',
  [TileType.UTILITY]:         '#0f766e',
  [TileType.CHANCE]:          '#b45309',
  [TileType.COMMUNITY_CHEST]: '#7c3aed',
  [TileType.TAX]:             '#dc2626',
  [TileType.CORNER]:          '#374151',
};

const TILE_TYPE_LABEL: Record<TileType, string> = {
  [TileType.PROPERTY]:        '',
  [TileType.RAILROAD]:        '✈',
  [TileType.UTILITY]:         '⚡',
  [TileType.CHANCE]:          '?',
  [TileType.COMMUNITY_CHEST]: '♠',
  [TileType.TAX]:             '$',
  [TileType.CORNER]:          '★',
};

function tileDisplayColor(tile: CustomTile): string {
  if (tile.type === TileType.PROPERTY) {
    return COLOR_GROUP_HEX[tile.group] || COLOR_GROUP_HEX[ColorGroup.NONE];
  }
  return TILE_TYPE_COLOR[tile.type];
}

// ── Visual board grid ─────────────────────────────────────────────────────────

interface BoardGridProps {
  tiles: CustomTile[];
  N: number;
  onClickTile: (tile: CustomTile) => void;
}

const BoardGrid: React.FC<BoardGridProps> = ({ tiles, N, onClickTile }) => {
  const CELL_PX = Math.max(24, Math.min(44, Math.floor(400 / N)));
  const totalPx = CELL_PX * N;

  return (
    <div
      className="relative border border-border rounded-lg overflow-hidden bg-muted/30 mx-auto"
      style={{ width: totalPx, height: totalPx }}
    >
      {/* Grid lines */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            repeating-linear-gradient(0deg, transparent, transparent ${CELL_PX - 1}px, rgba(0,0,0,.07) ${CELL_PX}px),
            repeating-linear-gradient(90deg, transparent, transparent ${CELL_PX - 1}px, rgba(0,0,0,.07) ${CELL_PX}px)
          `,
        }}
      />

      {tiles.map(tile => {
        const { row, col } = getTileGridPos(tile.position, N);
        const color = tileDisplayColor(tile);
        const isCorner = tile.type === TileType.CORNER;
        const flag = tile.countryCode ? flagEmoji(tile.countryCode) : '';

        return (
          <button
            key={tile.position}
            title={`#${tile.position}: ${tile.name}`}
            onClick={() => onClickTile(tile)}
            className="absolute flex flex-col items-center justify-center gap-0.5 hover:z-10 hover:ring-2 hover:ring-primary transition-all group"
            style={{
              width: CELL_PX,
              height: CELL_PX,
              left: (col - 1) * CELL_PX,
              top: (row - 1) * CELL_PX,
              background: isCorner ? '#1e293b' : 'white',
              borderRadius: 2,
            }}
          >
            {/* Color band */}
            <div
              className="absolute top-0 left-0 right-0"
              style={{ height: Math.max(4, CELL_PX * 0.18), background: color }}
            />
            {/* Position badge */}
            <span className="absolute top-0.5 right-0.5 text-[7px] leading-none text-muted-foreground font-mono opacity-60">
              {tile.position}
            </span>
            {/* Icon or flag */}
            <span className="text-[10px] mt-1.5" style={{ fontSize: CELL_PX < 30 ? 8 : 10 }}>
              {tile.type !== TileType.PROPERTY
                ? TILE_TYPE_LABEL[tile.type]
                : flag}
            </span>
            {/* Name (tiny, only if cell is big enough) */}
            {CELL_PX >= 34 && (
              <span
                className="px-0.5 text-center leading-tight"
                style={{
                  fontSize: 6,
                  color: isCorner ? 'white' : '#374151',
                  maxWidth: CELL_PX - 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {tile.name}
              </span>
            )}
            {/* Hover edit icon */}
            <Pencil
              className="absolute bottom-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary"
              style={{ width: 8, height: 8 }}
            />
          </button>
        );
      })}

      {/* Center label */}
      <div
        className="absolute flex items-center justify-center text-muted-foreground text-xs font-medium pointer-events-none select-none"
        style={{
          left: CELL_PX,
          top: CELL_PX,
          width: (N - 2) * CELL_PX,
          height: (N - 2) * CELL_PX,
        }}
      >
        <span className="opacity-30 text-center">RICHUP<br />BOARD</span>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const BOARD_SIZES = Array.from({ length: 7 }, (_, i) => i + 9); // 9..15

const BoardBuilder: React.FC<Props> = ({ initialBoard, onSave, onCancel }) => {
  const [boardName, setBoardName] = useState('');
  const [boardSize, setBoardSize] = useState(11);
  const [tiles, setTiles] = useState<CustomTile[]>([]);
  const [editingTile, setEditingTile] = useState<CustomTile | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  // Load initial board or generate defaults
  useEffect(() => {
    if (initialBoard) {
      setBoardName(initialBoard.name);
      setBoardSize(initialBoard.boardSize);
      setTiles(initialBoard.tiles);
    } else {
      setBoardName('');
      setBoardSize(11);
      setTiles(generateDefaultTiles(11));
    }
  }, [initialBoard]);

  // Regenerate tiles when size changes (preserves names where positions overlap)
  const handleSizeChange = (newN: number) => {
    const newTiles = generateDefaultTiles(newN);
    // Preserve existing customizations if position exists in new board
    const oldMap = new Map(tiles.map(t => [t.position, t]));
    const merged = newTiles.map(t => oldMap.get(t.position) ?? t);
    setBoardSize(newN);
    setTiles(merged);
  };

  const openEditor = (tile: CustomTile) => {
    setEditingTile(tile);
    setSheetOpen(true);
  };

  const handleCellSave = (updated: CustomTile) => {
    setTiles(prev => prev.map(t => t.position === updated.position ? updated : t));
  };

  const handleSave = () => {
    if (!boardName.trim()) { alert('Please enter a board name.'); return; }
    onSave({ name: boardName.trim(), boardSize, tiles });
  };

  const totalTiles = 4 * (boardSize - 1);

  // Group tiles by side for list view
  const sides = [
    { label: 'Bottom', tiles: tiles.filter(t => t.position < boardSize) },
    { label: 'Right',  tiles: tiles.filter(t => t.position >= boardSize && t.position < 2 * boardSize - 2) },
    { label: 'Top',    tiles: tiles.filter(t => t.position >= 2 * boardSize - 2 && t.position < 3 * boardSize - 3) },
    { label: 'Left',   tiles: tiles.filter(t => t.position >= 3 * boardSize - 3) },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            {initialBoard ? `Editing: ${initialBoard.name}` : 'New Board'}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Click any cell to customize it.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save Board
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        {/* ── Left: settings ── */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Board Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Board Name</Label>
                <Input
                  value={boardName}
                  onChange={e => setBoardName(e.target.value)}
                  placeholder="e.g. World Tour"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Board Size (cells per side)</Label>
                <Select
                  value={String(boardSize)}
                  onValueChange={v => handleSizeChange(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BOARD_SIZES.map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {n}×{n} — {4 * (n - 1)} tiles
                        {n === 11 ? ' (standard)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-xs">Total Tiles</p>
                  <p className="font-semibold text-lg">{totalTiles}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-muted-foreground text-xs">Board Size</p>
                  <p className="font-semibold text-lg">{boardSize}×{boardSize}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Legend</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Corner',    color: '#374151', icon: '★' },
                { label: 'Railroad',  color: '#1e293b', icon: '✈' },
                { label: 'Utility',   color: '#0f766e', icon: '⚡' },
                { label: 'Chance',    color: '#b45309', icon: '?' },
                { label: 'Chest',     color: '#7c3aed', icon: '♠' },
                { label: 'Tax',       color: '#dc2626', icon: '$' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 text-sm">
                  <div className="h-3 w-3 rounded-sm shrink-0" style={{ background: item.color }} />
                  <span className="text-muted-foreground">{item.icon}</span>
                  <span>{item.label}</span>
                </div>
              ))}
              <Separator className="my-1" />
              <p className="text-xs text-muted-foreground">Properties use their color group color.</p>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: visual board + list ── */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Board Preview
                <Badge variant="secondary" className="ml-2 text-xs font-normal">
                  {totalTiles} tiles
                </Badge>
              </CardTitle>
              <div className="flex items-center gap-1 rounded-md border p-0.5">
                <button
                  className={`rounded px-2 py-1 text-xs flex items-center gap-1 transition-colors ${view === 'grid' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  onClick={() => setView('grid')}
                >
                  <LayoutGrid className="h-3 w-3" />
                  Visual
                </button>
                <button
                  className={`rounded px-2 py-1 text-xs flex items-center gap-1 transition-colors ${view === 'list' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  onClick={() => setView('list')}
                >
                  <List className="h-3 w-3" />
                  List
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {view === 'grid' ? (
              <div className="flex justify-center py-2">
                <BoardGrid
                  tiles={tiles}
                  N={boardSize}
                  onClickTile={openEditor}
                />
              </div>
            ) : (
              <ScrollArea className="h-[520px] pr-3">
                <div className="space-y-4">
                  {sides.map(side => (
                    <div key={side.label}>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                        {side.label} row
                      </h4>
                      <div className="grid gap-1.5">
                        {side.tiles.map(tile => {
                          const color = tileDisplayColor(tile);
                          const flag = tile.countryCode ? flagEmoji(tile.countryCode) : '';
                          return (
                            <button
                              key={tile.position}
                              onClick={() => openEditor(tile)}
                              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors group"
                            >
                              {/* Color swatch */}
                              <div
                                className="h-6 w-1.5 rounded-full shrink-0"
                                style={{ background: color }}
                              />
                              {/* Position */}
                              <span className="text-xs font-mono text-muted-foreground w-5 shrink-0">
                                {tile.position}
                              </span>
                              {/* Flag */}
                              {flag && <span className="text-sm">{flag}</span>}
                              {/* Name */}
                              <span className="text-sm font-medium flex-1 truncate">{tile.name}</span>
                              {/* Price */}
                              {tile.price > 0 && (
                                <span className="text-xs text-muted-foreground">${tile.price}</span>
                              )}
                              {/* Type badge */}
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {tile.type.replace('_', ' ')}
                              </Badge>
                              <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cell Editor Sheet */}
      <CellEditor
        tile={editingTile}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSave={handleCellSave}
      />
    </div>
  );
};

export default BoardBuilder;
