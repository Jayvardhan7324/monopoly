
import { GoogleGenAI } from "@google/genai";
import { GameState } from "../types";

export const getAIAdvice = async (gameState: GameState): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
      model: 'gemini-2.0-flash',
      contents: context,
    });

    return response.text || "No advice generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Unable to connect to the advisor network. Please check your connection or API key.";
  }
};
