import React, { useRef, useEffect, useState } from 'react';
import { GameState } from '../types';
import { Tile } from './Tile';

interface BoardProps {
  gameState: GameState;
  onTileClick: (id: number) => void;
  children?: React.ReactNode;
}

// Production board constants — mathematically proportional per classic Monopoly spec:
//
//  Grid: 11×11 (indices 0–10 on each axis)
//  Corner tiles: 2.5fr × 2.5fr  →  ~17.9% of board width each
//  Edge tiles:   1fr  × 2.5fr  →  ~7.1% wide, same depth as corners
//  Inner area:   9fr  × 9fr    →  ~64.3% of board (target 60-65% ✓)
//
//  totalFr = 2×2.5 + 9×1 = 14fr
//  cornerPct = 2.5/14 = 17.86%
//  edgePct   = 1/14   =  7.14%
//  innerPct  = 9/14   = 64.29%

const CORNER_FR = 2.5;
const EDGE_FR   = 1;
const TILE_GAP_PX    = 1;
const BOARD_PADDING_PX = 2;

export const Board: React.FC<BoardProps> = ({ gameState, onTileClick, children }) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [scale,     setScale]     = useState(1);
  const [barHeight, setBarHeight] = useState(24);
  const [fontSize,  setFontSize]  = useState(8);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const boardWidth = entry.contentRect.width;

        // Scale factor relative to the 600px design base
        const newScale = Math.max(0.1, boardWidth / 600);
        setScale(newScale);

        // Compute actual pixel width of one edge tile so bar/font scale correctly
        // totalFr = 2*CORNER_FR + 9*EDGE_FR
        const totalFr     = 2 * CORNER_FR + 9 * EDGE_FR;          // 14
        const usableWidth = boardWidth - 2 * BOARD_PADDING_PX - 10 * TILE_GAP_PX;
        const edgeTilePx  = (usableWidth * EDGE_FR) / totalFr;

        // Color bar ≈ 28% of edge tile width; font ≈ 19%
        setBarHeight(Math.max(10, Math.round(edgeTilePx * 0.28)));
        setFontSize( Math.max(5,  Math.round(edgeTilePx * 0.19)));
      }
    });

    if (boardRef.current) observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, []);

  const getGridStyle = (index: number): React.CSSProperties => {
    if (index >= 0  && index <= 10) return { gridRow: 1,              gridColumn: index + 1           };
    if (index >= 11 && index <= 19) return { gridRow: index - 10 + 1, gridColumn: 11                  };
    if (index >= 20 && index <= 30) return { gridRow: 11,             gridColumn: 11 - (index - 20)   };
    if (index >= 31 && index <= 39) return { gridRow: 11 - (index - 30), gridColumn: 1                };
    return {};
  };

  const gridTemplate = `minmax(0, ${CORNER_FR}fr) repeat(9, minmax(0, ${EDGE_FR}fr)) minmax(0, ${CORNER_FR}fr)`;

  return (
    <div
      ref={boardRef}
      className="relative w-full max-w-[100vw] sm:max-w-[660px] group-data-[layout=row]:max-w-none group-data-[layout=row]:w-auto group-data-[layout=row]:h-full aspect-square p-2 bg-[#0c121d] rounded-2xl shadow-[0_50px_100px_rgba(0,0,0,0.9)] border border-white/5 mx-auto"
      style={{
        '--board-scale':    scale,
        '--tile-gap':       `${TILE_GAP_PX}px`,
        '--bar-height':     `${barHeight}px`,
        '--font-size':      `${fontSize}px`,
        '--board-padding':  `${BOARD_PADDING_PX}px`,
      } as React.CSSProperties}
    >
      <div
        className="w-full h-full grid bg-[#1a212e] rounded-lg overflow-hidden border border-slate-800 shadow-inner"
        style={{
          gap:                  `${TILE_GAP_PX}px`,
          padding:              `${BOARD_PADDING_PX}px`,
          gridTemplateColumns:  gridTemplate,
          gridTemplateRows:     gridTemplate,
        }}
      >
        {/* ── Central area — ~64% of board, holds game controls ── */}
        <div className="col-start-2 col-end-11 row-start-2 row-end-11 bg-[#121721] relative flex flex-col overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#2a303c_0%,_transparent_80%)] opacity-20 pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

          <div className="relative z-10 w-full h-full flex flex-col p-4">
            {children}
          </div>
        </div>

        {/* ── Perimeter tiles ── */}
        {gameState.tiles.map((tile) => {
          const playersHere   = gameState.players.filter(p => p.position === tile.id);
          const currentPlayer = gameState.players[gameState.currentPlayerIndex];
          const isOwned       = currentPlayer ? tile.ownerId === currentPlayer.id : false;

          let isMonopoly = false;
          if (tile.ownerId !== null && tile.type === 'PROPERTY') {
            const groupTiles = gameState.tiles.filter(t => t.group === tile.group);
            isMonopoly = groupTiles.every(t => t.ownerId === tile.ownerId);
          }

          return (
            <div key={tile.id} style={getGridStyle(tile.id)} className="w-full h-full">
              <Tile
                tile={tile}
                players={playersHere}
                onClick={() => onTileClick(tile.id)}
                isCurrent={currentPlayer?.position === tile.id}
                isOwned={isOwned}
                isMonopoly={isMonopoly}
                taxPool={tile.name === 'Vacation' ? gameState.taxPool : undefined}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};