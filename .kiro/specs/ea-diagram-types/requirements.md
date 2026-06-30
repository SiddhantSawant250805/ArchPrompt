# Requirements Document

## Introduction

ArchPrompt currently supports 12 diagram types targeting developers and system architects. This feature expands the platform to cover the full breadth of diagram types used by Enterprise Architects (EAs), including ArchiMate-style layered architecture views, BPMN-style business process flows, the complete UML suite, network topology and deployment diagrams, data flow diagrams (DFD), value stream maps (VSM), capability maps, IT roadmaps, swimlane process flows, and service blueprints.

Expansion touches four layers of the system:
1. The Blueprint JSON schema (`diagramKind` enum and relevant `type` values)
2. Stage 1 — `PARSER_SYSTEM` (natural language → Blueprint JSON)
3. Stage 2 — `buildCompilerPrompt` (Blueprint JSON → Mermaid code)
4. Stage 3 — `compileBlueprintToDrawio` in `lib/drawioCompiler.ts` (Blueprint JSON → draw.io XML)

Every new diagram kind must be renderable both in the Mermaid canvas and in the draw.io iframe with the same dark-mode enterprise visual style already established in the project.

---

## Glossary

- **Blueprint JSON**: The intermediate structured JSON representation produced by Stage 1 and consumed by Stages 2 and 3.
- **diagramKind**: The string field in Blueprint JSON that identifies which diagram type to render.
- **PARSER_SYSTEM**: The Stage 1 LLM system prompt that classifies a natural language prompt and produces Blueprint JSON.
- **buildCompilerPrompt**: The Stage 2 function in `app/api/generate/route.ts` that returns a Mermaid code-generation system prompt for a given `diagramKind`.
- **Compiler**: The deterministic TypeScript geometry engine in `lib/drawioCompiler.ts` that converts Blueprint JSON into draw.io mxGraph XML.
- **Mermaid_Canvas**: The client-side Mermaid.js SVG rendering surface in `app/page.tsx`.
- **Drawio_Editor**: The embedded `embed.diagrams.net` iframe in `app/page.tsx`.
- **EA**: Enterprise Architect — a practitioner responsible for aligning an organisation's technology strategy with its business goals.
- **ArchiMate_View**: A layered architecture diagram following ArchiMate notation concepts (motivation, strategy, business, application, technology layers).
- **BPMN_Flow**: A business process diagram following BPMN-style notation (pools, lanes, tasks, gateways, events).
- **DFD**: Data Flow Diagram — shows how data moves between processes, stores, and external entities.
- **VSM**: Value Stream Map — visualises the steps and information flows required to deliver a product or service.
- **Capability_Map**: A structured heat-map-style view of business or IT capabilities organised by domain.
- **Network_Topology**: A physical or logical diagram of network devices and their interconnections.
- **Deployment_Diagram**: A UML diagram showing how software artefacts are deployed onto hardware/infrastructure nodes.
- **Component_Diagram**: A UML diagram showing the components of a system and their interfaces/dependencies.
- **Use_Case_Diagram**: A UML diagram showing actors and their interactions with system use cases.
- **Activity_Diagram**: A UML diagram for modelling workflows, parallel flows, decisions, and forks.
- **Communication_Diagram**: A UML diagram (formerly collaboration diagram) showing object interactions in a network topology.
- **Package_Diagram**: A UML diagram grouping related classifiers into packages with dependency arrows.
- **Object_Diagram**: A UML diagram showing a snapshot of object instances and their links at a point in time.
- **Timing_Diagram**: A UML diagram showing state/value changes of objects over a linear time axis.
- **Interaction_Overview**: A UML diagram combining activity-diagram control flow with embedded sequence-diagram fragments.
- **IT_Roadmap**: A timeline-based view of technology initiatives, milestones, and phase gates across planning horizons.
- **Service_Blueprint**: A customer-journey-aligned diagram showing frontstage actions, backstage actions, support processes, and physical evidence.
- **Swimlane_Flow**: A flowchart partitioned into horizontal or vertical lanes, one per actor or department.
- **Sanitizer**: The multi-pass `sanitizeContent()` function in `route.ts` that repairs squashed Mermaid statements.
- **Dark_Mode_Palette**: The existing enterprise dark colour tokens (`#0A0A0A` background, `#d4ff00` neon-lime, `#38d9c0` teal, etc.) already established in `drawioCompiler.ts`.

