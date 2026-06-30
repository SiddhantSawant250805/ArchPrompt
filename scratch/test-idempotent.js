// Test whether applyPatterns is idempotent on already-clean C4 code
// and whether it introduces new problems

const clean = [
  'C4Container',
  'title Microservices Platform',
  'direction TD',
  'Container(api_gw, "API Gateway", "Node.js", "Routes requests")',
  'Person(customer, "Customer", "Uses platform")',
  'Rel(customer, api_gw, "HTTPS")',
  'LAYOUT_WITH_LEGEND()',
].join('\n');

function makePatterns() {
  return [
    /([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi,
    /([^\n])(C4Container\b)/g,
    /([^\n])(Container\s*\()/g,
    /([^\n])(Person\s*\()/g,
    /([^\n])(System\s*\()/g,
    /([^\n])(Rel\s*\()/g,
    /([^\n])(LAYOUT_WITH_LEGEND)/g,
    /([^\n])(title\s)/g,
  ];
}

function applyPatterns(input) {
  let s = input;
  s = s.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, (m,a,b) => a+'\n'+b);
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([^\n\s])/gi, (m,a,b) => a+'\n'+b);
  
  for (let pass = 0; pass < 30; pass++) {
    const prev = s;
    for (const p of makePatterns()) s = s.replace(p, (m,a,b) => a+'\n'+b);
    if (s === prev) break;
  }
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([^\n])/gi, (m,a,b) => a+'\n'+b);
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

console.log('INPUT:');
clean.split('\n').forEach((l,i) => console.log((i+1)+': '+l));

const pass1 = applyPatterns(clean);
console.log('\nAFTER 1st applyPatterns:');
pass1.split('\n').forEach((l,i) => console.log((i+1)+': '+l));

const pass2 = applyPatterns(pass1);
console.log('\nAFTER 2nd applyPatterns (should be identical):');
pass2.split('\n').forEach((l,i) => console.log((i+1)+': '+l));

console.log('\nIdempotent:', pass1 === pass2 ? 'YES' : 'NO - BROKEN');

// Key test: does title\s cause double-split?
const titleTest = 'title Microservices Platform';
const titleResult = titleTest.replace(/([^\n])(title\s)/g, (m,a,b) => a+'\n'+b);
console.log('\ntitle\s on standalone title line:', JSON.stringify(titleResult));
// This should NOT match since 'title ' is at position 0 (no [^\n] before it)
