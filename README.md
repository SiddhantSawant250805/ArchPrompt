# ArchPrompt — AI-Powered Architecture Diagram Studio

> **Transform natural language into stunning, editable architecture diagrams in seconds.**

ArchPrompt is a production-quality, enterprise-grade systems design and architecture visualizer. It ingests a plaintext description of any software system, process, cloud infrastructure, or workflow and synthesizes **two fully synchronized visual outputs** — an interactive Mermaid.js diagram and a native, editable draw.io vector canvas — through a robust 3-stage AI compilation pipeline.

---

## ✨ Feature Overview

| Feature | Description |
|---|---|
| 🤖 **3-Stage AI Pipeline** | Parse → Mermaid Compile → Draw.io Compile |
| 🗺️ **12 Diagram Types** | Flowcharts, C4, Sequence, ER, Class, State, Gantt, Timeline, Mindmap, Quadrant |
| 🖊️ **Live draw.io Editor** | Native embedded diagrams.net with full edit/export support |
| 🔄 **Bidirectional Sync** | Edit in Draw.io and sync changes back to Mermaid canvas |
| 🔎 **Pan & Zoom Canvas** | Mouse wheel zoom, drag-to-pan, auto-fit, and center controls |
| 🧠 **AI Co-pilot Refinement** | Natural language patch instructions that re-run the pipeline |
| 📁 **File Upload Support** | Attach `.txt`, `.json`, `.yaml`, `.md`, `.csv` as prompt context |
| 🕐 **Session History** | LocalStorage-persisted, recall and re-render any previous diagram |
| 🛠️ **Blueprint Inspector** | View and edit the structural JSON node/edge graph live |
| 📤 **Multi-format Export** | SVG, transparent PNG (2×), `.drawio`, `.mmd` raw source |
| 🔐 **GitHub Export** | Push diagrams directly to GitHub repositories |
| 🔒 **Robust Sanitization** | Multi-pass, quote-boundary-aware Mermaid statement splitter |
| ⚡ **Compiler Method Selector** | Visual (SVG-coordinate), Deterministic, or Gemini AI draw.io compilation |

---

## 🧠 AI Compilation Pipeline

Every generation run executes a sequential 3-stage LLM pipeline:

```
[User Prompt + File Attachment]
          │
          ▼
┌─────────────────────────────────────────┐
│  STAGE 1 — Blueprint Parser             │
│  Model: gemini-3.5-flash                │
│  Output: Structured Blueprint JSON      │
│  • Identifies diagram kind              │
│  • Maps components to groups/nodes      │
│  • Generates emoji-enriched labels      │
│  • Assigns types, shapes, relationships │
└────────────────┬────────────────────────┘
                 │ Blueprint JSON
                 ▼
┌─────────────────────────────────────────┐
│  STAGE 2 — Mermaid Compiler             │
│  Model: gemini-3.5-flash                │
│  Output: Mermaid v10 source code        │
│  • Strict newline-per-statement rules   │
│  • Per-diagram-type syntax guidance     │
│  • Color palette via classDef blocks    │
│  • Server-side sanitizeContent() pass   │
└────────────────┬────────────────────────┘
                 │ Mermaid code → SVG (client-side)
                 ▼
┌─────────────────────────────────────────┐
│  STAGE 3 — Draw.io Compiler             │
│  Output: mxGraph/mxfile XML             │
│  • 3 selectable methods (see below)     │
│  • Orthogonal edge routing              │
│  • Enterprise dark-mode palette         │
│  • Relative coordinate geometry         │
└─────────────────────────────────────────┘
```

### Stage 1 — Blueprint Parser (`PARSER_SYSTEM`)

Transforms free-form text into a normalized JSON blueprint:

- **12 diagram kinds**: `flowchart`, `sequence`, `er`, `class`, `state`, `c4context`, `c4container`, `c4component`, `gantt`, `timeline`, `mindmap`, `quadrant`
- **Snake_case node IDs** with zero spaces or special characters
- **Mandatory emoji labels** on all nodes (e.g., `🚀 API Gateway`, `🗄️ PostgreSQL`)
- **8–40 nodes** auto-scaled to input complexity
- **Referential integrity** — every edge `from`/`to` must match a declared node ID

