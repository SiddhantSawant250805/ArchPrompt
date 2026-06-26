import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
  "diagramKind": "flowchart" | "sequence" | "er" | "class" | "state" | "c4context" | "c4container" | "c4component" | "gantt" | "timeline" | "mindmap" | "quadrant",
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
          "shape": "rect" | "round" | "diamond" | "cylinder" | "hexagon" | "stadium",
          "type": "service" | "database" | "external" | "ui" | "queue" | "gateway" | "process" | "person" | "system" | "container" | "component" | "external_system"
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
- Planning: Use "gantt" for timelines and projects, "timeline" for cron events, "mindmap" for brainstorming, "quadrant" for 2x2 matrix categorizations.`;

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
  return `You are a professional Mermaid.js v10 code generator.
Translate the provided Blueprint JSON into a perfectly styled and executable Mermaid.js v10 diagram.

Strict rules:
1. Output ONLY the raw, executable Mermaid code. Absolutely zero explanations, zero markdown code block fences (\`\`\`mermaid), no backticks, no introduction, and no trailing comments.
2. The very first non-empty line of the output MUST be the valid Mermaid diagram declaration for the requested diagram type.
3. Every node ID must strictly match [a-zA-Z][a-zA-Z0-9_]*.
4. Ensure all syntax elements are fully compliant with Mermaid v10 definitions.
5. CRITICAL STATEMENT SPACING RULE:
   Each statement, keyword, boundary block start/end, relationship, title, and direction declaration MUST be on its own separate newline.
   You must NEVER combine or squash multiple statements onto a single line (for example, NEVER write "title Platformdirection TD" or "direction TDPerson(...)").

GUIDELINES BY KIND:
- flowchart:
  To ensure strictly orthogonal connections (no curved/diagonal lines, only right-angled horizontal and vertical line paths), your very first line MUST be:
  %%{init: {"theme": "dark", "flowchart": {"curve": "stepBefore"}}}%%
  Immediately following that on the next line, start with "flowchart ${direction}".
  Shape-to-syntax mapping:
    - rect: id["Label"]
    - round: id("Label")
    - diamond: id{"Label"}
    - cylinder: id[("Label")]
    - hexagon: id{{"Label"}}
    - stadium: id(["Label"])
  Edges: "A --> B" or "A -->|Label| B". For dashed "A -.-> B" or "A -. Label .-> B". No malformed syntax.
  Groups: Map each blueprint group into a Mermaid "subgraph group_id [\\"Group Label\\"]" block containing its nodes, followed by "end". Place ALL subgraphs before any edges are declared.
  Apply this color palette using classDef blocks at the very bottom:
    classDef service  fill:#1a2540,stroke:#5b8df8,color:#e4eaf8,stroke-width:2px;
    classDef database fill:#1a2e2b,stroke:#38d9c0,color:#e4eaf8,stroke-width:2px;
    classDef external fill:#25183a,stroke:#9d72ff,color:#e4eaf8,stroke-width:2px;
    classDef ui       fill:#1a1e30,stroke:#fbbf24,color:#e4eaf8,stroke-width:2px;
    classDef queue    fill:#2a1a18,stroke:#f87171,color:#e4eaf8,stroke-width:2px;
    classDef gateway  fill:#0e1f28,stroke:#38d9c0,color:#e4eaf8,stroke-width:2px;
    classDef process  fill:#1a2035,stroke:#5b8df8,color:#e4eaf8,stroke-width:1px;
  Assign classes like "class nodeId service".

  CORRECT SPACING EXAMPLE (flowchart):
  %%{init: {"theme": "dark", "flowchart": {"curve": "stepBefore"}}}%%
  flowchart TD
  subgraph group_web ["Web Layer"]
      web_client["🖥️ Web Client"]
  end
  subgraph group_api ["API Layer"]
      api_gateway["🚀 API Gateway"]
  end
  web_client --> api_gateway

- sequence:
  Start with "sequenceDiagram"
  Declare participants: "participant alias as \\"Name\\"" or "actor alias as \\"Name\\""
  Map messages: "A ->> B: message" or "A -->> B: response". Use loop, alt, else, end controls where relevant.

- er:
  Start with "erDiagram"
  Declare entities and their relationships. Relationship syntax: "ENTITY1 ||--o{ ENTITY2 : \\"label\\"" (using ||, o|, }|, o{, solid --, dashed ..). Entities should have field definitions inside curly braces. E.g., EntityName { string id PK }.

- class:
  Start with "classDiagram"
  Declare classes with attributes and methods: "class ClassName { +field : Type\\n+method() : Type }"
  Define associations: "A --|> B" (inheritance), "A --* B" (composition), "A --o B" (aggregation), "A --> B" (link).

- state:
  Start with "stateDiagram-v2"
  Syntax: "[*] --> StateA", "StateA --> StateB : Event", "StateB --> [*]". Support nested state definitions if necessary.

- c4context / c4container / c4component:
  Use Mermaid C4 definitions (C4Context, C4Container, C4Component).
  C4Context: title, Person(alias, "Label", "Description"), System(alias, "Label", "Description"), System_Ext(alias, "Label", "Description"), Rel(from, to, "Label").
  C4Container: System_Boundary(alias, "Boundary Label") { Container(alias, "Label", "Technology", "Description") }, Person, ContainerDb.
  C4Component: Container_Boundary(alias, "Boundary Label") { Component(alias, "Label", "Technology", "Description") }.
  IMPORTANT STRICT RULES FOR MERMAID:
  1. Each component declaration, boundary block, relationship (Rel), the title, and the direction declaration MUST be written on its own separate new line. Do NOT combine statements on the same line.
  2. Quote all node labels that contain spaces, special characters, or reserved words — use double quotes: A["My Label"]
  3. Never use TD, LR, TB, BT, RL as part of a node ID or label — these are reserved Mermaid direction keywords. Rename any node whose ID or label contains these strings.
  4. Avoid underscores in node IDs if they appear adjacent to reserved keywords — use camelCase or hyphens instead (e.g., systemCore instead of System_TD).
  5. Validate the output mentally by checking that every line is either a valid declaration, node definition, or edge — nothing else.
  6. The graph type and direction must always be on their own dedicated first line — e.g. "flowchart LR" alone, nothing else on that line.
  7. Every "subgraph" keyword must start on a new line, never immediately following the direction declaration or any other statement.
  8. Every "end" keyword must be on its own line to close each subgraph block.
  9. Each node definition, edge, and directive must occupy its own line — never concatenate two statements on a single line.
  10. Use consistent 2 or 4 space indentation inside subgraph blocks for readability.
  11. Output the diagram as a properly newline-separated string — every statement on its own line, no exceptions. Do NOT use string concatenation or template literals that could collapse whitespace — emit the diagram as a raw multiline string.
  12. After generating, mentally re-parse each line and confirm no two statements share a line before returning.
  13. Return only the raw Mermaid code — no markdown fences (no \`\`\`mermaid), no explanation, no preamble.
  Ensure you include "LAYOUT_WITH_LEGEND()" on a separate new line at the very end of the diagram.

  CORRECT SPACING EXAMPLE (c4context):
  C4Context
  title Online Banking System
  direction TD
  Person(customer, "Banking Customer", "A customer of the bank")
  System(banking_system, "Internet Banking System", "Allows customers to view account info")
  Rel(customer, banking_system, "Uses")
  LAYOUT_WITH_LEGEND()

- gantt:
  Start with "gantt"
  Syntax: "title ...", "dateFormat YYYY-MM-DD", "section SectionName", "Task Label : active, task1, 2026-06-14, 10d".

- timeline:
  Start with "timeline"
  Syntax: "title ...", "section Era", "Year : Event Title : Description".

- mindmap:
  Start with "mindmap"
  Root node on the first text line indent level 0: "root((Topic))".
  Branches/leaves indented by steps of 2 spaces. Supports shape wrappers. E.g. "  branch((ShapeLabel))" or "    leaf[SquareLabel]".

- quadrant:
  Start with "quadrantChart"
  Declare titles, axes: "x-axis LeftLabel --> RightLabel", "y-axis BottomLabel --> TopLabel". Declared quadrants: "quadrant-1 Q1Label", etc. Add items: "Item Name: [0.35, 0.72]".
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
  // Preceded by whitespace in valid Mermaid but may be squashed after word chars.
  // Use negative lookbehind (?<!\w) instead of \b to handle word-char→keyword.
  const PLAIN_KEYWORDS = [
    "direction",
    "classDef", "class",
    "participant", "actor", "autonumber", "loop", "rect", "opt", "alt", "else",
    "state", "dateFormat", "axisFormat", "section",
    "x-axis", "y-axis", "quadrant-1", "quadrant-2", "quadrant-3", "quadrant-4",
    "title", "end"
  ];

  // ── Category 4: Structural block keywords ────────────────────────────────
  // subgraph and end MUST always start on a fresh line regardless of what
  // character precedes them. They can appear after a word char ("TDsubgraph")
  // so (?<![\w]) lookbehind would block the match. Use unconditional pattern.
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


      // Special: direction TD/LR/TB/BT/RL — two passes:
      //  1. Ensure direction starts on its own line (split before it)
      //  2. Ensure NOTHING follows the direction value on the same line
      //     (e.g. "direction TDSystem_Boundary" → "direction TD\nSystem_Boundary")
      seg = seg.replace(/([^\n])(direction\s+(?:TD|LR|TB|BT|RL))/gi, "$1\n$2");
      seg = seg.replace(/(direction\s+(?:TD|LR|TB|BT|RL))(\S)/gi, "$1\n$2");


      // Category 3 — plain keywords: negative lookbehind (?<!\w) instead of
      // \b so we correctly split word-char→keyword (e.g. "Platformtitle").
      // NOTE: subgraph/end are intentionally excluded — they live in Cat 4.
      for (const kw of PLAIN_KEYWORDS) {
        const escaped = kw.replace(/[-]/g, "\\-");
        const regex = new RegExp(`([^\\n])((?<![\\w])${escaped}(?:\\s+|:|(?=\\s*$)))`, "g");
        seg = seg.replace(regex, "$1\n$2");
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

  // 1. flowchart/graph + direction squashed against subgraph / end.
  //    Use explicit direction alternation instead of \w+ so "TD" isn't
  //    consumed together with the following keyword as one token.
  const DIR = "(?:TD|LR|TB|BT|RL)";
  clean = clean.replace(new RegExp(`(flowchart\\s+${DIR})(subgraph)`, "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`(flowchart\\s+${DIR})(graph)`,    "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`(graph\\s+${DIR})(subgraph)`,     "gi"), "$1\n$2");
  clean = clean.replace(new RegExp(`(graph\\s+${DIR})(graph)`,        "gi"), "$1\n$2");

  // 2. Any remaining keyword-to-keyword merges that survived the loop
  clean = clean.replace(/(subgraph\s+\S+)(subgraph)/gi, "$1\n$2");
  clean = clean.replace(/(\bend\b)(subgraph)/gi,         "$1\n$2");
  clean = clean.replace(/(\bend\b)(flowchart)/gi,        "$1\n$2");
  clean = clean.replace(new RegExp(`(flowchart\\s+${DIR})(end\\b)`, "gi"), "$1\n$2");

  // LAYOUT_WITH_LEGEND always on its own line
  clean = clean.replace(/\s*LAYOUT_WITH_LEGEND(\(\))?\s*/gi, "\nLAYOUT_WITH_LEGEND()\n");
  // Collapse excessive blank lines
  clean = clean.replace(/\n{3,}/g, "\n\n");
  return clean.trim();
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

  // Try Gemini first if the API key is configured
  if (process.env.GEMINI_API_KEY) {
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
  } else {
    geminiError = new Error("GEMINI_API_KEY environment variable is not defined.");
  }

  // If Gemini failed or was skipped, try GROQ fallback
  if (process.env.GROQ_API_KEY) {
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
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
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
      const parsed = JSON.parse(cleanJson);

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
      const parsed = JSON.parse(cleanJson);

      return NextResponse.json({ blueprint: parsed });

    } else {
      return NextResponse.json({ error: "Invalid 'stage' value." }, { status: 400 });
    }

  } catch (error: any) {
    console.error("API error inside /api/generate:", error);
    return NextResponse.json({ error: error.message || "An unexpected error occurred." }, { status: 500 });
  }
}
