// Test the exact crash string from the error message
// "...roservices Platformdirection TDPerson("
// This means the full line is something like:
// "title Microservices Platformdirection TDPerson(..."

function makePatterns() {
  return [
    /([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi,
    /([^\n])(C4Container\b)/g, /([^\n])(C4Component\b)/g, /([^\n])(C4Context\b)/g,
    /([^\n])(Person\s*\()/g, /([^\n])(System\s*\()/g, /([^\n])(Rel\s*\()/g,
    /([^\n])(LAYOUT_WITH_LEGEND)/g,
    /([^\n])(title\s)/g,
  ];
}

const DIR_KW = ["Person", "System", "Rel", "title", "LAYOUT_WITH_LEGEND",
  "C4Context", "C4Container", "C4Component"];

function applyPatterns(input) {
  let s = input;
  s = s.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, (m, a, b) => a + "\n" + b);
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([^\n\s])/gi, (m, a, b) => a + "\n" + b);
  for (const kw of DIR_KW) {
    s = s.replace(new RegExp(`(direction\\s+(?:TD|LR|TB|BT|RL))\\s*(${kw}\\b)`, "gi"), (m, a, b) => a + "\n" + b);
    s = s.replace(new RegExp(`(\\w)(${kw}\\s*\\()`, "g"), (m, a, b) => a + "\n" + b);
  }
  for (let pass = 0; pass < 30; pass++) {
    const prev = s;
    const patterns = makePatterns();
    for (const p of patterns) s = s.replace(p, (m, a, b) => a + "\n" + b);
    if (s === prev) break;
  }
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([^\n])/gi, (m, a, b) => a + "\n" + b);
  return s.trim();
}

// Test case 1: already has newline after C4Context, title squashed with direction
const test1 = `C4Context
title Microservices Platformdirection TDPerson(customer, "Customer", "desc")System(api, "API", "desc")Rel(customer, api, "Uses")LAYOUT_WITH_LEGEND()`;

// Test case 2: all on one line (what history might store)
const test2 = `C4Contexttitle Microservices Platformdirection TDPerson(customer, "Customer", "desc")System(api, "API", "desc")Rel(customer, api, "Uses")LAYOUT_WITH_LEGEND()`;

// Test case 3: what if it's stored with the title on its own line but direction squashed
const test3 = `C4Context
title Microservices Platform
direction TDPerson(customer, "Customer", "desc")System(api, "API", "desc")Rel(customer, api, "Uses")LAYOUT_WITH_LEGEND()`;

for (const [name, input] of [["test1 (title+dir squash)", test1], ["test2 (all one line)", test2], ["test3 (dir+Person squash)", test3]]) {
  const result = applyPatterns(input);
  const crashed = /direction\s+(?:TD|LR|TB|BT|RL)[A-Za-z]/.test(result) ||
                  /\w+direction\s+(?:TD|LR|TB|BT|RL)/.test(result);
  console.log(crashed ? "❌ FAIL" : "✅ PASS", name);
  if (crashed) {
    console.log("  Input:", JSON.stringify(input.slice(0, 100)));
    result.split("\n").forEach((l, i) => console.log(`  ${i+1}: ${l}`));
  }
}
