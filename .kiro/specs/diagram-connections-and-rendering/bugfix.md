# Bugfix Requirements Document

## Introduction

Three interconnected bugs in ArchPrompt cause diagrams to render with disconnected nodes, the draw.io iframe to show blank content on first load, and EA diagram type compilers to silently drop edges when `cellMap` key lookups fail. Together these bugs mean most demo prompts produce visually broken diagrams in both the Mermaid canvas and the draw.io editor.

---

## Bug Analysis

### Current Behavior (Defect)

**Bug 1 — Stage 1 (PARSER_SYSTEM) generates Blueprint JSON without edges**

1.1 WHEN a user submits any natural language prompt, THEN the system produces Blueprint JSON where the `edges` array is empty or contains far fewer edges than the number of nodes, resulting in disconnected diagrams throughout the pipeline.

1.2 WHEN a demo example prompt from the `EXAMPLES` object in `app/page.tsx` is used, THEN the system generates Blueprint JSON with isolated nodes and no connections, because the `PARSER_SYSTEM` prompt contains no instructions mandating edge generation.

1.3 WHEN the Stage 2 Mermaid compiler receives Blueprint JSON with no edges, THEN the system renders a Mermaid diagram with isolated, floating nodes on the canvas despite RULE 8 ("EVERY DIAGRAM MUST HAVE CONNECTIONS") being present in the `buildCompilerPrompt` function.

1.4 WHEN the Stage 3 draw.io compiler (`compileBlueprintToDrawio`) receives Blueprint JSON with no edges, THEN the system produces draw.io XML with nodes but no `mxCell` edge elements, because the compiler is deterministic and only renders what the Blueprint JSON contains.

**Bug 2 — draw.io iframe does not reliably receive the compiled XML**

1.5 WHEN a diagram is generated on initial page load and `drawioReady` is still `false` at the time `loadDrawioXml()` is called, THEN the system silently skips the `postMessage` call and the iframe shows a blank state, because `loadDrawioXml()` only sends the message when `drawioReady === true`.

1.6 WHEN the `useEffect` safety net for `drawioReady` fires and re-sends the XML via `postMessage`, THEN the system may still show a blank or stale diagram if the iframe's `init` event has not fired yet or fired before `drawioXmlRef.current` was set, due to the timing race between state update and ref assignment.

1.7 WHEN the draw.io `init` event fires after `drawioXmlRef.current` has been set, THEN the system correctly sends the XML — but if `init` fires before `drawioXmlRef.current` is populated (because `setDrawioXML` has not yet caused the ref-sync `useEffect` to run), THEN the system sends nothing.

**Bug 3 — EA diagram compiler `cellMap` key mismatches cause missing edges in draw.io output**

1.8 WHEN `compileBpmnDiagram`, `compileArchimateView`, `compileCapabilityMap`, `compileNetworkTopology`, `compileDeploymentDiagram`, `compileComponentDiagram`, or `compileUseCaseDiagram` processes a Blueprint JSON where nodes are nested inside groups, THEN the system registers node IDs in `cellMap` using the correct `node.id` key, but edges whose `from`/`to` values match a node ID that shares the same string as a group ID (or any other collision) are silently dropped because `cellMap[edge.from]` returns `undefined`.

1.9 WHEN `compileDfdDiagram`, `compileVsmDiagram`, `compileActivityDiagram`, `compileCommunicationDiagram`, or any compiler that flattens nodes into a single list (bypassing group containers) processes Blueprint JSON, THEN the system still keys nodes by `node.id` in `cellMap`, but if the LLM-generated `edge.from` or `edge.to` references an ID from a flattened group that was not registered (e.g., an orphan or mis-cased ID), THEN the edge is silently skipped and the draw.io output is missing connections.

---

### Expected Behavior (Correct)

**Fix 1 — PARSER_SYSTEM must mandate edge generation**

2.1 WHEN a user submits any natural language prompt, THEN the system SHALL produce Blueprint JSON where every node participates in at least one edge, with a minimum of `(number_of_nodes − 1)` edges sufficient to form a connected graph.

