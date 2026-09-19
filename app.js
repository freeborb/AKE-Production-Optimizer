import { RECIPES } from "./data/recipes.js";
import { solveProblem } from "./solver.js";
import { loadEnabled } from "./store.js";

const state = {
  mode: "maximize",
  target: "Steel",
  targetAmount: 1,
  availability: {},
  enabled: loadEnabled(RECIPES)
};

for (const r of RECIPES) {
  if (r.source) state.availability[r.id] = r.capacity ?? 100;
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
  for (const r of RECIPES) {
    if (r.source) continue;
    for (const m in r.outputs) set.add(m);
    for (const m in r.residues || {}) set.add(m);
  }
  return [...set].sort();
}

function fillTargetSelect() {
  const mats = producedMaterials();
  if (!mats.length) return;
  els.target.innerHTML = "";
  for (const m of mats) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = m;
    if (m === state.target) opt.selected = true;
    els.target.appendChild(opt);
  }
  }

function renderAvailability() {
  els.availability.innerHTML = "";
  for (const r of RECIPES) {
    if (!r.source) continue;
    if (!Object.prototype.hasOwnProperty.call(state.availability, r.id)) state.availability[r.id] = 100;
    const row = document.createElement("label");
    row.className = "avail-row";
    const name = document.createElement("span");
    name.textContent = r.name;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.value = state.availability[r.id];
    input.dataset.id = r.id;
    input.addEventListener("input", () => {
      state.availability[input.dataset.id] = Number(input.value);
    });
    row.appendChild(name);
    row.appendChild(input);
    els.availability.appendChild(row);
  }
}

function fmtNum(n) {
  if (!Number.isFinite(n)) return String(n);
  return Number(n.toFixed(3)).toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function activeRecipes() {
  return RECIPES.filter((r) => state.enabled[r.id]);
}

function syncState() {
  state.mode = els.mode.value;
  state.target = els.target.value;
  state.targetAmount = Number(els.targetAmount.value) || 0;
  for (const input of els.availability.querySelectorAll("input")) {
    state.availability[input.dataset.id] = Number(input.value);
  }
}

function updateModeUI() {
  const isMin = state.mode === "minimize";
  els.amountWrap.style.display = isMin ? "" : "none";
  document.getElementById("availability-label").textContent = isMin
    ? "Raw availability (caps)"
    : "Available raw material (per min)";
}

function renderResult(result) {
  els.objective.textContent = "";
  els.runRows.innerHTML = "";
  els.balanceRows.innerHTML = "";
  if (result.status !== "Optimal") {
    els.status.textContent = "Solver status: " + result.status;
    return;
  }
  els.status.textContent = "Solver status: Optimal";
  els.objective.textContent =
    state.mode === "maximize"
      ? "Maximum " + state.target + ": " + fmtNum(result.objective) + " /min"
      : "Minimum total raw used for " + fmtNum(state.targetAmount) + " " + state.target + "/min: " + fmtNum(result.objective);

  const sorted = activeRecipes().filter((r) => Math.abs(result.rates[r.id] || 0) > 1e-9);
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

  els.lpText.textContent = result.lp;
}

els.mode.addEventListener("change", () => {
  state.mode = els.mode.value;
  updateModeUI();
});

els.solve.addEventListener("click", async () => {
  syncState();
  updateModeUI();
  const recipes = activeRecipes();
  if (recipes.length === 0) {
    els.status.textContent = "Enable at least one recipe.";
    return;
  }
  const opts = { mode: state.mode, target: state.target, availability: state.availability };
  if (state.mode === "minimize") opts.targetAmount = state.targetAmount;
  els.status.textContent = "Solving...";
  const result = await solveProblem(recipes, opts);
  renderResult(result);
});

fillTargetSelect();
renderAvailability();
updateModeUI();