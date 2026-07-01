# Diagram Connections and Rendering Bugfix Design

## Overview

This document describes the concrete code changes required to fix four bugs that cause ArchPrompt diagrams to render without connections, the draw.io iframe to show blank content on first load, EA diagram compilers to silently drop edges, and the Mermaid sanitizer to corrupt valid code and exhaust all repair passes without attempting server-side recovery.

All four bugs are rooted in three files: `app/api/generate/route.ts` (the LLM pipeline), `app/page.tsx` (the client-side rendering and iframe delivery), and `lib/drawioCompiler.ts` (the EA diagram compilers).

---

## Glossary

- **Bug_Condition (C)**: The condition that identifies a buggy input — e.g., a Blueprint JSON with an empty `edges` array, an iframe not yet ready when XML is delivered, a `cellMap` key lookup returning `undefined`, or a sanitizer that corrupts valid Mermaid code.
- **Property (P)**: The desired correct behavior for each bug — e.g., every node participates in at least one edge, XML always reaches the iframe, all edges render in draw.io output, sanitizer does not corrupt valid constructs.
- **Preservation**: Existing behaviors that must remain unchanged — correct edge rendering, `save`/`autosave` iframe event handling, non-affected compiler functions, successful render paths.
- **Blueprint JSON**: The intermediate JSON structure produced by Stage 1 (`PARSER_SYSTEM`) containing `groups` (nodes) and `edges`.
- **cellMap**: A dictionary keyed by node ID used by EA compiler functions to look up the draw.io cell ID for each node before rendering edges.
- **PARSER_SYSTEM**: The Stage 1 LLM system prompt in `app/api/generate/route.ts` that classifies diagrams and produces Blueprint JSON.
- **buildCompilerPrompt**: The Stage 2 function that generates the Mermaid code prompt from a Blueprint JSON.
- **compileBlueprintToDrawio**: The Stage 3 deterministic function that converts Blueprint JSON into draw.io XML.
- **loadDrawioXml**: A closure-local helper in `app/page.tsx` that delivers draw.io XML to the iframe via `postMessage`.
- **drawioReady**: Boolean React state that tracks whether the draw.io iframe has fired its `init` event.
- **sanitizeMermaidCode / applyPatterns / applyFinalPasses**: The client-side sanitizer chain in `app/page.tsx` that attempts to repair LLM-generated Mermaid code before rendering.

---

## Bug Details

### Bug Condition

Four distinct bugs cause broken diagram rendering. Each is formalized below.

#### Bug 1 — Stage 1 Blueprint JSON Missing Edges

The `PARSER_SYSTEM` prompt contains no rules mandating edge generation. Stage 3 is fully deterministic: zero edges in → zero edges out.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug1(blueprint)
  INPUT: blueprint of type BlueprintJSON
  OUTPUT: boolean

  allNodes ← FLATTEN(blueprint.groups[*].nodes)
  nodeCount ← LENGTH(allNodes)
  edgeCount ← LENGTH(blueprint.edges)

  IF edgeCount = 0 THEN RETURN true
  IF nodeCount > 1 AND edgeCount < nodeCount - 1 THEN RETURN true
  RETURN false
END FUNCTION
```

**Examples:**
- User submits "microservices architecture" prompt → Blueprint JSON has 10 nodes but `edges: []` → Mermaid canvas shows floating boxes, draw.io shows disconnected nodes.
- Demo prompt from `EXAMPLES` object used → Blueprint produced with 8 isolated nodes and 0 edges.
- Stage 2 (`buildCompilerPrompt`) receives edgeless blueprint → RULE 8 ("EVERY DIAGRAM MUST HAVE CONNECTIONS") cannot retroactively add edges to an already edgeless blueprint.
- Stage 3 (`compileBlueprintToDrawio`) receives edgeless blueprint → draw.io XML has nodes but zero `mxCell` edge elements.

#### Bug 2 — draw.io iframe XML Delivery Race Condition

`loadDrawioXml()` only sends `postMessage` when `drawioReady === true`. If the diagram is generated before the iframe fires its `init` event, the XML is silently discarded.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug2(state)
  INPUT: state of type { drawioReady: boolean, drawioXmlRefCurrent: string | null }
  OUTPUT: boolean

  RETURN state.drawioXmlRefCurrent != null AND state.drawioReady = false
END FUNCTION
```

**Examples:**
- Page first load: user immediately generates diagram before iframe finishes loading → `drawioReady` is `false` → `postMessage` branch skipped → iframe shows blank state.
- `useEffect([drawioReady])` safety net fires once when `drawioReady` transitions to `true`, but if diagram was generated after `drawioReady` became `true`, this effect does not fire again.
- `init` event fires before `drawioXmlRef.current` is populated → `init` handler sends nothing.

#### Bug 3 — EA Compiler `cellMap` Key Mismatches Silently Drop Edges

