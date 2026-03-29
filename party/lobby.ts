import type * as Party from "partykit/server";

interface RoomInfo {
  roomId: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default class Lobby implements Party.Server {
  constructor(readonly room: Party.Room) {}

  private async getRooms(): Promise<Record<string, RoomInfo>> {
    return (await this.room.storage.get<Record<string, RoomInfo>>("rooms")) ?? {};
  }

  async onRequest(req: Party.Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

    if (req.method === "GET") {
      const rooms = await this.getRooms();
      const publicRooms = Object.values(rooms).filter((r) => !r.isPrivate);
      return Response.json(publicRooms, { headers: CORS });
    }

    if (req.method === "POST") {
      let body: any;
      try { body = await req.json(); } catch { return new Response("Bad Request", { status: 400, headers: CORS }); }

      const rooms = await this.getRooms();

      if (body.action === "update" && body.roomId && body.room) {
        rooms[body.roomId] = body.room;
        await this.room.storage.put("rooms", rooms);
        // Broadcast updated list to any connected clients
        const publicRooms = Object.values(rooms).filter((r) => !r.isPrivate);
        this.room.broadcast(JSON.stringify({ type: "rooms_list", rooms: publicRooms }));
      } else if (body.action === "remove" && body.roomId) {
        delete rooms[body.roomId];
        await this.room.storage.put("rooms", rooms);
        const publicRooms = Object.values(rooms).filter((r) => !r.isPrivate);
        this.room.broadcast(JSON.stringify({ type: "rooms_list", rooms: publicRooms }));
      } else if (body.action === "join_random") {
        // Find an open public room
        const available = Object.values(rooms).find(
          (r) => !r.isPrivate && r.playerCount < r.maxPlayers
        );
        return Response.json(
          available ? { found: true, roomId: available.roomId } : { found: false },
          { headers: CORS }
        );
      }

      return Response.json({ ok: true }, { headers: CORS });
    }

    return new Response("Not Found", { status: 404, headers: CORS });
  }
}

Lobby satisfies Party.Worker;