---

## Requirements

### Requirement 1: EA Diagram Type Catalogue

**User Story:** As an Enterprise Architect, I want the system to recognise all diagram types I use in my daily practice, so that I can generate any of them from a natural language description without manually selecting a type.

#### Acceptance Criteria

1. THE System SHALL support the following `diagramKind` values in Blueprint JSON, in addition to the 12 existing kinds:
   - `archimate` — ArchiMate-style layered architecture view
   - `bpmn` — BPMN-style business process flow
   - `dfd` — Data Flow Diagram (levels 0, 1, 2)
   - `vsm` — Value Stream Map
   - `capability_map` — Business or IT capability map
   - `network_topology` — Physical or logical network diagram
   - `deployment` — UML Deployment Diagram
   - `component` — UML Component Diagram
   - `use_case` — UML Use Case Diagram
   - `activity` — UML Activity Diagram
   - `communication` — UML Communication / Collaboration Diagram
   - `package` — UML Package Diagram
   - `object` — UML Object Diagram
   - `timing` — UML Timing Diagram
   - `interaction_overview` — UML Interaction Overview Diagram
   - `it_roadmap` — IT / Product Roadmap (multi-horizon)
   - `service_blueprint` — Service Blueprint (customer journey + process layers)
   - `swimlane` — Swimlane Process Flow
2. THE System SHALL maintain backward compatibility: all 12 existing `diagramKind` values SHALL continue to function without change.
3. WHEN the PARSER_SYSTEM produces a Blueprint JSON for any new `diagramKind`, THE System SHALL include a `direction` field (`"TD"` or `"LR"`) that reflects the natural reading orientation of that diagram type.

---

### Requirement 2: Stage 1 — Natural Language Classification

**User Story:** As an Enterprise Architect, I want the system to automatically detect which EA diagram type best matches my natural language prompt, so that I do not have to know the exact type name upfront.

#### Acceptance Criteria

1. WHEN a user submits a natural language prompt describing an enterprise architecture concern, THE PARSER_SYSTEM SHALL classify the prompt into exactly one of the supported `diagramKind` values (existing or new).
2. WHEN the prompt mentions business processes, pools, lanes, tasks, gateways, events, or BPMN, THE PARSER_SYSTEM SHALL assign `diagramKind: "bpmn"`.
3. WHEN the prompt mentions ArchiMate layers (motivation, strategy, business layer, application layer, technology layer), THE PARSER_SYSTEM SHALL assign `diagramKind: "archimate"`.
4. WHEN the prompt mentions data flows, processes, external entities, data stores, or DFD levels, THE PARSER_SYSTEM SHALL assign `diagramKind: "dfd"`.
5. WHEN the prompt mentions value stream, lead time, cycle time, waste, Kaizen, or VSM, THE PARSER_SYSTEM SHALL assign `diagramKind: "vsm"`.
6. WHEN the prompt mentions capability domains, heat maps, business capabilities, or capability levels, THE PARSER_SYSTEM SHALL assign `diagramKind: "capability_map"`.
7. WHEN the prompt mentions routers, switches, firewalls, VLANs, physical servers, or network segments, THE PARSER_SYSTEM SHALL assign `diagramKind: "network_topology"`.
8. WHEN the prompt mentions deployment nodes, artefacts, executionEnvironments, or server topology for running software, THE PARSER_SYSTEM SHALL assign `diagramKind: "deployment"`.
9. WHEN the prompt mentions components, interfaces, provided/required ports, or subsystem dependencies, THE PARSER_SYSTEM SHALL assign `diagramKind: "component"`.
10. WHEN the prompt mentions actors, use cases, system boundary, or include/extend relationships, THE PARSER_SYSTEM SHALL assign `diagramKind: "use_case"`.
11. WHEN the prompt mentions activities, forks, joins, decision nodes, swim lanes, object flows, or action states, THE PARSER_SYSTEM SHALL assign `diagramKind: "activity"`.
12. WHEN the prompt mentions object collaboration, numbered messages, object links, or communication diagram, THE PARSER_SYSTEM SHALL assign `diagramKind: "communication"`.
13. WHEN the prompt mentions packages, namespaces, package imports, or package merges, THE PARSER_SYSTEM SHALL assign `diagramKind: "package"`.
14. WHEN the prompt mentions object instances, slot values, instance snapshots, or object links at a specific point in time, THE PARSER_SYSTEM SHALL assign `diagramKind: "object"`.
15. WHEN the prompt mentions timing constraints, state changes over time, lifelines with value axis, or timing diagrams, THE PARSER_SYSTEM SHALL assign `diagramKind: "timing"`.
16. WHEN the prompt mentions interaction fragments, combined fragments, or an overview of multiple sequence interactions, THE PARSER_SYSTEM SHALL assign `diagramKind: "interaction_overview"`.
17. WHEN the prompt mentions IT roadmap, technology strategy, planning horizons, initiative portfolio, or multi-year plan, THE PARSER_SYSTEM SHALL assign `diagramKind: "it_roadmap"`.
18. WHEN the prompt mentions service blueprint, customer journey, frontstage, backstage, line of visibility, or support processes, THE PARSER_SYSTEM SHALL assign `diagramKind: "service_blueprint"`.
19. WHEN the prompt mentions swimlane, cross-functional flowchart, lanes, or per-department process flow, THE PARSER_SYSTEM SHALL assign `diagramKind: "swimlane"`.
20. WHEN the user explicitly selects a diagram type from the UI selector, THE PARSER_SYSTEM SHALL honour that selection and override the auto-classification.
21. THE PARSER_SYSTEM SHALL generate Blueprint JSON with 8–40 nodes, scaled to the complexity of the input prompt, for every new `diagramKind`.
22. THE PARSER_SYSTEM SHALL assign emoji-prefixed labels to every node in the Blueprint JSON for all new diagram kinds, consistent with the existing convention.

