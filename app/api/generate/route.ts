import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Check if API key is configured
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Initialize Gemini Client only if key is available
const ai = GEMINI_API_KEY && GEMINI_API_KEY !== "your-gemini-api-key-here"
  ? new GoogleGenAI({
      apiKey: GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    })
  : null;

const DEFAULT_MODEL = "gemini-3.5-flash";

// ----------------------------------------------------
// SYSTEM PROMPTS & SCHEMAS
// ----------------------------------------------------

const PARSER_SYSTEM = `You are an expert enterprise systems and software architect.
Your job is to read a natural language description of an architecture, system, process, or workflow, and extract its structural blueprint into a pristine, valid JSON object.

Strict rules:
1. Do NOT output any markdown code blocks (fences like \`\`\`json). Output ONLY the raw valid JSON string starting with { and ending with }. No introductory or concluding text. No explanations.
2. If the prompt contains a simple system description, map it into 8-15 nodes. If it describes a complex enterprise platform, map up to 35-40 nodes across structured logical groups.
3. Node IDs must be unique, start with a letter, and match [a-zA-Z][a-zA-Z0-9_]* (snake_case). Strictly NO spaces, hyphens, or special characters.
4. Every edge "from" and "to" must reference an existing, declared node ID.
5. All JSON fields must strictly conform to the schema below.
6. MANDATORY LABEL ICONS: Prepended a highly relevant, colored emoji icon to the front of every node "label" (e.g., "🖥️ Web Client", "🚀 API Gateway", "🗄️ MySQL Database", "📬 Kafka Queue", "👤 Admin User", "🔒 Cognito Auth", "⚙️ Order Processor") to make the resulting diagram deeply visual, intuitive, and professional.

JSON SCHEMA:
{
  "diagramKind": "flowchart" | "sequence" | "er" | "class" | "state" | "c4context" | "c4container" | "c4component" | "gantt" | "timeline" | "mindmap" | "quadrant" | "archimate" | "bpmn" | "dfd" | "vsm" | "capability_map" | "network_topology" | "deployment" | "component" | "use_case" | "activity" | "communication" | "package" | "object" | "timing" | "interaction_overview" | "it_roadmap" | "service_blueprint" | "swimlane",
  "direction": "TD" | "LR",
  "title": "short, highly professional descriptive title",
  "groups": [
    {
      "id": "group_snake_id",
      "label": "Display Name of Group",
      "nodes": [
        {
          "id": "node_snake_id",
          "label": "emoji + 2-4 words display label",
          "shape": "rect" | "round" | "diamond" | "cylinder" | "hexagon" | "stadium" | "ellipse" | "actor",
          "type": "service" | "database" | "external" | "ui" | "queue" | "gateway" | "process" | "person" | "system" | "container" | "component" | "external_system" | "actor" | "use_case_node" | "gateway" | "event" | "task" | "store" | "artefact" | "node" | "layer" | "capability" | "device" | "swimlane_lane"
        }
      ]
    }
  ],
  "edges": [
    {
      "from": "source_node_id",
      "to": "target_node_id",
      "label": "1-3 words description or empty string",
      "style": "solid" | "dashed"
    }
  ]
}

Classification Guidance:
- C4 Architecture: Use "c4context" for systems-level overviews, "c4container" for containers/apps/databases, "c4component" for inner component detail.
- Sequence Diagrams: For message passing over time. Nodes represent participants, and edges are ordered events with descriptions.
- ER Diagrams: Entity relations. One primary group and edges denoting relationships.
- Flowcharts: For custom cloud infrastructures, pipelines, networks, and modular diagrams. Highly visual.
- Planning: Use "gantt" for timelines and projects, "timeline" for cron events, "mindmap" for brainstorming, "quadrant" for 2x2 matrix categorizations.
- archimate: For layered enterprise architecture views with ArchiMate-style layers (Motivation, Strategy, Business, Application, Technology). Use groups as layers.
- bpmn: For business process flows with pools, lanes, tasks, gateways, start/end events. Use groups as pools/lanes.
- dfd: For Data Flow Diagrams. External entities=rect, processes=round, data stores=cylinder.
- vsm: For Value Stream Maps with process boxes, inventory, and timeline.
- capability_map: For Business/IT capability heat-maps. Groups=domains, nodes=capabilities.
- network_topology: For physical/logical network diagrams. Nodes=devices (routers, switches, servers, firewalls).
- deployment: For UML Deployment Diagrams. Groups=nodes/environments, nodes=artefacts.
- component: For UML Component Diagrams. Groups=subsystems, nodes=components.
- use_case: For UML Use Case Diagrams. Groups=system boundary, nodes=actors and use cases.
- activity: For UML Activity Diagrams. Nodes=actions, decisions, forks.
- communication: For UML Communication Diagrams. Nodes=objects, edges=numbered messages.
- package: For UML Package Diagrams. Groups=packages, nodes=classifiers.
- object: For UML Object Diagrams. Nodes=instances, edges=links.
- timing: For UML Timing Diagrams. Groups=lifelines, nodes=states over time axis.
- interaction_overview: For UML Interaction Overview. Nodes=ref frames and decisions.
- it_roadmap: For IT/Product Roadmaps. Groups=planning horizons, nodes=initiatives/milestones.
- service_blueprint: For Service Blueprints. Groups=service layers, nodes=touchpoints/actions.
- swimlane: For Cross-functional Swimlane flowcharts. Groups=lanes (actors), nodes=process steps.`;

const REFINER_SYSTEM = `You are an expert enterprise systems architect and design diagrams editor.
Your task is to take an existing Blueprint JSON representing an architecture layout, and apply a natural language modification instruction to it.
Ensure the output matches the exact same JSON schema structure as the input. Update the diagram logically (add, modify, delete, rename, style, or restructure groups, nodes, or edges as instructed).

Strict rules:
1. Do NOT output any markdown code blocks (fences like \`\`\`json). Output ONLY the raw valid JSON string starting with { and ending with }. No introductory or concluding text. No explanations.
2. Maintain correctness of JSON syntax and valid matching edge connections.
3. Keep the current structure intact as much as possible; only apply the requested change.
4. MANDATORY LABEL ICONS: Keep or insert highly relevant colored emoji icons at the front of every node "label" (e.g., "🖥️ Web Dashboard", "⚙️ Billing Engine") to match the system-wide visual design rules.
`;

