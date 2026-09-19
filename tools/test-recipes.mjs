import { RECIPES } from "../data/recipes.js";
import { buildLP, computeBalances, validInRegion, sourceTotal } from "../lpmodel.js";
import Highs from "highs";

const solver = await Highs();

function regionRecipes(region) {
  return RECIPES.filter((r) => validInRegion(r, region));
}

function defaultAvailability(recipes, region) {
  const map = {};
  for (const r of recipes) {
    if (!r.source) continue;
    const t = sourceTotal(r, region);
    if (t > 0) map[r.id] = t;
  }
  return map;
}

function printPlan(label, recipes, lp, result) {
  const rates = {};
  for (const r of recipes) {
    const col = result.Columns["x_" + String(r.id).replace(/[^A-Za-z0-9]/g, "_")];
    if (col && col.Primal > 1e-9) rates[r.id] = col.Primal;
  }
  const bal = computeBalances(recipes, rates);
  console.log("\n=== " + label + " ===");
  console.log("status:", result.Status, "| objective:", result.ObjectiveValue);
  console.log("materials:");
  for (const [m, v] of bal) {
    const total = v.made - v.used;
    if (v.made || v.used) console.log("  " + m.padEnd(34) + " made " + v.made.toFixed(2) + " used " + v.used.toFixed(2) + " net " + total.toFixed(2));
  }
  console.log("active recipes:");
  for (const [id, rate] of Object.entries(rates)) {
    const r = recipes.find((x) => x.id === id);
    console.log("  " + (r ? r.name : id).padEnd(42) + " rate " + rate.toFixed(2));
  }
}

function solve(recipes, opts) {
  const lp = buildLP(recipes, opts);
  return solver.solve(lp, { output_flag: false });
}

for (const [region, target] of [
  [1, "Ferrium"],
  [1, "Steel"],
  [2, "Ferrium"],
  [2, "Steel"]
]) {
  const recipes = regionRecipes(region);
  const result = solve(recipes, { mode: "maximize", target, region, availability: defaultAvailability(recipes, region) });
  if (result.Status !== "Optimal") {
    console.log("=== " + region + " " + target + " === status " + result.Status);
    console.log(result.Log || "no log");
    continue;
  }
  printPlan(region + " -> " + target, recipes, null, result);
}

const region = 1;
const recipes = regionRecipes(region);
const result = solve(recipes, {
  mode: "minimize",
  target: "Steel",
  targetAmount: 10,
  region,
  availability: defaultAvailability(recipes, region)
});
if (result.Status !== "Optimal") {
  console.log("=== " + region + " minimize Steel === status " + result.Status);
  process.exit(1);
}
printPlan(region + " -> minimize Steel @10/min", recipes, null, result);