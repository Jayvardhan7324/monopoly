import { GameState } from "../types";

// SEC-07: API key was previously exposed in the client bundle via process.env.GEMINI_API_KEY.
// All Gemini calls now go through the server-side /api/ai-advice proxy endpoint.
export const getAIAdvice = async (gameState: GameState, retries = 2): Promise<string> => {
  try {
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const currentTile = gameState.tiles[currentPlayer.position];

    const context = {
      playerName: currentPlayer.name,
      playerMoney: currentPlayer.money,
      tileName: currentTile.name,
      tileType: currentTile.type,
      tilePrice: currentTile.price,
      tileOwnerId: currentTile.ownerId ?? null,
      myPropertyCount: gameState.tiles.filter(t => t.ownerId === currentPlayer.id).length,
      opponents: gameState.players
        .filter(p => p.id !== currentPlayer.id && !p.isBankrupt)
        .map(p => ({ name: p.name, money: p.money })),
    };

    const res = await fetch('/api/ai-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ context }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    return data.advice || "No advice generated.";
  } catch (error: any) {
    console.error("AI Advice Error:", error);

    if (retries > 0 && (error?.message?.toLowerCase().includes('rate') || error?.status === 429)) {
      console.log(`Rate limit hit, retrying in 2s... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getAIAdvice(gameState, retries - 1);
    }

    if (error?.message?.toLowerCase().includes('rate') || error?.status === 429) {
      return "Rate limit exceeded. Please wait a moment and try again.";
    }
    return "Unable to connect to the advisor network. Please try again.";
  }
};
