import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  JERSEY_THEMES,
  checkTeamBidEligibility,
  evaluateFriendScorecard,
  formatLakhsCrores,
  generateRoomCode,
  nextBidIncrementCr,
} from "../src/utils/auctionRules.ts";
import { createRealtimeTransport, normalizeRoomCode } from "../src/utils/realtimeSync.ts";
import { players as rosterPlayers } from "../src/data/roster.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function makePlayer(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    lotNumber: overrides.lotNumber ?? 1,
    name: overrides.name ?? "Virat Kohli",
    slug: overrides.slug ?? "virat-kohli",
    photoUrl: "/players/virat-kohli.jpg",
    role: overrides.role ?? "Batter",
    bat: "RHB",
    bowl: "N/A",
    type: "Anchor",
    category: "Marquee",
    ovr: overrides.ovr ?? 97,
    basePriceLakhs: overrides.basePriceLakhs ?? 200,
    basePriceCr: overrides.basePriceCr ?? 2.0,
    highestScore: "122*",
    careerRecords: "IPL all-time leading run-scorer (8,000+); 973 runs in IPL 2016",
    initials: "VK",
    overseas: Boolean(overrides.overseas),
  };
}

test("roster.ts and players.json match all 165 players and public/players/*.jpg portraits exist", () => {
  const jsonPlayers = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "players.json"), "utf8"));
  assert.equal(rosterPlayers.length, 165);
  assert.equal(jsonPlayers.length, 165);

  const slugs = new Set();
  for (let i = 0; i < rosterPlayers.length; i++) {
    const p = rosterPlayers[i];
    assert.equal(p.id, jsonPlayers[i].id);
    assert.equal(p.slug, jsonPlayers[i].slug);
    assert.ok(!slugs.has(p.slug), `Duplicate slug: ${p.slug}`);
    slugs.add(p.slug);
    assert.equal(p.photoUrl, `/players/${p.slug}.jpg`);
    assert.ok(p.ovr >= 60 && p.ovr <= 99);
    assert.ok(p.careerRecords.length > 0);
    assert.ok(p.highestScore || p.bestBowling, `Missing highest/best for ${p.name}`);

    const imgPath = path.join(ROOT, "public", "players", `${p.slug}.jpg`);
    assert.ok(fs.existsSync(imgPath), `Missing portrait file: ${imgPath}`);
  }
});

test("formats Lakhs and Crores accurately", () => {
  assert.equal(formatLakhsCrores(0.2), "20 Lakhs");
  assert.equal(formatLakhsCrores(0.75), "75 Lakhs");
  assert.equal(formatLakhsCrores(1.0), "1.00 Crore");
  assert.equal(formatLakhsCrores(2.4), "2.40 Crores");
});

test("dynamic bid steps follow Lakhs and Crores ladder", () => {
  assert.equal(nextBidIncrementCr(0.6), 0.2);
  assert.equal(nextBidIncrementCr(1.0), 0.25);
  assert.equal(nextBidIncrementCr(5.0), 0.5);
  assert.equal(nextBidIncrementCr(15.0), 1.0);
});

test("all 10 franchise codes and names match and eligibility enforces reserve and overseas limits", () => {
  assert.deepEqual(
    JERSEY_THEMES.map((k) => [k.code, k.franchiseName]),
    [
      ["CSK", "Clutch Squad Knights"],
      ["MBI", "Moneyball Icons"],
      ["RCB", "Raging Chasers Brigade"],
      ["KRC", "Knight Riders Club"],
      ["DDC", "Daredevil Contenders"],
      ["SRH", "Super Riser Heat"],
      ["RRG", "Royal Renegades"],
      ["PBK", "Pure Blitz Kings"],
      ["GPT", "Gameplan Titans"],
      ["LSG", "Lucky Striker Gangs"],
    ],
  );

  const team = {
    id: "t1",
    name: "Royal Blue Strikers",
    kit: JERSEY_THEMES[0],
    purseRemainingCr: 2.0,
    initialPurseCr: 80,
    squad: [],
  };

  const pTooExpensive = makePlayer({ basePriceCr: 1.25 });
  const blocked = checkTeamBidEligibility(team, pTooExpensive, null, null, 5, 11, 4);
  assert.equal(blocked.canBid, false);
  assert.match(blocked.reason || "", /Reserve/);

  const pAffordable = makePlayer({ basePriceCr: 0.8 });
  const allowed = checkTeamBidEligibility(team, pAffordable, null, null, 5, 11, 4);
  assert.equal(allowed.canBid, true);
  assert.equal(allowed.nextBidCr, 0.8);
});

test("final squad scorecard computes rating, steal, overpay, and warnings", () => {
  const p1 = makePlayer({ id: 1, role: "Batter", ovr: 95 });
  const p2 = makePlayer({ id: 2, role: "WK-Batter", ovr: 88 });
  const team = {
    id: "t1",
    name: "Crimson Gold Knights",
    kit: JERSEY_THEMES[1],
    purseRemainingCr: 68,
    initialPurseCr: 80,
    squad: [
      { player: p1, paidCr: 4.0, fairValueCr: 14.0, lotNumber: 1 },
      { player: p2, paidCr: 8.0, fairValueCr: 5.0, lotNumber: 2 },
    ],
  };

  const card = evaluateFriendScorecard(team, 5);
  assert.equal(card.totalSpentCr, 12);
  assert.equal(card.biggestSteal?.player.id, 1);
  assert.equal(card.biggestOverpay?.player.id, 2);
  assert.ok(card.squadRating > 0 && card.squadRating <= 100);
});

test("room code generator, normalization, and local realtime transport work cleanly", () => {
  const code = generateRoomCode(6);
  assert.equal(code.length, 6);
  assert.match(code, /^[A-Z0-9]{6}$/);
  assert.equal(normalizeRoomCode("ht-8k 4q!!"), "HT8K4Q");

  const t1 = createRealtimeTransport(code);
  const t2 = createRealtimeTransport(code);
  assert.equal(t1.mode, "local");

  const received = [];
  const unsub = t2.subscribe((msg) => received.push(msg));
  t1.send({ type: "JOIN_REQUEST", clientId: "c1", friendName: "Aarav", kitId: "csk" });

  unsub();
  t1.destroy();
  t2.destroy();
  assert.ok(Array.isArray(received));
});
