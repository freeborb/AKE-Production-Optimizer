import { RECIPES as BASE_RECIPES } from "./data/recipes.js";
import { loadEnabled, saveEnabled } from "./store.js";
import { nodeQualities, nodeRate, sourceTotal, sourceUnlimited, sourceRegions, validInRegion } from "./lpmodel.js";
import { currentRegion, regionOptions, regionLabel, regionTagElement, regionTagsElement, initRegionUI } from "./region.js";
import { loadCustomRecipes, saveCustomRecipes, loadHiddenRecipes, saveHiddenRecipes, mergeRecipes, newCustomId } from "./custom-recipes.js";

const customs = loadCustomRecipes();
const custIds = new Set(customs.map((c) => c.id));
const RECIPES = mergeRecipes(BASE_RECIPES);

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
  const region = currentRegion();
  if (sourceUnlimited(r, region)) return "unlimited";
  const parts = [];
  const quals = nodeQualities(r, region);
  if (quals.length) {
    parts.push(
      quals
        .map((q) => (q === "node" ? "Node" : q.toUpperCase()) + " " + fmt(nodeRate(r, q)) + "/min")
        .join(" | ")
    );
  }
  const defs = sourceRegions(r);
  if (defs.length) {
    parts.push(
      "default " +
        defs.map((reg) => regionLabel(reg) + " " + countsText(r.nodes[reg], r)).join(" | ")
    );
  }
  return parts.join("  |  ");
}

function countsText(counts, r) {
  const quals = ["hp", "lp", "node"].filter((q) => (counts[q] ?? 0) > 0);
  const str = quals.map((q) => (counts[q] ?? 0) + " " + (QUALITY_LABEL[q] || q)).join(" + ");
  return (str || "none") + " = " + fmt(sourceTotal(r, null, counts)) + "/min";
}

function detailLine(r) {
  const parts = [];
  const res = Object.entries(r.residues || {});
  if (res.length) parts.push("residue " + res.map(([m, q]) => fmt(q) + " " + m).join(", "));
  if (r.source) parts.push(capText(r));
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
    chip.className = "mat-chip";
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
  if (meta || r.source || r.region != null) {
    const metaEl = document.createElement("span");
    metaEl.className = "detail-meta";
    if (meta) metaEl.textContent = meta;
    if (r.source) {
      const tags = regionTagsElement(r);
      if (tags.childElementCount) metaEl.appendChild(tags);
    } else if (r.region != null) {
      metaEl.appendChild(regionTagElement(r.region));
    }
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

function deleteCustom(r) {
  const ci = customs.findIndex((c) => c.id === r.id);
  if (ci >= 0) customs.splice(ci, 1);
  saveCustomRecipes(customs);
  custIds.delete(r.id);
  const ri = RECIPES.indexOf(r);
  if (ri >= 0) RECIPES.splice(ri, 1);
  removeEnabled(r);
  state.facility = "";
  initFacilityOptions();
  render();
}

function hideBuiltIn(r) {
  const hidden = loadHiddenRecipes();
  if (!hidden.includes(r.id)) {
    hidden.push(r.id);
    saveHiddenRecipes(hidden);
  }
  removeEnabled(r);
  const ri = RECIPES.indexOf(r);
  if (ri >= 0) RECIPES.splice(ri, 1);
  state.facility = "";
  initFacilityOptions();
  render();
}

function removeEnabled(r) {
  delete currentEnabled()[r.id];
  saveEnabled(currentEnabled(), currentRegion());
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
    const nameWrap = document.createElement("span");
    nameWrap.className = "recipe-name-wrap";
    nameWrap.appendChild(name);
    if (r.facility) {
      const sub = document.createElement("span");
      sub.className = "recipe-name-sub";
      sub.textContent = r.facility + " (" + r.craftingTime + "s)";
      nameWrap.appendChild(sub);
    }
    row.appendChild(cb);
    row.appendChild(nameWrap);
    row.appendChild(rowDetail(r));

    const delWrap = document.createElement("span");
    delWrap.className = "recipe-del-wrap";
    row.appendChild(delWrap);
    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "recipe-del";
    delBtn.title = "Delete recipe";
    delBtn.textContent = "×";
    const disarm = () => {
      delWrap.innerHTML = "";
      delWrap.appendChild(delBtn);
      row.classList.remove("armed");
    };
    delBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      row.classList.add("armed");
      delWrap.innerHTML = "";
      const ok = document.createElement("button");
      ok.type = "button";
      ok.className = "recipe-del-confirm";
      ok.textContent = "Delete";
      ok.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (custIds.has(r.id)) deleteCustom(r);
        else hideBuiltIn(r);
      });
      const cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "recipe-del-cancel";
      cancel.textContent = "Cancel";
      cancel.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        disarm();
      });
      delWrap.appendChild(ok);
      delWrap.appendChild(cancel);
    });
    delWrap.appendChild(delBtn);
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

