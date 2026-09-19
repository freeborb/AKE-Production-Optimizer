const CUSTOM_KEY = "ake-optimizer-custom-recipes-v1";

export function loadCustomRecipes() {
  try {
    const list = JSON.parse(localStorage.getItem(CUSTOM_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveCustomRecipes(list) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
}

export function mergeCustomRecipes(base) {
  const customs = loadCustomRecipes();
  const ids = new Set(customs.map((c) => c.id));
  return [...base.filter((r) => !ids.has(r.id)), ...customs];
}

export function newCustomId() {
  return "custom_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}