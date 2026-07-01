# Implementation Plan: Diagram Connections and Rendering (All Four Bugs)

## Overview

This plan covers all implementation tasks for the four bugs in the `diagram-connections-and-rendering` spec:
- **Bug 1**: PARSER_SYSTEM generates Blueprint JSON without edges
- **Bug 2**: draw.io iframe does not reliably receive the compiled XML
- **Bug 3**: EA compiler `cellMap` key mismatches cause missing edges in draw.io output
- **Bug 4**: Mermaid sanitizer fallback — over-aggressive regex transforms corrupt valid code and the system falls into a placeholder render with no server-side recovery

## Tasks

### Fix 1 — PARSER_SYSTEM Edge Generation Rules (`app/api/generate/route.ts`)

- [ ] 1.1 Add mandatory edge-generation Rule 7 to `PARSER_SYSTEM`
  Insert a numbered rule 7 into the `PARSER_SYSTEM` template literal (after existing rule 6 — the MANDATORY LABEL ICONS rule) with the following text:
  ```
  7. MANDATORY CONNECTIONS — EDGES ARE REQUIRED:
     EVERY node MUST appear in at least one edge as either "from" or "to". Isolated nodes with zero connections are a CRITICAL ERROR.
     MINIMUM edges = number_of_nodes - 1 (to form a connected graph). For a 10-node diagram, produce at least 9 edges (ideally 12-20 for realistic flows).
     ALL edge "from" and "to" values MUST reference a node ID declared in the groups array above.
     NEVER produce a blueprint with an empty "edges" array unless the diagram has exactly 1 node.
  ```

- [ ] 1.2 Annotate the `edges` field in the `PARSER_SYSTEM` JSON schema comment
  Update the inline schema comment for the `edges` array to read:
  ```
  "edges": [  // REQUIRED — minimum (number_of_nodes - 1) entries; every node MUST appear in at least one edge
  ```
  and annotate both `from` and `to` fields with `// MUST be a declared node ID from the groups array`.

- [ ] 1.3 Add the "Edge Generation by Diagram Kind" block to `PARSER_SYSTEM`
  Append a per-`diagramKind` edge guidance block after the Classification Guidance section covering all 30 diagram kinds (flowchart, sequence, er, class, state, c4context, c4container, c4component, bpmn, archimate, dfd, vsm, capability_map, network_topology, deployment, component, use_case, activity, communication, package, object, timing, interaction_overview, it_roadmap, service_blueprint, swimlane, gantt, timeline, mindmap, quadrant).

- [ ] 1.4 Verify `PARSER_SYSTEM` rule numbering is consistent after insertion
  Confirm no existing rule is re-numbered or duplicated, and that the new rule 7 is syntactically valid inside the template literal with no escaped backtick conflicts.

---

### Fix 2 — Reliable draw.io iframe XML Delivery (`app/page.tsx`)

- [ ] 2.1 Add `drawioRetryRef` module-level ref for the retry interval
  Declare `const drawioRetryRef = useRef<ReturnType<typeof setInterval> | null>(null);` at component top level alongside the other refs.

- [ ] 2.2 Add `drawioReadyRef` mirror ref to read `drawioReady` inside intervals
  Declare `const drawioReadyRef = useRef(false);` at component top level.
  Add a `useEffect` that syncs it: `useEffect(() => { drawioReadyRef.current = drawioReady; }, [drawioReady]);`

- [ ] 2.3 Replace `loadDrawioXml` with retry-based delivery
  Rewrite `loadDrawioXml(xml: string)` inside `compileBlueprintToDiagrams` to:
  1. Always set `drawioXmlRef.current = xml` synchronously first.
  2. Call `setDrawioXML(xml)` and `setDrawioStatus("loaded")`.
  3. If `drawioReadyRef.current` is true, send `postMessage` immediately.
  4. Otherwise, clear any existing `drawioRetryRef.current` interval and start a new one that attempts `postMessage` every 300ms for up to 20 attempts (6 seconds), stopping as soon as `drawioReadyRef.current` becomes true or attempts are exhausted.