All 18 EA compiler functions already have an `if (!srcId || !tgtId) return;` guard on edge rendering, but silently skip edges when Blueprint JSON contains edges referencing non-existent or mismatched node IDs. No warning is emitted, making the failure invisible.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug3(blueprint, edge)
  INPUT: blueprint of type BlueprintJSON, edge of type Edge
  OUTPUT: boolean

  allNodeIds ← SET(FLATTEN(blueprint.groups[*].nodes)[*].id)
  RETURN edge.from NOT IN allNodeIds OR edge.to NOT IN allNodeIds
END FUNCTION
```

**Examples:**
- BPMN diagram with nodes nested inside groups → `cellMap` registers `node.id` correctly, but an edge with `from` matching a group ID (not a node ID) → `cellMap[edge.from]` returns `undefined` → edge silently skipped.
- DFD diagram flattens nodes into a single list; LLM generates an edge with a mis-cased `edge.from` → lookup fails silently → draw.io output missing connections with no console output.
- All 18 EA compilers affected; existing 12 base compilers (`compileFlowchartDiagram`, etc.) use different edge loop structure and are not affected.

#### Bug 4 — Sanitizer Chain Corrupts Valid Code and Exhausts Repair Passes

The nuclear keyword split transforms in `sanitizeMermaidCode`, `applyPatterns`, and `applyFinalPasses` corrupt structurally valid Mermaid code; when all client passes are exhausted, no server-side recovery is attempted.

**Formal Specification:**
```
FUNCTION isBugCondition_Bug4(mermaidCode)
  INPUT: mermaidCode of type string
  OUTPUT: boolean

  sanitized ← sanitizeMermaidCode(mermaidCode)
  repaired  ← applyFinalPasses(applyPatterns(sanitized))

  containsClassDefSplit ← sanitized CONTAINS orphaned CSS fragment (e.g. "actor fill:")
  containsNodeLabelSplit ← sanitized CONTAINS split node definition mid-label
  topLevelDirectionStripped ← mermaidCode CONTAINS top_level_direction_declaration
                              AND sanitized DOES NOT CONTAIN that declaration
  allPassesFailed ← NOT m.render_succeeds(repaired)
  noServerRecall  ← server_recall_attempted = false

  RETURN (containsClassDefSplit OR containsNodeLabelSplit OR topLevelDirectionStripped)
         OR (allPassesFailed AND noServerRecall)
END FUNCTION
```

**Examples:**
- Input: `classDef actor fill:#0c1524,stroke:#3b82f6;` → nuclear pass for keyword `actor` splits to `classDef\nactor fill:...` → orphaned CSS fragment → renderer throws.
- Input: `svc["📋 Section Overview"]` → regex `([a-zA-Z0-9_])(section(?=\s|$))` splits mid-label to `svc["📋\nsection Overview"]` → invalid syntax.
- C4 diagram uses `direction TD` as top-level statement → `insideSubgraph` depth counter misbehaves on unmatched `end` tokens → `direction TD` stripped → diagram header invalid.
- All client passes fail → system renders single-node placeholder and sets `canvasError` with no server re-call attempt, even though the original Stage 2 raw code may have been recoverable.

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Blueprint JSON that already contains a well-formed `edges` array with valid `from`/`to` references must continue to render all edges correctly in both the Mermaid canvas and the draw.io iframe without duplication or modification.
- When `drawioXmlRef.current` is `null` at `init` event time (no diagram generated yet), the system must remain in the `empty` draw.io status without sending any `postMessage` or triggering errors.
- When the draw.io iframe is already in `loaded` state and a new diagram is generated, XML delivery must continue using the existing `{ action: "load", xml, autosave: 1 }` format.
- The `save` and `autosave` draw.io iframe events must continue to update `drawioXML` state and trigger the SVG-export round-trip that syncs the canvas with iframe edits.
- Existing diagram types compiled by the 12 base compilers (`compileFlowchartDiagram`, `compileErDiagram`, etc.) must produce the same draw.io XML output as before — their edge loop structure is not touched.
- All existing `PARSER_SYSTEM` output rules must be respected: no markdown fences, raw JSON only, valid node IDs matching `[a-zA-Z][a-zA-Z0-9_]*`, emoji-prefixed labels, correct `diagramKind` classification.
- Stage 2 `buildCompilerPrompt` RULE 8 must continue to use existing Blueprint edges to produce connected Mermaid code rather than inventing new connections.
- The retry mechanism must clean up via React `useEffect` cleanup on component unmount to prevent memory leaks.
- When Mermaid code passes `sanitizeMermaidCode` and renders successfully on the first `m.render` attempt, no repair pass or server re-call is triggered.
- When the auto-repair path succeeds and `m.render` passes on the repaired code, the result is returned without triggering the server-side re-call.
- `classDef` lines in non-flowchart diagram types must continue to be stripped entirely (existing behavior) rather than hoisted.
- When `canvasError` is set to the fallback message, the error banner with "Try regenerating" must continue to display so the user always has a manual escape hatch.

