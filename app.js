import { RECIPES as BASE_RECIPES } from "./data/recipes.js";
import { mergeRecipes } from "./custom-recipes.js";
import { solveProblem } from "./solver.js";
import { loadEnabled, REGION_KEY } from "./store.js";
import { validInRegion, nodeQualities, sourceTotal, sourceUnlimited } from "./lpmodel.js";
import { currentRegion, regionOptions, setRegion, initRegionUI } from "./region.js";

const RECIPES = mergeRecipes(BASE_RECIPES);

const QUALITY_LABEL = { hp: "HP", lp: "LP", node: "Nodes" };

const REGION_STORE_KEY = "ake-optimizer-regions-v1";
const RESULT_STORE_KEY = "ake-optimizer-region-results-v1";

function loadJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "{}");
  } catch {
    return {};
  }
}

function saveJSON(key, obj) {
  localStorage.setItem(key, JSON.stringify(obj));
}

function regionKeyOf(v) {
  const n = Number(v);
  if (n === 1 || n === 2 || n === 3) return n;
  return v === "valley_4" ? 1 : v === "wuling" ? 2 : null;
}

function migrateMap(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const nk = regionKeyOf(k);
    if (nk != null) out[nk] = v;
  }
  return out;
}

const persisted = loadJSON(REGION_STORE_KEY);
const storedResults = migrateMap(loadJSON(RESULT_STORE_KEY));

const legacyRegion = regionKeyOf(persisted.region);
if (legacyRegion != null && localStorage.getItem(REGION_KEY) === null) setRegion(legacyRegion);

const state = {
  region: currentRegion(),
  regions: {},
  enabled: {}
};

for (const id of regionOptions()) {
  state.enabled[id] = loadEnabled(RECIPES, id);
}

const savedStates = migrateMap(persisted.states);

for (const id of regionOptions()) {
  const def = {
    mode: "maximize",
    target: "Steel",
    targetAmount: 1,
    availability: {}
  };
  for (const r of RECIPES) {
    if (!r.source || sourceUnlimited(r, id) || !validInRegion(r, id)) continue;
    def.availability[r.id] = { ...(r.nodes?.[id] || {}) };
  }
  const saved = savedStates[id] || {};
  state.regions[id] = {
    mode: saved.mode || def.mode,
    target: saved.target || def.target,
    targetAmount: saved.targetAmount ?? def.targetAmount,
    availability: { ...def.availability, ...(saved.availability || {}) }
  };
}

function currentState() {
  return state.regions[state.region];
}

function persistRegions() {
  saveJSON(REGION_STORE_KEY, {
    region: state.region,
    states: Object.fromEntries(
      Object.entries(state.regions).map(([key, s]) => [
        key,
        { mode: s.mode, target: s.target, targetAmount: s.targetAmount, availability: s.availability }
      ])
    )
  });
}

function validRegionRecipes() {
  return RECIPES.filter((r) => state.enabled[state.region][r.id] && validInRegion(r, state.region));
}

const els = {
  mode: document.getElementById("mode"),
  target: document.getElementById("target"),
  targetAmount: document.getElementById("target-amount"),
  amountWrap: document.getElementById("amount-wrap"),
  availability: document.getElementById("availability"),
  solve: document.getElementById("solve"),
  status: document.getElementById("status"),
  objective: document.getElementById("objective"),
  runRows: document.getElementById("run-rows"),
  balanceRows: document.getElementById("balance-rows"),
  lpText: document.getElementById("lp-text")
};

function producedMaterials() {
  const set = new Set();
  for (const r of validRegionRecipes()) {
    if (r.source) continue;
    for (const m in r.outputs) set.add(m);
    for (const m in r.residues || {}) set.add(m);
  }
  return [...set].sort();
}

function fillTargetSelect() {
  const mats = producedMaterials();
  const s = currentState();
  if (!mats.length) {
    els.target.innerHTML = "";
    return;
  }
  els.target.innerHTML = "";
  const wanted = mats.includes(s.target) ? s.target : mats.includes("Steel") ? "Steel" : mats[0];
  s.target = wanted;
  for (const m of mats) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    if (m === wanted) opt.selected = true;
    els.target.appendChild(opt);
  }
}

function renderAvailability() {
  els.availability.innerHTML = "";
  const s = currentState();
  for (const r of RECIPES) {
    if (!r.source || !validInRegion(r, state.region)) continue;
    const container = document.createElement("div");
    container.className = "avail-row";
    const name = document.createElement("span");
    name.className = "avail-name";
    name.textContent = r.name;
    container.appendChild(name);
    if (sourceUnlimited(r, state.region)) {
      const lim = document.createElement("span");
      lim.className = "avail-unlimited muted";
      lim.textContent = "unlimited";
      container.appendChild(lim);
      els.availability.appendChild(container);
      continue;
    }
    const counts = (s.availability[r.id] = s.availability[r.id] || {});
    const controls = document.createElement("div");
    controls.className = "avail-controls";
    const inputsWrap = document.createElement("div");
    inputsWrap.className = "avail-inputs";
    for (const q of nodeQualities(r, state.region)) {
      const qlabel = document.createElement("span");
      qlabel.className = "avail-q";
      qlabel.textContent = "Max " + (QUALITY_LABEL[q] || q);
      inputsWrap.appendChild(qlabel);
      const input = document.createElement("input");
      input.type = "number";
      input.min = "0";
      input.step = "1";
      input.value = counts[q] ?? 0;
      input.dataset.id = r.id;
      input.dataset.q = q;
      input.addEventListener("input", () => {
        counts[q] = Number(input.value) || 0;
        totalEl.textContent = rateText(r, state.region, counts);
      });
      inputsWrap.appendChild(input);
    }
    const totalEl = document.createElement("span");
    totalEl.className = "avail-total";
    totalEl.textContent = rateText(r, state.region, counts);
    controls.appendChild(inputsWrap);
    controls.appendChild(totalEl);
    container.appendChild(controls);
    els.availability.appendChild(container);
  }
}

