import { RECIPES } from "./data/recipes.js";
import { loadEnabled, saveEnabled } from "./store.js";

const state = {
  enabled: loadEnabled(RECIPES),
  filter: ""
};

const els = {
  search: document.getElementById("search"),
  count: document.getElementById("enabled-count"),
  list: document.getElementById("recipe-list")
};

function fmt(n) {
  return String(Math.round(n * 1000) / 1000);
}

const REGION_LABEL = { valley_4: "Valley 4", wuling: "Wuling" };

function capText(r) {
  if (r.capacity === undefined || r.capacity === null) return "external (unlimited)";
  if (typeof r.capacity === "object") {
    return Object.entries(r.capacity)
      .map(([key, c]) => REGION_LABEL[key] + " \u2264 " + fmt(c) + "/min")
      .join(", ");
  }
  return "external \u2264 " + fmt(r.capacity) + "/min";
}

function matchesFilter(r) {
  if (!state.filter) return true;
  return r.name.toLowerCase().includes(state.filter);
}

function detailText(r) {
  const parts = [];
  if (r.facility) parts.push(r.facility + " (" + r.craftingTime + "s)");
  const inText = Object.entries(r.inputs).map(([m, q]) => fmt(q) + " " + m).join(", ");
  if (inText) parts.push("in " + inText);
  const outText = Object.entries(r.outputs).map(([m, q]) => fmt(q) + " " + m).join(", ");
  if (outText) parts.push("out " + outText);
  const res = Object.entries(r.residues || {});
  if (res.length) parts.push("residue " + res.map(([m, q]) => fmt(q) + " " + m).join(", "));
  if (r.source) parts.push(capText(r));
  if (r.regions) parts.push("[" + r.regions.map((k) => REGION_LABEL[k]).join(", ") + "]");
  return parts.join("  |  ");
}

function countText(showing) {
  const enabled = RECIPES.filter((r) => state.enabled[r.id]).length;
  const shown = showing ? " (" + showing + " shown)" : "";
  return enabled + " of " + RECIPES.length + " recipes enabled" + shown;
}

function render() {
  els.list.innerHTML = "";
  const shown = RECIPES.filter(matchesFilter);
  for (const r of shown) {
    const row = document.createElement("label");
    row.className = "recipe-row" + (state.enabled[r.id] ? "" : " off");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.enabled[r.id];
    cb.addEventListener("change", () => {
      state.enabled[r.id] = cb.checked;
      row.classList.toggle("off", !cb.checked);
      saveEnabled(state.enabled);
      els.count.textContent = countText(shown.length);
    });
    const name = document.createElement("span");
    name.className = "recipe-name";
    name.textContent = r.name;
    const detail = document.createElement("span");
    detail.className = "recipe-detail";
    detail.textContent = detailText(r);
    row.appendChild(cb);
    row.appendChild(name);
    row.appendChild(detail);
    els.list.appendChild(row);
  }
  els.count.textContent = countText(shown.length);
}

els.search.addEventListener("input", () => {
  state.filter = els.search.value.trim().toLowerCase();
  render();
});

render();