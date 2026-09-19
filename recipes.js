import { RECIPES } from "./data/recipes.js";
import { loadEnabled, saveEnabled } from "./store.js";
import { nodeQualities, nodeRate, sourceTotal } from "./lpmodel.js";

const REGION_LABEL = { valley_4: "Valley 4", wuling: "Wuling" };
const QUALITY_LABEL = { hp: "HP", lp: "LP", node: "Nodes" };

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

function capText(r) {
  const parts = [];
  const quals = nodeQualities(r);
  if (quals.length) {
    parts.push(quals.map((q) => (QUALITY_LABEL[q] || q) + " " + fmt(nodeRate(r, q)) + "/min").join(", "));
  }
  const defs = Object.entries(r.defaults || {});
  if (defs.length) {
    parts.push(
      "default " +
        defs.map(([reg, counts]) => REGION_LABEL[reg] + " " + countsText(counts, r)).join(" | ")
    );
  }
  return parts.join("  |  ");
}

function countsText(counts, r) {
  return nodeQualities(r)
    .map((q) => (counts[q] ?? 0) + " " + (QUALITY_LABEL[q] || q))
    .join(" + ") + " = " + fmt(sourceTotal(r, null, counts)) + "/min";
}

function matchesFilter(r) {
  if (!state.filter) return true;
  return r.name.toLowerCase().includes(state.filter);
}

function detailLine(r) {
  const parts = [];
  if (r.facility) parts.push(r.facility + " (" + r.craftingTime + "s)");
  const res = Object.entries(r.residues || {});
  if (res.length) parts.push("residue " + res.map(([m, q]) => fmt(q) + " " + m).join(", "));
  if (r.source) parts.push(capText(r));
  if (r.energy) parts.push(fmt(r.energy) + " kJ/run");
  if (r.regions) parts.push("[" + r.regions.map((k) => REGION_LABEL[k]).join(", ") + "]");
  return parts.join("  |  ");
}

function ioLine(tagClass, tagText, materials) {
  const line = document.createElement("span");
  line.className = "detail-line";
  const tag = document.createElement("b");
  tag.className = "tag " + tagClass;
  tag.textContent = tagText;
  const text = document.createElement("span");
  text.textContent = materials;
  line.appendChild(tag);
  line.appendChild(text);
  return line;
}

function rowDetail(r) {
  const container = document.createElement("div");
  container.className = "recipe-detail";
  const inText = Object.entries(r.inputs).map(([m, q]) => fmt(q) + " " + m).join(", ");
  if (inText) container.appendChild(ioLine("in", "IN", inText));
  const outText = Object.entries(r.outputs).map(([m, q]) => fmt(q) + " " + m).join(", ");
  if (outText) container.appendChild(ioLine("out", "OUT", outText));
  const meta = detailLine(r);
  if (meta) {
    const metaEl = document.createElement("span");
    metaEl.className = "detail-meta";
    metaEl.textContent = meta;
    container.appendChild(metaEl);
  }
  return container;
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
    row.appendChild(cb);
    row.appendChild(name);
    row.appendChild(rowDetail(r));
    els.list.appendChild(row);
  }
  els.count.textContent = countText(shown.length);
}

els.search.addEventListener("input", () => {
  state.filter = els.search.value.trim().toLowerCase();
  render();
});

render();