function buildCompilerPrompt(kind: string, direction: string): string {
  return `You are a Mermaid.js diagram code generator. Your output is parsed directly by the Mermaid lexer — any syntax error will crash the renderer with no recovery.

══════════════════════════════════════════════
ABSOLUTE RULE — ONE STATEMENT PER LINE
══════════════════════════════════════════════
Every single token must be on its own line. This is non-negotiable.
The Mermaid lexer reads line by line. Two statements on one line = immediate crash.

══════════════════════════════════════════════
RULE 1 — DIAGRAM DECLARATION
══════════════════════════════════════════════
The diagram type declaration MUST be the first non-comment line, alone, nothing else on it.

CORRECT:
  flowchart TD
  A("Auth Service") --> B("Database")

WRONG — will crash:
  flowchart TDA("Auth Service") --> B("Database")
  flowchart TD A("Auth Service") --> B("Database")

══════════════════════════════════════════════
RULE 2 — direction KEYWORD
══════════════════════════════════════════════
\`direction\` is a standalone keyword. It MUST always be on its own line.
It must NEVER be attached to: the end of a node label, the start of a node ID, or any other keyword.

CORRECT:
  subgraph Backend
  direction TD
  A("Service A") --> B("Service B")
  end

WRONG — will crash every time:
  Person("Microservices Platform")direction TD
  System_Boundary(...)direction TD
  direction TDNodeId(

THE MOST COMMON CRASH PATTERN — never produce this:
  LABEL)direction TD
  LABEL)direction TDNodeId(

══════════════════════════════════════════════
RULE 3 — NODE LABELS WITH SPACES OR SPECIAL CHARACTERS
══════════════════════════════════════════════
Any label containing spaces, slashes, hyphens, dots, or parentheses MUST be wrapped in double quotes.

CORRECT:
  A("API Gateway")
  B("PostgreSQL DB")
  C("auth-service")
  D("S3 / CloudFront")

WRONG — will crash:
  A(API Gateway)
  B(PostgreSQL DB)

══════════════════════════════════════════════
RULE 4 — SUBGRAPH STRUCTURE
══════════════════════════════════════════════
subgraph title, direction, nodes, and end must each be on separate lines.

CORRECT:
  subgraph "Service Layer"
  direction TD
  A("Auth") --> B("Orders")
  end

WRONG:
  subgraph "Service Layer"
  direction TDA("Auth") --> B("Orders")end

══════════════════════════════════════════════
RULE 5 — NO MARKDOWN FENCES
══════════════════════════════════════════════
Return ONLY raw Mermaid syntax.
Do NOT wrap in \`\`\`mermaid or \`\`\` or any other markdown.
Do NOT add any explanation, comment, or text before or after the diagram.

══════════════════════════════════════════════
RULE 6 — C4 DIAGRAMS
══════════════════════════════════════════════
Each C4 function call (Person, System, Container, Rel, etc.) must be on its own line.

CORRECT:
  C4Context
  Person(personAlias, "Customer", "A customer")
  System(systemAlias, "E-Commerce", "Handles orders")
  Rel(personAlias, systemAlias, "Uses")

WRONG:
  C4ContextPerson(personAlias, "Customer")System(systemAlias, "E-Commerce")

══════════════════════════════════════════════
RULE 7 — classDef IS ONLY VALID IN FLOWCHART
══════════════════════════════════════════════
classDef and class statements ONLY work inside flowchart diagrams.
NEVER add classDef or class statements to: erDiagram, sequenceDiagram, classDiagram,
stateDiagram-v2, gantt, timeline, mindmap, quadrantChart, or C4 diagrams.
Adding classDef to those diagram types will CRASH the parser immediately.

WRONG — will crash erDiagram:
  erDiagram
  classDef database fill:#1a2e2b,stroke:#38d9c0  ← ILLEGAL, crashes parser
  USERS ||--o{ ORDERS : "places"

CORRECT erDiagram — no classDef at all:
  erDiagram
  USERS ||--o{ ORDERS : "places"
  ORDERS ||--|{ ORDER_ITEMS : "contains"

══════════════════════════════════════════════
RULE 8 — EVERY DIAGRAM MUST HAVE CONNECTIONS
══════════════════════════════════════════════
Every diagram MUST have meaningful edges/relationships between nodes.
An isolated node with no connections is a design flaw.
- flowchart/bpmn/dfd/vsm/swimlane/activity: use --> or -.-> arrows between EVERY step
- erDiagram: every entity MUST have at least one relationship line ||--o{ or }|--|{
- sequenceDiagram: every participant MUST appear in at least one message ->>
- classDiagram: every class MUST have at least one association, inheritance, or dependency
- C4 diagrams: every Person/System/Container MUST have at least one Rel() call
- state diagrams: every state MUST have at least one transition
- Isolated nodes with no edges are NOT acceptable

══════════════════════════════════════════════
SELF-CHECK BEFORE OUTPUTTING
══════════════════════════════════════════════
Before returning your output, scan every line and verify:
1. Does any line contain more than one node definition? → Split it.
2. Does any line contain a node label closing ) immediately followed by a keyword? → Split it.
3. Does \`direction\` appear anywhere except as the only token on its line? → Split it.
4. Does any node label contain spaces without double quotes? → Add quotes.
5. Is there any text before the diagram type declaration? → Remove it.
6. Does the diagram type require connections/edges? → Ensure EVERY node has at least one connection.
7. Is this NOT a flowchart diagram? → Remove ALL classDef and class lines — they CRASH non-flowchart parsers.
If any check fails, fix it before outputting.

Node IDs must strictly match [a-zA-Z][a-zA-Z0-9_]*.
Every node ID must be unique. Every edge from/to must reference a declared node ID.

GUIDELINES BY KIND:
- flowchart:
  First line MUST be: %%{init: {"theme": "dark", "flowchart": {"curve": "stepBefore"}}}%%
  Second line: flowchart ${direction}
  (These two lines are the ONLY lines that go on the flowchart declaration — nothing else.)
  Shape syntax: rect=id["L"], round=id("L"), diamond=id{"L"}, cylinder=id[("L")], hexagon=id{{"L"}}, stadium=id(["L"])
  Edges: A --> B or A -->|Label| B. Dashed: A -.-> B or A -. Label .-> B.
  Groups: each blueprint group → subgraph group_id ["Group Label"] on its own line, then nodes, then end on its own line. ALL subgraphs before any edges.
  Color palette — add these classDef lines at the very bottom, each on its own line:
    classDef service  fill:#1a2540,stroke:#5b8df8,color:#e4eaf8,stroke-width:2px;
    classDef database fill:#1a2e2b,stroke:#38d9c0,color:#e4eaf8,stroke-width:2px;
    classDef external fill:#25183a,stroke:#9d72ff,color:#e4eaf8,stroke-width:2px;
    classDef ui       fill:#1a1e30,stroke:#fbbf24,color:#e4eaf8,stroke-width:2px;
    classDef queue    fill:#2a1a18,stroke:#f87171,color:#e4eaf8,stroke-width:2px;
    classDef gateway  fill:#0e1f28,stroke:#38d9c0,color:#e4eaf8,stroke-width:2px;
    classDef process  fill:#1a2035,stroke:#5b8df8,color:#e4eaf8,stroke-width:1px;
  Assign: class nodeId service (each on its own line)

  EXACT OUTPUT FORMAT (every statement on its own line, no exceptions):
  %%{init: {"theme": "dark", "flowchart": {"curve": "stepBefore"}}}%%
  flowchart TD
  subgraph group_web ["🌐 Web Layer"]
  web_client["🖥️ Web Client"]
  end
  subgraph group_api ["🚀 API Layer"]
  api_gateway["🚀 API Gateway"]
  end
  web_client --> api_gateway
  classDef service fill:#1a2540,stroke:#5b8df8,color:#e4eaf8,stroke-width:2px;
  class web_client service
  class api_gateway gateway

- sequence:
  First line: sequenceDiagram
  Participants: participant alias as "Name" (each on its own line)
  Messages: A ->> B: message (each on its own line)
  REQUIRED: Every participant MUST send or receive at least one message. Minimum 4 messages.
  NO classDef. NO class statements. These crash sequenceDiagram.

- er:
  First line: erDiagram
  Relationships: ENTITY1 ||--o{ ENTITY2 : "label" (each on its own line)
  REQUIRED: Every entity MUST have at least one relationship. Minimum 5 relationships.
  Cardinality options: ||--o{ (one-to-many), }|--|{ (many-to-many), ||--|| (one-to-one).
  NO classDef. NO class statements. These CRASH erDiagram immediately.

  CORRECT erDiagram example:
  erDiagram
  USERS ||--o{ ORDERS : "places"
  ORDERS ||--|{ ORDER_ITEMS : "contains"
  PRODUCTS ||--o{ ORDER_ITEMS : "included in"

- class:
  First line: classDiagram
  Classes and associations each on their own line.
  REQUIRED: Every class MUST have at least one association. Use <|-- for inheritance, --> for association, ..> for dependency.
  NO classDef. NO class color statements — classDiagram has its own syntax which does not use classDef from flowchart.

- state:
  First line: stateDiagram-v2
  Transitions each on their own line.
  REQUIRED: Every state MUST have at least one transition. Include [*] --> InitialState and FinalState --> [*].
  NO classDef. NO class statements. These crash stateDiagram.

- c4context / c4container / c4component:
  First line: C4Context (or C4Container / C4Component)
  title, direction, Person(), System(), Rel(), LAYOUT_WITH_LEGEND() — each MUST be on its own line.
  LAYOUT_WITH_LEGEND() must be the last line.
  REQUIRED: Every Person and System MUST appear in at least one Rel() call.
  NO classDef. NO class statements. These crash C4 diagrams.

  EXACT OUTPUT FORMAT:
  C4Context
  title Online Banking System
  direction TD
  Person(customer, "Banking Customer", "A customer of the bank")
  System(bankingSystem, "Internet Banking System", "Allows customers to view account info")
  Rel(customer, bankingSystem, "Uses")
  LAYOUT_WITH_LEGEND()

- gantt:
  First line: gantt
  title, dateFormat, section, and tasks each on their own line.
  REQUIRED: At least 3 sections with 2+ tasks each.
  NO classDef. NO class statements.

- timeline:
  First line: timeline
  title, section, and events each on their own line.
  REQUIRED: At least 3 time periods with events.
  NO classDef. NO class statements.

- mindmap:
  First line: mindmap
  Root and branches indented by 2 spaces per level.
  REQUIRED: Root node with at least 4 branches, each with 2+ sub-branches.
  NO classDef. NO class statements.

- quadrant:
  First line: quadrantChart
  x-axis, y-axis, quadrant labels, and items each on their own line.
  REQUIRED: All 4 quadrants labelled. At least 8 items placed in the quadrant.
  NO classDef. NO class statements.

- bpmn:
  First line: %%{init: {"theme": "dark", "flowchart": {"curve": "stepBefore"}}}%%
  Second line: flowchart TD
  Use subgraph per pool/lane. Tasks=rect nodes, Gateways=diamond nodes, Start events=stadium nodes (🟢 prefix), End events=hexagon nodes (🔴 prefix).
  Inter-pool message flows use dashed edges.
  classDef task fill:#1a2035,stroke:#5b8df8,color:#e4eaf8;
  classDef gateway fill:#2a1a18,stroke:#f87171,color:#e4eaf8;
  classDef event fill:#0e1f28,stroke:#38d9c0,color:#e4eaf8;

- archimate:
  flowchart TD with subgraphs for each layer (Motivation, Strategy, Business, Application, Technology, Physical).
  Layer labels must include emoji: "🎯 Motivation", "📋 Strategy", "💼 Business", "⚙️ Application", "🖥️ Technology".
  Direction TD (layers stack vertically). Serving/realisation edges = dashed. Assignment edges = solid.
  classDef motivation fill:#1a1224,stroke:#9d72ff,color:#e4eaf8;
  classDef business fill:#1a2035,stroke:#fbbf24,color:#e4eaf8;
  classDef application fill:#1a2e2b,stroke:#38d9c0,color:#e4eaf8;
  classDef technology fill:#111215,stroke:#5b8df8,color:#e4eaf8;

- dfd:
  flowchart TD. External entities=rect with 🔲 prefix. Processes=round with ⚙️ prefix. Data stores=cylinder with 🗄️ prefix.
  All edges labelled with data item name.
  classDef external fill:#25183a,stroke:#9d72ff,color:#e4eaf8;
  classDef process fill:#1a2035,stroke:#5b8df8,color:#e4eaf8;
  classDef store fill:#1a2e2b,stroke:#38d9c0,color:#e4eaf8;

- vsm:
  flowchart LR. Process boxes=rect with ⚙️. Inventory triangles between processes=diamond with 📦. Push arrows=solid, pull arrows=dashed.
  Last subgraph is "⏱️ Timeline" with lead time nodes.
  classDef process fill:#1a2035,stroke:#5b8df8,color:#e4eaf8;
  classDef inventory fill:#2a1a18,stroke:#f87171,color:#e4eaf8;

- capability_map:
  flowchart TD. subgraphs for capability domains. Capabilities are rect nodes coloured by maturity (1=red, 2=orange, 3=yellow, 4=green, 5=bright green).
  classDef mat1 fill:#4a1a1a,stroke:#f87171,color:#e4eaf8;
  classDef mat2 fill:#3a2a1a,stroke:#fbbf24,color:#e4eaf8;
  classDef mat3 fill:#2a3a1a,stroke:#d4ff00,color:#e4eaf8;
  classDef mat4 fill:#1a3a2a,stroke:#38d9c0,color:#e4eaf8;
  classDef mat5 fill:#1a2a3a,stroke:#5b8df8,color:#e4eaf8;

- network_topology:
  flowchart TD. Servers=cylinder with 🖥️. Routers/switches=hexagon with 🔀. Firewalls=stadium with 🔥. Clients=rect with 💻. Cloud=round with ☁️.
  Edges labelled with protocol (TCP/IP, HTTPS, etc.) and bandwidth.
  classDef server fill:#101614,stroke:#38d9c0,color:#e4eaf8;
  classDef network fill:#1c1110,stroke:#ef4444,color:#e4eaf8;
  classDef firewall fill:#0e1f28,stroke:#fbbf24,color:#e4eaf8;

- deployment:
  flowchart TD. Deployment nodes=subgraphs with 🖥️ labels. Execution environments=nested subgraphs. Artefacts=stadium nodes with 📦.
  Deploy edges=dashed. Communication edges=solid.
  classDef node fill:#111215,stroke:#5b8df8,color:#e4eaf8;
  classDef artefact fill:#1a2e2b,stroke:#38d9c0,color:#e4eaf8;

- component:
  flowchart TD. Components=rect with ⚙️. Interfaces=small round nodes with 🔌. Dependencies=dashed arrows. Composition=solid arrows.
  classDef component fill:#1a2035,stroke:#5b8df8,color:#e4eaf8;
  classDef interface fill:#0e1f28,stroke:#38d9c0,color:#e4eaf8;

- use_case:
  flowchart TD. System boundary=subgraph with dashed style. Actors=stadium with 👤. Use cases=round with ○.
  Include=dashed with "«include»" label. Extend=dashed with "«extend»" label.
  classDef actor fill:#0c1524,stroke:#3b82f6,color:#e4eaf8;
  classDef usecase fill:#1a2035,stroke:#9d72ff,color:#e4eaf8;

- activity:
  flowchart TD. Actions=rect. Decisions=diamond. Fork/join=hexagon (◼ prefix). Initial=stadium (⬤). Final=hexagon (⊗).
  Guard conditions on edges in square brackets.
  classDef action fill:#1a2035,stroke:#5b8df8,color:#e4eaf8;
  classDef decision fill:#2a1a18,stroke:#fbbf24,color:#e4eaf8;
  classDef fork fill:#111215,stroke:#999999,color:#e4eaf8;

- communication:
  flowchart LR. Objects=rect. Messages=edges labelled with sequence number: "1: methodName()".
  Bidirectional messages use two separate edges with numbers.
  classDef object fill:#1a2035,stroke:#5b8df8,color:#e4eaf8;

- package:
  flowchart TD. Packages=subgraphs. Classifiers inside=rect. Dependency arrows=dashed. Import=dashed with "«import»". Merge=dashed with "«merge»".
  classDef classifier fill:#1a2035,stroke:#9d72ff,color:#e4eaf8;

- object:
  flowchart TD. Object instances=rect, label format "instanceName : ClassName" (underline implied). Attribute slots in label (multiline using <br/>).
  Links=solid edges. Dependency=dashed.
  classDef instance fill:#1a2035,stroke:#38d9c0,color:#e4eaf8;

- timing:
  flowchart LR. One row per lifeline = one subgraph. State-value nodes along horizontal axis=rect with state label. Time transitions=solid edges rightward.
  State changes=vertical dashed edges between states.
  classDef state fill:#1a2035,stroke:#38d9c0,color:#e4eaf8;

- interaction_overview:
  flowchart TD. Reference frames=round with "ref: Name" label. Combined fragments=diamond. Sequential flow=solid. Alt/loop=dashed.
  classDef ref fill:#25183a,stroke:#9d72ff,color:#e4eaf8;
  classDef fragment fill:#2a1a18,stroke:#fbbf24,color:#e4eaf8;

- it_roadmap:
  flowchart LR. subgraphs for planning horizons: "🟢 Now (Q1-Q2)", "🟡 Next (Q3-Q4)", "🔵 Later (FY+1)".
  Initiatives=rect inside horizons. Milestones=diamond with 🎯. Phase gates=stadium with 🚦.
  Dependency arrows between initiatives. Timeline flows left to right.
  classDef initiative fill:#1a2035,stroke:#5b8df8,color:#e4eaf8;
  classDef milestone fill:#0e1f28,stroke:#d4ff00,color:#e4eaf8;

- service_blueprint:
  flowchart LR. One subgraph per service layer (top to bottom): "👤 Customer Actions", "🎭 Frontstage", "👁️ Line of Visibility", "⚙️ Backstage", "🔧 Support Processes", "📦 Physical Evidence".
  Touchpoints=rect. Actions=round. Vertical inter-layer linking edges=dashed.
  classDef customer fill:#0c1524,stroke:#3b82f6,color:#e4eaf8;
  classDef frontstage fill:#1a2e2b,stroke:#38d9c0,color:#e4eaf8;
  classDef backstage fill:#25183a,stroke:#9d72ff,color:#e4eaf8;

- swimlane:
  flowchart LR (or TD based on blueprint direction). One subgraph per lane (actor/department).
  Process steps=rect. Decisions=diamond. Start=stadium (▶). End=hexagon (⏹).
  Cross-lane handoff edges=solid with activity label. Return flows=dashed.
  classDef step fill:#1a2035,stroke:#5b8df8,color:#e4eaf8;
  classDef decision fill:#2a1a18,stroke:#fbbf24,color:#e4eaf8;
`;
}

