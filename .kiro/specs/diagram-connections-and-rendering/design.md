# Technical Design Document

## Overview

This document describes the concrete code changes required to fix three bugs that cause ArchPrompt diagrams to render without connections, the draw.io iframe to show blank content, and EA diagram compilers to silently drop edges. All three bugs are rooted in two files: `app/api/generate/route.ts` (the LLM pipeline) and `app/page.tsx` (the client-side rendering and iframe delivery).

---

## Architecture

### Affected Files

| File | Bug | Change Type |
|------|-----|-------------|
| `app/api/generate/route.ts` | Bug 1 | Add edge-generation rules to `PARSER_SYSTEM` string |
| `app/page.tsx` | Bug 2 | Replace `loadDrawioXml` with retry-based delivery; harden `init` handler |
| `lib/drawioCompiler.ts` | Bug 3 | Add `console.warn` to edge skip guards across all 18 EA compilers |

---

## Fix 1 — PARSER_SYSTEM Edge Generation Rules

### Root Cause

The `PARSER_SYSTEM` prompt in `app/api/generate/route.ts` defines the JSON schema and classification guidance, but contains **no explicit rules mandating edges**. The `buildCompilerPrompt` function (Stage 2) has RULE 8 ("EVERY DIAGRAM MUST HAVE CONNECTIONS"), but that only governs Mermaid code output — it cannot retroactively add edges to a Blueprint JSON that was already produced edgeless by Stage 1.

The Stage 3 compiler (`compileBlueprintToDrawio`) is fully deterministic: it renders exactly what the Blueprint JSON contains. Zero edges in → zero edges out.

### Fix

Insert a numbered rule **7** into `PARSER_SYSTEM` (before the JSON SCHEMA block) and add inline annotation to the `edges` field in the schema. The rule must be explicit and quantified.

**New Rule 7 to add to PARSER_SYSTEM:**

```
7. MANDATORY CONNECTIONS — EDGES ARE REQUIRED:
   Every node MUST appear in at least one edge as either "from" or "to". An isolated node with no connections is a critical error.
   MINIMUM edge count = number_of_nodes - 1 (enough to form a fully connected graph).
   For typical diagrams: if you have 10 nodes, you MUST produce at least 9 edges (and ideally 12-20 to reflect realistic data flows).
   Every edge "from" and "to" value MUST reference a node ID that is declared in the "groups" array above.
   Do NOT produce a blueprint with an empty "edges" array unless the diagram has exactly 1 node.
```

**Updated schema annotation for `edges`:**

```json
"edges": [  // REQUIRED — must have at least (number_of_nodes - 1) entries; every node must appear in at least one edge
  {
    "from": "source_node_id",  // MUST be a declared node ID
    "to": "target_node_id",    // MUST be a declared node ID
    "label": "1-3 words description or empty string",
    "style": "solid" | "dashed"
  }
]
```

**Also add a per-diagram-kind edge guidance block** to the Classification Guidance section, giving the LLM concrete examples of what edges to generate per diagram type:

```
Edge Generation by Diagram Kind:
- flowchart: Connect services in data-flow order (client → gateway → service → database).
- sequence: Each participant sends at least one message.
- er: Every entity relates to at least one other entity.
- bpmn: Connect start event → tasks → gateways → end event within each pool; dashed edges between pools.
- archimate: Connect elements across layers (business → application → technology).
- dfd: External entity → process → data store; process → process for sub-flows.
- vsm: Linear left-to-right chain: process → inventory → process → inventory → timeline.
- capability_map: Connect capability domains or individual capabilities that have dependencies.
- network_topology: Device → device connections with protocol labels.
- deployment: Artefact → artefact deploy relationships; node → node communication.
- component: Component → interface → component dependency chains.
- use_case: Actor → use case; use case -.-> use case for include/extend.
- activity: Initial → action → decision → action(s) → final.
- swimlane: Process steps connected in order across lane boundaries.
- it_roadmap: Initiative → initiative dependency arrows; milestone connections.
- service_blueprint: Vertical links between layers (customer → frontstage → backstage → support).
```

### Location in File

In `PARSER_SYSTEM` (the template literal at the top of `app/api/generate/route.ts`):
- Insert the new Rule 7 after existing rule 6 (the MANDATORY LABEL ICONS rule)
- Update the `edges` schema comment inline
- Append the Edge Generation by Diagram Kind block after the Classification Guidance section

---

## Fix 2 — Reliable draw.io iframe XML Delivery

### Root Cause

`loadDrawioXml()` is a closure-local helper defined inside `compileBlueprintToDiagrams`. Its current implementation:

