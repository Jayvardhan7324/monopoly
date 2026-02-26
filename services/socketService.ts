import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const initSocket = () => {
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ["websocket"],
      autoConnect: true,
    });
  }
  return socket;
};

export const getSocket = () => socket;
