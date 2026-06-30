// Test the exact crash: "...direction TDContain..."
// Full pattern likely: "title Microservices Platformdirection TDContainer(api, ...)"

const full = 'C4Containertitle Microservices Platformdirection TDContainer(api_gw, "API Gateway", "Node.js", "Routes requests")Person(customer, "Customer", "Uses platform")Rel(customer, api_gw, "HTTPS")LAYOUT_WITH_LEGEND()';

function stepByStep(s) {
  const log = [];
  
  // Step A: split anything before direction <value>
  s = s.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, (m, a, b) => a + '\n' + b);
  log.push('After stepA:\n' + s.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));
  
  // Step B: split anything after direction <value> (non-space, non-newline)
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([^\n\s])/gi, (m, a, b) => a + '\n' + b);
  log.push('After stepB:\n' + s.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));
  
  // Check: is "direction TDContainer" on same line?
  const hasIssue = s.split('\n').some(line => /direction\s+(?:TD|LR|TB|BT|RL)\w/i.test(line));
  log.push('Still squashed after stepAB: ' + hasIssue);
  
  // Pattern from KEYWORD_PATTERNS for Container:
  s = s.replace(/([^\n])(Container\s*\()/g, (m, a, b) => a + '\n' + b);
  log.push('After Container( split:\n' + s.split('\n').map((l,i)=>(i+1)+': '+l).join('\n'));
  
  return log.join('\n\n');
}

console.log(stepByStep(full));
console.log('\n---');

// Now test what applyPatterns (from page.tsx) does with this
// Simulating the full pipeline
function makePatterns() {
  return [
    /([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi,
    /([^\n])(C4Container\b)/g,
    /([^\n])(C4Component\b)/g,
    /([^\n])(C4Context\b)/g,
    /([^\n])(Container\s*\()/g,
    /([^\n])(Component\s*\()/g,
    /([^\n])(Person\s*\()/g,
    /([^\n])(System\s*\()/g,
    /([^\n])(Rel\s*\()/g,
    /([^\n])(LAYOUT_WITH_LEGEND)/g,
    /([^\n])(title\s)/g,
  ];
}

const DIR_KW = ['Container', 'Component', 'Person', 'System', 'Rel', 'title', 'LAYOUT_WITH_LEGEND', 'C4Context', 'C4Container', 'C4Component'];

function applyAll(input) {
  let s = input;
  // Pre-pass A
  s = s.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, (m,a,b) => a+'\n'+b);
  // Pre-pass B
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([^\n\s])/gi, (m,a,b) => a+'\n'+b);
  // Pre-pass C: direction TD + keyword
  for (const kw of DIR_KW) {
    s = s.replace(new RegExp(`(direction\\s+(?:TD|LR|TB|BT|RL))\\s*(${kw}\\b)`, 'gi'), (m,a,b) => a+'\n'+b);
    s = s.replace(new RegExp(`(\\w)(${kw}\\s*\\()`, 'g'), (m,a,b) => a+'\n'+b);
  }
  // General loop
  for (let pass = 0; pass < 30; pass++) {
    const prev = s;
    for (const p of makePatterns()) s = s.replace(p, (m,a,b) => a+'\n'+b);
    if (s === prev) break;
  }
  // Post: direction TD followed by any non-whitespace
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([^\n])/gi, (m,a,b) => a+'\n'+b);
  return s.trim();
}

const result = applyAll(full);
console.log('FINAL OUTPUT:');
result.split('\n').forEach((l,i) => console.log((i+1)+': '+l));

// Check for remaining squash
const lines = result.split('\n');
let pass = true;
lines.forEach((l, i) => {
  if (/direction\s+(?:TD|LR|TB|BT|RL)\w/i.test(l)) {
    console.log(`FAIL line ${i+1}: ${l}`);
    pass = false;
  }
});
if (pass) console.log('\nPASS: No squash detected');
