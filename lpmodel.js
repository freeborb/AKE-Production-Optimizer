export function varName(id) {
  return "x_" + String(id).replace(/[^A-Za-z0-9]/g, "_");
}

function fmt(n) {
  if (!Number.isFinite(n)) return String(n);
  const r = Math.round(n * 1e9) / 1e9;
  return Object.is(r, -0) ? "0" : String(r);
}

function term(coef, v) {
  return (coef > 0 ? " + " : " - ") + fmt(Math.abs(coef)) + " " + v;
}

export function collectMaterials(recipes) {
  const set = new Set();
  for (const r of recipes) {
    for (const m in r.inputs) set.add(m);
    for (const m in r.outputs) set.add(m);
    for (const m in r.residues || {}) set.add(m);
  }
  set.add("Energy");
  return [...set].sort();
}

function balanceCoeffs(recipes) {
  const materials = collectMaterials(recipes);
  const rows = new Map(materials.map((m) => [m, []]));
  for (const r of recipes) {
    const v = varName(r.id);
    const coeff = new Map();
    for (const [m, q] of Object.entries(r.inputs)) coeff.set(m, (coeff.get(m) || 0) - q);
    if (r.energy) coeff.set("Energy", (coeff.get("Energy") || 0) - r.energy);
    for (const [m, q] of Object.entries(r.outputs)) coeff.set(m, (coeff.get(m) || 0) + q);
    for (const [m, q] of Object.entries(r.residues || {})) coeff.set(m, (coeff.get(m) || 0) + q);
    for (const [m, c] of coeff) if (c !== 0) rows.get(m).push([v, c]);
  }
  return rows;
}

export function buildLP(recipes, opts = {}) {
  const { mode = "maximize", target, targetAmount = 1, availability = {} } = opts;
  const rows = balanceCoeffs(recipes);
  const capacities = new Map();
  for (const r of recipes) {
    const v = varName(r.id);
    let ub = Infinity;
    if (r.source) {
      const a = Number(availability[r.id]);
      if (Number.isFinite(a) && a >= 0) ub = a;
    }
    if (Number.isFinite(r.capacity)) ub = Math.min(ub, r.capacity);
    if (Number.isFinite(ub)) capacities.set(v, ub);
  }

  const obj = new Map();
  if (mode === "minimize") {
    for (const r of recipes) if (r.source) obj.set(varName(r.id), 1);
  } else if (mode === "maximize") {
    if (target) for (const [v, c] of rows.get(target)) obj.set(v, c);
  } else {
    throw new Error("unknown mode: " + mode);
  }

  const lines = [];
  lines.push(mode === "minimize" ? "Minimize" : "Maximize");
  const objTerms = [...obj.entries()].filter(([, c]) => c !== 0).map(([v, c]) => term(c, v));
  lines.push("  obj: " + (objTerms.length ? objTerms.join(" ") : "0 Next"));
  lines.push("Subject To");
  for (const [m, termsList] of rows) {
    if (termsList.length) lines.push("  bal_" + m + ": " + termsList.map(([v, c]) => term(c, v)).join(" ") + " >= 0");
  }
  if (mode === "minimize" && target) {
    lines.push(
      "  req_" + target + ": " + rows.get(target).map(([v, c]) => term(c, v)).join(" ") + " >= " + fmt(targetAmount)
    );
  }
  if (capacities.size) {
    lines.push("Bounds");
    for (const [v, ub] of capacities) lines.push("  0 <= " + v + " <= " + fmt(ub));
  }
  lines.push("End");
  return lines.join("\n");
}

export function computeBalances(recipes, rates) {
  const materials = collectMaterials(recipes);
  const res = new Map(materials.map((m) => [m, { made: 0, used: 0 }]));
  for (const r of recipes) {
    const rate = rates[r.id] || 0;
    for (const [m, q] of Object.entries(r.inputs)) res.get(m).used += q * rate;
    if (r.energy) res.get("Energy").used += r.energy * rate;
    for (const [m, q] of Object.entries(r.outputs)) res.get(m).made += q * rate;
    for (const [m, q] of Object.entries(r.residues || {})) res.get(m).made += q * rate;
  }
  return res;
}