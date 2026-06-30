// Exact crash: ...ervices"]direction TDroute53["🗺️ Rout
// The full squashed line looks like:
// subgraph group_services ["⚙️ Services"]direction TDroute53["🗺️ Route 53"]

const crashLine = `%%{init: {"theme": "dark", "flowchart": {"curve": "stepBefore"}}}%%\nflowchart TD\nsubgraph group_services ["⚙️ Services"]direction TDroute53["🗺️ Route 53"]\nroute53 --> s3["🪣 S3"]\nend`;

// Simulate the FULL pipeline as it runs in sanitizeMermaidCode + applyPatterns
// to find exactly where the squash survives.

function step(label, s) {
  const found = /\]direction TD|direction TD[a-z]/i.test(s);
  if (found) console.log(`  ⚠️  Still squashed after: ${label}`);
  return s;
}

let s = crashLine;
console.log("INPUT:", s.split('\n')[2]);

// Step A
s = s.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, "$1\n$2");
step("Step A", s); console.log("  Line 3:", s.split('\n')[2]);

// Step B
s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([^\n\s])/gi, "$1\n$2");
step("Step B", s); console.log("  Line 3:", s.split('\n')[2]);

// Step B2
s = s.replace(/([\]"'])\s*(direction\s+(?:TD|LR|TB|BT|RL))/gi, "$1\n$2");
step("Step B2", s); console.log("  Line 3:", s.split('\n')[2]);

// Step B3
s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([a-zA-Z][a-zA-Z0-9_]*\s*[\[({])/gi, "$1\n$2");
step("Step B3", s); console.log("  Line 3:", s.split('\n')[2]);

console.log("\nFINAL (lines 1-6):");
s.split('\n').slice(0,6).forEach((l,i) => console.log(`  ${i+1}: ${l}`));

// Now simulate what applySplitPass does with the quoted string
// The key: split by " gives segments, even indices are unquoted
console.log("\n=== applySplitPass simulation ===");
let s2 = crashLine.split('\n')[2]; // just the problem line
console.log("Problem line:", s2);

const segments = s2.split('"');
console.log(`Split by " gives ${segments.length} segments:`);
segments.forEach((seg, i) => console.log(`  [${i}] ${i%2===0?'unquoted':'QUOTED'}: ${JSON.stringify(seg)}`));

// The segment containing "]direction TD" is:
// segment[2] (unquoted): "]direction TD"
// Let's apply the direction passes to segment[2]
let seg2 = segments[2] || "";
console.log("\nSegment [2] before:", JSON.stringify(seg2));
seg2 = seg2.replace(/(\w)(direction\s+(?:TD|LR|TB|BT|RL))/gi, "$1\n$2");
seg2 = seg2.replace(/([)\]}>])(direction\s+(?:TD|LR|TB|BT|RL))/gi, "$1\n$2");
seg2 = seg2.replace(/(direction\s+(?:TD|LR|TB|BT|RL))(\w)/gi, "$1\n$2");
console.log("Segment [2] after:", JSON.stringify(seg2));
segments[2] = seg2;
const rejoined = segments.join('"');
console.log("\nRejoined line:", rejoined);
console.log("Still squashed?", /\]direction|direction TD[a-z\[]/i.test(rejoined));
