import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const repoRoot = process.argv[2] ?? "C:/Users/User/AppData/Local/Temp/opencode/endfield-calc";

function readRel(p) {
  return fs.readFileSync(path.resolve(repoRoot, p), "utf8");
}

function parseConstEnums(text) {
  const out = {};
  const re = /const (ItemId|RecipeId|FacilityId) = \{([\s\S]*?)\} as const;/g;
  let m;
  while ((m = re.exec(text))) {
    const name = m[1];
    const map = {};
    const pair = /^\s*([A-Z0-9_]+):\s*"([^"]+)",?\s*$/gm;
    let p;
    while ((p = pair.exec(m[2]))) map[p[1]] = p[2];
    out[name] = map;
  }
  return out;
}

function parseFacilityPowers(...files) {
  const powers = {};
  for (const file of files) {
    const text = fs.readFileSync(path.resolve(repoRoot, file), "utf8");
    const chunks = text.split(/(?=\s*id: FacilityId\.)/);
    for (const chunk of chunks) {
      const idM = chunk.match(/id: FacilityId\.([A-Z0-9_]+)/);
      if (!idM) continue;
      const powerM = chunk.match(/powerConsumption:\s*([\d.]+)/);
      powers[idM[1]] = powerM ? Number(powerM[1]) : 0;
    }
  }
  return powers;
}

