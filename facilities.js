import { RECIPES } from "./data/recipes.js";
import { regionTagElement, initRegionUI } from "./region.js";

const els = {
  region: document.getElementById("region"),
  search: document.getElementById("search"),
  count: document.getElementById("facility-count"),
  list: document.getElementById("facility-list")
};

function fmt(n) {
  return String(Math.round(n * 1000) / 1000);
}

const groups = new Map();
for (const r of RECIPES) {
  if (!r.facility) continue;
  if (!groups.has(r.facility)) groups.set(r.facility, []);
  groups.get(r.facility).push(r);
}
const facilitiesSorted = [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));

const state = { search: "" };

function matches(r) {
  if (!state.search) return true;
  return r.name.toLowerCase().includes(state.search) || r.facility.toLowerCase().includes(state.search);
}

function ioLine(tagClass, tagText, text) {
  const line = document.createElement("span");
  line.className = "detail-line";
  const tag = document.createElement("b");
  tag.className = "tag " + tagClass;
  tag.textContent = tagText;
  const body = document.createElement("span");
  body.textContent = text;
  line.appendChild(tag);
  line.appendChild(body);
  return line;
}

function facilityDetail(r) {
  const container = document.createElement("div");
  container.className = "recipe-detail";
  const inText = Object.entries(r.inputs).map(([m, q]) => fmt(q) + " " + m).join(", ");
  if (inText) container.appendChild(ioLine("in", "IN", inText));
  const outText = Object.entries(r.outputs).map(([m, q]) => fmt(q) + " " + m).join(", ");
  if (outText) container.appendChild(ioLine("out", "OUT", outText));
  const meta = [r.craftingTime + "s"];
  if (meta.length) {
    const metaEl = document.createElement("div");
    metaEl.className = "detail-meta";
    metaEl.textContent = meta.join("  |  ");
    container.appendChild(metaEl);
  }
  if (r.region != null) {
    const tagWrap = document.createElement("div");
    tagWrap.className = "detail-meta";
    tagWrap.appendChild(regionTagElement(r.region));
    container.appendChild(tagWrap);
  }
  return container;
}

function render() {
  els.list.innerHTML = "";
  let shown = 0;
  let total = 0;
  for (const [facility, recipes] of facilitiesSorted) {
    const vis = recipes.filter(matches);
    shown += vis.length;
    total += recipes.length;
    const details = document.createElement("details");
    details.className = "facility";
    const summary = document.createElement("summary");
    summary.textContent = facility;
    const count = document.createElement("span");
    count.className = "muted";
    count.textContent = " (" + vis.length + " recipes)";
    summary.appendChild(count);
    details.appendChild(summary);
    const list = document.createElement("div");
    list.className = "stack";
    for (const r of [...vis].sort((a, b) => a.name.localeCompare(b.name))) {
      const row = document.createElement("div");
      row.className = "facility-recipe";
      const name = document.createElement("span");
      name.className = "recipe-name";
      name.textContent = r.name;
      row.appendChild(name);
      row.appendChild(facilityDetail(r));
      list.appendChild(row);
    }
    details.appendChild(list);
    els.list.appendChild(details);
  }
  els.count.textContent = shown + " of " + total + " recipes";
}

els.search.addEventListener("input", () => {
  state.search = els.search.value.trim().toLowerCase();
  render();
});

initRegionUI(els.region);
render();