2.2 WHEN a demo example prompt is used, THEN the system SHALL produce Blueprint JSON with edges connecting all nodes in a semantically meaningful way, ensuring neither the Mermaid canvas nor the draw.io compiler receives an edgeless blueprint.

2.3 WHEN the Stage 1 `PARSER_SYSTEM` prompt produces Blueprint JSON for any `diagramKind`, THEN the system SHALL include explicit rules stating: (a) every node must appear in at least one edge's `from` or `to` field; (b) the minimum edge count is `number_of_nodes − 1`; and (c) all `edge.from` and `edge.to` values must reference declared node IDs.

**Fix 2 — draw.io iframe XML delivery must be reliable regardless of timing**

2.4 WHEN `loadDrawioXml()` is called with a valid XML string, THEN the system SHALL always synchronously set `drawioXmlRef.current = xml` before any other operation, ensuring the ref is available to the `init` handler regardless of React rendering timing.

2.5 WHEN `loadDrawioXml()` is called and `drawioReady` is `false`, THEN the system SHALL NOT silently discard the XML; instead, the system SHALL attempt to deliver the XML via a retry mechanism (e.g., `setInterval` polling up to a configurable maximum number of attempts) that keeps trying to send the `postMessage` until the iframe acknowledges receipt or a timeout is reached.

2.6 WHEN the draw.io `init` event fires, THEN the system SHALL always send the current `drawioXmlRef.current` value via `postMessage` unconditionally, acting as a reliable fallback that covers the case where XML was set before `init` fired.

2.7 WHEN the retry mechanism successfully delivers the XML to the iframe, THEN the system SHALL cancel the retry interval to avoid redundant `postMessage` calls.

**Fix 3 — EA diagram compilers must produce complete connected graphs**

2.8 WHEN any EA-specific compiler function (`compileBpmnDiagram`, `compileArchimateView`, `compileCapabilityMap`, `compileNetworkTopology`, `compileDeploymentDiagram`, `compileComponentDiagram`, `compileUseCaseDiagram`, `compileDfdDiagram`, `compileVsmDiagram`, `compileActivityDiagram`, `compileCommunicationDiagram`, `compilePackageDiagram`, `compileObjectDiagram`, `compileTimingDiagram`, `compileInteractionOverview`, `compileItRoadmap`, `compileServiceBlueprint`, `compileSwimlaneDiagram`) processes Blueprint JSON, THEN the system SHALL verify that `cellMap[edge.from]` and `cellMap[edge.to]` are both defined before attempting to render an edge, and SHALL emit a `console.warn` for any edge whose source or target node ID is not found in `cellMap`.

2.9 WHEN a compiler flattens nodes from all groups into a single list before rendering, THEN the system SHALL register every flattened node's `node.id` in `cellMap` before processing any edge, ensuring referential integrity for all `edge.from` and `edge.to` lookups.

2.10 WHEN a compiler uses group containers (swimlanes) and registers nodes as children of those containers, THEN the system SHALL register both the group ID (`cellMap[grp.id]`) and every child node ID (`cellMap[node.id]`) in `cellMap` before the edge-rendering pass executes.

---

### Unchanged Behavior (Regression Prevention)

3.1 WHEN Blueprint JSON already contains a well-formed `edges` array with valid `from`/`to` references, THEN the system SHALL CONTINUE TO render all those edges correctly in both the Mermaid canvas and the draw.io iframe without duplication or modification.

3.2 WHEN the draw.io `init` event fires and `drawioXmlRef.current` is `null` (no diagram has been generated yet), THEN the system SHALL CONTINUE TO remain in the `empty` draw.io status without sending any `postMessage` or triggering errors.

3.3 WHEN the draw.io iframe is already in the `loaded` state and a new diagram is generated, THEN the system SHALL CONTINUE TO deliver the new XML via `postMessage` using the existing `load` action format (`{ action: "load", xml, autosave: 1 }`).

3.4 WHEN the `save` and `autosave` draw.io iframe events fire, THEN the system SHALL CONTINUE TO update `drawioXML` state and trigger the SVG-export round-trip that syncs the canvas with the iframe edits.