```jsonc
// Example Blueprint JSON (abbreviated)
{
  "diagramKind": "flowchart",
  "direction": "LR",
  "title": "E-Commerce Platform",
  "groups": [
    {
      "id": "group_api",
      "label": "API Layer",
      "nodes": [
        { "id": "api_gw", "label": "🚀 API Gateway", "shape": "stadium", "type": "gateway" }
      ]
    }
  ],
  "edges": [
    { "from": "api_gw", "to": "auth_svc", "label": "validates", "style": "solid" }
  ]
}
```

### Stage 2 — Mermaid Compiler (`buildCompilerPrompt`)

Converts blueprint JSON into Mermaid v10 syntax. The system prompt enforces:

- **Zero markdown fences** — raw code output only
- **One statement per line** — strict newline separation for every keyword, boundary, and declaration
- **Diagram-specific syntax** with separate rule sets for all 12 diagram kinds
- **Flowchart init directives** (`%%{init: {"flowchart": {"curve": "stepBefore"}}}%%`) for orthogonal edges
- **Color classDef palette** — consistent enterprise dark-mode colors per node type
- **Correct-spacing examples** embedded in the prompt as few-shot guidance for each diagram kind

### Stage 3 — Draw.io Compiler (3 selectable methods)

| Method | Description |
|---|---|
| **Deterministic** (default) | Pure TypeScript geometry engine in `lib/drawioCompiler.ts`, creates fully editable shapes with proper layout, no AI, no network calls |
| **Visual** | Parses rendered Mermaid SVG screen coordinates → maps to absolute `mxGeometry` for pixel-perfect visual parity |
| **Gemini AI** | Blueprint sent to Gemini with full `buildDrawioCompilerPrompt()` mxGraph style instructions |

---

## 🛡️ Mermaid Robustness System

A multi-layer defense against AI-generated Mermaid lexical errors (e.g., `title Platformdirection TDPerson(`):

### 1. Server-Side `sanitizeContent()` — Multi-Pass (`app/api/generate/route.ts`)

Runs immediately after Stage 2 API response, before returning to the client:

- Strips markdown code fences (` ```mermaid `, ` ```json `, ` ```xml `)
- **Multi-pass `do-while` loop** — the core fix. A single regex sweep can only inject one newline per match per keyword. When three statements are squashed on one line (e.g. `title X` + `direction TD` + `Person(`), a single pass only separates the first squash. The loop re-runs `applySplitPass()` until the output is fully stable (idempotent), capped at 20 iterations.
- **Quote-boundary-aware** — splits the code string on `"` characters and only operates on even-indexed (outside-quote) segments to avoid corrupting node label strings
- Normalizes `LAYOUT_WITH_LEGEND()` to its own line
- Collapses 3+ consecutive newlines to 2

### 2. Client-Side `sanitizeMermaidCode()` — Multi-Pass (`app/page.tsx`)

Mirrors the server sanitizer as a second-chance pass before `mermaid.render()`:

- Identical `applySplitPass()` loop with the same keyword dictionaries
- Re-splits on `"` each pass so newly-inserted newlines correctly shift segment boundaries
- Catches any edge cases introduced by client-side string handling

### 3. `validateMermaidStatements()` Pre-render Interceptor (`app/page.tsx`)

Runs between sanitization and rendering:

- Scans every line for squashed statement patterns using keyword lookaheads
- Reports the **exact line number and content** to the UI Diagnostics panel
- Surfaces errors before `mermaid.render()` is called

### 4. Tightened System Prompt

`buildCompilerPrompt()` explicitly states:

> *"Each statement, keyword, boundary block start/end, relationship, title, and direction declaration MUST be on its own separate newline. You must NEVER combine or squash multiple statements onto a single line."*

With correct-spacing examples for every supported diagram kind.

---

## 🎨 Design System

### Node Color Palette

| Node Type | Fill | Stroke | Draw.io Shape |
|---|---|---|---|
| `service` | `#111215` | `#d4ff00` (neon lime) | Rounded rect |
| `database` | `#101614` | `#38d9c0` (teal) | Cylinder |
| `external` | `#14111a` | `#a855f7` (purple) | Rounded rect |
| `ui` | `#1c1a12` | `#fbbf24` (amber) | Rounded rect |
| `queue` | `#1c1110` | `#ef4444` (red) | Hexagon |
| `gateway` | `#0f161a` | `#0ea5e9` (sky blue) | Stadium |
| `process` | `#111215` | `#999999` (gray) | Rounded rect |
| `person` | `#0c1524` | `#3b82f6` (blue) | Rounded rect |

### Animation & Motion

Built with `motion/react` (Framer Motion):

- Page entrance animations on studio panels
- Toast notification slide-in/out transitions
- Loading state shimmer effects
- Smooth tab content transitions with `AnimatePresence`

---

## 🖥️ UI Architecture (`app/page.tsx`)

Single-page React component (~2,700 lines) with these major sections:

### Input Studio (Left Panel)

- **Prompt textarea** — free-form architecture description
- **Diagram type selector** — auto-detect or pick from 12 types
- **Compiler method selector** — Visual / Deterministic / Gemini
- **Example templates** — 7 pre-built architecture prompts
- **File attachment** — upload text/JSON/YAML/Markdown as supplementary context
- **Generate / Reset controls**

### Output Canvas (Center)

- **Mermaid SVG canvas** — rendered client-side, pannable and zoomable via mouse/trackpad
- **Pan & zoom controls** — fit-view, center, zoom in/out, reset, scale readout
- **draw.io iframe editor** — live `embed.diagrams.net` with postMessage bi-directional sync
- **Tab navigation** — Diagram | Draw.io Editor | Mermaid Code | Blueprint JSON

### Inspector Panel (Right)

- **Inspector tab** — node property viewer/editor, quick-add node/edge forms
- **Diagnostics tab** — Mermaid statement validation log with line-number error reporting
- **AI Co-pilot** — inline refinement prompt calling the `REFINER_SYSTEM` to patch the live blueprint
- **History sidebar** — LocalStorage-backed session history with one-click recall

### Export Controls

- **SVG** — inline transparent vector
- **PNG** — 2× resolution transparent raster via Canvas API
- **`.drawio`** — raw mxGraph XML
- **`.mmd`** — raw Mermaid source

---

## 📐 Deterministic Draw.io Compiler (`lib/drawioCompiler.ts`)

Pure TypeScript geometry engine generating mxGraph XML from blueprint JSON with zero AI:

### Layout Algorithm

1. Iterates blueprint groups and assigns each a swimlane container
2. **Direction-aware grid** — more columns for `LR`, fewer for `TD`
3. Distributes nodes on a padded grid inside each container (`nodeWidth=180`, `nodeHeight=65`)
4. Calculates container bounding boxes from node count (minimum 120px gutters)
5. **Optional SVG coordinate mapping** — parses `transform="translate(x,y)"` from rendered Mermaid SVG to mirror real layout positions into `mxGeometry`

### Style Functions

- `getNodeStyle(type, shape)` — builds full mxGraph style string from the palette above
- `getEdgeStyle(style, exitPort, entryPort)` — constructs orthogonal edge style strings with optional port hints
- All edges use `edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonal=1;jettySize=auto`

---

## 🔌 API Route (`app/api/generate/route.ts`)

Single Next.js App Router endpoint handling all 3 pipeline stages:

### `POST /api/generate`

```jsonc
// Request body
{
  "stage": 1 | 2 | 3,         // Which pipeline stage to run
  "prompt": "...",             // Stage 1: natural language description
  "diagramType": "auto",       // Stage 1: diagram type hint
  "fileContent": "...",        // Stage 1: optional file attachment content
  "blueprint": { ... },        // Stage 2 & 3: Blueprint JSON from Stage 1
  "modificationPrompt": "..."  // Refiner mode: co-pilot patch instruction
}
```

**Stage routing:**
- `stage: 1` → `PARSER_SYSTEM` (or `REFINER_SYSTEM` if `modificationPrompt` present)
- `stage: 2` → `buildCompilerPrompt(kind, direction)` → returns `{ code: string }`
- `stage: 3` → `buildDrawioCompilerPrompt(kind, direction)` → returns `{ xml: string }`

All text responses pass through `sanitizeContent()` (multi-pass) before returning.

**Model:** `gemini-3.5-flash` at temperature `0.1` for low-variance structured outputs.

---

## 📁 Repository Structure

```
ArchPrompt/
├── app/
│   ├── api/
│   │   ├── generate/route.ts    ← 3-stage LLM pipeline API endpoint
│   │   └── github-push/route.ts ← GitHub repository export endpoint
│   ├── globals.css              ← Design tokens, dark-mode theme, animations
│   ├── layout.tsx               ← App layout and font integration
│   └── page.tsx                 ← Full studio UI (~2,700 lines)
├── lib/
│   ├── drawioCompiler.ts        ← Deterministic mxGraph XML geometry engine
│   └── utils.ts                 ← Shared utility helpers
├── hooks/
│   └── use-mobile.ts            ← Responsive viewport detection
├── assets/                      ← Static images and icons
├── .env.example                 ← Environment variable reference
├── metadata.json                ← App descriptor metadata
├── next.config.ts               ← Next.js configuration
├── package.json                 ← Node.js dependencies
└── README.md                    ← This file
```

---

## 🔧 Setup

### Prerequisites

- Node.js 18+
- A Google Gemini API key ([get one at AI Studio](https://aistudio.google.com/apikey))
- (Optional) A GitHub Personal Access Token for diagram export to repositories

### Installation

```bash
git clone https://github.com/your-org/archprompt.git
cd archprompt
npm install
cp .env.example .env
# Edit .env and add your API key
npm run dev
# Open http://localhost:3000
```

### Environment Variables

```env
# Required — only ever used server-side, never exposed to the browser
GEMINI_API_KEY="your-gemini-api-key"

# Optional — for GitHub export functionality
GITHUB_TOKEN="your-github-pat-with-repo-permissions"
```

---

## 🔄 Bidirectional Sync

ArchPrompt supports bidirectional synchronization between the Mermaid canvas and the Draw.io editor:

### Canvas to Draw.io
- When you generate a diagram, it automatically loads into the Draw.io editor
- The **Deterministic** compiler method (now default) creates editable, selectable shapes with proper layout
- Switch between Visual (pixel-perfect), Deterministic (editable), or Gemini AI methods

### Draw.io to Canvas
1. Edit your diagram in the Draw.io Editor tab
2. Click **Sync to Canvas** button in the toolbar
3. The updated diagram renders back to the Mermaid canvas preview

This allows you to:
- Start with AI-generated architecture
- Refine using Draw.io's visual tools
- See changes reflected in both views

---

## 📤 GitHub Export

Push diagrams directly to your GitHub repositories:

1. Generate or edit a diagram
2. Click **GitHub** button in the canvas or export panel
3. Select format: Draw.io (.drawio), SVG, or Mermaid (.mmd)
4. Enter repository owner, name, branch, and file path
5. Click **Push to GitHub**

**Requirements:**
- `GITHUB_TOKEN` environment variable with repo permissions
- Valid GitHub repository (create one if needed)

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS v4 with custom dark enterprise design tokens |
| **Animation** | `motion/react` (Framer Motion) |
| **Diagram Rendering** | Mermaid.js v10 (CDN, client-side) |
| **Vector Editor** | diagrams.net embedded iframe (`embed.diagrams.net`) |
| **AI / LLM** | Google Gemini 3.5 Flash via `@google/genai` |
| **Icons** | `lucide-react` |

---

## 🗺️ Supported Diagram Types

| Type | Mermaid Syntax | Typical Use Case |
|---|---|---|
| `flowchart` | `flowchart TD/LR` | Cloud infra, pipelines, system overviews |
| `sequence` | `sequenceDiagram` | Message flows, API interactions |
| `er` | `erDiagram` | Database schemas |
| `class` | `classDiagram` | OOP design, domain models |
| `state` | `stateDiagram-v2` | State machines, lifecycle flows |
| `c4context` | `C4Context` | System-level context views |
| `c4container` | `C4Container` | Container/app/service boundaries |
| `c4component` | `C4Component` | Internal component detail |
| `gantt` | `gantt` | Project timelines, roadmaps |
| `timeline` | `timeline` | Event chronology |
| `mindmap` | `mindmap` | Brainstorming, concept maps |
| `quadrant` | `quadrantChart` | 2×2 prioritization matrices |

---

## 📝 Built-in Example Templates

| Template | Description |
|---|---|
| **microservices** | E-commerce platform with API gateway, Kafka, PostgreSQL per-service |
| **auth** | OAuth 2.0 / OIDC flow with authorization server and token lifecycle |
| **ci** | GitHub Actions CI/CD pipeline to ECS with staging/production gate |
| **database** | E-commerce relational schema with all FK relationships |
| **cloud** | AWS VPC, ALB, ECS Fargate, RDS Aurora, ElastiCache, CloudFront |
| **c4** | C4 Context diagram for an online banking platform |
| **roadmap** | 12-month SaaS product roadmap with quarterly milestones |

---

*Enjoy modeling enterprise architectures! ⚡*
