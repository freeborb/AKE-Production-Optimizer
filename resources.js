import { RECIPES as BASE_RECIPES } from "./data/recipes.js";
import { mergeRecipes } from "./custom-recipes.js";
import { sourceTotal, sourceRegions } from "./lpmodel.js";
import { regionOptions, regionLabel, regionTagsElement, initRegionUI } from "./region.js";

const RECIPES = mergeRecipes(BASE_RECIPES);

const QUALITY_LABEL = { hp: "HP", lp: "LP", node: "Nodes" };

const state = {
  search: "",
  region: 0,
  type: ""
};

const els = {
  region: document.getElementById("region"),
  search: document.getElementById("search"),
  regionFilter: document.getElementById("region-filter"),
  type: document.getElementById("type"),
  count: document.getElementById("resource-count"),
  list: document.getElementById("resource-list")
};

function fmt(n) {
  return String(Math.round(n * 1000) / 1000);
}

function matches(r) {
  if (state.region !== 0) {
    const regs = sourceRegions(r);
    if (regs.length && !regs.includes(state.region)) return false;
  }
  if (state.type) {
    const t = (r.name.split(" ")[0] || "").toLowerCase();
    if (t !== state.type) return false;
  }
  if (state.search && !r.name.toLowerCase().includes(state.search)) return false;
  return true;
}

function metaParts(r) {
  return [r.name.split(" ")[0]];
}

function regionLines(r) {
  if (!r.nodes) return ["unlimited"];
  return sourceRegions(r).map((reg) => {
    const c = r.nodes[reg];
    const quals = ["hp", "lp", "node"].filter((q) => (c[q] ?? 0) > 0);
    const str = quals.map((q) => (c[q] ?? 0) + " " + (QUALITY_LABEL[q] || q)).join(" + ");
    return regionLabel(reg) + ": " + str + " = " + fmt(sourceTotal(r, reg)) + "/min";
  });
}

function render() {
  els.list.innerHTML = "";
  const resources = RECIPES.filter((r) => r.source).filter(matches);
  for (const r of resources) {
    const row = document.createElement("div");
    row.className = "resource-row";
    const name = document.createElement("span");
    name.className = "recipe-name";
    name.textContent = r.name;
    row.appendChild(name);
    const detail = document.createElement("div");
    detail.className = "recipe-detail";
    const meta = document.createElement("div");
    meta.className = "detail-meta";
    meta.textContent = metaParts(r).join("  |  ");
    const tags = regionTagsElement(r);
    if (tags.childElementCount) meta.appendChild(tags);
    detail.appendChild(meta);
    for (const line of regionLines(r)) {
      const el = document.createElement("div");
      el.className = "detail-meta";
      el.textContent = line;
      detail.appendChild(el);
    }
    row.appendChild(detail);
    els.list.appendChild(row);
  }
  els.count.textContent = resources.length + " of " + RECIPES.filter((r) => r.source).length + " resources";
}

for (const id of regionOptions()) {
  const opt = document.createElement("option");
  opt.value = String(id);
  opt.textContent = regionLabel(id);
  els.regionFilter.appendChild(opt);
}

els.search.addEventListener("input", () => {
  state.search = els.search.value.trim().toLowerCase();
  render();
});

els.regionFilter.addEventListener("change", () => {
  state.region = Number(els.regionFilter.value);
  render();
});

els.type.addEventListener("change", () => {
  state.type = els.type.value;
  render();
});

initRegionUI(els.region);
render();