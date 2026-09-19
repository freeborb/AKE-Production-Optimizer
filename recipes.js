import { RECIPES } from "./data/recipes.js";
import { loadEnabled, saveEnabled } from "./store.js";
import { nodeQualities, nodeRate, sourceTotal, validInRegion } from "./lpmodel.js";
import { currentRegion, regionOptions, regionLabel, regionTagElement, initRegionUI } from "./region.js";

const QUALITY_LABEL = { hp: "HP", lp: "LP", node: "Nodes" };

const state = {
  filter: "",
  facility: ""
};

const enabledByRegion = {};
for (const id of regionOptions()) enabledByRegion[id] = loadEnabled(RECIPES, id);

function currentEnabled() {
  return enabledByRegion[currentRegion()];
}

function regionRecipes() {
  return RECIPES.filter((r) => validInRegion(r, currentRegion()));
}

const els = {
  region: document.getElementById("region"),
  search: document.getElementById("search"),
  facility: document.getElementById("facility"),
  count: document.getElementById("enabled-count"),
  list: document.getElementById("recipe-list")
};

const EXTERNAL_VALUE = "__source__";

function initFacilityOptions() {
  const facilities = [...new Set(RECIPES.map((r) => r.facility).filter(Boolean))].sort();
  let html = '<option value="">All facilities</option>';
  html += '<option value="' + EXTERNAL_VALUE + '">External (sources)</option>';
  for (const f of facilities) html += '<option value="' + f + '">' + f + "</option>";
  els.facility.innerHTML = html;
}

function fmt(n) {
  return String(Math.round(n * 1000) / 1000);
}

function capText(r) {
  const parts = [];
  if (!r.defaults || !Object.keys(r.defaults).length) parts.push("unlimited");
  const quals = nodeQualities(r);
  if (quals.length) {
    parts.push(
      quals
        .map((q) => (q === "node" ? "Node" : q.toUpperCase()) + " " + fmt(nodeRate(r, q)) + "/min")
        .join(" | ")
    );
  }
  const defs = Object.entries(r.defaults || {});
  if (defs.length) {
    parts.push(
      "default " +
        defs.map(([reg, counts]) => regionLabel(Number(reg)) + " " + countsText(counts, r)).join(" | ")
    );
  }
  return parts.join("  |  ");
}

function countsText(counts, r) {
  return nodeQualities(r)
    .map((q) => (counts[q] ?? 0) + " " + (QUALITY_LABEL[q] || q))
    .join(" + ") + " = " + fmt(sourceTotal(r, null, counts)) + "/min";
}

function detailLine(r) {
  const parts = [];
  if (r.facility) parts.push(r.facility + " (" + r.craftingTime + "s)");
  const res = Object.entries(r.residues || {});
  if (res.length) parts.push("residue " + res.map(([m, q]) => fmt(q) + " " + m).join(", "));
  if (r.source) parts.push(capText(r));
  if (r.source) {
    if (r.energy) parts.push(fmt(r.energy) + " e/unit");
  } else if (r.energy) {
    parts.push(fmt(r.energy) + " kJ/run");
  }
  return parts.join("  |  ");
}

function ioLine(tagClass, tagText, materials) {
  const line = document.createElement("span");
  line.className = "detail-line";
  const tag = document.createElement("b");
  tag.className = "tag " + tagClass;
  tag.textContent = tagText;
  line.appendChild(tag);
  const chips = document.createElement("span");
  chips.className = "tag-chips";
  for (const [m, q] of materials) {
    const chip = document.createElement("span");
    chip.className = "mat-chip" + (tagClass === "out" ? " out" : "");
    chip.textContent = fmt(q) + " " + m;
    chips.appendChild(chip);
  }
  line.appendChild(chips);
  return line;
}

function rowDetail(r) {
  const container = document.createElement("div");
  container.className = "recipe-detail";
  const ins = Object.entries(r.inputs);
  if (ins.length) container.appendChild(ioLine("in", "IN", ins));
  const outs = Object.entries(r.outputs);
  if (outs.length) container.appendChild(ioLine("out", "OUT", outs));
  const meta = detailLine(r);
  if (meta || r.region != null) {
    const metaEl = document.createElement("span");
    metaEl.className = "detail-meta";
    if (meta) metaEl.textContent = meta;
    if (r.region != null) metaEl.appendChild(regionTagElement(r.region));
    container.appendChild(metaEl);
  }
  return container;
}

function matchesFilter(r) {
  if (state.facility) {
    if (state.facility === EXTERNAL_VALUE) {
      if (!r.source) return false;
    } else if (r.facility !== state.facility) {
      return false;
    }
  }
  if (!state.filter) return true;
  return r.name.toLowerCase().includes(state.filter);
}

function countText(enabledCount, total, shown) {
  const parts = [enabledCount + " of " + total + " recipes enabled"];
  if (shown < total) parts.push("(" + shown + " shown)");
  return parts.join(" ");
}

function render() {
  els.list.innerHTML = "";
  const regionSet = regionRecipes();
  const shown = regionSet.filter(matchesFilter);
  for (const r of shown) {
    const row = document.createElement("label");
    row.className = "recipe-row" + (currentEnabled()[r.id] ? "" : " off");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = currentEnabled()[r.id];
    cb.addEventListener("change", () => {
      currentEnabled()[r.id] = cb.checked;
      row.classList.toggle("off", !cb.checked);
      saveEnabled(currentEnabled(), currentRegion());
      const enabledCount = regionSet.filter((x) => currentEnabled()[x.id]).length;
      els.count.textContent = countText(enabledCount, regionSet.length, shown.length);
    });
    const name = document.createElement("span");
    name.className = "recipe-name";
    name.textContent = r.name;
    row.appendChild(cb);
    row.appendChild(name);
    row.appendChild(rowDetail(r));
    els.list.appendChild(row);
  }
  const enabledCount = regionSet.filter((x) => currentEnabled()[x.id]).length;
  els.count.textContent = countText(enabledCount, regionSet.length, shown.length);
}

els.search.addEventListener("input", () => {
  state.filter = els.search.value.trim().toLowerCase();
  render();
});

els.facility.addEventListener("change", () => {
  state.facility = els.facility.value;
  render();
});

initRegionUI(els.region, () => render());
initFacilityOptions();
render();