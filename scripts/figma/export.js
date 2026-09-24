// Figma plugin script that pulls mitame tokens and icons out of the Figma file.
// Run it through the Figma MCP `use_figma` tool (or paste into a plugin console)
// on file 8SPBcOobbk0U7U0uV01I2C once per theme (set COLLECTION to "liquid",
// "aqua", ...), then save:
//   result.tokens      -> tokens/<collection>.json
//   result.icons[name] -> icons/svg/<name>.svg
// and run `npm run tokens && npm run icons`.

const COLLECTION = "liquid";
const ICONS_PAGE = "Icons";

const hex = ({ r, g, b, a }) => {
  const h = (x) => Math.round(x * 255).toString(16).padStart(2, "0").toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a) : ""}`;
};

const col = (await figma.variables.getLocalVariableCollectionsAsync()).find((c) => c.name === COLLECTION);
const modes = Object.fromEntries(col.modes.map((m) => [m.modeId, m.name.toLowerCase()]));
const tokens = [];
for (const id of col.variableIds) {
  const v = await figma.variables.getVariableByIdAsync(id);
  const values = {};
  for (const [modeId, val] of Object.entries(v.valuesByMode)) {
    values[modes[modeId]] = v.resolvedType === "COLOR" ? hex(val) : val;
  }
  tokens.push({ name: v.name, type: v.resolvedType, values });
}

const page = figma.root.children.find((p) => p.name === ICONS_PAGE);
await figma.setCurrentPageAsync(page);
const icons = {};
for (const c of page.findAllWithCriteria({ types: ["COMPONENT"] })) {
  icons[c.name.replace("icon/", "")] = await c.exportAsync({ format: "SVG_STRING" });
}

return {
  tokens: { collection: COLLECTION, modes: Object.values(modes), tokens },
  icons,
};