**Scope:**
All inputs that do NOT match any of the four bug conditions above should be completely unaffected by these fixes. This includes:
- Diagrams that already have edges in their Blueprint JSON
- draw.io XML delivered when `drawioReady` is already `true`
- EA compiler calls with Blueprint edges whose `from`/`to` IDs are all present in `cellMap`
- Mermaid code that sanitizes and renders successfully on the first pass

---

## Hypothesized Root Cause

### Bug 1 — No Edge Mandate in PARSER_SYSTEM

1. **Missing explicit rules**: `PARSER_SYSTEM` defines the JSON schema and classification guidance but contains no numbered rule mandating edges. The schema's `edges` field has no annotation stating it is required.
2. **Stage 2 cannot recover**: `buildCompilerPrompt` RULE 8 ("EVERY DIAGRAM MUST HAVE CONNECTIONS") governs Mermaid code output only — it cannot retroactively populate edges in a Blueprint JSON that Stage 1 already produced without them.
3. **Deterministic Stage 3**: `compileBlueprintToDrawio` renders exactly what Blueprint JSON contains; zero edges in produces zero edges out with no compensation logic.
4. **No per-diagram-kind guidance**: The LLM has no examples of what edges to produce for each `diagramKind`, so it defaults to omitting them when uncertain.

### Bug 2 — Race Condition Between Iframe Init and XML Delivery