const add = {
  panel: document.getElementById("add-panel"),
  name: document.getElementById("custom-name"),
  facility: document.getElementById("custom-facility"),
  suggest: document.getElementById("fac-suggest"),
  time: document.getElementById("custom-time"),
  region: document.getElementById("custom-region"),
  inputs: document.getElementById("custom-inputs"),
  outputs: document.getElementById("custom-outputs"),
  error: document.getElementById("add-error")
};

add.region.innerHTML =
  '<option value="0">' + regionLabel(0) + "</option>" +
  regionOptions().map((id) => '<option value="' + id + '">' + regionLabel(id) + "</option>").join("");

function ioRow(material) {
  const row = document.createElement("div");
  row.className = "io-input-row";
  const mat = document.createElement("input");
  mat.className = "io-mat";
  mat.type = "text";
  mat.placeholder = "Material";
  mat.value = material;
  const qty = document.createElement("input");
  qty.className = "io-qty";
  qty.type = "number";
  qty.min = "0";
  qty.step = "any";
  qty.placeholder = "Qty";
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "io-remove";
  remove.textContent = "×";
  remove.addEventListener("click", () => row.remove());
  row.appendChild(mat);
  row.appendChild(qty);
  row.appendChild(remove);
  return row;
}

function collectIo(container) {
  const out = {};
  for (const row of container.querySelectorAll(".io-input-row")) {
    const mat = row.querySelector(".io-mat").value.trim();
    const qty = Number(row.querySelector(".io-qty").value);
    if (!mat || !(Number.isFinite(qty) && qty > 0)) continue;
    out[mat] = (out[mat] || 0) + qty;
  }
  return out;
}

function facilityOptions() {
  return [...new Set(RECIPES.map((r) => r.facility).filter(Boolean))].sort();
}

function refreshSuggest() {
  const q = add.facility.value.trim().toLowerCase();
  const filtered = facilityOptions().filter((f) => !q || f.toLowerCase().includes(q));
  add.suggest.innerHTML = "";
  if (!filtered.length) {
    add.suggest.hidden = true;
    return;
  }
  for (const f of filtered) {
    const li = document.createElement("li");
    li.textContent = f;
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      add.facility.value = f;
      add.suggest.hidden = true;
    });
    add.suggest.appendChild(li);
  }
  add.suggest.hidden = false;
}

function closeSuggest() {
  add.suggest.hidden = true;
}

add.facility.addEventListener("focus", refreshSuggest);
add.facility.addEventListener("input", refreshSuggest);
add.facility.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeSuggest();
});
add.facility.addEventListener("blur", () => setTimeout(closeSuggest, 100));

function openAddPanel() {
  add.error.textContent = "";
  add.panel.hidden = false;
  for (const container of [add.inputs, add.outputs]) {
    if (!container.querySelector(".io-input-row")) container.appendChild(ioRow(""));
  }
  add.name.focus();
}

function closeAddPanel() {
  closeSuggest();
  add.panel.hidden = true;
}

document.getElementById("add-recipe").addEventListener("click", () => {
  if (add.panel.hidden) openAddPanel();
});

document.getElementById("add-in-row").addEventListener("click", () => add.inputs.appendChild(ioRow("")));
document.getElementById("add-out-row").addEventListener("click", () => add.outputs.appendChild(ioRow("")));
document.getElementById("btn-cancel-add").addEventListener("click", () => closeAddPanel());

document.getElementById("btn-confirm-add").addEventListener("click", () => {
  const name = add.name.value.trim();
  const facility = add.facility.value.trim();
  const craftingTime = Number(add.time.value);
  const region = Number(add.region.value);
  if (!name) {
    add.error.textContent = "Name is required.";
    return;
  }
  if (!(Number.isFinite(craftingTime) && craftingTime > 0)) {
    add.error.textContent = "Crafting time must be greater than 0.";
    return;
  }
  const inputs = collectIo(add.inputs);
  const outputs = collectIo(add.outputs);
  if (!Object.keys(outputs).length) {
    add.error.textContent = "At least one output is required.";
    return;
  }
  const recipe = { id: newCustomId(), name, facility, craftingTime, inputs, outputs };
  if (region) recipe.region = region;
  customs.push(recipe);
  custIds.add(recipe.id);
  saveCustomRecipes(customs);
  RECIPES.push(recipe);
  currentEnabled()[recipe.id] = false;
  initFacilityOptions();
  render();
  closeAddPanel();
});