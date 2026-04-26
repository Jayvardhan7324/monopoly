import assert from 'node:assert/strict';
import { gameReducer, initialState } from '../services/gameReducer';
import { INITIAL_TILES } from '../constants';
import { TileType } from '../types';

const baseState = {
  ...initialState,
  players: [
    { id: 0, name: 'A', color: '#f00', money: 1500, position: 1, isBot: false, isBankrupt: false, inJail: false, jailTurns: 0 },
    { id: 1, name: 'B', color: '#00f', money: 1500, position: 3, isBot: false, isBankrupt: false, inJail: false, jailTurns: 0 },
  ],
  currentPlayerIndex: 0,
  phase: 'ACTION' as const,
  tiles: INITIAL_TILES.map(t => ({ ...t })),
};

const propertyId = baseState.tiles.findIndex(t => t.type === TileType.PROPERTY && t.price > 0);
assert.notEqual(propertyId, -1);

{
  const state = {
    ...baseState,
    tiles: baseState.tiles.map(t => t.id === propertyId ? { ...t, ownerId: 1 } : t),
  };
  const next = gameReducer(state, { type: 'MORTGAGE_PROPERTY', payload: { tileId: propertyId, senderPlayerId: 0 } });
  assert.equal(next.tiles[propertyId].isMortgaged, false, 'current player must not mortgage another player property');
}

{
  const state = {
    ...baseState,
    pendingTrade: {
      proposerId: 0,
      targetId: 1,
      offerCash: 10,
      offerPropertyIds: [],
      targetPropertyId: null,
      requestCash: 0,
    },
  };
  const next = gameReducer(state, { type: 'ACCEPT_TRADE', payload: { senderPlayerId: 0 } });
  assert.notEqual(next.pendingTrade, null, 'only the target may accept a pending trade');
}

{
  const jailed = {
    ...baseState,
    phase: 'ACTION' as const,
    players: baseState.players.map((p, idx) => idx === 0 ? { ...p, inJail: true } : p),
  };
  const next = gameReducer(jailed, { type: 'USE_JAIL_CARD', payload: { senderPlayerId: 0 } });
  assert.equal(next.players[0].inJail, true, 'jail actions are rejected outside ROLL phase');
}

{
  const next = gameReducer({ ...baseState, phase: 'TURN_END' as const }, { type: 'START_AUCTION', payload: { senderPlayerId: 0 } });
  assert.equal(next.auction, null, 'auction cannot start outside ACTION phase');
}

console.log('security smoke tests passed');
