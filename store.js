const ENABLED_KEY = "ake-optimizer-enabled-v1";
export const REGION_KEY = "ake-optimizer-region-v1";

function getJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

export function loadRegion() {
  const n = Number(localStorage.getItem(REGION_KEY));
  return n === 2 || n === 3 ? n : 1;
}

export function saveRegion(r) {
  localStorage.setItem(REGION_KEY, String(r));
}

export function loadEnabled(recipes, region) {
  const saved = getJSON(ENABLED_KEY);
  const isLegacyFlat = Object.keys(saved).some((k) => k !== "1" && k !== "2" && k !== "3");
  const map = isLegacyFlat ? saved : saved[region] || {};
  const state = {};
  for (const r of recipes) state[r.id] = map[r.id] !== false;
  return state;
}

export function saveEnabled(state, region) {
  const saved = getJSON(ENABLED_KEY);
  saved[region] = state;
  localStorage.setItem(ENABLED_KEY, JSON.stringify(saved));
}