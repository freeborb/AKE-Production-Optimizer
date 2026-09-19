import { RECIPES } from "../data/recipes.js";
import { buildLP, computeBalances } from "../lpmodel.js";
import Highs from "highs";

const solver = await Highs();

function printPlan(target, lp, result) {
  const rates = {};
  for (const r of RECIPES) {
    const col = result.Columns["x_" + String(r.id).replace(/[^A-Za-z0-9]/g, "_")];
    if (col && col.Primal > 1e-9) rates[r.id] = col.Primal;
  }
  const bal = computeBalances(RECIPES, rates);
  console.log("\n=== " + target + " ===");
  console.log("status:", result.Status, "| objective:", result.ObjectiveValue);
  console.log("materials:");
  for (const [m, v] of bal) {
    const total = v.made - v.used;
    if (v.made || v.used) console.log("  " + m.padEnd(34) + " made " + v.made.toFixed(2) + " used " + v.used.toFixed(2) + " net " + total.toFixed(2));
  }
  console.log("active recipes:");
  for (const [id, rate] of Object.entries(rates)) {
    const r = RECIPES.find((x) => x.id === id);
    console.log("  " + (r ? r.name : id).padEnd(42) + " rate " + rate.toFixed(2));
  }
}

const targets = process.argv.slice(2);
const lpTargets = targets.length ? targets : ["Ferrium", "Steel"];

for (const t of lpTargets) {
  const lp = buildLP(RECIPES, { mode: "maximize", target: t });
  const result = solver.solve(lp, { output_flag: false });
  if (result.Status !== "Optimal") {
    console.log("=== " + t + " === status " + result.Status);
    console.log(result.Log || "no log");
    continue;
  }
  printPlan(t, lp, result);
}

const lpMin = buildLP(RECIPES, { mode: "minimize", target: "Steel", targetAmount: 10 });
const rMin = solver.solve(lpMin, { output_flag: false });
console.log("\n=== minimize Steel @10/min ===");
console.log("status:", rMin.Status, "| objective (raw minutes):", rMin.ObjectiveValue);
const ratesMin = {};
for (const r of RECIPES) {
  const col = rMin.Columns["x_" + String(r.id).replace(/[^A-Za-z0-9]/g, "_")];
  if (col && col.Primal > 1e-9) ratesMin[r.id] = col.Primal;
}
const balMin = computeBalances(RECIPES, ratesMin);
console.log("active recipes:");
for (const [id, rate] of Object.entries(ratesMin)) {
  const r = RECIPES.find((x) => x.id === id);
  if (r && rate > 1e-9) console.log("  " + r.name.padEnd(42) + " rate " + rate.toFixed(2));
}
console.log("materials made/used/net:");
for (const [m, v] of balMin) {
  const total = v.made - v.used;
  if (v.made || v.used) console.log("  " + m.padEnd(34) + " made " + v.made.toFixed(2) + " used " + v.used.toFixed(2) + " net " + total.toFixed(2));
}