3.5 WHEN existing diagram types (`flowchart`, `sequence`, `er`, `class`, `state`, `c4context`, `c4container`, `c4component`, `gantt`, `timeline`, `mindmap`, `quadrant`) are compiled by their respective functions in `drawioCompiler.ts`, THEN the system SHALL CONTINUE TO produce the same draw.io XML output as before the fix.

3.6 WHEN the `PARSER_SYSTEM` edge-generation rules are added, THEN the system SHALL CONTINUE TO respect all existing strict output rules (no markdown fences, raw JSON only, valid node IDs matching `[a-zA-Z][a-zA-Z0-9_]*`, emoji-prefixed labels, `diagramKind` classification).

3.7 WHEN the Stage 2 `buildCompilerPrompt` RULE 8 ("EVERY DIAGRAM MUST HAVE CONNECTIONS") fires for a Blueprint JSON that already has edges, THEN the system SHALL CONTINUE TO use those edges to produce correctly connected Mermaid code rather than inventing new connections.

3.8 WHEN the retry mechanism is active and the user navigates away or unmounts the component, THEN the system SHALL CONTINUE TO clean up the interval via the React `useEffect` cleanup function to prevent memory leaks.

---

**Bug 4 — Mermaid sanitizer fallback: speculative regex transforms corrupt valid code and exhaust repair passes**

1.10 WHEN the sanitizer chain (`sanitizeMermaidCode` → `applyPatterns` → `applyFinalPasses`) applies the nuclear keyword split to a `classDef` line that contains a Mermaid keyword as part of a class name (e.g. `classDef actor fill:...`), THEN the system splits the line into `classDef\nactor fill:...`, producing an orphaned CSS fragment that the renderer cannot parse, which consumes a repair pass without making progress toward a valid diagram.

1.11 WHEN the sanitizer chain applies the nuclear keyword split to a flowchart node label that contains a Mermaid keyword (e.g. a node labelled `"🚀 Actor Service"` or `"📋 Section Overview"`), THEN the system splits the node definition mid-label, corrupting the node syntax and causing the renderer to fail on input that was structurally valid before sanitization.

1.12 WHEN the direction-inside-subgraph strip pass (`insideSubgraph > 0 && /^direction\s+...$/`) processes Mermaid code that uses `direction TD` as a standalone top-level statement (not inside any subgraph), THEN the system may erroneously count subgraph depth and strip the `direction` line, removing a valid structural declaration and causing the diagram type header to have no direction value.

1.13 WHEN all client-side repair passes (primary `sanitizeMermaidCode`, secondary `applyPatterns`, repair attempt via `applyFinalPasses(applyPatterns(...))`) are exhausted and `m.render` still throws, THEN the system renders a single-node placeholder diagram (`flowchart TD\n  note["⚠️ Diagram syntax issue..."]`) and sets `canvasError` to `"Diagram had a syntax issue and was regenerated in fallback mode. Try regenerating for the full diagram."`, giving the user an error banner with no actual diagram content and no server-side recovery attempt.

1.14 WHEN the fallback path is reached because client-side sanitization produced corrupt Mermaid code (due to over-aggressive regex transforms in 1.10–1.12), THEN the system makes no further attempt to recover the original generated Mermaid code from the server, even though the original raw code from Stage 2 (before client-side mutations) may have been valid or close to valid and recoverable via a targeted server-side re-generation call with the specific parse error provided as context.

---

### Expected Behavior (Correct)

**Fix 4 — Surgical sanitizer and server-side re-generation fallback**

2.11 WHEN the sanitizer chain encounters a `classDef` line, THEN the system SHALL hoist that line out of scope before running any nuclear keyword split passes, process all other lines through the split passes, and re-append the `classDef` line after splits complete, so that class names containing Mermaid keywords (e.g. `actor`, `service`, `class`) are never split mid-line.

2.12 WHEN the nuclear keyword split pass runs, THEN the system SHALL skip any line whose trimmed content is entirely within a quoted string context (i.e., the keyword appears only inside double-quoted label text and not in the structural token position), so that node labels containing words like `"actor"`, `"section"`, or `"end"` are not corrupted by word-boundary splits.