- [ ] 2.4 Harden the `init` event handler in `handleDrawioMessage`
  In the `case "init":` branch:
  1. Call `setDrawioReady(true)` and `setDrawioStatus("loaded")` (existing).
  2. Clear `drawioRetryRef.current` interval if set (cancel any in-flight retry).
  3. Set `drawioRetryRef.current = null`.
  4. If `drawioXmlRef.current` is non-null, unconditionally send `postMessage({ action: "load", xml: drawioXmlRef.current, autosave: 1 })` to the iframe.

- [ ] 2.5 Add unmount cleanup effect for `drawioRetryRef`
  Add `useEffect(() => { return () => { if (drawioRetryRef.current) clearInterval(drawioRetryRef.current); }; }, []);` to prevent memory leaks when the component unmounts while a retry is in progress.

- [ ] 2.6 Remove the now-redundant `useEffect([drawioReady])` safety net
  Locate the existing `useEffect` that fires on `drawioReady` change and re-sends the XML. Remove it (the retry mechanism and hardened `init` handler fully supersede it).

---

### Fix 3 — EA Compiler `cellMap` Diagnostic Warnings (`lib/drawioCompiler.ts`)

- [ ] 3.1 Add `console.warn` to edge skip guard in `compileArchimateView`
  Change `if (!srcId || !tgtId) return;` to:
  ```typescript
  if (!srcId || !tgtId) {
    console.warn(`[drawioCompiler] Edge skipped — node ID not in cellMap. from="${edge.from}" (${srcId ? "ok" : "MISSING"}) to="${edge.to}" (${tgtId ? "ok" : "MISSING"})`);
    return;
  }
  ```

- [ ] 3.2 Add `console.warn` to edge skip guard in `compileBpmnDiagram`
  Same pattern as 3.1.

- [ ] 3.3 Add `console.warn` to edge skip guard in `compileDfdDiagram`
  Same pattern as 3.1.

- [ ] 3.4 Add `console.warn` to edge skip guard in `compileVsmDiagram`
  Same pattern as 3.1.

- [ ] 3.5 Add `console.warn` to edge skip guard in `compileCapabilityMap`
  Same pattern as 3.1.

- [ ] 3.6 Add `console.warn` to edge skip guard in `compileNetworkTopology`
  Same pattern as 3.1.

- [ ] 3.7 Add `console.warn` to edge skip guard in `compileDeploymentDiagram`
  Same pattern as 3.1.

- [ ] 3.8 Add `console.warn` to edge skip guard in `compileComponentDiagram`
  Same pattern as 3.1.

- [ ] 3.9 Add `console.warn` to edge skip guard in `compileUseCaseDiagram`
  Same pattern as 3.1.

- [ ] 3.10 Add `console.warn` to edge skip guard in `compileActivityDiagram`
  Same pattern as 3.1.

- [ ] 3.11 Add `console.warn` to edge skip guard in `compileCommunicationDiagram`
  Same pattern as 3.1.

- [ ] 3.12 Add `console.warn` to edge skip guard in `compilePackageDiagram`
  Same pattern as 3.1.

- [ ] 3.13 Add `console.warn` to edge skip guard in `compileObjectDiagram`
  Same pattern as 3.1.

- [ ] 3.14 Add `console.warn` to edge skip guard in `compileTimingDiagram`
  Same pattern as 3.1.

- [ ] 3.15 Add `console.warn` to edge skip guard in `compileInteractionOverview`
  Same pattern as 3.1.

- [ ] 3.16 Add `console.warn` to edge skip guard in `compileItRoadmap`
  Same pattern as 3.1.

- [ ] 3.17 Add `console.warn` to edge skip guard in `compileServiceBlueprint`
  Same pattern as 3.1.

- [ ] 3.18 Add `console.warn` to edge skip guard in `compileSwimlaneDiagram`
  Same pattern as 3.1.

---

### Fix 4 — Surgical Sanitizer and Server-Side Stage 2 Re-generation Fallback

#### 4A — Hoist `classDef` lines in `applyFinalPasses` before Stage 5 nuclear split (`app/page.tsx`)