---

### Requirement 3: Stage 2 — Mermaid Code Generation for New Diagram Types

**User Story:** As an Enterprise Architect, I want the Mermaid canvas to display every EA diagram type in a readable, correctly structured diagram, so that I can immediately review the generated architecture visually.

#### Acceptance Criteria

1. THE buildCompilerPrompt function SHALL include per-kind syntax rules for each new `diagramKind`.
2. WHEN `diagramKind` is `"bpmn"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with swimlane subgraphs (one per pool/lane), task nodes as rectangles, gateway nodes as diamonds, start/end events as circles, and dashed lines for message flows between pools.
3. WHEN `diagramKind` is `"archimate"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with layered subgraphs (Motivation, Strategy, Business, Application, Technology), nodes labelled with ArchiMate element types (Role, Process, Application Service, etc.), and directed edges for serving, realisation, and assignment relationships.
4. WHEN `diagramKind` is `"dfd"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with external entities as rectangles, processes as rounded rectangles, data stores as open-ended rectangles (cylinder shape), and directed labelled edges for data flows.
5. WHEN `diagramKind` is `"vsm"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart LR` diagram with process boxes, inventory triangles (diamond shape), push/pull arrows, and a timeline row at the bottom.
6. WHEN `diagramKind` is `"capability_map"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with capability domain subgraphs and capability nodes coloured by maturity level using `classDef` blocks.
7. WHEN `diagramKind` is `"network_topology"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with device nodes (cylinder for servers, hexagon for network devices, stadium for firewalls/gateways) and labelled edges indicating protocol and bandwidth.
8. WHEN `diagramKind` is `"deployment"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with deployment node subgraphs (servers, cloud environments), artefact nodes nested inside them, and dashed `«deploy»` edges.
9. WHEN `diagramKind` is `"component"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with component nodes, provided interface (lollipop) annotations in labels, required interface annotations, and dependency arrows.
10. WHEN `diagramKind` is `"use_case"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with actor nodes (stadium shape), use case nodes (ellipse via round shape), a system boundary subgraph, and include/extend labelled dashed edges.
11. WHEN `diagramKind` is `"activity"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart TD` diagram with action nodes (rectangles), decision nodes (diamonds), fork/join bars (narrow rectangles), initial (filled circle via stadium shape) and final (double-circle via hexagon shape) nodes, and flow edges with guard labels.
12. WHEN `diagramKind` is `"communication"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with object nodes and numbered, bidirectional labelled edges showing message sequences.
13. WHEN `diagramKind` is `"package"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with package subgraphs containing classifier nodes and dashed dependency or import arrows between packages.
14. WHEN `diagramKind` is `"object"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with object instance nodes (label format `instanceName : ClassName`) and solid link edges.
15. WHEN `diagramKind` is `"timing"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart LR` diagram as a multi-row timeline with one row per lifeline, state-change nodes, and horizontal time-axis edges.
16. WHEN `diagramKind` is `"interaction_overview"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart TD` diagram with reference fragments (rounded rectangles labelled `ref: <name>`) and combined fragment decision nodes, connected by sequential flow edges.
17. WHEN `diagramKind` is `"it_roadmap"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart LR` diagram with initiative nodes grouped by planning horizon (Now/Next/Later or quarters), milestone diamonds, and phase gate edges.
18. WHEN `diagramKind` is `"service_blueprint"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart LR` diagram with horizontal lane subgraphs (Customer Journey, Frontstage, Line of Visibility, Backstage, Support Processes, Physical Evidence) and vertical linking edges between layers.
19. WHEN `diagramKind` is `"swimlane"`, THE buildCompilerPrompt SHALL instruct the LLM to produce a `flowchart` diagram with one subgraph per lane (actor or department), process nodes inside lanes, and inter-lane edges for handoffs.
20. FOR ALL new diagram kinds, THE buildCompilerPrompt SHALL enforce the existing ABSOLUTE RULE of one Mermaid statement per line and all other syntax rules already defined in the function.
21. FOR ALL new diagram kinds, THE buildCompilerPrompt SHALL include `classDef` colour assignments consistent with the existing Dark_Mode_Palette.

---

### Requirement 4: Stage 3 — Deterministic Draw.io Compilation for New Diagram Types

**User Story:** As an Enterprise Architect, I want the draw.io editor to display every EA diagram type as a fully editable diagram with proper shapes and layout, so that I can refine the generated architecture using draw.io's native tools.

#### Acceptance Criteria

1. THE Compiler SHALL include a dedicated compilation function for each new `diagramKind` in `lib/drawioCompiler.ts`.
2. WHEN `diagramKind` is `"bpmn"`, THE Compiler SHALL render pools as outer swimlane containers, lanes as nested swimlane containers, task nodes as rounded rectangles, gateway nodes as diamonds, start events as filled circles, end events as double circles, and dashed edges for inter-pool message flows.
3. WHEN `diagramKind` is `"archimate"`, THE Compiler SHALL render each ArchiMate layer (Motivation, Strategy, Business, Application, Technology) as a distinct coloured swimlane container, with nodes styled by element type (Role=person shape, Process=rectangle, Application Service=rounded rectangle, Technology Node=cylinder).
4. WHEN `diagramKind` is `"dfd"`, THE Compiler SHALL render external entities as plain rectangles, processes as rounded rectangles with a process number label, data stores as open-rectangle (table-row) shapes, and all directed edges labelled with the data item name.
5. WHEN `diagramKind` is `"vsm"`, THE Compiler SHALL render process boxes in a left-to-right flow with inventory triangles between them and a bottom-row timeline band showing lead time and cycle time annotations.
6. WHEN `diagramKind` is `"capability_map"`, THE Compiler SHALL render capability domains as coloured swimlane containers and capability nodes as filled rectangles, with fill colour varying by maturity level (1–5 scale mapped to the Dark_Mode_Palette).
7. WHEN `diagramKind` is `"network_topology"`, THE Compiler SHALL render network devices using draw.io network shape library stencils where available (falling back to hexagon for switches, cylinder for servers, stadium for firewalls), with edges labelled with protocol and bandwidth.
8. WHEN `diagramKind` is `"deployment"`, THE Compiler SHALL render deployment nodes as outer containers, execution environments as inner containers, artefact nodes inside environments, and `«deploy»` labelled dashed edges.
9. WHEN `diagramKind` is `"component"`, THE Compiler SHALL render component nodes using the draw.io `mxgraph.uml.component` shape, with provided interface notation as small circle overlays and required interface notation as small arc overlays on the component border.
10. WHEN `diagramKind` is `"use_case"`, THE Compiler SHALL render actor nodes using the draw.io `mxgraph.uml.actor` shape, use case nodes as ellipses, a system boundary as a dashed rectangle container, and `«include»`/`«extend»` stereotype labels on dashed edges.
11. WHEN `diagramKind` is `"activity"`, THE Compiler SHALL render action nodes as rounded rectangles, decision nodes as diamonds, fork/join bars as thin filled rectangles (5px height, full-width), initial nodes as filled circles, activity-final nodes as circles with a concentric inner circle, and edges with guard condition labels.
12. WHEN `diagramKind` is `"communication"`, THE Compiler SHALL render object nodes as rectangles, with bidirectional edges labelled with sequence numbers (e.g., `1: methodName()`).
13. WHEN `diagramKind` is `"package"`, THE Compiler SHALL render package containers using the draw.io `shape=mxgraph.uml.package2` style, with classifier nodes inside them and dashed dependency arrows between packages.
14. WHEN `diagramKind` is `"object"`, THE Compiler SHALL render object instance nodes as rectangles with an underlined label (`instanceName : ClassName`) and solid link edges.
15. WHEN `diagramKind` is `"timing"`, THE Compiler SHALL render one horizontal row per lifeline, using a series of connected state-value rectangle nodes along a horizontal time axis, with vertical dashed lines marking state transitions.
16. WHEN `diagramKind` is `"interaction_overview"`, THE Compiler SHALL render reference frames as rounded rectangles with a `ref` corner tab, decision nodes as diamonds, and sequential flow edges.
17. WHEN `diagramKind` is `"it_roadmap"`, THE Compiler SHALL render a multi-row horizontal bar layout (one row per initiative) grouped inside swimlane containers for each planning horizon, with milestone diamonds and phase gate labels.
18. WHEN `diagramKind` is `"service_blueprint"`, THE Compiler SHALL render horizontal swimlane containers for each service layer (Customer Journey, Frontstage, Backstage, Support, Physical Evidence) with nodes inside them and vertical linking edges between layers.
19. WHEN `diagramKind` is `"swimlane"`, THE Compiler SHALL render one swimlane container per actor/department with process nodes inside and cross-lane handoff edges.
20. FOR ALL new diagram kinds, THE Compiler SHALL apply the Dark_Mode_Palette (background `#0A0A0A`, edge colour `#d4ff00`, container border `#333333`, font colour `#E0E0E0`) consistently.
21. FOR ALL new diagram kinds, THE Compiler SHALL use RELATIVE coordinates for nodes nested inside containers (coordinates relative to the container's top-left corner, not the page origin).
22. IF a Blueprint JSON contains a `diagramKind` value that has no dedicated compilation function, THEN THE Compiler SHALL fall back to the existing `flowchart` compilation path and log a console warning.

---

### Requirement 5: UI Diagram Type Selector

**User Story:** As an Enterprise Architect, I want to see all supported diagram types in the UI selector so that I can explicitly choose one when auto-detection is not what I need.

#### Acceptance Criteria

1. THE System SHALL add all 18 new `diagramKind` values to the diagram type selector dropdown in `app/page.tsx`.
2. WHEN a user selects a new diagram type from the selector, THE System SHALL pass the selection to Stage 1 as the `diagramType` parameter, and the PARSER_SYSTEM SHALL honour that selection.
3. THE System SHALL display human-readable labels for each diagram type in the selector (e.g., `"bpmn"` → `"BPMN Process Flow"`, `"archimate"` → `"ArchiMate View"`, `"capability_map"` → `"Capability Map"`).
4. THE System SHALL group the selector entries into logical categories: `UML Diagrams`, `EA / Architecture Views`, `Process & Workflow`, `Planning & Strategy`.

---

### Requirement 6: Example Templates for New Diagram Types

**User Story:** As an Enterprise Architect, I want built-in example prompts for the new diagram types so that I can quickly explore the system's capabilities without writing my own prompts.

#### Acceptance Criteria

1. THE System SHALL add at least one example template for each of the following new diagram types: `bpmn`, `archimate`, `dfd`, `vsm`, `capability_map`, `network_topology`, `deployment`, `use_case`, `activity`, `swimlane`, `it_roadmap`, `service_blueprint`.
2. WHEN a user clicks an example template, THE System SHALL populate the prompt textarea with the example text and set the diagram type selector to the corresponding `diagramKind`.
3. THE System SHALL display example template labels in the UI that clearly indicate the diagram type (e.g., `"BPMN: Order Process"`, `"ArchiMate: Insurance Platform"`).

---

### Requirement 7: Mermaid Sanitizer Support for New Syntax Patterns

**User Story:** As a developer maintaining the system, I want the Mermaid sanitizer to handle syntax patterns introduced by the new diagram types, so that LLM-generated code for new kinds does not crash the renderer.

#### Acceptance Criteria

1. WHEN the Sanitizer processes Mermaid code for any new `diagramKind` that maps to `flowchart`, THE Sanitizer SHALL apply all existing flowchart split-pass rules without modification.
2. WHEN the Sanitizer encounters a squashed `subgraph` keyword (used extensively by the new swimlane, bpmn, archimate, capability_map, and service_blueprint kinds), THE Sanitizer SHALL split it onto its own line using the existing `STRUCTURAL_KEYWORDS` mechanism.
3. WHEN the Sanitizer encounters a squashed `classDef` or `class` keyword introduced by the new kinds' colour-palette blocks, THE Sanitizer SHALL split them correctly using the existing `PLAIN_KEYWORDS` mechanism.
4. IF the LLM emits any new diagram-type-specific keywords that are not yet in the sanitizer's keyword dictionaries, THEN THE System SHALL add those keywords to the appropriate category list (`DIAGRAM_DECLARATIONS`, `C4_FUNC_KEYWORDS`, or `PLAIN_KEYWORDS`) in `sanitizeContent()`.

---

### Requirement 8: Blueprint Schema Integrity for New Diagram Types

**User Story:** As a developer integrating downstream tooling, I want the Blueprint JSON for new diagram types to follow the same schema conventions as existing kinds, so that existing merging, refinement, and export code works without modification.

#### Acceptance Criteria

1. THE PARSER_SYSTEM SHALL produce Blueprint JSON for all new diagram kinds using the same top-level fields (`diagramKind`, `direction`, `title`, `groups`, `edges`) already defined in the schema.
2. WHEN a Blueprint JSON for a new `diagramKind` is passed to the Stage 4 REFINER_SYSTEM, THE System SHALL return a valid, modified Blueprint JSON that preserves the `diagramKind` and schema structure.
3. THE System SHALL ensure that all `edge.from` and `edge.to` values in Blueprint JSON for new diagram kinds reference declared node IDs within the same Blueprint, maintaining referential integrity.
4. WHEN Blueprint JSON for a new `diagramKind` is passed to the `mergeBlueprint` function in `lib/merger/blueprintMerger.ts`, THE System SHALL merge it without error.
5. WHEN Blueprint JSON for a new `diagramKind` is passed to the `mergeDrawio` function in `lib/merger/drawioMerger.ts`, THE System SHALL merge the resulting draw.io XML without error.

---

### Requirement 9: Round-Trip Compilation Integrity

**User Story:** As an Enterprise Architect, I want every diagram I generate to be fully representable through the complete 3-stage pipeline, so that I never get a broken or empty output for a supported diagram type.

#### Acceptance Criteria

1. FOR ALL supported `diagramKind` values (existing and new), WHEN a valid Blueprint JSON is passed through Stage 2, THE buildCompilerPrompt SHALL produce a non-empty Mermaid code string.
2. FOR ALL supported `diagramKind` values (existing and new), WHEN a valid Blueprint JSON is passed through Stage 3, THE Compiler SHALL produce a non-empty, well-formed mxGraph XML string containing at least one `<mxCell>` vertex element.
3. IF `compileBlueprintToDrawio` receives a Blueprint JSON with an unrecognised `diagramKind`, THEN THE Compiler SHALL not throw an exception; instead it SHALL return a valid fallback flowchart draw.io XML.
4. THE System SHALL ensure that the draw.io XML produced for every new `diagramKind` passes basic XML well-formedness validation (balanced tags, no unescaped special characters in attribute values).
