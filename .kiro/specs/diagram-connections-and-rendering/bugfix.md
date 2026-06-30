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
