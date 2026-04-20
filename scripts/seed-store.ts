/**
 * Seed script — adds a batch of store items (tokens, profile pics, avatars)
 * and three themed 11×11 boards, then links each board to a `board_skin`
 * store item so players can unlock it via coins.
 *
 * Usage:
 *   DATABASE_URL=postgres://… npx tsx scripts/seed-store.ts
 *
 * Safe to run multiple times — each item/board is keyed by a stable slug
 * so re-runs overwrite rather than duplicate.
 */
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db";
import { storeItem, adminBoard } from "../db/schema";
import { TileType, ColorGroup } from "../types";

// ── Tile builder (mirrors components/admin/boardUtils.ts) ─────────────────────

const PROPERTY_GROUPS = [
  ColorGroup.BROWN,
  ColorGroup.LIGHT_BLUE,
  ColorGroup.PINK,
  ColorGroup.ORANGE,
  ColorGroup.RED,
  ColorGroup.YELLOW,
  ColorGroup.GREEN,
  ColorGroup.DARK_BLUE,
];

const BASE_PRICES = [60, 100, 140, 180, 220, 260, 300, 380];

interface SeedTile {
  position: number;
  name: string;
  type: TileType;
  group: ColorGroup;
  price: number;
  rent: number[];
  houseCost: number;
  countryCode?: string;
  priceTagPosition: "top" | "bottom" | "left" | "right";
}

/** Build a 40-tile (11×11) board with themed names for the 22 properties. */
function buildBoard(
  cornerNames: [string, string, string, string], // START, Prison, Vacation, Go to Prison
  railNames: [string, string, string, string],
  propertyNames: string[],
  chanceLabel = "Surprise",
  taxLabel = "Tax",
): SeedTile[] {
  const N = 11;
  const total = 4 * (N - 1); // 40
  const corners = [0, N - 1, 2 * N - 2, 3 * N - 3]; // 0, 10, 20, 30

  const rail = new Set(
    [0.125, 0.375, 0.625, 0.875]
      .map((f) => Math.round(total * f))
      .filter((p) => !corners.includes(p)),
  );
  const chance = new Set(
    [0.175, 0.55]
      .map((f) => Math.round(total * f))
      .filter((p) => !corners.includes(p) && !rail.has(p)),
  );
  const tax = new Set(
    [0.1, 0.95]
      .map((f) => Math.round(total * f))
      .filter((p) => !corners.includes(p) && !rail.has(p) && !chance.has(p)),
  );

  const nonCornerCount = total - 4;
  const propertySlots =
    nonCornerCount - rail.size - chance.size - tax.size; // how many PROPERTY tiles

  const railList = [...rail].sort((a, b) => a - b);
  let railIdx = 0;
  let propIdx = 0;

  return Array.from({ length: total }, (_, i): SeedTile => {
    const ci = corners.indexOf(i);
    if (ci !== -1) {
      return {
        position: i,
        name: cornerNames[ci],
        type: TileType.CORNER,
        group: ColorGroup.NONE,
        price: 0,
        rent: [],
        houseCost: 0,
        priceTagPosition: "bottom",
      };
    }
    if (rail.has(i)) {
      const name = railNames[railIdx++] ?? `Station ${railIdx}`;
      return {
        position: i,
        name,
        type: TileType.RAILROAD,
        group: ColorGroup.NONE,
        price: 200,
        rent: [25, 50, 100, 200],
        houseCost: 0,
        priceTagPosition: "bottom",
      };
    }
    if (chance.has(i)) {
      return {
        position: i,
        name: chanceLabel,
        type: TileType.CHANCE,
        group: ColorGroup.NONE,
        price: 0,
        rent: [],
        houseCost: 0,
        priceTagPosition: "bottom",
      };
    }
    if (tax.has(i)) {
      return {
        position: i,
        name: taxLabel,
        type: TileType.TAX,
        group: ColorGroup.NONE,
        price: 0,
        rent: [],
        houseCost: 0,
        priceTagPosition: "bottom",
      };
    }

    const groupIdx = Math.min(
      Math.floor((propIdx / Math.max(propertySlots, 1)) * PROPERTY_GROUPS.length),
      PROPERTY_GROUPS.length - 1,
    );
    const group = PROPERTY_GROUPS[groupIdx];
    const basePrice = BASE_PRICES[groupIdx];
    const houseCost = groupIdx < 4 ? 50 : groupIdx < 6 ? 100 : 150;
    const name = propertyNames[propIdx] ?? `Property ${i}`;
    propIdx++;

    return {
      position: i,
      name,
      type: TileType.PROPERTY,
      group,
      price: basePrice,
      rent: [
        Math.round(basePrice * 0.03),
        Math.round(basePrice * 0.17),
        Math.round(basePrice * 0.5),
        Math.round(basePrice * 1.5),
        Math.round(basePrice * 2.5),
        Math.round(basePrice * 4),
      ],
      houseCost,
      priceTagPosition: "bottom",
    };
  });
}

