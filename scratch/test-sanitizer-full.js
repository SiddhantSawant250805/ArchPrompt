// Full pipeline validation test
// Tests all known crash patterns against the sanitizer logic

function makePatterns() {
  return [
    /([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi,
    /([^\n])(%%\{)/g,
    /([^\n])(C4Container\b)/g, /([^\n])(C4Component\b)/g, /([^\n])(C4Context\b)/g,
    /([^\n])(sequenceDiagram\b)/g, /([^\n])(erDiagram\b)/g,
    /([^\n])(classDiagram\b)/g, /([^\n])(stateDiagram-v2\b)/g,
    /([^\n])(flowchart\s)/g, /([^\n])(mindmap\b)/g,
    /([^\n])(quadrantChart\b)/g, /([^\n])(gantt\b)/g, /([^\n])(timeline\b)/g,
    /([^\n])(Person_Ext\s*\()/g, /([^\n])(System_Ext\s*\()/g,
    /([^\n])(System_Boundary\s*\()/g, /([^\n])(Container_Boundary\s*\()/g,
    /([^\n])(Container\s*\()/g, /([^\n])(Component\s*\()/g, /([^\n])(Boundary\s*\()/g,
    /([^\n])(Person\s*\()/g, /([^\n])(System\s*\()/g, /([^\n])(Rel\s*\()/g,
    /([^\n])(LAYOUT_WITH_LEGEND)/g,
    /([^\n])(subgraph\s)/g, /([^\n])(classDef\s)/g,
    /([^\n])(participant\s)/g, /([^\n])(actor\s)/g,
    /([^\n])(title\s)/g, /([^\n])(section\s)/g,
  ];
}

const DIR_KW = [
  "Person_Ext", "System_Ext", "Container_Ext", "Component_Ext",
  "ContainerDb_Ext", "ContainerQueue_Ext", "System_Boundary", "Container_Boundary",
  "ContainerDb", "ContainerQueue", "Rel_Back", "Rel_Neighbor",
  "Rel_Up", "Rel_Down", "Rel_Left", "Rel_Right",
  "Container", "Component", "Boundary",
  "Person", "System", "Rel",
  "title", "subgraph", "classDef", "participant", "actor", "section",
  "LAYOUT_WITH_LEGEND", "C4Context", "C4Container", "C4Component",
  "flowchart", "sequenceDiagram", "erDiagram", "classDiagram", "stateDiagram",
];

function VALID_HEADER_RE() {
  return /^(?:%%\{[\s\S]*?%%\s*\n)?(?:flowchart|graph|sequenceDiagram|erDiagram|classDiagram|stateDiagram-v2|C4Context|C4Container|C4Component|mindmap|quadrantChart|gantt|timeline)/m;
}

function ensureHeader(code) {
  if (VALID_HEADER_RE().test(code)) return code;
  return "flowchart TD\n" + code;
}

function applyPatterns(input) {
  let s = input;
  // Targeted pre-pass
  s = s.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, (m, a, b) => a + "\n" + b);
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([^\n\s])/gi, (m, a, b) => a + "\n" + b);
  for (const kw of DIR_KW) {
    s = s.replace(new RegExp(`(direction\\s+(?:TD|LR|TB|BT|RL))\\s*(${kw}\\b)`, "gi"), (m, a, b) => a + "\n" + b);
    s = s.replace(new RegExp(`(\\w)(${kw}\\s*\\()`, "g"), (m, a, b) => a + "\n" + b);
  }
  // General loop with fresh patterns each pass
  for (let pass = 0; pass < 30; pass++) {
    const prev = s;
    const patterns = makePatterns();
    for (const p of patterns) s = s.replace(p, (m, a, b) => a + "\n" + b);
    if (s === prev) break;
  }
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([^\n])/gi, (m, a, b) => a + "\n" + b);
  s = s.replace(/\n{3,}/g, "\n\n");
  return ensureHeader(s.trim());
}

function validate(code) {
  const hasDirSquash = /\w+direction\s+(?:TD|LR|TB|BT|RL)/i.test(code);
  const hasDirKeyword = /direction\s+(?:TD|LR|TB|BT|RL)[A-Za-z]/i.test(code);
  const hasParenKeyword = /\)[ \t]*(?:Person|System|Container|Component|Rel|Boundary|direction)\b/i.test(code);
  if (hasDirSquash || hasDirKeyword || hasParenKeyword) {
    return { ok: false, hasDirSquash, hasDirKeyword, hasParenKeyword };
  }
  return { ok: true };
}

const tests = [
  {
    name: "Classic crash: Platformdirection TDPerson(",
    input: "C4Contexttitle Microservices Platformdirection TDPerson(customer, \"Customer\", \"A customer\")System(api_gateway, \"API Gateway\", \"Handles\")Rel(customer, api_gateway, \"Uses\")LAYOUT_WITH_LEGEND()",
  },
  {
    name: "direction TDSystem_ pattern",
    input: "C4Contexttitle Microservices Platformdirection TDSystem_Boundary(sb, \"System\")Person(customer, \"Customer\")Rel(customer, sb, \"Uses\")LAYOUT_WITH_LEGEND()",
  },
  {
    name: "No-space directionTDPerson",
    input: "C4ContextdirectionTDPerson(customer, \"Customer\", \"desc\")System(system1, \"System\", \"desc\")Rel(customer, system1, \"Uses\")",
  },
  {
    name: "flowchart with squashed subgraph",
    input: "flowchart TDsubgraph group1 [\"Group\"]A[\"Node A\"]endA --> B[\"Node B\"]",
  },
  {
    name: "title followed by direction (lazy quantifier issue)",
    input: "C4Context\ntitle Microservices Platformdirection TD\nPerson(customer, \"Customer\", \"desc\")\nSystem(api, \"API\", \"desc\")",
  },
  {
    name: "Already correct C4Context",
    input: "C4Context\ntitle Online Banking\ndirection TD\nPerson(customer, \"Customer\", \"A customer\")\nSystem(bank, \"Banking System\", \"Allows access\")\nRel(customer, bank, \"Uses\")\nLAYOUT_WITH_LEGEND()",
  },
  {
    name: "Already correct flowchart",
    input: "%%{init: {\"theme\": \"dark\"}}%%\nflowchart TD\nsubgraph group1 [\"Web Layer\"]\n  A[\"Web Client\"]\nend\nA --> B[\"API Gateway\"]",
  },
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = applyPatterns(t.input);
  const v = validate(result);
  if (v.ok) {
    console.log("✅ PASS:", t.name);
    passed++;
  } else {
    console.log("❌ FAIL:", t.name);
    console.log("   Input:", t.input.slice(0, 80));
    console.log("   Output line 3:", result.split("\n")[2]);
    console.log("   Validation:", v);
    failed++;
  }
}

console.log("\n─────────────────────────────────────");
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed === 0) {
  console.log("All tests passed — sanitizer is working correctly.");
} else {
  console.log("FAILURES DETECTED — fix required.");
  process.exit(1);
}
