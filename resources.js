import { RECIPES } from "./data/recipes.js";
import { nodeQualities, nodeRate, sourceTotal } from "./lpmodel.js";
import { regionOptions, regionLabel, regionTagElement, initRegionUI } from "./region.js";

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

function qname(q) {
  return q === "node" ? "Node" : q.toUpperCase();
}

function nodeText(r) {
  return nodeQualities(r)
    .map((q) => qname(q) + " " + fmt(nodeRate(r, q)) + "/min")
    .join(" | ");
}

function capsText(r) {
  const defs = r.defaults || {};
  if (!Object.keys(defs).length) return "unlimited";
  return Object.entries(defs)
    .map(([reg, counts]) => {
      const used = nodeQualities(r).filter((q) => (counts[q] ?? 0) > 0);
      const countStr = used.length ? used.map((q) => (counts[q] ?? 0) + " " + (QUALITY_LABEL[q] || q)).join(" + ") : "none";
      return regionLabel(Number(reg)) + ": " + countStr + " = " + fmt(sourceTotal(r, Number(reg), counts)) + "/min";
    })
    .join("  |  ");
}

function matches(r) {
  if (state.region !== 0 && r.region !== 0 && r.region !== state.region) return false;
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
    meta.appendChild(regionTagElement(r.region));
    detail.appendChild(meta);
    for (const line of [nodeText(r), capsText(r)]) {
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