1. **Synchronous ref, but conditional postMessage**: `loadDrawioXml` sets `drawioXmlRef.current` synchronously but only calls `postMessage` when `drawioReady === true` — the common first-load path has `drawioReady === false` at generation time.
2. **One-shot useEffect safety net**: The `useEffect([drawioReady])` safety net fires exactly once when `drawioReady` transitions to `true`; subsequent generations after `drawioReady` is already `true` bypass it and rely entirely on the `if (drawioReady)` branch.
3. **Init before ref**: If the iframe `init` event fires before `drawioXmlRef.current` is populated (ref-sync `useEffect` hasn't run), the `init` handler sends nothing and the window closes.
4. **Stale closure capture**: `loadDrawioXml` is defined inside `compileBlueprintToDiagrams` and captures `drawioReady` at render time; interval callbacks reading the closed-over `drawioReady` will always see the stale value.

### Bug 3 — Silent Edge Skip in EA Compilers

1. **Guard exists but is silent**: All 18 EA compilers have the correct `if (!srcId || !tgtId) return;` guard, but it silently discards edges with no `console.warn`, making ID mismatches undetectable in production.
2. **LLM ID drift**: Stage 1 may generate `edge.from`/`edge.to` values that subtly differ from the `node.id` values registered in `cellMap` (e.g., casing difference, group ID vs node ID, whitespace).
3. **No validation at Blueprint boundary**: There is no cross-check between `edge.from`/`edge.to` values and the set of declared node IDs before the Blueprint JSON reaches the compiler.

### Bug 4 — Over-Aggressive Sanitizer Transforms

1. **classDef hoist gap in applyFinalPasses**: The `isFlowchartForHoist` + classDef extraction guard exists in `sanitizeMermaidCode` and partially in `applyPatterns`, but is absent from the Stage 5 nuclear split in `applyFinalPasses`, allowing `classDef actor fill:...` to be split there.
2. **Quote-unaware regex replacement**: The nuclear keyword split uses a bulk `String.replace` with a global regex that has no awareness of whether a keyword match falls inside a quoted node label — splitting mid-label is structurally equivalent to corrupting the node definition.
3. **Depth counter fragility**: The `insideSubgraph` counter uses `^end\s*$` to decrement; an unmatched `end` token (e.g., a node labelled `end`) decrements it below zero, causing real subgraph `direction` lines to be evaluated at the wrong depth — and direction strips running on C4/sequence diagrams where `direction` is a valid top-level statement.
4. **No server recovery before fallback**: The `catch (repairErr)` block jumps directly to the placeholder render; the original Blueprint JSON and the specific parse error message are both available at that point but never forwarded to the server for a targeted Stage 2 re-call.

---

## Correctness Properties

Property 1: Bug Condition — Blueprint JSON Edge Coverage

_For any_ Blueprint JSON where the bug condition holds (`isBugCondition_Bug1` returns true — edges array is empty or edge count is less than `nodeCount − 1`), the fixed `PARSER_SYSTEM` prompt SHALL produce Blueprint JSON where every node participates in at least one edge and the edge count is at least `number_of_nodes − 1`, forming a connected graph.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation — Existing Well-Formed Blueprints

_For any_ Blueprint JSON where the bug condition does NOT hold (`isBugCondition_Bug1` returns false — edges array is already well-formed), the fixed `PARSER_SYSTEM` prompt SHALL produce the same edges as before, preserving all existing connection semantics and all other strict output rules (node IDs, emoji labels, `diagramKind`, no markdown fences).

**Validates: Requirements 3.1, 3.6, 3.7**

Property 3: Bug Condition — iframe XML Always Delivered

_For any_ state where the bug condition holds (`isBugCondition_Bug2` returns true — XML is set but `drawioReady` is `false`), the fixed `loadDrawioXml` SHALL deliver the XML to the iframe within the maximum retry window (20 attempts × 300 ms = 6 seconds), either via the retry interval or the `init` handler acting as the authoritative delivery point.

**Validates: Requirements 2.4, 2.5, 2.6, 2.7**

Property 4: Preservation — Existing iframe Delivery Paths

_For any_ state where the bug condition does NOT hold (`isBugCondition_Bug2` returns false — `drawioReady` is already `true`), the fixed `loadDrawioXml` SHALL send the XML immediately via `postMessage` using the existing `{ action: "load", xml, autosave: 1 }` format, preserving all existing delivery behaviour and `save`/`autosave` event handling.

**Validates: Requirements 3.2, 3.3, 3.4, 3.8**

Property 5: Bug Condition — EA Compiler Edge Visibility

_For any_ Blueprint edge where the bug condition does NOT hold (both `edge.from` and `edge.to` are present in `cellMap`), the fixed EA compiler function SHALL render that edge as an `mxCell` in the draw.io XML output. For any edge where the bug condition holds (a node ID is missing from `cellMap`), the fixed function SHALL emit a `console.warn` identifying the missing ID, making the failure diagnosable.

**Validates: Requirements 2.8, 2.9, 2.10**

Property 6: Preservation — Non-EA Compiler Output Unchanged

_For any_ Blueprint JSON processed by the 12 base compiler functions (flowchart, ER, sequence, class, state, C4, gantt, timeline, mindmap, quadrant), the fixed code SHALL produce exactly the same draw.io XML output as the original code, with no change to their edge loop structure.

**Validates: Requirements 3.5**

Property 7: Bug Condition — Sanitizer Does Not Corrupt Valid Constructs

_For any_ Mermaid code string where the bug condition holds (`isBugCondition_Bug4` returns true — a `classDef` line contains a keyword, a node label contains a keyword, a top-level `direction` declaration is present, or all client passes have failed), the fixed sanitizer chain SHALL preserve `classDef` lines intact (hoist before splits), skip keyword splits inside quoted label strings, and not strip `direction` lines at depth 0.

**Validates: Requirements 2.11, 2.12, 2.13**

Property 8: Bug Condition — Server Re-call Before Fallback

_For any_ Mermaid code string where all client-side repair passes are exhausted and `m.render` still fails, the fixed `renderMermaidMarkup` SHALL attempt a Stage 2 server re-call to `/api/generate` with `stage: 2`, the original Blueprint JSON, and the specific parse error message before rendering the placeholder diagram. If the server re-call produces renderable code, `canvasError` SHALL remain `null`.

**Validates: Requirements 2.14, 2.15**

Property 9: Preservation — Successful Render Paths Unaffected

_For any_ Mermaid code string that renders successfully on the first `m.render` attempt, or that is successfully repaired by the auto-repair path, the fixed code SHALL produce the same SVG output as the original code without triggering any repair pass or server re-call.

**Validates: Requirements 3.9, 3.10, 3.11, 3.12, 3.13**

---

## Fix Implementation

### Changes Required

#### Fix 1 — PARSER_SYSTEM Edge Generation Rules

**File**: `app/api/generate/route.ts`

**Target**: The `PARSER_SYSTEM` template literal at the top of the file.

**Specific Changes:**
1. **Add Rule 7 — Mandatory Connections**: Insert after existing rule 6 (the MANDATORY LABEL ICONS rule):
   ```
   7. MANDATORY CONNECTIONS — EDGES ARE REQUIRED:
      Every node MUST appear in at least one edge as either "from" or "to". An isolated node with no connections is a critical error.
      MINIMUM edge count = number_of_nodes - 1 (enough to form a fully connected graph).
      For typical diagrams: if you have 10 nodes, you MUST produce at least 9 edges (and ideally 12-20 to reflect realistic data flows).
      Every edge "from" and "to" value MUST reference a node ID that is declared in the "groups" array above.
      Do NOT produce a blueprint with an empty "edges" array unless the diagram has exactly 1 node.
   ```
2. **Annotate the `edges` schema field** with an inline comment: `// REQUIRED — must have at least (number_of_nodes - 1) entries; every node must appear in at least one edge`
3. **Add per-diagram-kind edge guidance block** to the Classification Guidance section with concrete edge examples for all 16 diagram kinds (flowchart, sequence, er, bpmn, archimate, dfd, vsm, capability_map, network_topology, deployment, component, use_case, activity, swimlane, it_roadmap, service_blueprint).

#### Fix 2 — Reliable draw.io iframe XML Delivery

**File**: `app/page.tsx`

**Specific Changes:**
1. **Add `drawioRetryRef`**: New module-level ref `const drawioRetryRef = useRef<ReturnType<typeof setInterval> | null>(null)` to track pending retry intervals.
2. **Add `drawioReadyRef`**: New ref `const drawioReadyRef = useRef(false)` mirroring `drawioReady` state, plus a `useEffect` to keep it current. Used inside interval callbacks to avoid stale closure capture.
3. **Replace `loadDrawioXml`**: Rewrite to always set `drawioXmlRef.current = xml` synchronously, then either send immediately if `drawioReadyRef.current` is true, or install a 300 ms retry interval (max 20 attempts = 6 s) that reads `drawioReadyRef.current`.
4. **Harden `init` handler**: Add `clearInterval(drawioRetryRef.current)` at the start of the `case "init":` branch (before the existing unconditional `postMessage` if ref is set).
5. **Add unmount cleanup**: New `useEffect(() => () => { clearInterval(drawioRetryRef.current) }, [])` to prevent memory leaks.
6. **Remove redundant `useEffect([drawioReady])`**: The retry mechanism supersedes the one-shot safety net; remove it to avoid double-sending.

#### Fix 3 — EA Compiler `cellMap` Diagnostic Warnings

**File**: `lib/drawioCompiler.ts`

**Specific Changes:**
1. **Add `console.warn` to all 18 EA compiler edge guards**: In every EA compiler function, change the silent `return` in the `if (!srcId || !tgtId) return;` guard to emit a warning first:
   ```typescript
   if (!srcId || !tgtId) {
     console.warn(`[drawioCompiler] Edge skipped — node ID not in cellMap. from="${edge.from}" (${srcId ? "ok" : "MISSING"}) to="${edge.to}" (${tgtId ? "ok" : "MISSING"})`);
     return;
   }
   ```
   Applies to: `compileArchimateView`, `compileBpmnDiagram`, `compileDfdDiagram`, `compileVsmDiagram`, `compileCapabilityMap`, `compileNetworkTopology`, `compileDeploymentDiagram`, `compileComponentDiagram`, `compileUseCaseDiagram`, `compileActivityDiagram`, `compileCommunicationDiagram`, `compilePackageDiagram`, `compileObjectDiagram`, `compileTimingDiagram`, `compileInteractionOverview`, `compileItRoadmap`, `compileServiceBlueprint`, `compileSwimlaneDiagram`.

#### Fix 4 — Surgical Sanitizer and Server-Side Stage 2 Re-generation Fallback

**File**: `app/page.tsx`

**Specific Changes:**
1. **4A — Hoist `classDef` in `applyFinalPasses` Stage 5**: Add the `isFlowchartForHoist` + `classDef` extraction pattern before the Stage 5 nuclear split loop (already present in `sanitizeMermaidCode` and partially in `applyPatterns`; missing from `applyFinalPasses`).
2. **4B — Quote-aware nuclear split helpers**: Add `isInsideQuotes(line, matchIndex)` and `splitKeywordOutsideQuotes(line, kw)` helper functions above `renderMermaidMarkup`; replace bulk `String.replace` calls in all nuclear split loops with per-line invocations of these helpers.
3. **4C — Guard direction strip to flowchart diagrams only**: Wrap the `insideSubgraph` depth-tracking direction strip in a `isFlowchartForDirection` guard (first non-comment line starts with `flowchart` or `graph `). For all other diagram types, skip the strip entirely since `direction` is a valid top-level statement there.
4. **4D — Server re-call before fallback**: In `renderMermaidMarkup`'s `catch (repairErr)` block, before rendering the placeholder, attempt a `fetch("/api/generate", { method: "POST", body: JSON.stringify({ stage: 2, blueprint: lastBlueprint, errorContext: repairErr.message }) })`. If the response contains valid Mermaid code that renders, set `mermaidCode` and `canvasError = null`; only fall through to placeholder if the server re-call also fails.

**File**: `app/api/generate/route.ts`

**Specific Changes:**
5. **4E — Accept `errorContext` in Stage 2 handler**: In the `stage === 2` branch of the POST handler, destructure `errorContext` from the request body; if present, append a `CRITICAL CORRECTION REQUIRED` block to `compilerPrompt` that includes the specific parse error and targeted correction instructions.

---

## Architecture

### Affected Files

| File | Bug | Change Type |
|------|-----|-------------|
| `app/api/generate/route.ts` | Bug 1 | Add edge-generation rules to `PARSER_SYSTEM` string |
| `app/page.tsx` | Bug 2 | Replace `loadDrawioXml` with retry-based delivery; harden `init` handler |
| `lib/drawioCompiler.ts` | Bug 3 | Add `console.warn` to edge skip guards across all 18 EA compilers |
| `app/page.tsx` | Bug 4 | Make sanitizer surgical (hoist classDef, protect labels, fix depth tracking); add server-side Stage 2 re-generation fallback |
| `app/api/generate/route.ts` | Bug 4 | Accept `errorContext` field in `stage: 2` payload; pass it to `buildCompilerPrompt` |

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fixes. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate each bug condition (empty Blueprint edges, race condition state, cellMap key mismatches, corrupting Mermaid strings) and assert the expected correct behavior. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases:**
1. **Bug 1 — Edgeless Blueprint**: Call `PARSER_SYSTEM` with a multi-node prompt; assert `edges.length >= nodes.length - 1` (will fail on unfixed code).
2. **Bug 2 — Iframe Race**: Simulate `loadDrawioXml(xml)` called when `drawioReady === false`; assert iframe eventually receives the XML (will fail on unfixed code — XML silently discarded).
3. **Bug 3 — cellMap Lookup**: Call an EA compiler with a Blueprint whose edge references a valid node ID; assert the mxCell edge appears in the output (may already pass if cellMap is correct; will reveal warnings with fix).
4. **Bug 4A — classDef Split**: Pass `classDef actor fill:#0c1524` through `sanitizeMermaidCode`; assert the line is returned intact (will fail on unfixed code — splits to orphaned CSS).
5. **Bug 4B — Label Split**: Pass `svc["📋 Section Overview"]` through sanitizer; assert the node definition is not split (will fail on unfixed code).
6. **Bug 4C — Direction Strip**: Pass a C4 diagram with `direction TD` as top-level statement; assert it is not stripped (will fail on unfixed code).
7. **Bug 4D — No Server Recovery**: Trigger all client passes to fail; assert server re-call is attempted before placeholder is rendered (will fail on unfixed code).

**Expected Counterexamples:**
- Blueprint JSON with `edges: []` for multi-node prompts — confirms Bug 1 root cause.
- `postMessage` never called when `drawioReady === false` — confirms Bug 2 root cause.
- No `console.warn` emitted for missing cellMap entries — confirms Bug 3 root cause.
- Sanitizer output contains `\nactor fill:` fragments — confirms Bug 4A root cause.
- No fetch to `/api/generate` in the fallback path — confirms Bug 4D root cause.

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode (all four bugs):**
```
FOR ALL blueprint WHERE isBugCondition_Bug1(blueprint) DO
  result ← PARSER_SYSTEM'(prompt)
  ASSERT LENGTH(result.edges) >= LENGTH(FLATTEN(result.groups[*].nodes)) - 1
  ASSERT FOR ALL node IN FLATTEN(result.groups[*].nodes):
           EXISTS edge IN result.edges WHERE edge.from = node.id OR edge.to = node.id
END FOR

FOR ALL state WHERE isBugCondition_Bug2(state) DO
  result ← loadDrawioXml'(xml)
  ASSERT iframe_received_xml(result) = true WITHIN max_retry_attempts
END FOR

FOR ALL (blueprint, edge) WHERE NOT isBugCondition_Bug3(blueprint, edge) DO
  xml ← compileEaDiagram'(blueprint)
  ASSERT xml CONTAINS mxCell WITH source=cellMap[edge.from] AND target=cellMap[edge.to]
END FOR

FOR ALL mermaidCode WHERE isBugCondition_Bug4(mermaidCode) DO
  result ← sanitizeMermaidCode'(mermaidCode)
  ASSERT classDef_lines_intact(result)
  ASSERT node_labels_intact(result)
  ASSERT top_level_direction_preserved(result)
  ASSERT server_recall_was_attempted(renderMermaidMarkup'(mermaidCode)) = true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where each bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL blueprint WHERE NOT isBugCondition_Bug1(blueprint) DO
  ASSERT PARSER_SYSTEM(prompt).edges = PARSER_SYSTEM'(prompt).edges
END FOR

FOR ALL state WHERE NOT isBugCondition_Bug2(state) DO
  ASSERT loadDrawioXml(xml) = loadDrawioXml'(xml)
END FOR

FOR ALL blueprint WHERE blueprint.edges IS WELL_FORMED DO
  ASSERT compileEaDiagram(blueprint).edgeCount = compileEaDiagram'(blueprint).edgeCount
END FOR

FOR ALL mermaidCode WHERE NOT isBugCondition_Bug4(mermaidCode) DO
  ASSERT renderMermaidMarkup(mermaidCode) = renderMermaidMarkup'(mermaidCode)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because it generates many test cases automatically, catches edge cases that manual unit tests might miss, and provides strong guarantees that behavior is unchanged for all non-buggy inputs.

**Test Cases:**
1. **Edge Preservation**: Blueprint with well-formed edges → both Mermaid canvas and draw.io output contain exactly those edges.
2. **Iframe No-Op**: `loadDrawioXml` called when `drawioReady === true` → single immediate `postMessage`, no retry interval started.
3. **save/autosave Preservation**: iframe `save` and `autosave` events → `drawioXML` state updated and SVG-export round-trip triggered as before.
4. **Base Compiler Preservation**: Flowchart/ER/sequence/class/state/C4/gantt/timeline/mindmap/quadrant blueprints → identical draw.io XML before and after fix.
5. **Sanitizer Happy Path**: Valid Mermaid code that renders on first attempt → no repair pass triggered, no server re-call.
6. **Auto-Repair Preservation**: Code that fails first render but succeeds after `applyFinalPasses(applyPatterns(...))` → SVG returned, no server re-call.

### Unit Tests

- Test `isBugCondition_Bug1` with blueprints of various edge counts.
- Test `loadDrawioXml` with `drawioReady === false` and verify retry interval is started and cancelled correctly.
- Test `loadDrawioXml` with `drawioReady === true` and verify single immediate `postMessage`.
- Test each EA compiler with a Blueprint whose edges have valid `cellMap` entries — assert all edges appear in output.
- Test `sanitizeMermaidCode` with `classDef actor fill:...` — assert line is returned intact.
- Test nuclear keyword split with quoted labels containing keywords — assert labels are not split.
- Test direction strip with C4 `direction TD` top-level — assert line is preserved.
- Test `renderMermaidMarkup` fallback path — assert fetch to `/api/generate` is called before placeholder.

### Property-Based Tests

- Generate random Blueprint JSON with varying node/edge counts; verify fixed `PARSER_SYSTEM` always satisfies the connectivity invariant.
- Generate random `drawioReady` / timing combinations; verify XML always reaches the iframe.
- Generate random Blueprint edges with mixed valid/invalid `from`/`to` IDs; verify EA compilers emit warnings for invalid and render correctly for valid.
- Generate random Mermaid strings containing `classDef` lines and quoted labels with keywords; verify sanitizer output is structurally valid.
- Generate random inputs NOT matching any bug condition; verify all four fixed functions produce identical output to the originals.

### Integration Tests

- End-to-end: Submit a multi-node architecture prompt; verify Mermaid canvas shows arrows and draw.io iframe shows connected diagram.
- Timing: Hard-refresh page, immediately generate diagram; verify draw.io iframe displays the diagram rather than blank state.
- EA types: Generate BPMN, ArchiMate, Network Topology diagrams; verify draw.io output contains connections.
- Sanitizer: Generate a diagram that triggers the classDef split path; verify the diagram renders without error.
- Recovery: Force all client render passes to fail; verify a server re-call is attempted and the recovered diagram is shown if the re-call succeeds.

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
                                            → if drawioReadyRef.current: send immediately
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

## Detailed Implementation Reference

The following sections provide verbatim code samples for each fix, for direct use during implementation.

### Fix 1 — PARSER_SYSTEM Rule 7 and Schema Annotation

**New Rule 7 to add to PARSER_SYSTEM (after rule 6):**

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

**Edge Generation by Diagram Kind (append to Classification Guidance section):**

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

### Fix 2 — Reliable draw.io iframe XML Delivery

**New refs (add near other refs at top of component):**

```typescript
const drawioRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);
const drawioReadyRef = useRef(false);
useEffect(() => { drawioReadyRef.current = drawioReady; }, [drawioReady]);
```

**Replacement `loadDrawioXml`:**

```typescript
const loadDrawioXml = (xml: string) => {
  drawioXmlRef.current = xml;
  setDrawioXML(xml);
  setDrawioStatus("loaded");

  const sendToIframe = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "load", xml, autosave: 1 }),
      "*"
    );
  };

  if (drawioReadyRef.current) {
    sendToIframe();
  } else {
    if (drawioRetryRef.current) {
      clearInterval(drawioRetryRef.current);
      drawioRetryRef.current = null;
    }
    let attempts = 0;
    const MAX_ATTEMPTS = 20;
    drawioRetryRef.current = setInterval(() => {
      attempts++;
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage(
          JSON.stringify({ action: "load", xml, autosave: 1 }),
          "*"
        );
      }
      if (drawioReadyRef.current || attempts >= MAX_ATTEMPTS) {
        clearInterval(drawioRetryRef.current!);
        drawioRetryRef.current = null;
      }
    }, 300);
  }
};
```

**Hardened `init` handler:**

```typescript
case "init":
  setDrawioReady(true);
  setDrawioStatus("loaded");
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

