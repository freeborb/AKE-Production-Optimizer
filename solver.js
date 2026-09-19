import loadHighs from "https://cdn.jsdelivr.net/npm/highs@1.15.3/+esm";
import { buildLP, varName, computeBalances } from "./lpmodel.js";

const HIGHS_BASE = "https://cdn.jsdelivr.net/npm/highs@1.15.3/build/";
let highsPromise;

async function getHighs() {
  if (!highsPromise) {
    highsPromise = loadHighs({ locateFile: (f) => HIGHS_BASE + f });
  }
  return highsPromise;
}

export async function solveProblem(recipes, opts) {
  const lp = buildLP(recipes, opts);
  const highs = await getHighs();
  const result = highs.solve(lp, { output_flag: false });
  const status = result.Status;
  if (status === "Optimal") {
    const rates = {};
    for (const r of recipes) {
      rates[r.id] = result.Columns?.[varName(r.id)]?.Primal ?? 0;
    }
    return {
      status,
      objective: result.ObjectiveValue,
      lp,
      rates,
      balances: computeBalances(recipes, rates)
    };
  }
  return { status, lp, rates: null, balances: null };
}