function buildDrawioCompilerPrompt(kind: string, direction: string): string {
  return `You are an expert draw.io (mxGraph) XML compiler.
Your task is to translate the provided Blueprint JSON into a visually stunning, perfectly engineered native draw.io XML diagram (mxfile).
This diagram must consist of fully editable, non-overlapping selectable shapes, groups, and lines.

Strict rules:
1. Output ONLY a valid, escaped XML string. Absolutely NO explanations, code fences (\`\`\`xml), markdown, or introductory text. Start directly with "<?xml version=\\"1.0\\" encoding=\\"UTF-8\\"?>".
2. The root element must be a single <mxfile> tag containing <diagram name="Architecture"> and <mxGraphModel>.
3. Set the background of the <mxGraphModel> to "#0d1117" (dark mode) as a pristine enterprise-tool canvas.
4. Cell mappings:
   - Root elements MUST contain exactly:
     <mxCell id="0"/>
     <mxCell id="1" parent="0"/>
   - All other shapes/edges must have a unique sequential string ID (e.g. "2", "3", "4", ...) and parent="1" (or the ID of their parent container / swimlane).
5. Ensure vertices have vertex="1" and a full <mxGeometry x="..." y="..." width="..." height="..." as="geometry"/> with non-overlapping, neat coordinate grids.
   - Spaces and gutters between group borders must be at least 120px wide to prevent line crossing and overlaps.
   - Default node shape size: 180x65 to accommodate text and custom labels comfortably.
   - CRITICAL RELATIVE COORDINATE RULE: When nesting a node inside a group container/swimlane, its coordinate geometry (x, y) MUST be RELATIVE to that parent container's top-left corner, NOT absolute coordinates (e.g., node 1 at x=30, y=55; node 2 at x=240, y=55 inside the container). If absolute coordinates are nested inside parent containers, they will drift terribly and overlap.
6. Edges must have edge="1", source="..." and target="..." referencing vertex IDs, and <mxGeometry relative="1" as="geometry"/>. All edges must be strictly orthogonal (i.e. only horizontal or vertical straight paths with NO curves or rounded diagonals). Therefore, all edges MUST be styled with rounded=0 and edgeStyle=orthogonalEdgeStyle.
7. You must XML-escape all labels, text, and styling parameters (e.g., use &amp; for &, &lt; for <, &gt; for >, &quot; for ").

MXGRAPH STYLE GUIDE:
Map nodes and groups to native draw.io shapes using this professional visual styling palette (use these exact attributes in the 'style=' property):
- service: rounded=1;whiteSpace=wrap;html=1;fillColor=#111215;strokeColor=#d4ff00;fontColor=#e4eaf8;strokeWidth=1.5;
- database: shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#101614;strokeColor=#38d9c0;fontColor=#e4eaf8;strokeWidth=1.5;boundedLbl=1;
- external: rounded=1;whiteSpace=wrap;html=1;fillColor=#14111a;strokeColor=#a855f7;fontColor=#e4eaf8;strokeWidth=1.5;
- ui: rounded=1;whiteSpace=wrap;html=1;fillColor=#1c1a12;strokeColor=#fbbf24;fontColor=#e4eaf8;strokeWidth=1.5;
- queue: shape=hexagon;whiteSpace=wrap;html=1;fillColor=#1c1110;strokeColor=#ef4444;fontColor=#e4eaf8;strokeWidth=1.5;
- gateway: rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#0f161a;strokeColor=#0ea5e9;fontColor=#e4eaf8;strokeWidth=1.5;
- process: rounded=1;whiteSpace=wrap;html=1;fillColor=#111215;strokeColor=#999999;fontColor=#e4eaf8;strokeWidth=1;
- default: rounded=1;whiteSpace=wrap;html=1;fillColor=#111215;strokeColor=#d4ff00;fontColor=#e4eaf8;strokeWidth=1.5;
- solid edge: edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonal=1;jettySize=auto;html=1;strokeColor=#d4ff00;fontColor=#F0F0F0;fontSize=10;labelBackgroundColor=#0A0A0A;labelBorderColor=none;
- dashed edge: edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonal=1;jettySize=auto;html=1;strokeColor=#d4ff00;fontColor=#F0F0F0;fontSize=10;dashed=1;labelBackgroundColor=#0A0A0A;labelBorderColor=none;

DIAGRAM SPECIFIC LAYOUTS:
- flowchart: Render logical groups as swimlane containers (style: swimlane;html=1;whiteSpace=wrap;collapsible=0;recursiveResize=0;container=1;fillColor=#121212;strokeColor=#333333;strokeWidth=1.5;fontColor=#E0E0E0;fontSize=11;fontStyle=1;startSize=32;align=center;verticalAlign=top;shadow=0;).
  - STACKING RULE:
    * For Left-To-Right (LR) diagrams, arrange nodes horizontally within group boxes (using more columns, e.g., cols = count > 3 ? Math.ceil(count / 2) : count) so horizontal connection paths flow beautifully from left to right.
    * For Top-To-Bottom (TD) diagrams, arrange nodes vertically within group boxes (using fewer columns, e.g., cols = count > 4 ? 2 : 1) so vertical connection paths flow beautifully from top to bottom.
- c4context / c4container / c4component: Render dashed standard containers and systems. People as c4Person style. Group and nest nodes relative to parent swimlane boxes following the flowchart STACKING RULE for LR and TD.
- sequence: Grid of vertical lifelines. Horizontal message lines positioned chronologically.
- er / class / state: Standard tables, specialized boxes. Layout entities cleanly with at least 150px to 250px spacing.
- gantt / timeline / mindmap / quadrant: Reconstruct these visually using beautiful groupings of nodes, labeled lines, marker dots, and clean, relative coordinate offsets spanning the dark canvas.`;
}