**Unmount cleanup:**

```typescript
useEffect(() => {
  return () => {
    if (drawioRetryRef.current) {
      clearInterval(drawioRetryRef.current);
    }
  };
}, []);
```

### Fix 3 — EA Compiler Diagnostic Warning

**Pattern to apply in all 18 EA compiler edge loops:**

```typescript
edges.forEach((edge) => {
  const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
  if (!srcId || !tgtId) {
    console.warn(`[drawioCompiler] Edge skipped — node ID not in cellMap. from="${edge.from}" (${srcId ? "ok" : "MISSING"}) to="${edge.to}" (${tgtId ? "ok" : "MISSING"})`);
    return;
  }
  // ... render edge (unchanged)
});
```

### Fix 4A — Hoist classDef in `applyFinalPasses` Stage 5

Apply the same pattern already present in `sanitizeMermaidCode`: extract `classDef` lines, run nuclear splits on the remaining body, re-append `classDef` lines.

### Fix 4B — Quote-Aware Nuclear Split Helpers

```typescript
const isInsideQuotes = (line: string, matchIndex: number): boolean => {
  let insideQuote = false;
  for (let i = 0; i < matchIndex; i++) {
    if (line[i] === '"') insideQuote = !insideQuote;
  }
  return insideQuote;
};

const splitKeywordOutsideQuotes = (line: string, kw: string): string => {
  if (/^\s*classDef\b/i.test(line.trim())) return line;
  const re = new RegExp(`([a-zA-Z0-9_])(${kw}(?=\\s|$))`, "gi");
  let result = "";
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(line)) !== null) {
    const matchStart = match.index;
    if (!isInsideQuotes(line, matchStart + 1)) {
      result += line.slice(lastIndex, matchStart + 1) + "\n";
      lastIndex = matchStart + 1;
    }
  }
  result += line.slice(lastIndex);
  return result;
};
```