function rateText(r, region, counts) {
  const max = sourceTotal(r, region, counts);
  const saved = storedResults[state.region];
  const used = (saved && saved.rates ? saved.rates[r.id] : 0) || 0;
  return fmtNum(used) + " / " + fmtNum(max);
}

function fmtNum(n) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toFixed(3)).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function captureControls() {
  const s = currentState();
  s.mode = els.mode.value;
  s.target = els.target.value;
  s.targetAmount = Number(els.targetAmount.value) || 0;
  for (const input of els.availability.querySelectorAll("input[data-q]")) {
    s.availability[input.dataset.id] = s.availability[input.dataset.id] || {};
    s.availability[input.dataset.id][input.dataset.q] = Number(input.value) || 0;
  }
}

function applyStateToControls() {
  const s = currentState();
  els.mode.value = s.mode;
  fillTargetSelect();
  els.targetAmount.value = s.targetAmount;
  renderAvailability();
}

function updateModeUI() {
  const isMin = currentState().mode === "minimize";
  els.amountWrap.style.display = isMin ? "" : "none";
  document.getElementById("availability-label").textContent = "Resource nodes";
}

function clearResult() {
  els.status.textContent = "Ready";
  els.objective.textContent = "";
  els.runRows.innerHTML = "";
  els.balanceRows.innerHTML = "";
  els.lpText.textContent = "";
}

function renderResult(result) {
  const s = currentState();
  els.objective.textContent = "";
  els.runRows.innerHTML = "";
  els.balanceRows.innerHTML = "";
  if (result.status !== "Optimal") {
    els.status.textContent = "Solver status: " + result.status;
    return;
  }
  els.status.textContent = "Solver status: Optimal";
  els.objective.textContent =
    s.mode === "maximize"
      ? "Maximum " + s.target + ": " + fmtNum(result.objective) + " /min"
      : "Minimum total raw used for " + fmtNum(s.targetAmount) + " " + s.target + "/min: " + fmtNum(result.objective);

  const sorted = validRegionRecipes().filter((r) => Math.abs(result.rates[r.id] || 0) > 1e-9);
  if (sorted.length === 0) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = 3;
    td.textContent = "Nothing to run.";
    tr.appendChild(td);
    els.runRows.appendChild(tr);
  }
  for (const r of sorted) {
    const tr = document.createElement("tr");
    const tdName = document.createElement("td");
    tdName.textContent = r.name;
    const tdRate = document.createElement("td");
    tdRate.textContent = fmtNum(result.rates[r.id]) + " runs/min";
    const tdOut = document.createElement("td");
    tdOut.textContent = Object.entries(r.outputs).map(([m, q]) => fmtNum(q * result.rates[r.id]) + " " + m + "/min").join(", ");
    tr.appendChild(tdName);
    tr.appendChild(tdRate);
    tr.appendChild(tdOut);
    els.runRows.appendChild(tr);
  }

  for (const [m, b] of result.balances) {
    const tr = document.createElement("tr");
    const tdM = document.createElement("td");
    tdM.textContent = m;
    const tdMade = document.createElement("td");
    tdMade.textContent = fmtNum(b.made) + "/min";
    const tdUsed = document.createElement("td");
    tdUsed.textContent = fmtNum(b.used) + "/min";
    const tdNet = document.createElement("td");
    const net = b.made - b.used;
    tdNet.textContent = fmtNum(net) + "/min " + (net > 1e-9 ? "surplus" : net < -1e-9 ? "deficit" : "(balanced)");
    tdNet.className = net > 1e-9 ? "pos" : net < -1e-9 ? "neg" : "";
    tr.appendChild(tdM);
    tr.appendChild(tdMade);
    tr.appendChild(tdUsed);
    tr.appendChild(tdNet);
    els.balanceRows.appendChild(tr);
  }

  els.lpText.textContent = result.lp || "(Re-solve to regenerate the LP model.)";
}

function handleRegionChange(newRegion) {
  captureControls();
  persistRegions();
  state.region = newRegion;
  applyStateToControls();
  updateModeUI();
  const saved = storedResults[newRegion];
  if (saved && saved.status === "Optimal") renderResult(saved);
  else clearResult();
}

els.mode.addEventListener("change", () => {
  captureControls();
  updateModeUI();
});

els.solve.addEventListener("click", async () => {
  captureControls();
  const s = currentState();
  const recipes = validRegionRecipes();
  if (recipes.length === 0) {
    els.status.textContent = "Enable at least one recipe.";
    return;
  }
  const totals = {};
  for (const r of recipes) {
    if (r.source && !sourceUnlimited(r, state.region)) totals[r.id] = sourceTotal(r, state.region, s.availability[r.id] || {});
  }
  const opts = {
    mode: s.mode,
    target: s.target,
    targetAmount: s.targetAmount,
    availability: totals,
    region: state.region
  };
  els.status.textContent = "Solving...";
  const result = await solveProblem(recipes, opts);
  renderResult(result);
  if (result.status === "Optimal") {
    storedResults[state.region] = {
      status: result.status,
      objective: result.objective,
      rates: result.rates,
      balances: [...result.balances]
    };
    saveJSON(RESULT_STORE_KEY, storedResults);
    persistRegions();
    renderAvailability();
  }
});

initRegionUI(document.getElementById("region"), handleRegionChange);
applyStateToControls();
updateModeUI();
const initialResult = storedResults[state.region];
if (initialResult && initialResult.status === "Optimal") renderResult(initialResult);