function parseRecipeEntries(text) {
  const start = text.indexOf("export const recipes: Recipe[] = [");
  if (start < 0) throw new Error("recipes array not found");
  const bodyAll = text.slice(start);
  const open = bodyAll.indexOf("= [");
  const close = bodyAll.lastIndexOf("\n];");
  const body = bodyAll.slice(open + 3, close);
  return body.split(/\n  (?=\{)/);
}

function parseIoArray(arrayText) {
  const out = [];
  const re = /\{\s*itemId:\s*(?:ItemId\.([A-Z0-9_]+)|"([^"]*)"),\s*amount:\s*([\d.]+),?\s*\}/g;
  let m;
  while ((m = re.exec(arrayText))) out.push([m[1] || m[2], Number(m[3])]);
  return out;
}

const localeItem = JSON.parse(readRel("public/locales/en/item.json"));
const localeRecipe = JSON.parse(readRel("public/locales/en/recipe.json"));
const localeFacility = JSON.parse(readRel("public/locales/en/facility.json"));

const enumKeyToValue = {
  item: parseConstEnums(readRel("src/types/constants.ts")).ItemId,
  recipe: parseConstEnums(readRel("src/types/constants.ts")).RecipeId,
  facility: parseConstEnums(readRel("src/types/constants.ts")).FacilityId,
};

function valueOf(enumName, key) {
  const v = enumKeyToValue[enumName][key];
  if (!v) throw new Error("missing " + enumName + " enum key: " + key);
  return v;
}

function contentSegmentToLiquidId(seg) {
  if (seg === "grass_1" || seg === "grass_2") return "item_liquid_plant_" + seg;
  return "item_liquid_" + seg;
}

function contentSegmentToGasId(seg) {
  return "item_gas_" + seg;
}

function itemDisplayName(id) {
  let m = /^item_fbottle_(.+)$/.exec(id);
  if (m) {
    const bases = ["copperenr", "glassenr", "ironenr", "xiranenr", "copper", "glass", "iron"].sort(
      (a, b) => b.length - a.length
    );
    const tail = m[1];
    const base = bases.find((b) => tail === b || tail.startsWith(b + "_"));
    const content = tail.slice(base.length + 1);
    const liquidId = contentSegmentToLiquidId(content);
    const contentName = localeItem[liquidId] || content;
    const baseName = localeItem[id] || id;
    return baseName + " (" + contentName + ")";
  }
  m = /^item_gasjar_(.+)$/.exec(id);
  if (m) {
    const tail = m[1];
    const prefix = "copper_gas_";
    if (tail.startsWith(prefix)) {
      const content = tail.slice(prefix.length);
      const gasId = contentSegmentToGasId(content);
      const gasName = localeItem[gasId] || content;
      const baseName = localeItem[id] || id;
      return baseName + " (" + gasName + ")";
    }
  }
  if (localeItem[id]) return localeItem[id];
  return id;
}

const itemNames = new Map();
for (const id of Object.keys(localeItem)) itemNames.set(id, itemDisplayName(id));

const facilityPower = parseFacilityPowers(
  "src/data/facilities.ts",
  "src/data/region-subsystems.ts",
  "src/data/power.ts"
);

const VALLEY = "valley_4";
const WULING = "wuling";

const ORE_NODES = { hp: { rate: 20 }, lp: { rate: 10 } };
const LIQUID_NODES = { node: { rate: 60 } };

const SOURCES = [
  {
    id: "source_originium_ore",
    item: "item_originium_ore",
    tag: "Mine",
    energy: 0,
    nodes: ORE_NODES,
    defaults: { [VALLEY]: { hp: 28, lp: 0 }, [WULING]: { hp: 22, lp: 10 } },
  },
  {
    id: "source_quartz_sand",
    item: "item_quartz_sand",
    tag: "Mine",
    energy: 0,
    nodes: ORE_NODES,
    defaults: { [VALLEY]: { hp: 12, lp: 0 } },
    regions: [VALLEY],
  },
  {
    id: "source_iron_ore",
    item: "item_iron_ore",
    tag: "Mine",
    energy: 0,
    nodes: ORE_NODES,
    defaults: { [VALLEY]: { hp: 54, lp: 0 }, [WULING]: { hp: 6, lp: 0 } },
  },
  {
    id: "source_copper_ore",
    item: "item_copper_ore",
    tag: "Mine",
    energy: 0,
    nodes: ORE_NODES,
    defaults: { [WULING]: { hp: 21, lp: 0 } },
    regions: [WULING],
  },
  {
    id: "source_liquid_water",
    item: "item_liquid_water",
    tag: "Pump",
    energy: 10,
    nodes: LIQUID_NODES,
    defaults: { [VALLEY]: { node: 10 }, [WULING]: { node: 10 } },
  },
  {
    id: "source_liquid_acid",
    item: "item_liquid_acid",
    tag: "Pump",
    energy: 20,
    nodes: LIQUID_NODES,
    defaults: { [WULING]: { node: 10 } },
    regions: [WULING],
  },
  {
    id: "source_gas_inert",
    item: "item_gas_inert",
    tag: "Extract",
    energy: 0,
    nodes: ORE_NODES,
    defaults: { [WULING]: { hp: 23, lp: 0 } },
    regions: [WULING],
  },
  {
    id: "source_gas_xiranite",
    item: "item_gas_xiranite",
    tag: "Extract",
    energy: 0,
    nodes: ORE_NODES,
    defaults: { [WULING]: { hp: 5, lp: 0 } },
    regions: [WULING],
  },
  {
    id: "source_muck",
    item: "item_muck_feces_1",
    tag: "Collect",
    energy: 0,
    nodes: { node: { rate: 30 } },
    defaults: { [WULING]: { node: 10 } },
    regions: [WULING],
  },
];

const BURNS = [
  { recipe: "burn_item_proc_battery_1", battery: "item_proc_battery_1", energy: 220 * 40, regions: [VALLEY] },
  { recipe: "burn_item_proc_battery_2", battery: "item_proc_battery_2", energy: 420 * 40, regions: [VALLEY] },
  { recipe: "burn_item_proc_battery_3", battery: "item_proc_battery_3", energy: 1100 * 40, regions: [VALLEY] },
  { recipe: "burn_item_proc_battery_4", battery: "item_proc_battery_4", energy: 1600 * 40, regions: [WULING] },
  { recipe: "burn_item_proc_battery_5", battery: "item_proc_battery_5", energy: 3200 * 40, regions: [WULING] },
];

const SKIP_RECIPES = new Set([
  "liquid_clean_gate_1_disposal",
  "vaporize_item_gas_acid",
  "vaporize_item_gas_inert",
  "vaporize_item_gas_water",
  "vaporize_item_gas_xiranite",
]);

function recipeFallbackName(id, inputs, outputs, facilityName) {
  const names = (list) => list.map(([itemId]) => itemNames.get(itemId) || itemId).join(", ");
  if (outputs.length) return names(outputs) + " @ " + facilityName;
  if (inputs.length) return "Dispose " + names(inputs);
  return id;
}

function displayedName(name) {
  return name.replace(/\s+Production(?=\s*\(|$)/i, "");
}

const recipes = [];
const namesToIds = new Map();
let skipped = 0;

function trackName(name, itemId) {
  if (!namesToIds.has(name)) namesToIds.set(name, new Set());
  namesToIds.get(name).add(itemId);
}

for (const entry of parseRecipeEntries(readRel("src/data/recipes.ts"))) {
  if (!/id: RecipeId\./.test(entry)) continue;
  const idM = entry.match(/id: RecipeId\.([A-Z0-9_]+)/);
  if (!idM) throw new Error("recipe without id:\n" + entry);
  const recipeId = valueOf("recipe", idM[1]);

  const facM = entry.match(/facilityId: FacilityId\.([A-Z0-9_]+)/);
  const facilityId = facM ? valueOf("facility", facM[1]) : null;
  const timeM = entry.match(/craftingTime:\s*([\d.]+)/);
  const craftingTime = timeM ? Number(timeM[1]) : 1;

  const inputsArray = parseIoArray((entry.match(/inputs:\s*\[([\s\S]*?)\]/) || [])[1] || "");
  const outputsArray = parseIoArray((entry.match(/outputs:\s*\[([\s\S]*?)\]/) || [])[1] || "");

  if (SKIP_RECIPES.has(recipeId)) {
    skipped++;
    continue;
  }

  const inputs = {};
  for (const [itemKey, amount] of inputsArray) {
    const id = itemKey.startsWith("item_") ? itemKey : valueOf("item", itemKey);
    const name = itemNames.get(id) || id;
    trackName(name, id);
    inputs[name] = (inputs[name] || 0) + amount;
  }
  const outputs = {};
  for (const [itemKey, amount] of outputsArray) {
    const id = itemKey.startsWith("item_") ? itemKey : valueOf("item", itemKey);
    const name = itemNames.get(id) || id;
    trackName(name, id);
    outputs[name] = (outputs[name] || 0) + amount;
  }

  const facilityName = facilityId ? localeFacility[facilityId] || facilityId : "?";
  const power = facilityId ? facilityPower[facM[1]] : 0;
  const energy = Math.round(power * craftingTime * 1e6) / 1e6;

  recipes.push({
    id: recipeId,
    name: displayedName(localeRecipe[recipeId] || recipeFallbackName(recipeId, inputsArray, outputsArray, facilityName)),
    facility: facilityName,
    craftingTime,
    inputs,
    outputs,
    energy,
  });
}

for (const s of SOURCES) {
  const name = itemNames.get(s.item) || s.item;
  trackName(name, s.item);
  const recipe = {
    id: s.id,
    name: s.tag + " " + name,
    inputs: {},
    outputs: { [name]: 1 },
    energy: s.energy,
    source: true,
    nodes: s.nodes,
    defaults: s.defaults,
  };
  if (s.regions) recipe.regions = s.regions;
  recipes.push(recipe);
}

for (const b of BURNS) {
  const batteryName = itemNames.get(b.battery) || b.battery;
  trackName(batteryName, b.battery);
  const recipe = {
    id: b.recipe,
    name: localeRecipe[b.recipe] || "Power Generation (" + batteryName + ")",
    facility: "Thermal Bank",
    craftingTime: 40,
    inputs: { [batteryName]: 1 },
    outputs: { Energy: b.energy },
    energy: 0,
  };
  if (b.regions) recipe.regions = b.regions;
  recipes.push(recipe);
}

const collisions = [...namesToIds.entries()]
  .filter(([name, ids]) => ids.size > 1 && name !== "Energy")
  .map(([name, ids]) => name + " <- " + [...ids].join(", "));

console.log("recipes:", recipes.length, "| skipped:", skipped);
console.log("materials:", namesToIds.size);
if (collisions.length) {
  console.log("NAME COLLISIONS (distinct item ids sharing a display name):");
  for (const c of collisions) console.log("  " + c);
}

const out =
  "export const RECIPES = " +
  JSON.stringify(recipes, null, 2) +
  ";";

fs.writeFileSync(path.join(projectRoot, "data", "recipes.js"), out);
console.log("wrote data/recipes.js");