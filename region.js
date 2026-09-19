import { loadRegion, saveRegion } from "./store.js";
import { sourceRegions } from "./lpmodel.js";

export const REGIONS = [
  { id: 1, label: "Valley 4", color: "dced3f" },
  { id: 2, label: "Wuling", color: "0da9a8" },
];

let current = loadRegion();

export function currentRegion() {
  return current;
}

export function setRegion(r) {
  current = r;
  saveRegion(r);
}

export function regionOptions() {
  return REGIONS.map((r) => r.id);
}

export function regionLabel(id) {
  if (id === 0) return "All regions";
  return REGIONS.find((r) => r.id === id)?.label ?? "Region " + id;
}

export function regionHex(id) {
  const c = REGIONS.find((r) => r.id === id)?.color ?? null;
  return c ? "#" + c : null;
}

export function regionTagElement(id) {
  const span = document.createElement("span");
  span.className = "region-tag";
  const c = regionHex(id);
  if (c) {
    span.style.borderColor = c;
    span.style.color = c;
  }
  span.textContent = regionLabel(id);
  return span;
}

export function regionTagsElement(r) {
  const wrap = document.createElement("span");
  wrap.className = "region-tags";
  for (const id of sourceRegions(r)) wrap.appendChild(regionTagElement(id));
  return wrap;
}

export function initRegionUI(selectEl, onChange) {
  selectEl.innerHTML = REGIONS.map((r) => '<option value="' + r.id + '">' + r.label + "</option>").join("");
  selectEl.value = String(current);
  const paint = () => {
    const c = regionHex(current) || "var(--accent)";
    selectEl.style.borderColor = c;
    selectEl.style.color = c;
    document.body.style.setProperty("--region-color", c);
  };
  paint();
  selectEl.addEventListener("change", () => {
    current = Number(selectEl.value);
    saveRegion(current);
    paint();
    if (onChange) onChange(current);
  });
}