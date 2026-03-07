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
  const disconnectTimers = new Map<string, NodeJS.Timeout>(); // keyed by originalPlayerId
  const RECONNECT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  // Permanently removes a player after the reconnect window expires
  function permanentlyRemovePlayer(roomId: string, originalPlayerId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    const idx = room.players.findIndex((p: any) => (p.originalId || p.id) === originalPlayerId);
    if (idx === -1) return;
    const player = room.players[idx];
    // If they reconnected before the timer fired, don't remove them
    if (!player.disconnected) return;
    room.players.splice(idx, 1);
    disconnectTimers.delete(originalPlayerId);
    if (room.players.length === 0) {
      rooms.delete(roomId);
    } else {
      // Transfer host if the removed player was host
      if (room.host === player.id) {
        const next = room.players.find((p: any) => !p.disconnected);
        const heir = next || room.players[0];
        room.host = heir.id;
        heir.isHost = true;
        room.hostName = heir.name || 'Player';
        // BUG-11 FIX: Log warning if heir is also disconnected
        if (heir.disconnected) {
          console.log(`WARNING: Host transferred to disconnected player ${heir.id} in room ${roomId}. Waiting for reconnect.`);
        }
      }
      io.to(roomId).emit("room_updated", { players: room.players });
    }
    io.emit("rooms_list", getPublicRoomsList());
    console.log(`Player ${originalPlayerId} permanently removed from room ${roomId} (reconnect window expired).`);
  }

  const GAMERTAG_ADJECTIVES = [
    'Swift', 'Brave', 'Fierce', 'Bold', 'Dark', 'Iron', 'Stone', 'Silent',
    'Shadow', 'Crimson', 'Silver', 'Golden', 'Arctic', 'Cosmic', 'Neon',
    'Phantom', 'Rogue', 'Thunder', 'Velvet', 'Blazing', 'Crystal', 'Electric',
    'Sacred', 'Frozen', 'Obsidian', 'Scarlet', 'Astral', 'Hollow', 'Ember', 'Void'
  ];
  const GAMERTAG_NOUNS = [
    'Falcon', 'Wolf', 'Panther', 'Dragon', 'Phoenix', 'Hawk', 'Blade', 'Shield',
    'Ghost', 'Viper', 'Tiger', 'Lion', 'Fox', 'Raven', 'Eagle', 'Cobra',
    'Titan', 'Ranger', 'Knight', 'Wizard', 'Ninja', 'Viking', 'Warrior',
    'Samurai', 'Mage', 'Archer', 'Scout', 'Cipher', 'Wraith', 'Oracle'
  ];

  function generateGamertag(): string {
    const adj = GAMERTAG_ADJECTIVES[Math.floor(Math.random() * GAMERTAG_ADJECTIVES.length)];
    const noun = GAMERTAG_NOUNS[Math.floor(Math.random() * GAMERTAG_NOUNS.length)];
    return `${adj}${noun}`;
  }

  function getUniqueName(baseName: string, players: any[]) {
    const stripped = (baseName || '').trim();
    // Use a gamertag when the player hasn't set a real name (empty, or default "Player 1", "Player 2", etc.)
    let name = (!stripped || stripped.toLowerCase().startsWith('player')) ? generateGamertag() : stripped;
    let suffix = 1;
    let finalName = name;
    while (players.some(p => p.name === finalName)) {
      finalName = `${name}${suffix}`;   // e.g. SwiftFalcon2 (no brackets, stays clean)
      suffix++;
    }
    return finalName;
  }

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
    const player = { id: playerId, originalId: playerId, name: data.name, avatar: data.avatar, isHost: true };
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
      const uniqueName = getUniqueName(data.name, room.players);
      const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, isHost: false };
      room.players.push(player);
      // We don't broadcast room_updated here because socket isn't connected yet.
      // We will broadcast when they actually connect their socket.
      res.json({ success: true, roomId: targetRoomId, playerId, players: room.players });
    } else {
      // Create a new room
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const playerId = "p_" + Math.random().toString(36).substring(2, 10);
      const player = { id: playerId, originalId: playerId, name: data.name, avatar: data.avatar, isHost: true };
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
    const roomId = req.params.id.trim().toUpperCase();
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
    const uniqueName = getUniqueName(data.name, room.players);
    const player = { id: playerId, originalId: playerId, name: uniqueName, avatar: data.avatar, isHost: false };
    room.players.push(player);

    io.emit("rooms_list", getPublicRoomsList());
    res.json({ success: true, roomId: roomId, playerId, players: room.players });
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Initial connection linking REST session to Socket
    socket.on("join_session", (data, callback) => {
      const { playerId } = data;
      const roomId = data.roomId?.trim().toUpperCase();
      const room = rooms.get(roomId);

      if (!room) {
        if (callback) callback({ success: false, error: "Room not found" });
        return;
      }

      // Search by originalId first (handles reconnects after socket ID change)
      // then fall back to current id (first-time connection)
      const playerIndex = room.players.findIndex((p: any) =>
        p.originalId === playerId || p.id === playerId
      );

      if (playerIndex === -1) {
        if (callback) callback({ success: false, error: "Player session not found in room" });
        return;
      }

      const player = room.players[playerIndex];
      const oldId = player.id;

      // Clear any active disconnect timer for this player
      const timerKey = player.originalId || playerId;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey)!);
        disconnectTimers.delete(timerKey);
        console.log(`Player ${timerKey} reconnected to room ${roomId}. Disconnect timer cleared.`);
      }

      // Update socket ID and clear disconnected flag
      player.id = socket.id;
      player.disconnected = false;
      if (!player.originalId) player.originalId = playerId;

      // Transfer host reference if this player was host
      if (room.host === oldId) {
        room.host = socket.id;
      }

      socket.join(roomId);

      // Notify everyone else that player is back
      io.to(roomId).emit("room_updated", { players: room.players });

      // If game is already in progress, send current state to the rejoining player
      if (room.state) {
        socket.emit("sync_state", { state: room.state });
        console.log(`Sent live game state to reconnecting player ${timerKey} in room ${roomId}.`);
      }

      if (callback) callback({ success: true, players: room.players, gameInProgress: !!room.state });
    });

    socket.on("update_player", (data, callback) => {
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        const room = rooms.get(roomId);
        if (room) {
          const player = room.players.find(p => p.id === socket.id);
          if (player) {
            if (data.name !== undefined) {
              const otherPlayers = room.players.filter(p => p.id !== socket.id);
              player.name = getUniqueName(data.name, otherPlayers);
            }
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

    // BUG-14 FIX: Simple per-socket rate limiter
    const rateLimitMap = new Map<string, number[]>();
    const RATE_LIMIT_MAX = 10;
    const RATE_LIMIT_WINDOW_MS = 1000;
    function isRateLimited(eventKey: string): boolean {
      const now = Date.now();
      const key = `${socket.id}:${eventKey}`;
      const timestamps = rateLimitMap.get(key) || [];
      const filtered = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);
      if (filtered.length >= RATE_LIMIT_MAX) return true;
      filtered.push(now);
      rateLimitMap.set(key, filtered);
      return false;
    }

    socket.on("send_chat", (data) => {
      if (isRateLimited('chat')) return;
      const roomId = Array.from(socket.rooms).find(r => r !== socket.id);
      if (roomId) {
        io.to(roomId).emit("chat_message", data);
      }
    });

    socket.on("game_action", (data) => {
      if (isRateLimited('action')) return;
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
        const playerIndex = room.players.findIndex((p: any) => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          const timerKey = player.originalId || player.id;

          // Soft-disconnect: mark as disconnected and start the reconnect timer
          player.disconnected = true;
          console.log(`Player ${timerKey} disconnected from room ${roomId}. Starting ${RECONNECT_WINDOW_MS / 60000}-min reconnect window.`);

          // Notify others that this player temporarily disconnected
          io.to(roomId).emit("room_updated", { players: room.players });
          io.emit("rooms_list", getPublicRoomsList());

          // Schedule permanent removal after the reconnect window
          const timer = setTimeout(() => {
            permanentlyRemovePlayer(roomId, timerKey);
          }, RECONNECT_WINDOW_MS);
          disconnectTimers.set(timerKey, timer);

          return; // player found in a room — done
        }
      }
      // Not in any room — just update the list
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
    app.use((req, res) => {
      res.sendFile(path.default.resolve(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
