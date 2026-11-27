import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "../server.mjs";
import { TEAM_CATALOG, incrementForCurrentBid } from "../engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLAYERS_PATH = path.resolve(__dirname, "..", "data", "players.json");

test("backend player dataset has 165 players and 10 franchises", () => {
  const players = JSON.parse(fs.readFileSync(PLAYERS_PATH, "utf-8"));
  assert.equal(players.length, 165);
  assert.equal(TEAM_CATALOG.length, 10);
  assert.equal(incrementForCurrentBid(1.0), 0.25);
  assert.equal(incrementForCurrentBid(5.0), 0.5);
  assert.equal(incrementForCurrentBid(15.0), 1.0);
});

test("backend HTTP endpoints /health, /api/players, and /api/rooms/:code work", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const base = `http://127.0.0.1:${addr.port}`;

  try {
    const h = await fetch(`${base}/health`);
    assert.equal(h.status, 200);
    const hJson = await h.json();
    assert.equal(hJson.status, "ok");

    const pRes = await fetch(`${base}/api/players`);
    assert.equal(pRes.status, 200);
    const players = await pRes.json();
    assert.equal(players.length, 165);

    const postRes = await fetch(`${base}/api/rooms/HT8K4M`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ screen: "LOBBY", lotIdx: 0 }),
    });
    assert.equal(postRes.status, 200);

    const getRes = await fetch(`${base}/api/rooms/HT8K4M`);
    assert.equal(getRes.status, 200);
    const room = await getRes.json();
    assert.equal(room.roomCode, "HT8K4M");
    assert.equal(room.screen, "LOBBY");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
