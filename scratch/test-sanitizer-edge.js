// Test edge cases that may not be covered by current sanitizer
// Focus on closing-paren + keyword patterns like: ")Person(", ")System("

// Simulating route.ts STEP 0 sanitizer
const DIR = "(?:TD|LR|TB|BT|RL)";
const DIR_KW = [
  "Person_Ext", "System_Ext", "Container_Ext", "Component_Ext",
  "ContainerDb_Ext", "ContainerQueue_Ext", "System_Boundary", "Container_Boundary",
  "ContainerDb", "ContainerQueue",
  "Rel_Back", "Rel_Neighbor", "Rel_Up", "Rel_Down", "Rel_Left", "Rel_Right",
  "Container", "Component", "Boundary",
  "Person", "System", "Rel",
  "title", "subgraph", "classDef", "participant", "actor", "section",
  "LAYOUT_WITH_LEGEND", "C4Context", "C4Container", "C4Component",
  "flowchart", "sequenceDiagram", "erDiagram", "classDiagram", "stateDiagram",
];

function makeRoutePatterns() {
  return [
    /([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi,
    /([^\n])(%%\{)/g,
    /([^\n])(C4Container\b)/g, /([^\n])(C4Component\b)/g, /([^\n])(C4Context\b)/g,
    /([^\n])(sequenceDiagram\b)/g, /([^\n])(erDiagram\b)/g,
    /([^\n])(classDiagram\b)/g, /([^\n])(stateDiagram-v2\b)/g,
    /([^\n])(flowchart\s)/g, /([^\n])(mindmap\b)/g,
    /([^\n])(quadrantChart\b)/g, /([^\n])(gantt\b)/g, /([^\n])(timeline\b)/g,
    /([^\n])(Person_Ext\s*\()/g, /([^\n])(System_Ext\s*\()/g,
    /([^\n])(Container_Ext\s*\()/g, /([^\n])(Component_Ext\s*\()/g,
    /([^\n])(ContainerDb_Ext\s*\()/g, /([^\n])(ContainerQueue_Ext\s*\()/g,
    /([^\n])(System_Boundary\s*\()/g, /([^\n])(Container_Boundary\s*\()/g,
    /([^\n])(ContainerDb\s*\()/g, /([^\n])(ContainerQueue\s*\()/g,
    /([^\n])(Rel_Back\s*\()/g, /([^\n])(Rel_Neighbor\s*\()/g,
    /([^\n])(Rel_Up\s*\()/g, /([^\n])(Rel_Down\s*\()/g,
    /([^\n])(Rel_Left\s*\()/g, /([^\n])(Rel_Right\s*\()/g,
    /([^\n])(Container\s*\()/g, /([^\n])(Component\s*\()/g,
    /([^\n])(Boundary\s*\()/g,
    /([^\n])(Person\s*\()/g, /([^\n])(System\s*\()/g, /([^\n])(Rel\s*\()/g,
    /([^\n])(LAYOUT_WITH_LEGEND)/g,
    /([^\n])(subgraph\s)/g, /([^\n])(classDef\s)/g,
    /([^\n])(participant\s)/g, /([^\n])(actor\s)/g,
    /([^\n])(title\s)/g, /([^\n])(section\s)/g,
  ];
}

function sanitizeRouteTs(input) {
  let clean = input;

  // STEP 0 pre-pass
  clean = clean.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, (m, a, b) => a + "\n" + b);
  clean = clean.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([^\n\s])/gi, (m, a, b) => a + "\n" + b);

  // C4 DIAGRAM DECLARATION + DIRECTION SQUASH (FIXED: $3 -> $2)
  clean = clean.replace(/\b(C4Context|C4Container|C4Component)(direction)/gi, "$1\n$2");
  clean = clean.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*(Boundary|Person|System|Container|Component|Rel)\s*\(/gi, "$1\n$2(");

  for (const kw of DIR_KW) {
    clean = clean.replace(
      new RegExp(`(direction\\s+(?:TD|LR|TB|BT|RL))\\s*(${kw}\\b)`, "gi"),
      (m, a, b) => a + "\n" + b
    );
    clean = clean.replace(
      new RegExp(`(\\w)(${kw}\\s*\\()`, "g"),
      (m, a, b) => a + "\n" + b
    );
  }

  // General pattern loop
  for (let pass = 0; pass < 30; pass++) {
    const prev = clean;
    const patterns = makeRoutePatterns();
    for (const p of patterns) clean = clean.replace(p, (m, a, b) => a + "\n" + b);
    if (clean === prev) break;
  }

  clean = clean.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([^\n])/gi, (m, a, b) => a + "\n" + b);
  return clean.trim();
}

// Test cases
const tests = [
  {
    name: "Closing paren + Person pattern",
    input: `C4ContextPerson(personAlias, "Customer")System(systemAlias, "E-Commerce")Rel(personAlias, systemAlias, "Uses")`,
  },
  {
    name: "Multi-call squash pattern",
    input: `C4Context\nPerson(a, "A")System(b, "B")Rel(a, b, "uses")`,
  },
  {
    name: "All on one line with direction",
    input: `C4Contextdirection TDPerson(a, "A")System(b, "B")Rel(a, b, "uses")LAYOUT_WITH_LEGEND()`,
  },
  {
    name: "Quoted string with keyword inside",
    input: `C4Context\nPerson(a, "Customer uses System")System(b, "Backend")`,
  },
  {
    name: "direction TD + Boundary squashed",
    input: `C4Container\ndirection TDBoundary(b, "System Boundary")Container(c, "API", "Node.js")`,
  },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = sanitizeRouteTs(t.input);

  // Validation checks - must NOT include newlines (properly split lines are OK)
  const hasSquash = /[^\n](Person|System|Container|Component|Rel|Boundary)\s*\(/i.test(result);
  const hasDirSquash = /direction\s+(?:TD|LR|TB|BT|RL)[A-Za-z]/i.test(result);
  const hasCloseParenKeyword = /\)[ \t]*(Person|System|Container|Component|Rel|Boundary)\s*\(/i.test(result);

  if (!hasSquash && !hasDirSquash && !hasCloseParenKeyword) {
    console.log("PASS:", t.name);
    passed++;
  } else {
    console.log("FAIL:", t.name);
    console.log("  Input:", t.input.slice(0, 80));
    console.log("  Output:");
    result.split("\n").forEach((l, i) => console.log(`    ${i + 1}: ${l}`));
    console.log("  Validation: hasSquash=" + hasSquash + ", hasDirSquash=" + hasDirSquash);
    failed++;
  }
}

console.log("\n" + "─".repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("All tests passed!");
} else {
  console.log("FAILURES DETECTED");
  process.exit(1);
}
