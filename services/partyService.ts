import PartySocket from "partysocket";

let socket: PartySocket | null = null;
let _roomId: string | null = null;
let _playerId: string | null = null;

export const PARTYKIT_HOST: string =
  (import.meta as any).env?.VITE_PARTYKIT_HOST ?? "localhost:1999";

const isLocal = PARTYKIT_HOST.startsWith("localhost") || PARTYKIT_HOST.startsWith("127.");
export const PARTYKIT_HTTP = `${isLocal ? "http" : "https"}://${PARTYKIT_HOST}`;

export const partyFetch = (path: string, init?: RequestInit) =>
  fetch(`${PARTYKIT_HTTP}${path}`, init);

export const initParty = (roomId: string, playerId: string): PartySocket => {
  if (socket) return socket;

  _roomId = roomId;
  _playerId = playerId;

  socket = new PartySocket({
    host: PARTYKIT_HOST,
    room: roomId,
    // uses main party (party/monopoly.ts)
  });

  socket.addEventListener("open", () => {
    socket?.send(JSON.stringify({ type: "join_session", playerId }));
  });

  return socket;
};

export const getPartySocket = () => socket;

export const resetParty = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
  _roomId = null;
  _playerId = null;
};
