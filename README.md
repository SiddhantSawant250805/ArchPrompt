# ArchPrompt — AI-Powered Architecture Diagram Studio

ArchPrompt is an advanced, production-quality systems design and architecture visualizer. It takes plaintext architecture descriptions and synthesizes **two synchronized outputs**:
1. An **interactive Mermaid.js diagram** with high-performance pan, zoom, and fit-view capabilities.
2. A **native draw.io (mxGraph) diagram** embedded directly into a live editors.net iframe – backed by fully editable, selectable vector elements instead of a flat image.

---

## 🚀 Key Features

- **Sequential 3-Stage Compilation Pipeline:**
  1. **Stage 1 (Parse):** Reads raw text inputs and maps them logically into structured architectural components (JSON schema).
  2. **Stage 2 (Mermaid Compile):** Compiles the component blueprints into Mermaid code for high-performance viewport previews.
  3. **Stage 3 (Draw.io Compile):** Synthesizes selectable nodes and lines with custom orthographic routing configurations directly compatible with Diagrams.net XML specifications.
- **Unified Visual Palette Styles:** Features consistent color coding and element styling (UIs, databases, microservices, caches, external routers, security personas).
- **12 Comprehensive Blueprint Diagram Types:** Support for C4 Architecture Contexts, Containers, and Components, standard Flowcharts, UML classes, Sequence lifelines, State charts, timelines, calendars, mindmaps, Gantt timelines, and 2x2 classifications.
- **Export Formats:** Scalable transparent SVGs, transparent double-resolution PNGs, standard `.drawio` vectors, and `.mmd` raw compiler code.

---

## 🛠 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Styling:** Tailwind CSS (v4) with customized dark enterprise branding custom properties
- **Core Visual Engines:** Mermaid.js (v10 via CDN) & embedded diagrams.net vector canvas
- **Language Models:** Google Gemini 3.5 Flash (via `@google/genai` on server-side)

---

## 📁 Repository Structure

```
/
├── app/
│   ├── api/generate/route.ts  ← server-side parallel LLM compiler pipelines
│   ├── layout.tsx             ← font integrations and app layout wrapping
│   ├── globals.css            ← design tokens, styles, scrollbars, and customized animations
│   └── page.tsx               ← full responsive frontend design studio and editor
├── hooks/
│   └── use-mobile.ts          ← responsive device adapter
├── .env.example               ← environment variables references
├── metadata.json              ← app descriptor metadata configuration
├── package.json               ← standard Node dependency definitions
└── README.md                  ← setup and documentation reference
```

---

## 🔧 Environment Variables

Register your API keys inside the secret console.
These are safely handled server-side within the compilation endpoint:
```env
# GEMINI_API_KEY: Required for Gemini AI API calls.
GEMINI_API_KEY="your-gemini-api-key"
```
No frontend API key inputs or local configurations are required.

Enjoy modeling enterprise architectures! ⚡
