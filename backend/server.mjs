import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PLAYERS_JSON_PATH = path.join(__dirname, "data", "players.json");

const PORT = Number(process.env.PORT || 8080);
const HOST = "0.0.0.0";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// In-memory room store for lightweight REST sync (optional alongside Supabase Realtime)
const rooms = new Map();

function loadPlayers() {
  const raw = fs.readFileSync(PLAYERS_JSON_PATH, "utf-8");
  return JSON.parse(raw);
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

export function createServer() {
  return http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": CORS_ORIGIN,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      });
      res.end();
      return;
    }

    const urlPath = (req.url || "/").split("?")[0];

    if (urlPath === "/" || urlPath === "/health") {
      sendJson(res, 200, {
        status: "ok",
        service: "hammer-time-auction-backend",
        activeRooms: rooms.size,
      });
      return;
    }

    if (urlPath === "/api/players") {
      try {
        const players = loadPlayers();
        sendJson(res, 200, players);
      } catch (err) {
        sendJson(res, 500, { error: String(err) });
      }
      return;
    }

    const roomMatch = urlPath.match(/^\/api\/rooms\/([A-Za-z0-9]{4,8})$/);
    if (roomMatch) {
      const code = roomMatch[1].toUpperCase();
      if (req.method === "GET") {
        const snap = rooms.get(code);
        if (!snap) {
          sendJson(res, 404, { error: `Room ${code} not found` });
          return;
        }
        sendJson(res, 200, snap);
        return;
      }
      if (req.method === "POST") {
        try {
          const payload = await readJsonBody(req);
          rooms.set(code, { ...payload, roomCode: code, updatedAt: Date.now() });
          sendJson(res, 200, rooms.get(code));
        } catch (err) {
          sendJson(res, 400, { error: String(err) });
        }
        return;
      }
    }

    sendJson(res, 404, { error: "Not Found" });
  });
}

if (process.argv[1] === __filename) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`Hammer Time Auction Backend listening on http://${HOST}:${PORT}`);
  });
}
