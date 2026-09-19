import { RECIPES } from "./data/recipes.js";
import { solveProblem } from "./solver.js";
import { loadEnabled } from "./store.js";
import { validInRegion, capFor } from "./lpmodel.js";

const REGIONS = [
  { key: "valley_4", label: "Valley 4" },
  { key: "wuling", label: "Wuling" }
];

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

const persisted = loadJSON(REGION_STORE_KEY);
const storedResults = loadJSON(RESULT_STORE_KEY);

const state = {
  region: REGIONS.some((r) => r.key === persisted.region) ? persisted.region : "valley_4",
  regions: {},
  enabled: loadEnabled(RECIPES)
};

for (const reg of REGIONS) {
  const def = {
    mode: "maximize",
    target: "Steel",
    targetAmount: 1,
    availability: {}
  };
  for (const r of RECIPES) {
    if (!r.source || !validInRegion(r, reg.key)) continue;
    const cap = capFor(r, reg.key);
    def.availability[r.id] = Number.isFinite(cap) ? cap : 100;
  }
  const saved = persisted.states?.[reg.key] || {};
  state.regions[reg.key] = {
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
  return RECIPES.filter((r) => state.enabled[r.id] && validInRegion(r, state.region));
}

const els = {
  region: document.getElementById("region"),
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

function fillRegionSelect() {
  els.region.innerHTML = "";
  for (const reg of REGIONS) {
    const opt = document.createElement("option");
    opt.value = reg.key;
    opt.textContent = reg.label;
    if (reg.key === state.region) opt.selected = true;
    els.region.appendChild(opt);
  }
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
    const row = document.createElement("label");
    row.className = "avail-row";
    const name = document.createElement("span");
    name.textContent = r.name;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = s.availability[r.id];
    input.dataset.id = r.id;
    row.appendChild(name);
    row.appendChild(input);
    els.availability.appendChild(row);
  }
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
  for (const input of els.availability.querySelectorAll("input")) {
    s.availability[input.dataset.id] = Number(input.value);
  }
}

function applyStateToControls() {
  const s = currentState();
  els.region.value = state.region;
  els.mode.value = s.mode;
  fillTargetSelect();
  els.targetAmount.value = s.targetAmount;
  renderAvailability();
}

function updateModeUI() {
  const isMin = currentState().mode === "minimize";
  els.amountWrap.style.display = isMin ? "" : "none";
  document.getElementById("availability-label").textContent = isMin
    ? "Raw availability (caps)"
    : "Available raw material (per min)";
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

els.region.addEventListener("change", () => {
  captureControls();
  persistRegions();
  state.region = els.region.value;
  applyStateToControls();
  updateModeUI();
  const saved = storedResults[state.region];
  if (saved && saved.status === "Optimal") renderResult(saved);
  else clearResult();
});

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
  const opts = {
    mode: s.mode,
    target: s.target,
    targetAmount: s.targetAmount,
    availability: s.availability,
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
  }
});

fillRegionSelect();
applyStateToControls();
updateModeUI();
const initialResult = storedResults[state.region];
if (initialResult && initialResult.status === "Optimal") renderResult(initialResult);