// ── Themed boards ─────────────────────────────────────────────────────────────

// Properties: 22 slots, 8 color groups ordered BROWN → DARK_BLUE.
// Naming convention: 2 brown, 3 each for the next six groups, 2 dark blue.

const TROPICAL = buildBoard(
  ["START", "Island Jail", "Beach Break", "Shark Lagoon"],
  ["Port Victoria", "Coral Harbor", "Palm Wharf", "Sunset Marina"],
  [
    "Driftwood Cove", "Turtle Bay",
    "Palm Grove", "Hibiscus Isle", "Mango Ridge",
    "Coconut Lagoon", "Pearl Reef", "Starfish Point",
    "Mango Beach", "Sunset Strip", "Orchid Bay",
    "Ruby Reef", "Flamingo Cay", "Sunfire Cliffs",
    "Amber Sands", "Golden Dunes", "Lemon Atoll",
    "Emerald Isle", "Jade Harbor", "Paradise Peak",
    "Sapphire Bay", "Azure Shores",
  ],
  "Message in a Bottle",
  "Customs Tax",
);

const NEON = buildBoard(
  ["BOOT", "Lockout", "Respawn Plaza", "Black ICE"],
  ["Grid Node A", "Grid Node B", "Grid Node C", "Grid Node D"],
  [
    "Byte Slum", "Pixel Alley",
    "Data Wharf", "Circuit Row", "Fiber Lane",
    "Chrome Plaza", "Neon Strip", "Holo Park",
    "Firewall Ave", "Synth Heights", "Vapor Court",
    "Plasma Road", "Fusion Gate", "Crimson Loop",
    "Solar Deck", "Lumen Terrace", "Photon Mall",
    "Cryo Green", "Emerald Matrix", "Jadegate",
    "Zero Tower", "Singularity",
  ],
  "Hacker's Roll",
  "ICE Tax",
);

const MEDIEVAL = buildBoard(
  ["START", "Dungeon", "Tavern Rest", "To the Dungeon"],
  ["East Gate", "West Gate", "North Gate", "South Gate"],
  [
    "Peasant Lane", "Mud Row",
    "Hunter's Path", "Fox Hollow", "Briar Green",
    "Merchant Way", "Cobbler Row", "Apothecary Ln",
    "Smithy Square", "Forge End", "Iron Court",
    "Knight's Hold", "Dragon Road", "Ember Keep",
    "Amberwood", "Honeymead", "Sunspire",
    "Emerald Glen", "Verdant Vale", "Shireford",
    "Crownhold", "Royal Spire",
  ],
  "Fortune's Wheel",
  "Crown Tax",
);

// Stable slugs let us upsert (reruns don't create duplicates).
const BOARD_SEEDS = [
  { slug: "tropical-paradise", name: "Tropical Paradise", tiles: TROPICAL },
  { slug: "neon-metropolis",   name: "Neon Metropolis",   tiles: NEON },
  { slug: "medieval-kingdom",  name: "Medieval Kingdom",  tiles: MEDIEVAL },
];

// ── Store item catalog ────────────────────────────────────────────────────────

interface ItemSeed {
  id: string;
  name: string;
  description: string;
  type: "avatar" | "board_skin" | "token" | "profile_pic" | "misc";
  priceCoins: number;
  assetUrl: string | null;
}

