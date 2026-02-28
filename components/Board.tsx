
import React, { useRef, useEffect, useState } from 'react';
import { GameState } from '../types';
import { Tile } from './Tile';

interface BoardProps {
  gameState: GameState;
  onTileClick: (id: number) => void;
  children?: React.ReactNode;
}

export const Board: React.FC<BoardProps> = ({ gameState, onTileClick, children }) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        // Base size is 600px
        const newScale = Math.max(0.1, entry.contentRect.width / 600);
        setScale(newScale);
      }
    });

    if (boardRef.current) {
      observer.observe(boardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const getGridStyle = (index: number) => {
    if (index >= 0 && index <= 10) return { gridRow: 1, gridColumn: index + 1 };
    if (index >= 11 && index <= 19) return { gridRow: index - 10 + 1, gridColumn: 11 };
    if (index >= 20 && index <= 30) return { gridRow: 11, gridColumn: 11 - (index - 20) };
    if (index >= 31 && index <= 39) return { gridRow: 11 - (index - 30), gridColumn: 1 };
    return {};
  };

  return (
    <div 
      ref={boardRef}
      className="relative w-full max-w-[100vw] sm:max-w-[660px] group-data-[layout=row]:max-w-none group-data-[layout=row]:w-auto group-data-[layout=row]:h-full aspect-square p-2 bg-[#0c121d] rounded-2xl shadow-[0_50px_100px_rgba(0,0,0,0.9)] border border-white/5 mx-auto @container"
      style={{ '--board-scale': scale } as React.CSSProperties}
    >
      <div 
        className="w-full h-full grid gap-[1.5px] bg-[#1a212e] p-[1.5px] rounded-lg overflow-hidden border border-slate-800 shadow-inner"
        style={{
          gridTemplateColumns: 'minmax(0, 2.5fr) repeat(9, minmax(0, 1fr)) minmax(0, 2.5fr)',
          gridTemplateRows: 'minmax(0, 2.5fr) repeat(9, minmax(0, 1fr)) minmax(0, 2.5fr)'
        }}
      >
        {/* Central Area for Controls/HUD */}
        <div className="col-start-2 col-end-11 row-start-2 row-end-11 bg-[#121721] relative flex flex-col overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#2a303c_0%,_transparent_80%)] opacity-20 pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
            <div className="relative z-10 w-full h-full flex flex-col p-4">
                {children}
            </div>
        </div>

        {/* Tiles */}
        {gameState.tiles.map((tile) => {
          const playersHere = gameState.players.filter(p => p.position === tile.id);
          const currentPlayer = gameState.players[gameState.currentPlayerIndex];
          const isOwned = currentPlayer ? tile.ownerId === currentPlayer.id : false;
          
          // Check for monopoly
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