### Fix 4C — Direction Strip Scoped to Flowchart Only

```typescript
{
  const firstLineLower = clean.split("\n")
    .find(l => l.trim() && !l.trim().startsWith("%%"))?.trim()?.toLowerCase() || "";
  const isFlowchartForDirection =
    firstLineLower.startsWith("flowchart") || firstLineLower.startsWith("graph ");

  if (isFlowchartForDirection) {
    const lines = clean.split("\n");
    let insideSubgraph = 0;
    const filtered = lines.filter(line => {
      const t = line.trim();
      if (/^subgraph\b/i.test(t)) { insideSubgraph++; return true; }
      if (/^end\s*$/i.test(t) && insideSubgraph > 0) { insideSubgraph--; return true; }
      if (insideSubgraph > 0 && /^direction\s+(?:TD|LR|TB|BT|RL)\s*$/i.test(t)) return false;
      return true;
    });
    clean = filtered.join("\n");
  }
}
```

### Fix 4D — Server Re-call Before Fallback

```typescript
} catch (repairErr: any) {
  console.error("[renderMermaidMarkup] Repair also failed:", repairErr);

  try {
    console.warn("[renderMermaidMarkup] Attempting server-side Stage 2 re-generation with error context...");
    const recoveryRes = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: 2,
        blueprint: lastBlueprint,
        errorContext: repairErr.message || String(repairErr),
      }),
    });
    if (recoveryRes.ok) {
      const { mermaid: recoveredCode } = await recoveryRes.json();
      if (recoveredCode) {
        const cleanedRecovery = sanitizeMermaidCode(recoveredCode);
        const recoveryRenderId = "mermaid-render-recovery-" + Math.random().toString(36).substring(2, 9);
        try {
          const { svg: recoverySvg } = await m.render(recoveryRenderId, cleanedRecovery);
          setMermaidCode(cleanedRecovery);
          setCanvasSvg(recoverySvg);
          setCanvasError(null);
          setTimeout(() => { autoFitDiagramView(); }, 50);
          return recoverySvg;
        } catch (recoveryRenderErr) {
          console.warn("[renderMermaidMarkup] Recovery render also failed:", recoveryRenderErr);
        }
      }
    }
  } catch (serverErr) {
    console.warn("[renderMermaidMarkup] Server re-call failed:", serverErr);
  }

  // Final fallback: render minimal valid diagram
  try {
    const fallbackId = "mermaid-render-fallback-" + Math.random().toString(36).substring(2, 9);
    const fallbackCode = `flowchart TD\n  note["⚠️ Diagram syntax issue — please try regenerating"]\n  classDef service fill:#1a2540,stroke:#5b8df8,color:#e4eaf8,stroke-width:2px;\n  class note service`;
    const { svg: fallbackSvg } = await m.render(fallbackId, fallbackCode);
    setCanvasSvg(fallbackSvg);
    setCanvasError("Diagram had a syntax issue and was regenerated in fallback mode. Try regenerating for the full diagram.");
    return fallbackSvg;
  } catch {
    setCanvasError(
      `Diagram rendering failed.\n\nError: ${repairErr.message || repairErr}\n\nGenerated code (first 500 chars):\n${repairedCode.slice(0, 500)}`
    );
    const badElem = document.getElementById(renderId);
    if (badElem) badElem.remove();
    return null;
  }
}
```

### Fix 4E — Accept `errorContext` in Stage 2 Route Handler

```typescript
if (stage === 2) {
  const { blueprint, errorContext } = body;
  const kind = blueprint?.diagramKind ?? "flowchart";
  const direction = blueprint?.direction ?? "TD";

  let compilerPrompt = buildCompilerPrompt(kind, direction);

  if (errorContext) {
    compilerPrompt += `\n\n══════════════════════════════════════════════
CRITICAL CORRECTION REQUIRED
══════════════════════════════════════════════
The previous generation attempt produced Mermaid code that failed to parse with this error:
  "${errorContext}"
You MUST produce corrected code that avoids this specific error. Pay particular attention to:
- Ensuring every statement is on its own line
- Ensuring \`direction\` is never attached to another token
- Ensuring all node labels with special characters are in double quotes
- Not adding classDef or class statements to non-flowchart diagram types
`;
  }

  // ... rest of stage 2 handler using compilerPrompt
}
```