2.13 WHEN the direction-inside-subgraph strip pass runs, THEN the system SHALL only strip `direction` lines whose preceding `subgraph` was opened and whose matching `end` has not yet been seen (strict depth tracking), ensuring that `direction` lines at depth 0 (top-level scope, outside any subgraph) are never stripped.

2.14 WHEN all client-side repair passes are exhausted and `m.render` still fails, THEN the system SHALL make a Stage 2 re-call to the `/api/generate` endpoint with `stage: 2`, passing: (a) the original Blueprint JSON unchanged, (b) the specific parse error message from the final `m.render` failure, and (c) an instruction to produce corrected Mermaid code avoiding the specific error pattern — before falling back to the placeholder diagram.

2.15 WHEN the server-side Stage 2 re-call in 2.14 returns corrected Mermaid code, THEN the system SHALL attempt `m.render` on the corrected code one final time; if that render succeeds, the system SHALL update `mermaidCode` state and `canvasError` SHALL remain `null` (no error banner shown); if that render also fails, only then SHALL the system render the placeholder diagram and set `canvasError`.

---

### Unchanged Behavior (Regression Prevention)

3.9 WHEN Mermaid code passes the primary `sanitizeMermaidCode` pass without errors and renders successfully on the first `m.render` attempt, THEN the system SHALL CONTINUE TO render that diagram immediately without triggering any repair pass or server re-call.

3.10 WHEN the auto-repair path (first `applyFinalPasses(applyPatterns(...))`) successfully fixes a syntax issue and `m.render` succeeds on the repaired code, THEN the system SHALL CONTINUE TO use the repaired code and return the SVG without triggering the server-side re-call.

3.11 WHEN a `classDef` line appears in a non-flowchart diagram type, THEN the system SHALL CONTINUE TO strip that line entirely (existing behavior) rather than hoisting it, since `classDef` is only valid in flowchart diagrams.

3.12 WHEN the Stage 2 re-call for Mermaid code generation is made, THEN the system SHALL CONTINUE TO use the same model and endpoint (`/api/generate` with `stage: 2`) used by the main pipeline, and SHALL NOT alter the Blueprint JSON structure or the diagram kind during the re-call.

3.13 WHEN `canvasError` is set to the fallback message, THEN the system SHALL CONTINUE TO display the error banner with the "Try regenerating" prompt so the user always has a manual escape hatch.

---

## Bug Condition Pseudocode

### Bug 1 — Edge Absence in Blueprint JSON

```pascal
FUNCTION isBugCondition_Bug1(blueprint)
  INPUT: blueprint of type BlueprintJSON
  OUTPUT: boolean

  allNodes ← FLATTEN(blueprint.groups[*].nodes)
  nodeCount ← LENGTH(allNodes)
  edgeCount ← LENGTH(blueprint.edges)

  // Bug condition: edges array is empty OR no node participates in any edge
  IF edgeCount = 0 THEN RETURN true
  IF nodeCount > 1 AND edgeCount < nodeCount - 1 THEN RETURN true
  RETURN false
END FUNCTION

// Property: Fix Checking — every Blueprint must have a connected graph
FOR ALL blueprint WHERE isBugCondition_Bug1(blueprint) DO
  result ← PARSER_SYSTEM'(prompt)
  ASSERT LENGTH(result.edges) >= LENGTH(FLATTEN(result.groups[*].nodes)) - 1
  ASSERT FOR ALL node IN FLATTEN(result.groups[*].nodes):
           EXISTS edge IN result.edges WHERE edge.from = node.id OR edge.to = node.id
END FOR

// Property: Preservation Checking
FOR ALL blueprint WHERE NOT isBugCondition_Bug1(blueprint) DO
  ASSERT PARSER_SYSTEM(prompt).edges = PARSER_SYSTEM'(prompt).edges
END FOR
```

### Bug 2 — iframe XML Delivery Race