```typescript
const loadDrawioXml = (xml: string) => {
  drawioXmlRef.current = xml;   // sync ref first
  setDrawioXML(xml);
  setDrawioStatus("loaded");
  if (drawioReady) {            // ← PROBLEM: drawioReady is false on first render
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "load", xml, autosave: 1 }),
      "*"
    );
  }
  // If drawioReady is false: XML is saved in ref/state but never sent — silent failure
};
```

The existing `useEffect([drawioReady])` safety net:
```typescript
useEffect(() => {
  if (drawioReady && drawioXmlRef.current) {
    iframeRef.current?.contentWindow?.postMessage(...)
  }
}, [drawioReady]);
```
This fires once when `drawioReady` transitions from `false` to `true`. If a diagram is generated **after** `drawioReady` is already true (common on subsequent generations), this effect does NOT fire again — relying entirely on the `if (drawioReady)` branch in `loadDrawioXml`. This path works. The failure mode is **first render only**: iframe loads, `drawioReady` becomes `true`, and only then the user generates a diagram — this actually works. But if `drawioReady` is `false` when the diagram is generated (iframe still loading), the XML is silently lost.

### Fix Design

Replace `loadDrawioXml` with a version that installs a **retry interval** when the iframe is not yet ready:

```typescript
// Module-level ref to track any pending retry interval (prevents leaks)
const drawioRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
```

```typescript
const loadDrawioXml = (xml: string) => {
  // 1. Always set ref synchronously — init handler reads this
  drawioXmlRef.current = xml;
  // 2. Update React state
  setDrawioXML(xml);
  setDrawioStatus("loaded");

  const sendToIframe = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "load", xml, autosave: 1 }),
      "*"
    );
  };

  if (drawioReady) {
    // Iframe already initialized — send immediately
    sendToIframe();
  } else {
    // Iframe not ready yet — install a retry interval
    // Clear any existing retry interval before starting a new one
    if (drawioRetryRef.current) {
      clearInterval(drawioRetryRef.current);
      drawioRetryRef.current = null;
    }
    let attempts = 0;
    const MAX_ATTEMPTS = 20; // 20 × 300ms = 6 seconds max
    drawioRetryRef.current = setInterval(() => {
      attempts++;
      if (iframeRef.current?.contentWindow) {
        // Try sending — even if drawioReady isn't set yet, postMessage is safe
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ action: "load", xml, autosave: 1 }),
          "*"
        );
      }
      // Stop retrying when drawioReady is true or we've exhausted attempts
      if (drawioReady || attempts >= MAX_ATTEMPTS) {
        clearInterval(drawioRetryRef.current!);
        drawioRetryRef.current = null;
      }
    }, 300);
  }
};
```

**Cleanup on unmount** — add a `useEffect` to clear the retry interval:

```typescript
useEffect(() => {
  return () => {
    if (drawioRetryRef.current) {
      clearInterval(drawioRetryRef.current);
    }
  };
}, []);
```

**Harden the `init` event handler** — the `init` case already reads from `drawioXmlRef.current` and sends unconditionally if set. This is correct. Also cancel any pending retry when init fires:

```typescript
case "init":
  setDrawioReady(true);
  setDrawioStatus("loaded");
  // Cancel any pending retry — init is the authoritative delivery point
  if (drawioRetryRef.current) {
    clearInterval(drawioRetryRef.current);
    drawioRetryRef.current = null;
  }
  if (drawioXmlRef.current) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "load", xml: drawioXmlRef.current, autosave: 1 }),
      "*"
    );
  }
  break;
```

**Remove the now-redundant `useEffect([drawioReady])` safety net** — with the retry mechanism in place, this effect is superseded and can be removed to avoid double-sending.

### State Dependency Note

The `loadDrawioXml` closure captures `drawioReady` at render time. Since it's defined inside `compileBlueprintToDiagrams` (which is called during render), the retry interval's conditional `if (drawioReady)` check uses a stale closure. The interval callback should use `drawioReadyRef` (a ref mirror of `drawioReady`) to read the current value.

Add:
```typescript
const drawioReadyRef = useRef(false);
useEffect(() => { drawioReadyRef.current = drawioReady; }, [drawioReady]);
```

Then the interval uses `drawioReadyRef.current` instead of the stale `drawioReady` closure value.

---

## Fix 3 — EA Compiler `cellMap` Diagnostic Warnings

### Root Cause Analysis

After reviewing all 18 EA compiler functions in `lib/drawioCompiler.ts`, **all of them already correctly register `cellMap[node.id]` for every node** and all already have the `if (!srcId || !tgtId) return;` guard on edge rendering. This means Bug 3 as originally hypothesised (key mismatch) is less severe than feared — the compilers do the right thing.

