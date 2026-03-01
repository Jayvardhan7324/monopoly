import React, { useRef, useEffect, useState } from 'react';
import { GameState } from '../types';
import { Tile } from './Tile';

interface BoardProps {
  gameState: GameState;
  onTileClick: (id: number) => void;
  children?: React.ReactNode;
}

// Standard Monopoly board proportions:
// 11×11 grid where corners are 2× the size of regular spaces
// Grid template: '2fr repeat(9, 1fr) 2fr'  (total = 13 units)
// Corners = 2/13 of board width, regular spaces = 1/13

export const Board: React.FC<BoardProps> = ({ gameState, onTileClick, children }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState(0);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Board must be a square; use the smaller dimension
        const size = Math.min(entry.contentRect.width, entry.contentRect.height);
        setBoardSize(size);
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const getGridStyle = (index: number): React.CSSProperties => {
    // Standard Monopoly: 0 is GO (Bottom Right)
    // 0-10: Bottom side (Right to Left)
    if (index >= 0 && index <= 10)  return { gridRow: 11,             gridColumn: 11 - index };
    // 11-19: Left side (Bottom to Top)
    if (index >= 11 && index <= 19) return { gridRow: 11 - (index - 10), gridColumn: 1 };
    // 20-30: Top side (Left to Right)
    if (index >= 20 && index <= 30) return { gridRow: 1,              gridColumn: index - 20 + 1 };
    // 31-39: Right side (Top to Bottom)
    if (index >= 31 && index <= 39) return { gridRow: index - 30 + 1,    gridColumn: 11 };
    return {};
  };

  // unit = one regular-space width/height in px
  // Grid: 2 + 9 + 2 = 13 units across the whole board
  // Subtract 12px for padding (6px each side)
  const padding = 6;
  const innerSize = boardSize - padding * 2;
  const unit = innerSize > 0 ? innerSize / 13 : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-square mx-auto min-h-[300px]"
      style={{ maxWidth: '100%' }}
    >
      {/* Outer board frame */}
      <div
        className="absolute inset-0 bg-[#0c121d] rounded-2xl shadow-[0_40px_80px_rgba(0,0,0,0.8)] border border-white/5"
        style={{ padding }}
      >
        {/* Inner grid */}
        <div
          className="w-full h-full rounded-xl overflow-hidden border border-slate-700/60"
          style={{
            display: 'grid',
            gap: '1px',
            background: '#1a212e', // gap color
            gridTemplateColumns: '2fr repeat(9, 1fr) 2fr',
            gridTemplateRows:    '2fr repeat(9, 1fr) 2fr',
          }}
        >
          {/* ── Center area ── */}
          <div
            className="col-start-2 col-end-11 row-start-2 row-end-11 bg-[#0f1520] relative flex flex-col overflow-hidden"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_#1e2a40_0%,_transparent_70%)] pointer-events-none" />
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{ backgroundImage: 'linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)', backgroundSize: '32px 32px' }} />
            <div className="relative z-10 w-full h-full flex flex-col">
              {children}
            </div>
          </div>

          {/* ── Tiles ── */}
          {gameState.tiles.map((tile) => {
            const playersHere = gameState.players.filter(p => p.position === tile.id);
            const currentPlayer = gameState.players[gameState.currentPlayerIndex];
            const isOwned = currentPlayer ? tile.ownerId === currentPlayer.id : false;

            let isMonopoly = false;
            if (tile.ownerId !== null && tile.type === 'PROPERTY') {
              const groupTiles = gameState.tiles.filter(t => t.group === tile.group);
              isMonopoly = groupTiles.every(t => t.ownerId === tile.ownerId);
            }

            return (
              <div
                key={tile.id}
                style={getGridStyle(tile.id)}
                className="w-full h-full min-w-0 min-h-0 overflow-hidden"
              >
                <Tile
                  tile={tile}
                  players={playersHere}
                  onClick={() => onTileClick(tile.id)}
                  isCurrent={currentPlayer?.position === tile.id}
                  isOwned={isOwned}
                  isMonopoly={isMonopoly}
                  taxPool={tile.name === 'Vacation' ? gameState.taxPool : undefined}
                  unit={unit}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};