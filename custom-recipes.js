const CUSTOM_KEY = "ake-optimizer-custom-recipes-v1";
const HIDDEN_KEY = "ake-optimizer-hidden-recipes-v1";

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

export function loadHiddenRecipes() {
  try {
    const list = JSON.parse(localStorage.getItem(HIDDEN_KEY) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveHiddenRecipes(list) {
  localStorage.setItem(HIDDEN_KEY, JSON.stringify(list));
}

export function hideRecipeId(id) {
  const list = loadHiddenRecipes();
  if (!list.includes(id)) {
    list.push(id);
    saveHiddenRecipes(list);
  }
}

export function mergeCustomRecipes(base) {
  const customs = loadCustomRecipes();
  const ids = new Set(customs.map((c) => c.id));
  return [...base.filter((r) => !ids.has(r.id)), ...customs];
}

export function mergeRecipes(base) {
  const hidden = new Set(loadHiddenRecipes());
  return mergeCustomRecipes(base).filter((r) => !hidden.has(r.id));
}

export function newCustomId() {
  return "custom_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}