const KEY = "ake-optimizer-enabled-v1";

export function loadEnabled(recipes) {
  let saved = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    saved = {};
  }
  const state = {};
  for (const r of recipes) state[r.id] = saved[r.id] !== false;
  return state;
}

export function saveEnabled(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}