- [ ] 4.1 Add `classDef` hoist block at the start of the Stage 5 nuclear keyword loop inside `applyFinalPasses`
  Before the `const KW5 = [...]` array and its loop, add the same `isFlowchartForHoist` detection and line-extraction logic that already exists at the start of `applyPatterns`:
  1. Detect whether the first meaningful line is `flowchart` or `graph `.
  2. If so, separate out all lines matching `/^classDef\b/i` into a `savedClassDefs` array and all lines matching `/^class\s+\w+\s+\w+/i` into `savedClassAssigns`, removing them from `s`.
  3. Run the Stage 5 KW loop only on the remaining body lines.
  4. Re-append `savedClassDefs` and `savedClassAssigns` at the end of `s` after the loop.

#### 4B — Make nuclear keyword split quote-aware (`app/page.tsx`)

- [ ] 4.2 Add `isInsideQuotes` helper function above `renderMermaidMarkup`
  ```typescript
  const isInsideQuotes = (line: string, pos: number): boolean => {
    let inside = false;
    for (let i = 0; i < pos; i++) {
      if (line[i] === '"') inside = !inside;
    }
    return inside;
  };
  ```

- [ ] 4.3 Refactor the nuclear keyword split in `sanitizeMermaidCode` to be quote-aware
  Replace the current `clean.replace(new RegExp(...), "$1\n$2")` pattern in the nuclear pre-pass with a per-line, per-keyword approach that calls `isInsideQuotes` at the match position and skips the split when the keyword match falls inside quoted text.
  Also add a guard: skip any line matching `/^\s*classDef\b/i` entirely in the nuclear pass (classDef is hoisted separately).

- [ ] 4.4 Apply the same quote-aware split refactor in `applyPatterns` nuclear pre-pass
  Same change as 4.3 applied to the nuclear pre-pass block inside `applyPatterns`.

- [ ] 4.5 Apply the same quote-aware split refactor in `applyFinalPasses` Stage 5 loop
  After the classDef hoist from 4.1, apply the same quote-aware logic to the Stage 5 nuclear KW loop.

#### 4C — Guard direction-inside-subgraph strip to flowchart diagrams only (`app/page.tsx`)

- [ ] 4.6 Add flowchart type guard to direction strip in `sanitizeMermaidCode`
  Wrap the existing `insideSubgraph` depth counter and direction-strip filter block with:
  ```typescript
  const isFlowchartForDirStrip = firstMeaningfulLine.startsWith("flowchart") || firstMeaningfulLine.startsWith("graph ");
  if (isFlowchartForDirStrip) {
    // existing direction strip logic
  }
  ```
  where `firstMeaningfulLine` is the already-computed first non-comment line (reuse the variable already in scope).

- [ ] 4.7 Add the same flowchart type guard to direction strip in `applyPatterns`
  Same change as 4.6, using the `firstLineForHoist` variable already computed at the start of `applyPatterns`.

#### 4D — Server-side Stage 2 re-call before fallback (`app/page.tsx`)

- [ ] 4.8 Add server-side Stage 2 re-call block before the placeholder fallback in `renderMermaidMarkup`
  In the `catch (repairErr: any)` block (after both `m.render` calls have failed), insert a `try/catch` block before the existing fallback render that:
  1. Logs a warning: `"[renderMermaidMarkup] Attempting server-side Stage 2 re-generation with error context..."`.
  2. Calls `fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage: 2, blueprint: lastBlueprint, errorContext: repairErr.message || String(repairErr) }) })`.
  3. If the response is OK, extracts `mermaid` from the JSON, runs it through `sanitizeMermaidCode`, and attempts `m.render` on the sanitized result.
  4. If that render succeeds: calls `setMermaidCode(cleanedRecovery)`, `setCanvasSvg(recoverySvg)`, `setCanvasError(null)`, schedules `autoFitDiagramView()`, and returns the SVG.
  5. If the server call fails or the render fails: logs the error and falls through to the existing placeholder render.
  Wrap the entire server re-call in a `try/catch` so any network or JSON parse error silently falls through to the placeholder.

#### 4E — Accept `errorContext` in Stage 2 route handler (`app/api/generate/route.ts`)

- [ ] 4.9 Extract `errorContext` from the request body in the Stage 2 handler
  In the `stage === 2` branch of the POST handler, destructure `errorContext` from `body` alongside the existing `blueprint` field.