// Helper to sanitize incoming markdown or text
function sanitizeContent(text: string): string {
  if (!text) return "";
  let clean = text.trim();
  // Strip ```json, ```mermaid, ```xml blocks
  clean = clean.replace(/^```[a-zA-Z-]*\n/gm, "");
  clean = clean.replace(/\n```$/gm, "");
  clean = clean.replace(/^```$/gm, "");

  // Normalize line endings
  clean = clean.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // ── STRIP INVALID NODE ATTRIBUTE BAGS ────────────────────────────────────
  // Must run before all other passes. The LLM sometimes emits non-existent
  // Mermaid syntax like:
  //   web_app["🌐 Web Application"]{class="ui", shape="round"}
  // Mermaid's lexer treats `{` as DIAMOND_START and hard-crashes with:
  //   "got 'DIAMOND_START'" parse error.
  // Strip these bags entirely — correct class assignments are emitted as
  // separate `class nodeId className` lines by the LLM elsewhere.
  clean = clean.replace(/\{[^{}]*(?:class|shape|style|fill|stroke)[^{}]*\}/gi, "");
  // ── END STRIP INVALID NODE ATTRIBUTE BAGS ─────────────────────────────────

  // ── STRIP classDef/class FROM NON-FLOWCHART DIAGRAMS ─────────────────────
  // classDef and class assignment lines are ONLY valid inside flowchart.
  // When emitted inside erDiagram/sequenceDiagram/classDiagram/stateDiagram-v2/
  // gantt/timeline/mindmap/quadrantChart the parser crashes immediately.
  {
    const firstMeaningfulLine = clean
      .split("\n")
      .find((l: string) => l.trim() && !l.trim().startsWith("%%"))
      ?.trim()
      ?.toLowerCase() || "";
    const isFlowchartBase =
      firstMeaningfulLine.startsWith("flowchart") ||
      firstMeaningfulLine.startsWith("graph ");
    if (!isFlowchartBase) {
      clean = clean
        .split("\n")
        .filter((l: string) => {
          const t = l.trim();
          if (/^classDef\s+\w+/i.test(t)) return false;
          if (/^class\s+\w+\s+\w+$/i.test(t) && !firstMeaningfulLine.startsWith("classdiagram")) return false;
          return true;
        })
        .join("\n");
    }
  }
  // ── END STRIP classDef/class FROM NON-FLOWCHART DIAGRAMS ─────────────────

  // ── STEP 0: Direct regex keyword injection ────────────────────────────────
  // Targeted pre-pass first — handles the specific crash pattern
  // "Xdirection TDKeyword(" before the general loop runs.
  {
    const DIR_KW = [
      "Person_Ext", "System_Ext", "Container_Ext", "Component_Ext",
      "ContainerDb_Ext", "ContainerQueue_Ext", "System_Boundary", "Container_Boundary",
      "ContainerDb", "ContainerQueue", "Rel_Back", "Rel_Neighbor",
      "Rel_Up", "Rel_Down", "Rel_Left", "Rel_Right",
      "Container", "Component", "Boundary",
      "Person", "System", "Rel",
      "title", "subgraph", "classDef", "participant", "actor", "section",
      "LAYOUT_WITH_LEGEND", "C4Context", "C4Container", "C4Component",
      "flowchart", "sequenceDiagram", "erDiagram", "classDiagram",
    ];
    clean = clean.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, (m: string, a: string, b: string) => a + "\n" + b);
    clean = clean.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([^\n\s])/gi, (m: string, a: string, b: string) => a + "\n" + b);
    // Split bracket/quote close immediately before direction (subgraph label squash)
    clean = clean.replace(/([\]"'])\s*(direction\s+(?:TD|LR|TB|BT|RL))/gi, (m: string, a: string, b: string) => a + "\n" + b);
    // Split node definition squashed directly after direction TD
    clean = clean.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([a-zA-Z][a-zA-Z0-9_]*\s*[\[({])/gi, (m: string, a: string, b: string) => a + "\n" + b);
    for (const kw of DIR_KW) {
      clean = clean.replace(
        new RegExp(`(direction\\s+(?:TD|LR|TB|BT|RL))\\s*(${kw}\\b)`, "gi"),
        (m: string, a: string, b: string) => a + "\n" + b
      );
      clean = clean.replace(
        new RegExp(`(\\w)(${kw}\\s*\\()`, "g"),
        (m: string, a: string, b: string) => a + "\n" + b
      );
    }
  }

  // General pattern loop — fresh regex instances each pass to avoid stale lastIndex
  const makeRoutePatterns = (): RegExp[] => [
    /([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi,
    /([^\n])(%%\{)/g,
    /([^\n])(C4Container\b)/g, /([^\n])(C4Component\b)/g, /([^\n])(C4Context\b)/g,
    /([^\n])(sequenceDiagram\b)/g, /([^\n])(erDiagram\b)/g,
    /([^\n])(classDiagram\b)/g, /([^\n])(stateDiagram-v2\b)/g,
    /([^\n])(flowchart\s)/g, /([^\n])(mindmap\b)/g,
    /([^\n])(quadrantChart\b)/g, /([^\n])(gantt\b)/g, /([^\n])(timeline\b)/g,
    /([^\n])(Person_Ext\s*\()/g, /([^\n])(System_Ext\s*\()/g,
    /([^\n])(Container_Ext\s*\()/g, /([^\n])(Component_Ext\s*\()/g,
    /([^\n])(ContainerDb_Ext\s*\()/g, /([^\n])(ContainerQueue_Ext\s*\()/g,
    /([^\n])(System_Boundary\s*\()/g, /([^\n])(Container_Boundary\s*\()/g,
    /([^\n])(ContainerDb\s*\()/g, /([^\n])(ContainerQueue\s*\()/g,
    /([^\n])(Rel_Back\s*\()/g, /([^\n])(Rel_Neighbor\s*\()/g,
    /([^\n])(Rel_Up\s*\()/g, /([^\n])(Rel_Down\s*\()/g,
    /([^\n])(Rel_Left\s*\()/g, /([^\n])(Rel_Right\s*\()/g,
    /([^\n])(Container\s*\()/g, /([^\n])(Component\s*\()/g,
    /([^\n])(Boundary\s*\()/g,
    /([^\n])(Person\s*\()/g, /([^\n])(System\s*\()/g, /([^\n])(Rel\s*\()/g,
    /([^\n])(LAYOUT_WITH_LEGEND)/g,
    /([^\n])(subgraph\s)/g, /([^\n])(classDef\s)/g,
    /([^\n])(participant\s)/g, /([^\n])(actor\s)/g,
    /([^\n])(title\s)/g, /([^\n])(section\s)/g,
    // Sequence diagram: split squashed message lines
    /(\w[\w_]*\s+(?:-\.?->>?|-->>?|->)\s+\w[\w_]*)(\w[\w_]*\s+(?:-\.?->>?|-->>?|->))/g,
  ];
  for (let pass = 0; pass < 30; pass++) {
    const prev = clean;
    const patterns = makeRoutePatterns();
    for (const p of patterns) clean = clean.replace(p, (m: string, a: string, b: string) => a + "\n" + b);
    if (clean === prev) break;
  }
  clean = clean.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([^\n])/gi, (m: string, a: string, b: string) => a + "\n" + b);
  // ── END STEP 0 ───────────────────────────────────────────────────────────

  // ── Category 1: Diagram-type declarations ────────────────────────────────
  // Standalone keywords with NO parentheses that may be squashed directly
  // against another word character (e.g. "C4Contexttitle", "erDiagramtitle").
  // MUST NOT use \b because the preceding char may also be a word char.
  const DIAGRAM_DECLARATIONS = [
    "C4Context", "C4Container", "C4Component",
    "sequenceDiagram", "erDiagram", "classDiagram", "stateDiagram-v2",
    "flowchart", "mindmap", "quadrantChart", "gantt", "timeline", "graph"
  ];

  // ── Category 2: C4 function keywords (always followed by `(`) ────────────
  const C4_FUNC_KEYWORDS = [
    "Person_Ext", "System_Ext", "Container_Ext", "Component_Ext",
    "ContainerDb_Ext", "ContainerQueue_Ext",
    "System_Boundary", "Container_Boundary",
    "ContainerDb", "ContainerQueue",
    "Rel_Back", "Rel_Neighbor", "Rel_Up", "Rel_Down", "Rel_Left", "Rel_Right",
    "Container", "Component", "Boundary",
    "Person", "System", "Rel"
  ];

  // ── Category 3: Plain Mermaid keywords ───────────────────────────────────
  const PLAIN_KEYWORDS = [
    "direction",
    "classDef", "class",
    "participant", "actor", "autonumber", "loop", "rect", "opt", "alt", "else",
    "state", "dateFormat", "axisFormat", "section",
    "x-axis", "y-axis", "quadrant-1", "quadrant-2", "quadrant-3", "quadrant-4",
    "title", "end"
  ];

  // ── Category 4: Structural block keywords ────────────────────────────────
  const STRUCTURAL_KEYWORDS = ["subgraph"];

  /**
   * One full sweep: split all squashed statements by inserting \n before each
   * recognized keyword. Runs on unquoted segments only to preserve labels.
   * Called in a do-while loop until idempotent.
   */
  const applySplitPass = (input: string): string => {
    let segments = input.split('"');
    // If there's an unclosed quote (even number of segments), treat the whole string as unquoted
    // to prevent the sanitizer from being completely bypassed and crashing the renderer.
    if (segments.length % 2 === 0) {
      segments = [input];
    }

    for (let i = 0; i < segments.length; i += 2) {
      let seg = segments[i];

      // Category 4 — structural block keywords (subgraph / end) — MUST run
      // FIRST, before Category 1, because Category 1 contains "graph" which
      // would otherwise split "subgraph" → "sub\ngraph". By inserting the
      // newline before "subgraph" as one atomic unit first, the whole word
      // is already on its own line and Category 1 never sees a bare "graph".
      for (const kw of STRUCTURAL_KEYWORDS) {
        const regex = new RegExp(`([^\\n])(${kw}(?:\\s|$))`, "g");
        seg = seg.replace(regex, "$1\n$2");
      }

      // Category 1 — diagram declarations: no `(`, no \b required
      for (const kw of DIAGRAM_DECLARATIONS) {
        const pattern = kw === "graph" ? "(?<!sub)graph" : kw;
        const regex = new RegExp(`([^\\n])(${pattern})`, "g");
        seg = seg.replace(regex, "$1\n$2");
        // Also split if followed immediately by a letter (e.g. C4Contexttitle -> C4Context\ntitle)
        const trailingRegex = new RegExp(`(${pattern})([a-zA-Z])`, "g");
        seg = seg.replace(trailingRegex, "$1\n$2");
      }

      // Category 2 — C4 function calls: keyword must be followed by (
      // Match any character except newline and underscore (avoid splitting System_Boundary into System_\nBoundary)
      for (const kw of C4_FUNC_KEYWORDS) {
        const regex = new RegExp(`([^\\n_])\\s*(${kw}\\s*\\()`, "g");
        seg = seg.replace(regex, "$1\n$2");
      }


      // Special: direction TD/LR/TB/BT/RL — multiple passes to handle all squashing scenarios:
      //  1a. Split any word-char IMMEDIATELY before `direction` (e.g. Platformdirection → Platform\ndirection).
      //      Uses \w instead of [^\n] so it fires even when direction is squashed mid-word.
      //  1b. Also split closing brackets/parens before direction (e.g. )direction → )\ndirection).
      //  2.  Split any word-char IMMEDIATELY after the direction value (e.g. direction TDSystem_ → direction TD\nSystem_).
      //  3.  Handle direction with NO space before the value (e.g. directionTD → direction TD).
      //  4.  Split opening brackets/parens after direction value (e.g. direction TDSystem( → direction TD\nSystem().
      //  5.  Handle underscore immediately after TD (TD_) and before direction (Platformdirection).
      //  6.  Handle title followed by any text then direction (e.g., title Textdirection → title Text\ndirection).
      seg = seg.replace(/(\w)(direction\s+(?:TD|LR|TB|BT|RL))/gi, "$1\n$2");
      seg = seg.replace(/([)\]}>])(direction\s+(?:TD|LR|TB|BT|RL))/gi, "$1\n$2");
      seg = seg.replace(/([^\n\w)\]}>])(direction\s+(?:TD|LR|TB|BT|RL))/gi, "$1\n$2");
      seg = seg.replace(/(direction\s+(?:TD|LR|TB|BT|RL))(\w)/gi, "$1\n$2");
      seg = seg.replace(/(direction\s+(?:TD|LR|TB|BT|RL))([([{<_])/gi, "$1\n$2");
      seg = seg.replace(/(direction)(TD|LR|TB|BT|RL)/gi, "$1 $2");
      // Handle underscore directly after the direction value (TD_System → TD\n_System)
      seg = seg.replace(/((?:TD|LR|TB|BT|RL))(_)/gi, "$1\n$2");


      // Category 3 — plain keywords.
      // Two passes per keyword because a single lookbehind cannot handle
      // the word-char→keyword squash (e.g. "externaltitle" or "Platformclass"):
      //  Pass A: use (\w) to catch word-char immediately before the keyword.
      //          No lookbehind needed — if it's preceded by a word char it MUST split.
      //  Pass B: use ([^\n]) + (?<![\w]) for non-word, non-newline chars (original logic).
      // NOTE: the trailing (?:\s+|:|(?=\s*$)) ensures we only match standalone
      //       keywords — "classDef" won't incorrectly split "class" because
      //       "D" is not whitespace/colon/end-of-line.
      for (const kw of PLAIN_KEYWORDS) {
        const escaped = kw.replace(/[-]/g, "\\-");
        // Pass A: word-char → keyword (lookbehind would block this case)
        const wordBeforeRegex = new RegExp(`(\\w)(${escaped}(?:\\s+|:|(?=\\s*$)))`, "g");
        seg = seg.replace(wordBeforeRegex, "$1\n$2");
        // Pass B: non-word non-newline → keyword (original lookbehind logic)
        const nonWordRegex = new RegExp(`([^\\n])((?<![\\w])${escaped}(?:\\s+|:|(?=\\s*$)))`, "g");
        seg = seg.replace(nonWordRegex, "$1\n$2");
      }

      segments[i] = seg;
    }
    return segments.join('"');
  };

  // Multi-pass: repeat until idempotent (no further changes), max 20 passes
  let prev: string;
  let iterations = 0;
  do {
    prev = clean;
    clean = applySplitPass(clean);
    iterations++;
  } while (clean !== prev && iterations < 20);

  // ── Final safety-net passes ───────────────────────────────────────────────
  // Targets squash patterns that survive the quote-aware loop, such as a
  // flowchart declaration merged directly against a subgraph statement.

  // 0. direction keyword squashed with surrounding word characters — full-string
  //    safety net that catches any case the per-segment loop may have missed
  //    (e.g. inside an odd-split quoted segment, or zero-space directionTD).
  const DIR = "(?:TD|LR|TB|BT|RL)";
  clean = clean.replace(new RegExp(`(\\w)(direction\\s+${DIR})`, "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`([)\\]}>])(direction\\s+${DIR})`, "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`(direction\\s+${DIR})(\\w)`, "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`(direction\\s+${DIR})([([{<_])`, "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`(direction)(${DIR})`, "gi"), "$1 $2");
  // Handle underscore directly after the direction value (TD_System → TD\n_System)
  clean = clean.replace(new RegExp(`(${DIR})(_)`, "gi"), "$1\n$2");
  // Handle title followed by any word then direction — greedy match
  clean = clean.replace(new RegExp(`(title\\s+[^\\n]+)(direction)`, "gi"), "$1\n$2");

  // 1. flowchart/graph + direction squashed against subgraph / end.
  //    Use explicit direction alternation instead of \w+ so "TD" isn't
  //    consumed together with the following keyword as one token.
  clean = clean.replace(new RegExp(`(flowchart\\s+${DIR})(subgraph)`, "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`(flowchart\\s+${DIR})(graph)`, "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`(graph\\s+${DIR})(subgraph)`, "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`(graph\\s+${DIR})(graph)`, "gi"), "$1\n$2");

  // 2. Any remaining keyword-to-keyword merges that survived the loop
  clean = clean.replace(/(subgraph\s+\S+)(subgraph)/gi, "$1\n$2");
  clean = clean.replace(/(\bend\b)(subgraph)/gi, "$1\n$2");
  clean = clean.replace(/(\bend\b)(flowchart)/gi, "$1\n$2");
  clean = clean.replace(new RegExp(`(flowchart\\s+${DIR})(end\\b)`, "gi"), "$1\n$2");

  // LAYOUT_WITH_LEGEND always on its own line
  clean = clean.replace(/\s*LAYOUT_WITH_LEGEND(\(\))?\s*/gi, "\nLAYOUT_WITH_LEGEND()\n");

  // ── STRIP INVALID NODE ATTRIBUTE BAGS ────────────────────────────────────
  // The LLM sometimes emits non-existent Mermaid syntax like:
  //   web_app["🌐 Web Application"]{class="ui", shape="round"}
  // Mermaid's lexer sees `{` as DIAMOND_START and crashes immediately.
  // Strip these attribute bags entirely; class assignments are handled via
  // `class nodeId className` statements that the LLM already generates separately.
  clean = clean.replace(/(\{[^{}]*(?:class|shape|style|fill|stroke)[^{}]*\})/gi, "");
  // ── END STRIP INVALID NODE ATTRIBUTE BAGS ─────────────────────────────────

  // ── B2/B3: explicit subgraph-label / node-definition direction splits ──────
  // Handles: subgraph id ["label"]direction TD  (bracket/quote close before direction)
  clean = clean.replace(/([\]"'])\s*(direction\s+(?:TD|LR|TB|BT|RL))/gi, "$1\n$2");
  // Handles: direction TDnodeId["label"] (node definition immediately after direction)
  clean = clean.replace(/(direction\s+(?:TD|LR|TB|BT|RL))\s*([a-zA-Z][a-zA-Z0-9_]*\s*[\[({])/gi, "$1\n$2");
  // ── END B2/B3 ──────────────────────────────────────────────────────────────

  // ── NUCLEAR DIRECTION PASS: ensure `direction TD/LR/...` is always isolated on its own line
  clean = clean.replace(/([^\n]+?)\s*(direction\s+(?:TD|LR|TB|BT|RL))\s*([^\n]+)/gi, (_, before, dir, after) => {
    const parts: string[] = [];
    if (before.trim()) parts.push(before.trim());
    parts.push(dir.trim());
    if (after.trim()) parts.push(after.trim());
    return parts.join("\n");
  });
  // Collapse excessive blank lines
  clean = clean.replace(/\n{3,}/g, "\n\n");
  return clean.trim();
}

/**
 * repairJson — makes a best-effort attempt to fix common LLM JSON slip-ups
 * before handing to JSON.parse.
 *
 * Handles:
 *  1. Trailing commas before } or ]  (e.g. {"a":1,}  or [1,2,])
 *  2. Single-quoted strings          (e.g. {'key': 'value'})
 *  3. Unquoted keys                  (e.g. {key: "value"})
 *  4. Comments                       (// ... or /* ... *\/)
 *  5. Ellipsis placeholders          (e.g. "edges": [...])
 *  6. Extra leading/trailing text    (extract the outermost { ... } block)
 *
 * Returns the repaired string. Throws if no valid JSON can be extracted.
 */
function repairJson(raw: string): string {
  let s = raw.trim();

  // 1. Strip markdown fences (```json ... ```)
  s = s.replace(/^```[a-zA-Z-]*\s*/gm, "").replace(/\s*```$/gm, "").trim();

  // 2. Extract the outermost JSON object — handles preamble/postamble text
  const firstBrace = s.indexOf("{");
  const lastBrace = s.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    s = s.slice(firstBrace, lastBrace + 1);
  }

  // 3. Strip JS-style comments (// line and /* block */)
  s = s.replace(/\/\/[^\n]*/g, "");
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");

  // 4. Strip trailing commas before } or ] (the most common LLM mistake)
  //    Run multiple times until idempotent to handle nested structures.
  for (let i = 0; i < 10; i++) {
    const prev = s;
    s = s.replace(/,\s*([}\]])/g, "$1");
    if (s === prev) break;
  }

  // 5. Replace single-quoted strings with double-quoted
  //    Only fires when a single-quoted value isn't already inside double quotes.
  s = s.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, (_, inner) => `"${inner}"`);

  // 6. Quote unquoted keys:  { key: "value" }  →  { "key": "value" }
  s = s.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

  // 7. Remove ellipsis placeholder entries that break parse
  //    e.g.  "edges": [ ... ]  or  "edges": [...]
  s = s.replace(/:\s*\[\s*\.\.\.\s*\]/g, ": []");
  s = s.replace(/:\s*\{\s*\.\.\.\s*\}/g, ": {}");

  return s;
}

// Zentrale generator routine with fallback
async function generateWithFallback({
  systemInstruction,
  contents,
  responseMimeType,
  temperature = 0.1,
}: {
  systemInstruction: string;
  contents: any;
  responseMimeType?: string;
  temperature?: number;
}): Promise<string> {
  let geminiError: any = null;

  // Check if any LLM provider is configured
  const hasGeminiKey = GEMINI_API_KEY && GEMINI_API_KEY !== "your-gemini-api-key-here";
  const hasGroqKey = GROQ_API_KEY && GROQ_API_KEY !== "your-groq-api-key-here";

  if (!hasGeminiKey && !hasGroqKey) {
    throw new Error(
      "No LLM API key configured. Please set GEMINI_API_KEY or GROQ_API_KEY in your .env file. " +
      "Get a Gemini key at https://aistudio.google.com/apikey"
    );
  }

  // Try Gemini first if the API key is configured
  if (hasGeminiKey && ai) {
    try {
      const response = await ai.models.generateContent({
        model: DEFAULT_MODEL,
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: temperature,
          responseMimeType: responseMimeType as any,
        },
      });

      const text = response.text;
      if (text) {
        return text;
      }
      throw new Error("Gemini returned an empty text response.");
    } catch (err: any) {
      console.warn("Gemini model execution failed, attempting fallback...", err.message || err);
      geminiError = err;
    }
  } else if (!hasGeminiKey) {
    geminiError = new Error("GEMINI_API_KEY not configured (using placeholder value).");
  }

  // If Gemini failed or was skipped, try GROQ fallback
  if (hasGroqKey) {
    console.log("Using Groq API fallback with model 'llama-3.3-70b-versatile'...");
    try {
      // Safely extract string content for Groq which is text-only
      let textContents = "";
      if (typeof contents === "string") {
        textContents = contents;
      } else if (contents && typeof contents === "object") {
        if (Array.isArray(contents)) {
          textContents = contents.map((c: any) => c.text || JSON.stringify(c)).join("\n");
        } else if (contents.parts && Array.isArray(contents.parts)) {
          textContents = contents.parts.map((p: any) => p.text || "").join("\n");
        } else {
          textContents = JSON.stringify(contents);
        }
      } else {
        textContents = String(contents);
      }

      const messages = [
        { role: "system", content: systemInstruction },
        { role: "user", content: textContents }
      ];

      const payload: any = {
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: temperature,
      };

      if (responseMimeType === "application/json") {
        payload.response_format = { type: "json_object" };
      }

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GROQ API returned HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const outputText = data?.choices?.[0]?.message?.content;
      if (outputText) {
        return outputText;
      }
      throw new Error("GROQ returned an empty response.");
    } catch (groqError: any) {
      console.error("GROQ fallback also failed:", groqError);
      throw new Error(
        `Both primary Gemini API and Groq fallback failed.\nGemini Error: ${geminiError?.message || geminiError}\nGroq Error: ${groqError.message || groqError}`
      );
    }
  }

  // No Groq key and Gemini failed
  throw new Error(`Primary Gemini API execution failed and no Groq fallback API key was provided.\nGemini Error: ${geminiError?.message || geminiError}`);
}

// Handle POST requests
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { stage, prompt, diagramType, blueprint, file, instruction } = body;

    if (!stage) {
      return NextResponse.json({ error: "Missing 'stage' parameter." }, { status: 400 });
    }

    if (stage === 1) {
      if (!prompt) {
        return NextResponse.json({ error: "Missing 'prompt' parameter for Stage 1." }, { status: 400 });
      }

      let inputPrompt = `Diagram Type: ${diagramType || "auto"}\nUser Prompt: ${prompt}`;
      let contentsPayload: any = inputPrompt;

      if (file) {
        if (file.fileType.startsWith("text/") || file.fileType === "application/json" || file.fileType === "text/csv" || file.fileType === "text/plain") {
          inputPrompt += `\n\n[Attached File Context "${file.fileName}"]: \n${file.fileContent}`;
          contentsPayload = inputPrompt;
        } else if (file.fileType === "application/pdf" || file.fileType.startsWith("image/")) {
          // Send as multimodal inlineData parts for Gemini
          contentsPayload = {
            parts: [
              { text: inputPrompt },
              {
                inlineData: {
                  data: file.fileContent.split(",")[1] || file.fileContent,
                  mimeType: file.fileType,
                },
              },
            ],
          };
        } else {
          inputPrompt += `\n\n[Attached File Context "${file.fileName}"]: \n${file.fileContent}`;
          contentsPayload = inputPrompt;
        }
      }

      const text = await generateWithFallback({
        systemInstruction: PARSER_SYSTEM,
        contents: contentsPayload,
        responseMimeType: "application/json",
        temperature: 0.1,
      });

      const cleanJson = sanitizeContent(text);
      let parsed: any;
      try {
        parsed = JSON.parse(repairJson(cleanJson));
      } catch (parseErr: any) {
        // Last resort: try the raw text in case sanitizeContent mangled it
        try {
          parsed = JSON.parse(repairJson(text));
        } catch {
          console.error("Stage 1: AI returned malformed JSON:", cleanJson.slice(0, 300));
          return NextResponse.json({ error: `AI returned malformed JSON. Try again. (${(parseErr as Error).message})` }, { status: 500 });
        }
      }

      return NextResponse.json({ blueprint: parsed });

    } else if (stage === 2) {
      if (!blueprint) {
        return NextResponse.json({ error: "Missing 'blueprint' parameter for Stage 2." }, { status: 400 });
      }

      const systemPrompt = buildCompilerPrompt(blueprint.diagramKind || "flowchart", blueprint.direction || "TD");

      const text = await generateWithFallback({
        systemInstruction: systemPrompt,
        contents: JSON.stringify(blueprint),
        temperature: 0.1,
      });

      const cleanMermaid = sanitizeContent(text);
      return NextResponse.json({ code: cleanMermaid });

    } else if (stage === 3) {
      if (!blueprint) {
        return NextResponse.json({ error: "Missing 'blueprint' parameter for Stage 3." }, { status: 400 });
      }

      const systemPrompt = buildDrawioCompilerPrompt(blueprint.diagramKind || "flowchart", blueprint.direction || "TD");

      let attempt = 0;
      let drawioXML = "";
      let errorMsg = "";

      while (attempt < 2) {
        try {
          const contents = attempt === 0
            ? JSON.stringify(blueprint)
            : `The previous XML was invalid or contained errors: ${errorMsg}. Please fix all XML formatting mistakes, make sure there are NO missing tags, escape all style variables properly, and supply a absolute complete valid mxfile XML document for Blueprint: ${JSON.stringify(blueprint)}`;

          const text = await generateWithFallback({
            systemInstruction: systemPrompt,
            contents: contents,
            temperature: 0.1,
          });

          drawioXML = sanitizeContent(text);

          // Basic check on server side. The full DOMParser review will run on client,
          // but we do a quick check here to reject obviously broken ones immediately.
          if (!drawioXML.includes("<mxfile>") || !drawioXML.includes("</mxfile>")) {
            throw new Error("XML is missing matching <mxfile> root tags.");
          }

          // If simple validation succeeds, break!
          break;
        } catch (err: any) {
          attempt++;
          errorMsg = err.message || "Failed parsing/generating draw.io xml";
          if (attempt >= 2) {
            return NextResponse.json({ error: `Stage 3 compilation failed after retry. Details: ${errorMsg}` }, { status: 500 });
          }
        }
      }

      return NextResponse.json({ xml: drawioXML });

    } else if (stage === 4) {
      const currentBlueprint = blueprint;
      if (!currentBlueprint || !instruction) {
        return NextResponse.json({ error: "Missing 'blueprint' or 'instruction' parameters for Stage 4." }, { status: 400 });
      }

      let inputContents = `Current Blueprint JSON:\n${JSON.stringify(currentBlueprint, null, 2)}\n\nUser Modification Instruction:\n${instruction}`;
      let contentsPayload: any = inputContents;

      if (file) {
        if (file.fileType.startsWith("text/") || file.fileType === "application/json" || file.fileType === "text/csv" || file.fileType === "text/plain") {
          inputContents += `\n\n[Attached File Context "${file.fileName}"]: \n${file.fileContent}`;
          contentsPayload = inputContents;
        } else if (file.fileType === "application/pdf" || file.fileType.startsWith("image/")) {
          // Send as multimodal inlineData parts for Gemini
          contentsPayload = {
            parts: [
              { text: inputContents },
              {
                inlineData: {
                  data: file.fileContent.split(",")[1] || file.fileContent,
                  mimeType: file.fileType,
                },
              },
            ],
          };
        } else {
          inputContents += `\n\n[Attached File Context "${file.fileName}"]: \n${file.fileContent}`;
          contentsPayload = inputContents;
        }
      }

      const text = await generateWithFallback({
        systemInstruction: REFINER_SYSTEM,
        contents: contentsPayload,
        responseMimeType: "application/json",
        temperature: 0.1,
      });

      const cleanJson = sanitizeContent(text);
      let parsed: any;
      try {
        parsed = JSON.parse(repairJson(cleanJson));
      } catch (parseErr: any) {
        // Last resort: try the raw text in case sanitizeContent mangled it
        try {
          parsed = JSON.parse(repairJson(text));
        } catch {
          console.error("Stage 4: AI returned malformed JSON:", cleanJson.slice(0, 300));
          return NextResponse.json({ error: `AI returned malformed JSON. Try again. (${(parseErr as Error).message})` }, { status: 500 });
        }
      }

      return NextResponse.json({ blueprint: parsed });

    } else {
      return NextResponse.json({ error: "Invalid 'stage' value." }, { status: 400 });
    }

  } catch (error: any) {
    console.error("API error inside /api/generate:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 });
  }
}
