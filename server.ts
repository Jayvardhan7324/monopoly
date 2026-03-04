import express from "express";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";

interface RoomData {
  host: string;
  hostName: string;
  players: any[];
  state: any;
  isPrivate: boolean;
  maxPlayers: number;
  createdAt: number;
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const rooms = new Map<string, RoomData>();

  function getPublicRoomsList() {
    const publicRooms: any[] = [];
    for (const [id, room] of rooms.entries()) {
      // Only list rooms that are: public, not started, and not full
      if (!room.isPrivate && !room.state) {
        publicRooms.push({
          roomId: id,
          hostName: room.hostName,
          playerCount: room.players.length,
          maxPlayers: room.maxPlayers,
          createdAt: room.createdAt,
        });
      }
    }
    // Sort by newest first
    publicRooms.sort((a, b) => b.createdAt - a.createdAt);
    return publicRooms;
  }

  // REST API: List active public rooms
  app.get("/api/rooms", (req, res) => {
    res.json(getPublicRoomsList());
  });

  // REST API: Create a room
  app.post("/api/rooms", (req, res) => {
    const data = req.body;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const playerId = "p_" + Math.random().toString(36).substring(2, 10);
    const player = { id: playerId, name: data.name, avatar: data.avatar, isHost: true };
    rooms.set(roomId, {
      host: playerId, // Will be updated to socket.id when they connect
      hostName: data.name || 'Player',
      players: [player],
      state: null,
      isPrivate: data.isPrivate || false,
      maxPlayers: data.maxPlayers || 5,
      createdAt: Date.now(),
    });

    // Broadcast updated room list to everyone (via socket)
    io.emit("rooms_list", getPublicRoomsList());
    res.json({ success: true, roomId, playerId, players: [player] });
  });

  // REST API: Join a random room
  app.post("/api/rooms/random", (req, res) => {
    const data = req.body;
    // Find a room that is not full, not private, and hasn't started
    let targetRoomId = null;
    for (const [id, room] of rooms.entries()) {
      if (!room.state && !room.isPrivate && room.players.length < room.maxPlayers) {
        targetRoomId = id;
        break;
      }
    }

    if (targetRoomId) {
      const room = rooms.get(targetRoomId)!;
      const playerId = "p_" + Math.random().toString(36).substring(2, 10);
      const player = { id: playerId, name: data.name, avatar: data.avatar, isHost: false };
      room.players.push(player);
      // We don't broadcast room_updated here because socket isn't connected yet.
      // We will broadcast when they actually connect their socket.
      res.json({ success: true, roomId: targetRoomId, playerId, players: room.players });
    } else {
      // Create a new room
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const playerId = "p_" + Math.random().toString(36).substring(2, 10);
      const player = { id: playerId, name: data.name, avatar: data.avatar, isHost: true };
      rooms.set(roomId, {
        host: playerId,
        hostName: data.name || 'Player',
        players: [player],
        state: null,
        isPrivate: false,
        maxPlayers: 5,
        createdAt: Date.now(),
      });
      io.emit("rooms_list", getPublicRoomsList());
      res.json({ success: true, roomId, playerId, players: [player] });
    }
  });

  // REST API: Join a specific room
  app.post("/api/rooms/:id/join", (req, res) => {
    const roomId = req.params.id;
    const data = req.body;
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    if (room.state) {
      return res.status(400).json({ success: false, error: "Game already started" });
    }
    if (room.players.length >= room.maxPlayers) {
      return res.status(400).json({ success: false, error: "Room is full" });
    }

    const playerId = "p_" + Math.random().toString(36).substring(2, 10);
    const player = { id: playerId, name: data.name, avatar: data.avatar, isHost: false };
    room.players.push(player);

    io.emit("rooms_list", getPublicRoomsList());
    res.json({ success: true, roomId: roomId, playerId, players: room.players });
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Initial connection linking REST session to Socket
    socket.on("join_session", (data, callback) => {
      const { roomId, playerId } = data;
      const room = rooms.get(roomId);

      if (!room) {
        if (callback) callback({ success: false, error: "Room not found" });
        return;
      }

      // Find the player placeholder created by the REST API
      const playerIndex = room.players.findIndex(p => p.id === playerId);

      if (playerIndex === -1) {
        if (callback) callback({ success: false, error: "Player session not found in room" });
        return;
      }

      // Update the placeholder player ID to the actual socket ID
      const oldPlayerId = room.players[playerIndex].id;
      room.players[playerIndex].id = socket.id;

      // If they were the host, update the room host reference
      if (room.host === oldPlayerId) {
        room.host = socket.id;
      }

      socket.join(roomId);

      // Tell everyone in the room there's an update (like someone actually appeared online)
      io.to(roomId).emit("room_updated", { players: room.players });

      if (callback) callback({ success: true, players: room.players });
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

          // Room is now in-game, remove from public list
          io.emit("rooms_list", getPublicRoomsList());
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

            // Broadcast updated room list
            io.emit("rooms_list", getPublicRoomsList());
          }
        }
      }
    });

    socket.on("update_settings", (data) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room && room.host === socket.id && !room.state) {
          // Update room-level settings
          if (data.settings?.isPrivate !== undefined) {
            room.isPrivate = data.settings.isPrivate;
          }
          if (data.settings?.maxPlayers !== undefined) {
            room.maxPlayers = data.settings.maxPlayers;
          }
          socket.to(roomId).emit("settings_updated", data.settings);

          // Broadcast updated room list (privacy might have changed)
          io.emit("rooms_list", getPublicRoomsList());
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
              room.hostName = room.players[0].name || 'Player';
            }
            io.to(roomId).emit("room_updated", { players: room.players });
          }
        }
      }
      // Broadcast updated room list
      io.emit("rooms_list", getPublicRoomsList());
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await import("vite");
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  } else {
    const path = await import("path");
    const distPath = path.default.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    // SPA fallback: serve index.html for all non-API routes
    app.get("*", (req, res) => {
      res.sendFile(path.default.resolve(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
