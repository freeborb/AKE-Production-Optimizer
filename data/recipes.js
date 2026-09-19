export const RECIPES = [
  {
    id: "source_ore",
    name: "Mine Ore",
    inputs: {},
    outputs: { Ore: 1 },
    residues: {},
    energy: 0,
    source: true
  },
  {
    id: "source_sand",
    name: "Gather Sand",
    inputs: {},
    outputs: { Sand: 1 },
    residues: {},
    energy: 0,
    source: true
  },
  {
    id: "smelt_ore",
    name: "Smelt Ore",
    inputs: { Ore: 2 },
    outputs: { Refined: 1 },
    residues: { Slag: 0.6 },
    energy: 5
  },
  {
    id: "wash_sand",
    name: "Wash Sand",
    inputs: { Sand: 2 },
    outputs: { Silicon: 1 },
    residues: { Dust: 0.3 },
    energy: 2
  },
  {
    id: "alloy",
    name: "Alloy Mix (Refined + Silicon)",
    inputs: { Refined: 1, Silicon: 1 },
    outputs: { Alloy: 1 },
    residues: { Slag: 0.3 },
    energy: 4
  },
  {
    id: "alloy_alt",
    name: "Alloy Heavy (Refined only)",
    inputs: { Refined: 2 },
    outputs: { Alloy: 1 },
    residues: { Dust: 0.2 },
    energy: 3
  },
  {
    id: "dust_recycle",
    name: "Recycle Dust",
    inputs: { Dust: 1, Sand: 1 },
    outputs: { Silicon: 0.6 },
    residues: {},
    energy: 3
  },
  {
    id: "dust_refine",
    name: "Refine Dust",
    inputs: { Dust: 1 },
    outputs: { Refined: 0.4 },
    residues: {},
    energy: 1
  },
  {
    id: "assemble",
    name: "Assemble Product",
    inputs: { Alloy: 1, Silicon: 1 },
    outputs: { Product: 1 },
    residues: { Slag: 0.2 },
    energy: 6
  },
  {
    id: "make_battery",
    name: "Make Battery",
    inputs: { Alloy: 0.5 },
    outputs: { Battery: 1 },
    residues: {},
    energy: 2
  },
  {
    id: "burn_battery",
    name: "Burn Battery",
    inputs: { Battery: 1 },
    outputs: { Energy: 25 },
    residues: {},
    energy: 0
  }
];