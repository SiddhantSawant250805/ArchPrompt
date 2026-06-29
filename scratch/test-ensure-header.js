// Test ensureHeader with C4 diagrams — make sure it doesn't prepend flowchart TD
// when the code already has C4Context

const VALID_HEADER_RE = /^(?:%%\{[\s\S]*?%%\s*\n)?(?:flowchart|graph|sequenceDiagram|erDiagram|classDiagram|stateDiagram-v2|C4Context|C4Container|C4Component|mindmap|quadrantChart|gantt|timeline)/m;

function ensureHeader(code) {
  if (VALID_HEADER_RE.test(code)) return code;
  console.warn("[ensureHeader] No valid diagram header found — prepending 'flowchart TD'");
  return "flowchart TD\n" + code;
}

// After sanitization, C4Context squash becomes:
// "C4Context\ntitle ...\ndirection TD\nPerson(...)"
const sanitizedC4 = `C4Context
title Microservices Platform
direction TD
Person(customer, "Customer", "desc")
System(api, "API", "desc")
Rel(customer, api, "Uses")
LAYOUT_WITH_LEGEND()`;

const result = ensureHeader(sanitizedC4);
console.log("Input starts with C4Context:", sanitizedC4.startsWith("C4Context"));
console.log("VALID_HEADER_RE matches:", VALID_HEADER_RE.test(sanitizedC4));
console.log("ensureHeader prepended:", result !== sanitizedC4);
console.log("First line:", result.split("\n")[0]);

// Edge case: what if there's whitespace before C4Context?
const withWhitespace = `  C4Context
title Test`;
console.log("\nWith leading whitespace:");
console.log("VALID_HEADER_RE matches:", VALID_HEADER_RE.test(withWhitespace));
console.log("ensureHeader prepended:", ensureHeader(withWhitespace) !== withWhitespace);

// Edge case: empty string
console.log("\nEmpty string:");
const emptyResult = ensureHeader("");
console.log("Result:", JSON.stringify(emptyResult));
