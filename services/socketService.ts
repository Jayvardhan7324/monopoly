import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = (roomId: string, playerId: string) => {
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ["polling", "websocket"],
      upgrade: true,
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.connect();

    socket.on("connect", () => {
      socket?.emit("join_session", { roomId, playerId });
    });
  }
  return socket;
};

export const getSocket = () => socket;

// BUG-7 FIX: Reset socket so player can join a different room
export const resetSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};