```pascal
FUNCTION isBugCondition_Bug2(state)
  INPUT: state of type { drawioReady: boolean, drawioXmlRefCurrent: string | null }
  OUTPUT: boolean

  // Bug condition: XML is available but iframe isn't ready yet when loadDrawioXml fires
  RETURN state.drawioXmlRefCurrent != null AND state.drawioReady = false
END FUNCTION

// Property: Fix Checking — XML must always reach the iframe
FOR ALL state WHERE isBugCondition_Bug2(state) DO
  result ← loadDrawioXml'(xml)
  ASSERT iframe_received_xml(result) = true WITHIN max_retry_attempts
END FOR

// Property: Preservation Checking
FOR ALL state WHERE NOT isBugCondition_Bug2(state) DO
  ASSERT loadDrawioXml(xml) = loadDrawioXml'(xml)
END FOR
```

### Bug 3 — cellMap Key Mismatch in EA Compilers

```pascal
FUNCTION isBugCondition_Bug3(blueprint, edge)
  INPUT: blueprint of type BlueprintJSON, edge of type Edge
  OUTPUT: boolean

  allNodeIds ← SET(FLATTEN(blueprint.groups[*].nodes)[*].id)

  // Bug condition: edge references a node ID not registered in cellMap
  RETURN edge.from NOT IN allNodeIds OR edge.to NOT IN allNodeIds
END FUNCTION

// Property: Fix Checking — every edge in Blueprint must appear in draw.io XML
FOR ALL (blueprint, edge) WHERE NOT isBugCondition_Bug3(blueprint, edge) DO
  xml ← compileEaDiagram'(blueprint)
  ASSERT xml CONTAINS mxCell WITH source=cellMap[edge.from] AND target=cellMap[edge.to]
END FOR

// Property: Preservation Checking
FOR ALL blueprint WHERE blueprint.edges IS WELL_FORMED DO
  ASSERT compileEaDiagram(blueprint).edgeCount = compileEaDiagram'(blueprint).edgeCount
END FOR
```

### Bug 4 — Sanitizer Corruption and Fallback Exhaustion

```pascal
FUNCTION isBugCondition_Bug4(mermaidCode)
  INPUT: mermaidCode of type string
  OUTPUT: boolean

  // Bug condition: sanitizer chain produces corrupt code from valid-or-repairable input
  // AND no server-side recovery is attempted when all client passes exhaust

  sanitized ← sanitizeMermaidCode(mermaidCode)
  repaired  ← applyFinalPasses(applyPatterns(sanitized))

  // Case A: nuclear split corrupted a classDef line or a node label
  containsClassDefSplit ← sanitized CONTAINS orphaned CSS fragment (e.g. "actor fill:")
  containsNodeLabelSplit ← sanitized CONTAINS split node definition mid-label

  // Case B: direction strip removed a top-level direction declaration
  topLevelDirectionStripped ← mermaidCode CONTAINS top_level_direction_declaration
                              AND sanitized DOES NOT CONTAIN that declaration

  // Case C: all passes exhausted and m.render still fails with no server re-call
  allPassesFailed ← NOT m.render_succeeds(repaired)
  noServerRecall  ← server_recall_attempted = false

  RETURN (containsClassDefSplit OR containsNodeLabelSplit OR topLevelDirectionStripped)
         OR (allPassesFailed AND noServerRecall)
END FUNCTION

// Property: Fix Checking — sanitizer must not corrupt valid constructs
FOR ALL mermaidCode WHERE isBugCondition_Bug4(mermaidCode) DO
  result ← sanitizeMermaidCode'(mermaidCode)
  ASSERT classDef_lines_intact(result)
  ASSERT node_labels_intact(result)
  ASSERT top_level_direction_preserved(result)
END FOR

// Property: Fix Checking — server re-call must be attempted before fallback
FOR ALL mermaidCode WHERE allClientPassesFailed(mermaidCode) DO
  outcome ← renderMermaidMarkup'(mermaidCode)
  ASSERT server_recall_was_attempted(outcome) = true
  // Only show placeholder if server re-call also fails
  IF server_recall_also_failed(outcome) THEN
    ASSERT canvasError_set_to_fallback_message(outcome) = true
  ELSE
    ASSERT canvasError = null AND svg_rendered(outcome) = true
  END IF
END FOR

// Property: Preservation Checking
FOR ALL mermaidCode WHERE NOT isBugCondition_Bug4(mermaidCode) DO
  ASSERT renderMermaidMarkup(mermaidCode) = renderMermaidMarkup'(mermaidCode)
END FOR
```
