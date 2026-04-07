import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X, Pencil, LayoutGrid, List, GripVertical } from 'lucide-react';
import CellEditor from './CellEditor';
import type { CustomBoard, CustomTile } from './types';
import { Tile } from '../Tile';
import type { Tile as GameTile } from '../../types';
import {
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

function tileDisplayColor(tile: CustomTile): string {
  if (tile.type === TileType.PROPERTY) {
    return COLOR_GROUP_HEX[tile.group] || COLOR_GROUP_HEX[ColorGroup.NONE];
  }
  const colors: Record<TileType, string> = {
    [TileType.PROPERTY]:        '',
    [TileType.RAILROAD]:        '#1e293b',
    [TileType.UTILITY]:         '#0f766e',
    [TileType.CHANCE]:          '#b45309',
    [TileType.COMMUNITY_CHEST]: '#7c3aed',
    [TileType.TAX]:             '#dc2626',
    [TileType.CORNER]:          '#374151',
  };
  return colors[tile.type];
}

/** Convert admin CustomTile → game Tile for preview rendering */
function toGameTile(t: CustomTile): GameTile {
  return {
    id: t.position,
    name: t.name,
    type: t.type,
    price: t.price,
    rent: t.rent,
    group: t.group,
    ownerId: null,
    buildingCount: 0,
    isMortgaged: false,
    houseCost: t.houseCost,
    countryCode: t.countryCode,
  };
}

/** CSS grid position for tile at index on an N×N board (matches Board.tsx logic exactly) */
function getGridStyle(index: number, N: number): React.CSSProperties {
  if (index <= N - 1)     return { gridRow: 1,  gridColumn: index + 1 };
  if (index <= 2 * N - 3) return { gridRow: index - N + 2, gridColumn: N };
  if (index <= 3 * N - 3) return { gridRow: N,  gridColumn: 3 * N - 2 - index };
  if (index <= 4 * N - 5) return { gridRow: 4 * N - 3 - index, gridColumn: 1 };
  return {};
}

// ── Live Board Preview (uses real Tile component — exact game look) ─────────

interface LivePreviewProps {
  tiles: CustomTile[];
  N: number;
  onClickTile: (tile: CustomTile) => void;
  onSwapTiles: (fromPos: number, toPos: number) => void;
}

const LiveBoardPreview: React.FC<LivePreviewProps> = ({ tiles, N, onClickTile, onSwapTiles }) => {
  const draggedPos = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  const gridTemplate = `minmax(0, 1.5fr) repeat(${N - 2}, minmax(0, 1fr)) minmax(0, 1.5fr)`;

  const handleDrop = (targetPos: number) => {
    setDragOver(null);
    const fromPos = draggedPos.current;
    if (fromPos === null || fromPos === targetPos) return;
    onSwapTiles(fromPos, targetPos);
    draggedPos.current = null;
  };

  return (
    <div
      className="relative mx-auto bg-[#0c121d] rounded-xl border border-white/5 shadow-xl"
      style={{ width: 440, height: 440, '--board-scale': '1' } as React.CSSProperties}
    >
      <div
        className="w-full h-full grid gap-[1.5px] bg-[#1a212e] p-[1.5px] rounded-lg border border-slate-800"
        style={{ gridTemplateColumns: gridTemplate, gridTemplateRows: gridTemplate }}
      >
        {/* Central area */}
        <div
          className="bg-[#0f1420] flex items-center justify-center"
          style={{ gridColumn: `2 / ${N}`, gridRow: `2 / ${N}` }}
        >
          <span className="text-slate-600 text-xs font-mono select-none text-center leading-relaxed">
            {tiles.length} tiles<br />{N}×{N}<br />
            <span className="text-slate-700 text-[10px]">drag to swap</span>
          </span>
        </div>

        {/* Tiles */}
        {tiles.map(tile => {
          const gameTile = toGameTile(tile);
          const isDragTarget = dragOver === tile.position;

          return (
            <div
              key={tile.position}
              style={getGridStyle(tile.position, N)}
              className={`w-full h-full relative cursor-grab active:cursor-grabbing ${isDragTarget ? 'ring-2 ring-blue-400 z-50 rounded-[4px]' : ''}`}
              draggable
              onDragStart={(e) => {
                draggedPos.current = tile.position;
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOver(tile.position);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOver(prev => prev === tile.position ? null : prev);
                }
              }}
              onDrop={(e) => { e.preventDefault(); handleDrop(tile.position); }}
              onDragEnd={() => { draggedPos.current = null; setDragOver(null); }}
            >
              <Tile
                tile={gameTile}
                players={[]}
                allPlayers={[]}
                onClick={() => onClickTile(tile)}
                isCurrent={false}
                boardSizeN={N}
              />
            </div>
          );
        })}
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

  // Drag state for list view
  const listDragPos = useRef<number | null>(null);

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

  /** Swap all tile data between two positions (keeps position numbers fixed) */
  const handleSwapTiles = (fromPos: number, toPos: number) => {
    setTiles(prev => {
      const fi = prev.findIndex(t => t.position === fromPos);
      const ti = prev.findIndex(t => t.position === toPos);
      if (fi < 0 || ti < 0) return prev;
      const next = [...prev];
      next[fi] = { ...prev[ti], position: fromPos };
      next[ti] = { ...prev[fi], position: toPos };
      return next;
    });
  };

  const handleSave = () => {
    if (!boardName.trim()) { alert('Please enter a board name.'); return; }
    onSave({ name: boardName.trim(), boardSize, tiles });
  };

  const totalTiles = 4 * (boardSize - 1);

  // Group tiles by side for list view
  const sides = [
    { label: 'Top',    tiles: tiles.filter(t => t.position <= boardSize - 1) },
    { label: 'Right',  tiles: tiles.filter(t => t.position >= boardSize && t.position <= 2 * boardSize - 3) },
    { label: 'Bottom', tiles: tiles.filter(t => t.position >= 2 * boardSize - 2 && t.position <= 3 * boardSize - 3) },
    { label: 'Left',   tiles: tiles.filter(t => t.position >= 3 * boardSize - 2) },
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
            Click any tile to edit · Drag tiles to swap positions
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

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
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
              <div className="flex justify-center py-2 overflow-x-auto">
                <LiveBoardPreview
                  tiles={tiles}
                  N={boardSize}
                  onClickTile={openEditor}
                  onSwapTiles={handleSwapTiles}
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
                            <div
                              key={tile.position}
                              draggable
                              onDragStart={() => { listDragPos.current = tile.position; }}
                              onDragOver={e => e.preventDefault()}
                              onDrop={() => {
                                const from = listDragPos.current;
                                if (from !== null && from !== tile.position) {
                                  handleSwapTiles(from, tile.position);
                                }
                                listDragPos.current = null;
                              }}
                              className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors group cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
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
                              <button
                                onClick={() => openEditor(tile)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10"
                              >
                                <Pencil className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </div>
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
