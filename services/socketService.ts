import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = (roomId: string, playerId: string) => {
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
    });

    socket.connect();

    socket.on("connect", () => {
      // Always re-read from sessionStorage so reconnects after transport drop
      // use the latest roomId/playerId, not stale closure values (NET-02).
      const stored = sessionStorage.getItem('richup_session');
      const session = stored ? JSON.parse(stored) : null;
      const sid = session?.playerId || playerId;
      const rid = session?.roomId || roomId;
      if (rid && sid) {
        socket?.emit("join_session", { roomId: rid, playerId: sid });
      }
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
