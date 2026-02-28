import express from "express";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Socket.io logic
  const rooms = new Map<string, { host: string; players: any[]; state: any }>();

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    socket.on("create_room", (data, callback) => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const player = { id: socket.id, name: data.name, avatar: data.avatar, isHost: true };
      rooms.set(roomId, { host: socket.id, players: [player], state: null });
      socket.join(roomId);
      callback({ success: true, roomId, players: [player] });
    });

    socket.on("join_random_room", (data, callback) => {
      // Find a room that is not full and hasn't started
      let targetRoomId = null;
      for (const [id, room] of rooms.entries()) {
        if (!room.state && room.players.length < 5) {
          targetRoomId = id;
          break;
        }
      }

      if (targetRoomId) {
        const room = rooms.get(targetRoomId)!;
        const player = { id: socket.id, name: data.name, avatar: data.avatar, isHost: false };
        room.players.push(player);
        socket.join(targetRoomId);
        io.to(targetRoomId).emit("room_updated", { players: room.players });
        callback({ success: true, roomId: targetRoomId, players: room.players });
      } else {
        // Create a new room
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const player = { id: socket.id, name: data.name, avatar: data.avatar, isHost: true };
        rooms.set(roomId, { host: socket.id, players: [player], state: null });
        socket.join(roomId);
        callback({ success: true, roomId, players: [player] });
      }
    });

    socket.on("join_room", (data, callback) => {
      const room = rooms.get(data.roomId);
      if (!room) {
        return callback({ success: false, error: "Room not found" });
      }
      if (room.state) {
        return callback({ success: false, error: "Game already started" });
      }
      if (room.players.length >= 5) {
        return callback({ success: false, error: "Room is full" });
      }
      const player = { id: socket.id, name: data.name, avatar: data.avatar, isHost: false };
      room.players.push(player);
      socket.join(data.roomId);
      io.to(data.roomId).emit("room_updated", { players: room.players });
      callback({ success: true, roomId: data.roomId, players: room.players });
    });

    socket.on("update_player", (data, callback) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          const player = room.players.find(p => p.id === socket.id);
          if (player) {
            if (data.name !== undefined) player.name = data.name;
            if (data.avatar !== undefined) player.avatar = data.avatar;
            io.to(roomId).emit("room_updated", { players: room.players });
            if (callback) callback({ success: true });
          }
        }
      }
    });

    socket.on("start_game", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.host === socket.id) {
          room.state = data.initialState;
          io.to(roomId).emit("game_started", { state: data.initialState });
        }
      }
    });

    socket.on("kick_player", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.host === socket.id && !room.state) {
          const playerIndex = room.players.findIndex(p => p.id === data.playerId);
          if (playerIndex !== -1) {
            const kickedPlayer = room.players[playerIndex];
            room.players.splice(playerIndex, 1);
            io.sockets.sockets.get(kickedPlayer.id)?.leave(roomId);
            io.to(kickedPlayer.id).emit("kicked");
            io.to(roomId).emit("room_updated", { players: room.players });
          }
        }
      }
    });

    socket.on("update_settings", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.host === socket.id && !room.state) {
          socket.to(roomId).emit("settings_updated", data.settings);
        }
      }
    });

    socket.on("send_chat", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        io.to(roomId).emit("chat_message", data);
      }
    });

    socket.on("game_action", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          // Send action to the host to process
          io.to(room.host).emit("host_process_action", data);
        }
      }
    });

    socket.on("sync_state", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.host === socket.id) {
          room.state = data.state;
          // Broadcast state to all other clients in the room
          socket.to(roomId).emit("sync_state", data);
        }
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
      for (const [roomId, room] of rooms.entries()) {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          room.players.splice(playerIndex, 1);
          if (room.players.length === 0) {
            rooms.delete(roomId);
          } else {
            if (room.host === socket.id) {
              room.host = room.players[0].id;
              room.players[0].isHost = true;
            }
            io.to(roomId).emit("room_updated", { players: room.players });
          }
        }
      }
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
