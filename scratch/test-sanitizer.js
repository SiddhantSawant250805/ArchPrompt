// Test the exact crash pattern through the sanitizer pipeline
const input = 'C4Contexttitle Microservices Platformdirection TDPerson(customer, "Customer", "A customer")System(api_gateway, "API Gateway", "Handles requests")Rel(customer, api_gateway, "Uses")LAYOUT_WITH_LEGEND()';

function applyPatterns(s) {
  // Targeted pre-pass: direction TD + keyword
  s = s.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, (m, a, b) => a + '\n' + b);
  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([^\n\s])/gi, (m, a, b) => a + '\n' + b);

  const DIR_KW = [
    'Person_Ext', 'System_Ext', 'Container_Ext', 'Component_Ext',
    'ContainerDb_Ext', 'ContainerQueue_Ext', 'System_Boundary', 'Container_Boundary',
    'ContainerDb', 'ContainerQueue', 'Rel_Back', 'Rel_Neighbor',
    'Rel_Up', 'Rel_Down', 'Rel_Left', 'Rel_Right',
    'Container', 'Component', 'Boundary',
    'Person', 'System', 'Rel',
    'title', 'subgraph', 'classDef', 'participant', 'actor', 'section',
    'LAYOUT_WITH_LEGEND', 'C4Context', 'C4Container', 'C4Component',
    'flowchart', 'sequenceDiagram', 'erDiagram', 'classDiagram', 'stateDiagram',
  ];
  for (const kw of DIR_KW) {
    s = s.replace(new RegExp(`(direction\\s+(?:TD|LR|TB|BT|RL))\\s*(${kw}\\b)`, 'gi'), (m, a, b) => a + '\n' + b);
    s = s.replace(new RegExp(`(\\w)(${kw}\\s*\\()`, 'g'), (m, a, b) => a + '\n' + b);
  }

  const patterns = [
    /([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi,
    /([^\n])(C4Container\b)/g,
    /([^\n])(C4Component\b)/g,
    /([^\n])(C4Context\b)/g,
    /([^\n])(Person_Ext\s*\()/g,
    /([^\n])(System_Ext\s*\()/g,
    /([^\n])(System_Boundary\s*\()/g,
    /([^\n])(Container_Boundary\s*\()/g,
    /([^\n])(Container\s*\()/g,
    /([^\n])(Component\s*\()/g,
    /([^\n])(Boundary\s*\()/g,
    /([^\n])(Person\s*\()/g,
    /([^\n])(System\s*\()/g,
    /([^\n])(Rel\s*\()/g,
    /([^\n])(LAYOUT_WITH_LEGEND)/g,
    /([^\n])(title\s)/g,
  ];

  for (let pass = 0; pass < 30; pass++) {
    const prev = s;
    for (const p of patterns) s = s.replace(p, (m, a, b) => a + '\n' + b);
    if (s === prev) break;
  }

  s = s.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([^\n])/gi, (m, a, b) => a + '\n' + b);
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

const result = applyPatterns(input);
console.log('=== INPUT ===');
console.log(input);
console.log('\n=== OUTPUT ===');
result.split('\n').forEach((l, i) => console.log((i + 1) + ': ' + l));

// Check for crash patterns
const hasCrash = /\w+direction\s+(?:TD|LR|TB|BT|RL)/i.test(result);
const hasSquash = /direction\s+(?:TD|LR|TB|BT|RL)[A-Za-z]/.test(result);
console.log('\n=== VALIDATION ===');
console.log('Has squashed direction:', hasCrash);
console.log('Has direction+keyword:', hasSquash);
console.log('Passes:', !hasCrash && !hasSquash ? 'YES' : 'NO - STILL BROKEN');