However, the guard silently skips edges with no warning, making it impossible to diagnose when Blueprint JSON contains edges that reference non-existent node IDs (e.g., the LLM generates an edge pointing to a node ID that wasn't declared in any group).

### Fix

Add `console.warn` logging to every EA compiler's edge skip guard. This turns a silent failure into a diagnosable one. The pattern to change in every EA compiler:

**Before:**
```typescript
edges.forEach((edge) => {
  const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
  if (!srcId || !tgtId) return;
  // ... render edge
});
```

**After:**
```typescript
edges.forEach((edge) => {
  const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
  if (!srcId || !tgtId) {
    console.warn(`[drawioCompiler] Edge skipped — node ID not in cellMap. from="${edge.from}" (${srcId ? "ok" : "MISSING"}) to="${edge.to}" (${tgtId ? "ok" : "MISSING"})`);
    return;
  }
  // ... render edge
});
```

This applies to all 18 EA-specific functions:
`compileArchimateView`, `compileBpmnDiagram`, `compileDfdDiagram`, `compileVsmDiagram`, `compileCapabilityMap`, `compileNetworkTopology`, `compileDeploymentDiagram`, `compileComponentDiagram`, `compileUseCaseDiagram`, `compileActivityDiagram`, `compileCommunicationDiagram`, `compilePackageDiagram`, `compileObjectDiagram`, `compileTimingDiagram`, `compileInteractionOverview`, `compileItRoadmap`, `compileServiceBlueprint`, `compileSwimlaneDiagram`.

The existing 12 base compilers (`compileFlowchartDiagram`, `compileErDiagram`, etc.) use a different edge loop structure — they are left unchanged per regression prevention requirement 3.5.

---

## Data Flow After Fix

```
User prompt
    ↓
Stage 1 (PARSER_SYSTEM)
    → Now mandates: edges ≥ nodes−1, every node in at least one edge
    ↓
Blueprint JSON (with edges)
    ↓
Stage 2 (buildCompilerPrompt)          Stage 3 (compileBlueprintToDrawio)
    → Mermaid code with connections         → draw.io XML with mxCell edges
    ↓                                           ↓
Mermaid canvas (SVG with arrows)        loadDrawioXml()
                                            → drawioXmlRef.current = xml (sync)
                                            → setDrawioXML / setDrawioStatus
                                            → if drawioReady: send immediately
                                            → else: retry interval (300ms × 20)
                                            ↓
                                        draw.io iframe `init` event
                                            → clears retry interval
                                            → sends XML unconditionally
                                            ↓
                                        draw.io iframe: displays connected diagram
```

---

## Component Interaction Diagram

```
app/page.tsx
├── compileBlueprintToDiagrams()
│   ├── fetch Stage 2 → setMermaidCode → renderMermaidMarkup → setCanvasSvg
│   └── compileBlueprintToDrawio() → loadDrawioXml(xml) [FIXED]
│       ├── drawioXmlRef.current = xml  ← sync, always
│       ├── setDrawioXML(xml)
│       ├── if drawioReadyRef.current → postMessage immediately
│       └── else → setInterval retry (max 6s) using drawioRetryRef
│
├── handleDrawioMessage (useEffect)
│   ├── case "init" → clearInterval(drawioRetryRef) + postMessage if ref set [FIXED]
│   ├── case "save" → setDrawioXML
│   ├── case "autosave" → setDrawioXML + request SVG export
│   └── case "export" → renderDrawioSVGInCanvas (sync canvas with iframe edits)
│
└── useEffect cleanup → clearInterval(drawioRetryRef) on unmount [NEW]

app/api/generate/route.ts
└── PARSER_SYSTEM [FIXED]
    ├── Rule 7: mandatory edges ≥ nodes−1
    ├── Schema: edges array annotated as REQUIRED
    └── Classification Guidance: per-kind edge examples added

lib/drawioCompiler.ts
└── All 18 EA compiler functions [FIXED]
    └── Edge skip guard: console.warn on missing cellMap entry
```

---

## Testing Strategy

### Manual Verification Steps

1. **Bug 1**: Open the app, click any demo example prompt (e.g. "microservices"), generate diagram. Verify the Mermaid canvas shows arrows between nodes and the Blueprint JSON (visible in the Code tab) has a non-empty `edges` array.

2. **Bug 2**: On first page load (hard refresh), immediately generate a diagram before the iframe finishes loading. Verify the draw.io tab shows the diagram rather than a blank state. Check browser console — should see `[Draw.io Event] init` followed by the diagram appearing.

3. **Bug 3**: Generate any EA diagram type (e.g. BPMN, ArchiMate, Network Topology). Verify the draw.io iframe shows connections between nodes. Check browser console for any `[drawioCompiler] Edge skipped` warnings — if present, those indicate Blueprint JSON edges with invalid node IDs that should be reported.

### Regression Check

- Existing diagram types (flowchart, sequence, er, class, etc.) must continue to render correctly with no change to their compilers.
- The `save` and `autosave` iframe events must continue to sync the canvas.
- History restore must continue to load draw.io XML into the iframe correctly.