- [ ] 4.10 Append error-context correction instruction to `compilerPrompt` when `errorContext` is provided
  After calling `buildCompilerPrompt(kind, direction)`, if `errorContext` is a non-empty string, append the following block to the prompt string:
  ```
  ══════════════════════════════════════════════
  CRITICAL CORRECTION REQUIRED
  ══════════════════════════════════════════════
  The previous generation attempt failed with this parse error:
    "{errorContext}"
  You MUST produce corrected Mermaid code that avoids this specific error. Pay particular attention to:
  - Every statement on its own line, no exceptions.
  - `direction` keyword never attached to another token.
  - All node labels with spaces or special characters in double quotes.
  - classDef and class statements ONLY in flowchart diagrams, never in er/sequence/class/state/C4.
  - The `end` keyword alone on its own line with nothing before or after it.
  ```
  (Interpolate the actual `errorContext` string into the template.)

---

### Verification

- [ ] 5.1 Manual smoke test — Bug 1: generate a microservices diagram and confirm Blueprint JSON has ≥ (nodes − 1) edges with every node referenced
- [ ] 5.2 Manual smoke test — Bug 1: generate all 14 EA diagram types (archimate, bpmn, dfd, vsm, capability_map, network_topology, deployment, component, use_case, activity, communication, it_roadmap, service_blueprint, swimlane) and confirm non-empty `edges` arrays in each Blueprint
- [ ] 5.3 Manual smoke test — Bug 2: hard-refresh the page, immediately click Generate before the draw.io iframe fully loads, confirm the diagram appears in the draw.io tab (not blank)
- [ ] 5.4 Manual smoke test — Bug 2: confirm browser console shows `[Draw.io Event] init` followed by the XML load, and no `[drawioCompiler] Edge skipped` warnings for well-formed blueprints
- [ ] 5.5 Manual smoke test — Bug 3: generate a BPMN and ArchiMate diagram, confirm draw.io iframe shows connection arrows between nodes, check console for any `[drawioCompiler] Edge skipped` warnings
- [ ] 5.6 Manual smoke test — Bug 4 (sanitizer): generate a flowchart with node labels containing Mermaid keywords (e.g. "Actor Service", "Section Overview", "End-to-End Pipeline") and confirm the rendered Mermaid SVG is correct with no split labels
- [ ] 5.7 Manual smoke test — Bug 4 (server re-call): in a dev build, temporarily introduce a syntax error into Stage 2 LLM output (via mock or console intercept), confirm the UI attempts a server re-call before showing the fallback banner, and that `canvasError` remains null if the re-call succeeds
- [ ] 5.8 Regression check: existing diagram types (flowchart, sequence, er, class, state, c4context, c4container, c4component, gantt, timeline, mindmap, quadrant) render correctly and produce the same draw.io XML structure as before the fix
- [ ] 5.9 Regression check: `save` and `autosave` iframe events continue to sync the canvas after the `loadDrawioXml` retry refactor
- [ ] 5.10 Regression check: history restore loads draw.io XML into the iframe correctly after the `init` handler change

## Task Dependency Graph

```json
{
  "waves": [
    {
      "wave": 1,
      "tasks": ["1.1", "1.2", "1.3", "1.4", "2.1", "2.2", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7", "3.8", "3.9", "3.10", "3.11", "3.12", "3.13", "3.14", "3.15", "3.16", "3.17", "3.18", "4.1", "4.2", "4.6", "4.9"]
    },
    {
      "wave": 2,
      "tasks": ["2.3", "2.4", "2.5", "2.6", "4.3", "4.4", "4.5", "4.7", "4.10"]
    },
    {
      "wave": 3,
      "tasks": ["4.8"]
    },
    {
      "wave": 4,
      "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9", "5.10"]
    }
  ]
}
```

## Notes

- Tasks 1.1–1.4 all modify `PARSER_SYSTEM` in `app/api/generate/route.ts`. Complete them together in one editing pass to avoid multiple opens of the same large template literal.
- Tasks 3.1–3.18 are mechanical and independent — each is a one-line-to-four-line change in a different function in `lib/drawioCompiler.ts`. They can be done in a single pass through the file.
- Tasks 4.6 and 4.7 (direction strip guards) are independent of the quote-aware split changes (4.2–4.5) and can be done in any order.
- Task 4.8 must be done after 4.9 and 4.10 are complete so the server endpoint accepts the `errorContext` field before the client sends it.
- All verification tasks (5.x) require a running dev server (`npm run dev`). Run them manually.