const STANDALONE_ITEMS: ItemSeed[] = [
  // Tokens
  { id: "token-rocket",  name: "Rocket Token",  description: "Blast off in style.",             type: "token",       priceCoins: 250, assetUrl: null },
  { id: "token-crown",   name: "Crown Token",   description: "Rule the board.",                 type: "token",       priceCoins: 400, assetUrl: null },
  { id: "token-skull",   name: "Skull Token",   description: "Cursed gold hits different.",     type: "token",       priceCoins: 350, assetUrl: null },
  { id: "token-dragon",  name: "Dragon Token",  description: "Hoard properties like a dragon.", type: "token",       priceCoins: 600, assetUrl: null },
  // Profile pics
  { id: "pic-fox",       name: "Sly Fox",       description: "For the cunning negotiator.",     type: "profile_pic", priceCoins: 150, assetUrl: null },
  { id: "pic-robot",     name: "Tycoon Bot",    description: "All calculated, no emotion.",     type: "profile_pic", priceCoins: 200, assetUrl: null },
  { id: "pic-wizard",    name: "Coin Wizard",   description: "Magic markup on rents.",          type: "profile_pic", priceCoins: 300, assetUrl: null },
  // Avatar frames
  { id: "avatar-gold",   name: "Gold Frame",    description: "Glittering border for your avatar.", type: "avatar",   priceCoins: 500, assetUrl: null },
  { id: "avatar-neon",   name: "Neon Frame",    description: "Pulses in your opponent's nightmares.", type: "avatar", priceCoins: 500, assetUrl: null },
  // Misc
  { id: "misc-confetti", name: "Confetti Burst",description: "Explosive win animation.",        type: "misc",        priceCoins: 800, assetUrl: null },
];

// ── Runner ────────────────────────────────────────────────────────────────────

async function upsertBoard(slug: string, name: string, tiles: SeedTile[]) {
  const existing = await db
    .select({ id: adminBoard.id })
    .from(adminBoard)
    .where(eq(adminBoard.name, name))
    .limit(1);

  if (existing.length) {
    await db
      .update(adminBoard)
      .set({ tiles, boardSize: 11, updatedAt: new Date() })
      .where(eq(adminBoard.id, existing[0].id));
    return existing[0].id;
  }

  const id = randomUUID();
  await db.insert(adminBoard).values({
    id,
    name,
    boardSize: 11,
    tiles,
    isActive: false,
  });
  return id;
}

async function upsertItem(item: ItemSeed) {
  const existing = await db
    .select({ id: storeItem.id })
    .from(storeItem)
    .where(eq(storeItem.id, item.id))
    .limit(1);

  if (existing.length) {
    await db
      .update(storeItem)
      .set({
        name: item.name,
        description: item.description,
        type: item.type,
        priceCoins: item.priceCoins,
        assetUrl: item.assetUrl,
        active: true,
      })
      .where(eq(storeItem.id, item.id));
  } else {
    await db.insert(storeItem).values({ ...item, active: true });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required.");
    process.exit(1);
  }

  console.log("Seeding boards…");
  const boardItems: ItemSeed[] = [];
  const boardPrices: Record<string, number> = {
    "tropical-paradise": 700,
    "neon-metropolis":   900,
    "medieval-kingdom":  750,
  };
  const boardBlurbs: Record<string, string> = {
    "tropical-paradise": "Trade coconuts for high-roller beachfront.",
    "neon-metropolis":   "Cyberpunk streets, circuit-board rents.",
    "medieval-kingdom":  "Bid on fiefdoms from peasant lane to the royal spire.",
  };

  for (const b of BOARD_SEEDS) {
    const boardId = await upsertBoard(b.slug, b.name, b.tiles);
    console.log(`  ✓ ${b.name} (${boardId})`);
    boardItems.push({
      id: `board-skin-${b.slug}`,
      name: `${b.name} Board`,
      description: boardBlurbs[b.slug],
      type: "board_skin",
      priceCoins: boardPrices[b.slug],
      assetUrl: boardId, // admin board row id — client uses this to load the board
    });
  }

  console.log("Seeding store items…");
  const all = [...boardItems, ...STANDALONE_ITEMS];
  for (const item of all) {
    await upsertItem(item);
    console.log(`  ✓ ${item.type.padEnd(12)} ${item.name}  (${item.priceCoins} coins)`);
  }

  console.log(`\nDone — ${BOARD_SEEDS.length} boards, ${all.length} store items.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
