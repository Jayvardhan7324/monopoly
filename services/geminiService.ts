
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

export const getAIAdvice = async (gameState: GameState, retries = 2): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const currentPlayer = gameState.players[gameState.currentPlayerIndex];
    const currentTile = gameState.tiles[currentPlayer.position];

    // Construct a lightweight context string
    const context = `
      You are a Monopoly expert advisor.
      Game State:
      - Current Player: ${currentPlayer.name} (Cash: $${currentPlayer.money})
      - Position: ${currentTile.name} (Type: ${currentTile.type}, Price: $${currentTile.price}, Owned By: ${currentTile.ownerId ?? 'None'})
      - My Properties count: ${gameState.tiles.filter(t => t.ownerId === currentPlayer.id).length}
      - Opponents: ${gameState.players.filter(p => p.id !== currentPlayer.id).map(p => `${p.name} ($${p.money})`).join(', ')}
      
      Advice needed on what to do (Buy? Pass? Trade strategy?). 
      Keep it very short (under 30 words), punchy, and strategic.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: context,
    });

    return response.text || "No advice generated.";
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    
    if (retries > 0 && (error?.message?.toLowerCase().includes('rate') || error?.status === 429)) {
      console.log(`Rate limit hit, retrying in 2s... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getAIAdvice(gameState, retries - 1);
    }

    if (error?.message?.toLowerCase().includes('rate') || error?.status === 429) {
      return "Rate limit exceeded. Please wait a moment and try again.";
    }
    return "Unable to connect to the advisor network. Please check your connection or API key.";
  }
};
