import { resolveLogoForNode, LogoEntry } from "./logoRegistry";

// ── XML escaping helper ───────────────────────────────────────────────────────
function escapeXml(unsafe: string): string {
  if (!unsafe) return "";
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

// ── Dark theme base colors ────────────────────────────────────────────────────
const baseColors: Record<string, { fill: string; stroke: string; width: number }> = {
  service:  { fill: "#111215", stroke: "#d4ff00", width: 1.5 },
  database: { fill: "#101614", stroke: "#38d9c0", width: 1.5 },
  external: { fill: "#14111a", stroke: "#a855f7", width: 1.5 },
  ui:       { fill: "#1c1a12", stroke: "#fbbf24", width: 1.5 },
  queue:    { fill: "#1c1110", stroke: "#ef4444", width: 1.5 },
  gateway:  { fill: "#0f161a", stroke: "#0ea5e9", width: 1.5 },
  process:  { fill: "#111215", stroke: "#999999", width: 1   },
  person:   { fill: "#0c1524", stroke: "#3b82f6", width: 1.5 },
};

// ── Node style builder (flowchart) ────────────────────────────────────────────
function getNodeStyle(type: string, shape: string, logoPath?: string): string {
  const colors = baseColors[type] || baseColors.service;
  const parts: string[] = [
    "whiteSpace=wrap", "html=1", "fontSize=11",
    `fillColor=${colors.fill}`, `strokeColor=${colors.stroke}`,
    `strokeWidth=${colors.width}`, "fontColor=#F0F0F0", "fontStyle=1",
  ];
  if (shape === "diamond") {
    parts.push("shape=rhombus");
  } else if (shape === "cylinder" || type === "database") {
    parts.push("shape=cylinder3", "boundedLbl=1");
  } else if (shape === "hexagon" || type === "queue") {
    parts.push("shape=hexagon");
  } else if (shape === "stadium" || type === "gateway") {
    parts.push("rounded=1", "arcSize=50");
  } else {
    parts.push("rounded=1");
  }
  if (logoPath) {
    const fullLogoUrl = logoPath.startsWith("http")
      ? logoPath
      : (typeof window !== "undefined" ? window.location.origin : "") + logoPath;
    parts.push(`image;image=${fullLogoUrl}`, "imageAlign=left", "imageVerticalAlign=top", "imageWidth=20", "imageHeight=20");
  }
  return parts.join(";");
}

// ── Edge style builder (flowchart) ───────────────────────────────────────────
function getEdgeStyle(style: string, exitPort?: string, entryPort?: string): string {
  const parts: string[] = [
    "edgeStyle=orthogonalEdgeStyle", "rounded=0", "html=1",
    "strokeColor=#d4ff00", "strokeWidth=1.5", "fontColor=#F0F0F0",
    "fontSize=10", "labelBackgroundColor=#0A0A0A", "labelBorderColor=none",
    "orthogonal=1", "jettySize=auto",
  ];
  if (style === "dashed") parts.push("dashed=1");
  if (exitPort) parts.push(exitPort);
  if (entryPort) parts.push(entryPort);
  return parts.join(";");
}

// ── mxfile envelope ───────────────────────────────────────────────────────────
function mxfileOpen(pageWidth = 1400, pageHeight = 1000): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<mxfile host="ArchPrompt" modified="${new Date().toISOString()}" agent="ArchPrompt" version="21.5.0" type="device">\n` +
    `  <diagram id="diag_${Math.random().toString(36).substring(2, 9)}" name="Architecture">\n` +
    `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1.0" pageWidth="${pageWidth}" pageHeight="${pageHeight}" background="#0A0A0A" math="0" shadow="0">\n` +
    `      <root>\n` +
    `        <mxCell id="0"/>\n` +
    `        <mxCell id="1" parent="0"/>\n`
  );
}

function mxfileClose(): string {
  return `      </root>\n    </mxGraphModel>\n  </diagram>\n</mxfile>\n`;
}

// ── ID generator ─────────────────────────────────────────────────────────────
function makeIdGen(start = 2): () => number {
  let current = start;
  return () => current++;
}

// ════════════════════════════════════════════════════════════════════════════
// ER DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileErDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const direction     = (blueprint.direction || "TD").toUpperCase();

  const nextId  = makeIdGen(2);
  const cellMap: Record<string, number> = {}; // groupId / nodeId → cellId

  // Layout constants
  const tableW = 220;
  const rowH   = 30;
  const headerH = 32;
  const colGap = 100;
  const rowGap = 80;

  // Determine grid dimensions for table placement
  const count = groups.length;
  let gridCols = direction === "LR" ? count : Math.max(1, Math.ceil(Math.sqrt(count)));
  if (direction === "TD" && count > 3) gridCols = Math.ceil(count / 2);
  if (direction === "LR") gridCols = count;

  let xml = mxfileOpen(
    gridCols * (tableW + colGap) + colGap + 100,
    Math.ceil(count / gridCols) * (rowH * 8 + rowGap + headerH) + 200
  );

  // Render entity tables
  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const col = gi % gridCols;
    const row = Math.floor(gi / gridCols);
    const tableH = headerH + nodes.length * rowH;
    const gx = 60 + col * (tableW + colGap);
    const gy = 60 + row * (tableH + rowGap + 40);

    const tableId = nextId();
    cellMap[grp.id] = tableId;

    const tableStyle =
      "shape=table;html=1;whiteSpace=wrap;startSize=30;container=1;" +
      "collapsible=0;childLayout=tableLayout;fixedRows=1;rowLines=0;" +
      "fontStyle=1;align=center;resizeLast=1;" +
      "fillColor=#1a1a1a;strokeColor=#38d9c0;fontColor=#E0E0E0;fontSize=11;";

    xml += `        <mxCell id="${tableId}" value="${escapeXml(grp.label)}" style="${tableStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${tableW}" height="${tableH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    // Table rows (attributes)
    nodes.forEach((node) => {
      const rowId = nextId();
      cellMap[node.id] = rowId;
      const rowStyle =
        "shape=tableRow;horizontal=0;startSize=0;swimlaneHead=0;" +
        "fillColor=#111111;strokeColor=#333333;fontColor=#E0E0E0;html=1;";
      xml += `        <mxCell id="${rowId}" value="${escapeXml(node.label)}" style="${rowStyle}" vertex="1" parent="${tableId}">\n`;
      xml += `          <mxGeometry y="${headerH + (nodes.indexOf(node)) * rowH}" width="${tableW}" height="${rowH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  // Render relationships
  edges.forEach((edge) => {
    const srcId = cellMap[edge.from] ?? cellMap[edge.from];
    const tgtId = cellMap[edge.to]   ?? cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const edgeStyle =
      "edgeStyle=entityRelationEdgeStyle;endArrow=ERmanyToOne;startArrow=ERone;" +
      "exitX=1;exitY=0.5;entryX=0;entryY=0.5;html=1;" +
      `strokeColor=#38d9c0;fontColor=#E0E0E0;${edge.style === "dashed" ? "dashed=1;" : ""}`;
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${edgeStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// SEQUENCE DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileSequenceDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];

  // Flatten all nodes across groups into a participant list
  const participants: any[] = [];
  const seen = new Set<string>();
  for (const g of groups) {
    for (const n of g.nodes || []) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        participants.push(n);
      }
    }
  }
  // Also ensure every node referenced in edges exists
  for (const e of edges) {
    for (const nid of [e.from, e.to]) {
      if (nid && !seen.has(nid)) {
        seen.add(nid);
        participants.push({ id: nid, label: nid, type: "service", shape: "rect" });
      }
    }
  }

  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const partW = 130;
  const partH = 44;
  const partGap = 60; // space between participants
  const lifelineH = 500;
  const lifelineY = 80;    // top of lifeline (below participant box)
  const firstMsgY = 140;   // y of first message arrow
  const msgStep = 60;      // vertical spacing between messages
  const startX = 60;

  const pageW = startX * 2 + participants.length * (partW + partGap);
  const pageH = firstMsgY + edges.length * msgStep + 120;

  let xml = mxfileOpen(pageW, pageH);

  // Participant boxes + lifelines
  participants.forEach((p, i) => {
    const px = startX + i * (partW + partGap);
    const py = 40;
    const centerX = px + partW / 2;

    const boxId = nextId();
    cellMap[p.id] = boxId;

    const boxStyle =
      "rounded=1;whiteSpace=wrap;html=1;fontSize=11;fontStyle=1;" +
      "fillColor=#1a1a2e;strokeColor=#38d9c0;fontColor=#E0E0E0;";
    xml += `        <mxCell id="${boxId}" value="${escapeXml(p.label)}" style="${boxStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${px}" y="${py}" width="${partW}" height="${partH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    // Lifeline (dashed vertical line)
    const llId = nextId();
    const llStyle =
      "endArrow=none;html=1;strokeColor=#38d9c0;strokeWidth=1;dashed=1;";
    xml += `        <mxCell id="${llId}" value="" style="${llStyle}" edge="1" parent="1">\n`;
    xml += `          <mxGeometry x="${centerX}" y="${lifelineY}" width="2" height="${lifelineH}" as="geometry">\n`;
    xml += `            <mxPoint x="${centerX}" y="${lifelineY}" as="sourcePoint"/>\n`;
    xml += `            <mxPoint x="${centerX}" y="${lifelineY + lifelineH}" as="targetPoint"/>\n`;
    xml += `          </mxGeometry>\n`;
    xml += `        </mxCell>\n`;
  });

  // Message arrows
  edges.forEach((edge, idx) => {
    const srcBox = cellMap[edge.from];
    const tgtBox = cellMap[edge.to];
    if (!srcBox || !tgtBox) return;

    const srcIdx = participants.findIndex((p) => p.id === edge.from);
    const tgtIdx = participants.findIndex((p) => p.id === edge.to);
    if (srcIdx < 0 || tgtIdx < 0) return;

    const srcCx = startX + srcIdx * (partW + partGap) + partW / 2;
    const tgtCx = startX + tgtIdx * (partW + partGap) + partW / 2;
    const my = firstMsgY + idx * msgStep;

    const msgId = nextId();
    const msgStyle =
      "edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#d4ff00;fontColor=#F0F0F0;" +
      "exitX=0.5;exitY=0.5;entryX=0.5;entryY=0.5;" +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${msgId}" value="${escapeXml(edge.label || "")}" style="${msgStyle}" edge="1" parent="1" source="${srcBox}" target="${tgtBox}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry">\n`;
    xml += `            <mxPoint x="${srcCx}" y="${my}" as="sourcePoint"/>\n`;
    xml += `            <mxPoint x="${tgtCx}" y="${my}" as="targetPoint"/>\n`;
    xml += `          </mxGeometry>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// CLASS DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileClassDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const direction     = (blueprint.direction || "TD").toUpperCase();

  const nextId  = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const classW = 180;
  const classH = 60;
  const colGap  = 100;
  const rowGap  = 80;
  const pkgPadL = 30;
  const pkgPadT = 50;
  const pkgPadR = 30;
  const pkgPadB = 30;

  const totalGroups = groups.length;
  const gridCols = direction === "LR" ? totalGroups : Math.max(1, Math.ceil(Math.sqrt(totalGroups)));

  let xml = mxfileOpen(
    gridCols * (classW + colGap + pkgPadL + pkgPadR) + 100,
    Math.ceil(totalGroups / gridCols) * (classH + rowGap + pkgPadT + pkgPadB) + 200
  );

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const col = gi % gridCols;
    const row = Math.floor(gi / gridCols);

    const pkgCols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const pkgRows = Math.ceil(nodes.length / pkgCols);
    const pkgW = pkgPadL + pkgPadR + pkgCols * classW + (pkgCols - 1) * colGap;
    const pkgH = pkgPadT + pkgPadB + pkgRows * classH + (pkgRows - 1) * rowGap;
    const gx = 60 + col * (pkgW + colGap);
    const gy = 60 + row * (pkgH + rowGap);

    const pkgId = nextId();
    cellMap[grp.id] = pkgId;
    const pkgStyle =
      "swimlane;html=1;childLayout=stackLayout;horizontal=1;startSize=26;" +
      "fillColor=#1a1a2e;strokeColor=#6366f1;strokeWidth=1.5;" +
      "fontColor=#E0E0E0;fontSize=11;fontStyle=1;dashed=1;";
    xml += `        <mxCell id="${pkgId}" value="${escapeXml(grp.label)}" style="${pkgStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${pkgW}" height="${pkgH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    nodes.forEach((node, ni) => {
      const nc = ni % pkgCols;
      const nr = Math.floor(ni / pkgCols);
      const nx = pkgPadL + nc * (classW + colGap);
      const ny = pkgPadT + nr * (classH + rowGap);

      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const umlStyle =
        "shape=mxgraph.flowchart.start_1;whiteSpace=wrap;html=1;fontSize=11;fontStyle=1;" +
        "fillColor=#1a1a2e;strokeColor=#6366f1;fontColor=#E0E0E0;";
      // Use a plain rounded rect for classes — mxgraph.flowchart.start_1 is a circle
      const classStyle =
        "rounded=1;whiteSpace=wrap;html=1;fontSize=11;fontStyle=1;" +
        "fillColor=#111827;strokeColor=#6366f1;fontColor=#E0E0E0;";
      void umlStyle; // suppress unused warning
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${classStyle}" vertex="1" parent="${pkgId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${classW}" height="${classH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  // Edges — inheritance uses open arrow
  edges.forEach((edge) => {
    const srcId = cellMap[edge.from];
    const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const isInheritance = (edge.label || "").toLowerCase().includes("extend") ||
                          (edge.label || "").toLowerCase().includes("inherit");
    const edgeStyle =
      `edgeStyle=orthogonalEdgeStyle;html=1;` +
      `strokeColor=#6366f1;fontColor=#E0E0E0;` +
      (isInheritance ? "endArrow=block;endFill=0;" : "endArrow=open;endFill=0;") +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${edgeStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// STATE DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileStateDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const direction     = (blueprint.direction || "TD").toUpperCase();

  const nextId  = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 140;
  const nodeH = 50;
  const colGap = 80;
  const rowGap = 70;

  // Flatten all nodes
  const allNodes: any[] = groups.flatMap((g) => g.nodes || []);
  const cols = direction === "LR" ? allNodes.length : Math.max(1, Math.ceil(Math.sqrt(allNodes.length)));

  const pageW = cols * (nodeW + colGap) + 120;
  const pageH = Math.ceil(allNodes.length / cols) * (nodeH + rowGap) + 120;

  let xml = mxfileOpen(pageW, pageH);

  allNodes.forEach((node, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const nx = 60 + c * (nodeW + colGap);
    const ny = 60 + r * (nodeH + rowGap);

    const nodeId = nextId();
    cellMap[node.id] = nodeId;

    const isInitial = (node.label || "").toLowerCase().includes("start") ||
                      (node.label || "").toLowerCase().includes("initial") ||
                      (node.label || "").toLowerCase() === "init";
    const isFinal   = (node.label || "").toLowerCase().includes("end") ||
                      (node.label || "").toLowerCase().includes("final") ||
                      (node.label || "").toLowerCase() === "stop";

    let style: string;
    if (isInitial) {
      style = "ellipse;aspect=fixed;fillColor=#38d9c0;strokeColor=#38d9c0;fontColor=#000;fontSize=10;";
    } else if (isFinal) {
      style = "doubleEllipse;aspect=fixed;fillColor=#d4ff00;strokeColor=#d4ff00;fontColor=#000;fontSize=10;";
    } else {
      style = "rounded=1;whiteSpace=wrap;html=1;fontSize=11;fontStyle=1;" +
              "fillColor=#1a1a2e;strokeColor=#38d9c0;fontColor=#E0E0E0;";
    }

    xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${style}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${nx}" y="${ny}" width="${isInitial || isFinal ? 30 : nodeW}" height="${isInitial || isFinal ? 30 : nodeH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  // Transition arrows
  edges.forEach((edge) => {
    const srcId = cellMap[edge.from];
    const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const edgeStyle =
      "edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#d4ff00;fontColor=#E0E0E0;" +
      "endArrow=block;endFill=1;" +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${edgeStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// C4 DIAGRAM (context / container / component)
// ════════════════════════════════════════════════════════════════════════════
function compileC4Diagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const direction     = (blueprint.direction || "TD").toUpperCase();

  const nextId  = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 160;
  const nodeH = 80;
  const colGap = 60;
  const rowGap = 60;
  const pkgPadL = 30;
  const pkgPadT = 50;
  const pkgPadR = 30;
  const pkgPadB = 30;

  const totalGroups = groups.length;
  const gridCols = direction === "LR" ? totalGroups : Math.max(1, Math.ceil(Math.sqrt(totalGroups)));

  let xml = mxfileOpen(
    gridCols * (nodeW + colGap + pkgPadL + pkgPadR) + 100,
    Math.ceil(totalGroups / gridCols) * (nodeH + rowGap + pkgPadT + pkgPadB) + 200
  );

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const col = gi % gridCols;
    const row = Math.floor(gi / gridCols);

    const pkgCols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    const pkgRows = Math.ceil(nodes.length / pkgCols);
    const pkgW = pkgPadL + pkgPadR + pkgCols * nodeW + (pkgCols - 1) * colGap;
    const pkgH = pkgPadT + pkgPadB + pkgRows * nodeH + (pkgRows - 1) * rowGap;
    const gx = 60 + col * (pkgW + colGap);
    const gy = 60 + row * (pkgH + rowGap);

    const pkgId = nextId();
    cellMap[grp.id] = pkgId;
    const boundaryStyle =
      "swimlane;startSize=30;fillColor=#1a1a2e;strokeColor=#444444;strokeWidth=1;" +
      "dashed=1;fontColor=#E0E0E0;fontSize=11;fontStyle=1;";
    xml += `        <mxCell id="${pkgId}" value="${escapeXml(grp.label)}" style="${boundaryStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${pkgW}" height="${pkgH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    nodes.forEach((node, ni) => {
      const nc = ni % pkgCols;
      const nr = Math.floor(ni / pkgCols);
      const nx = pkgPadL + nc * (nodeW + colGap);
      const ny = pkgPadT + nr * (nodeH + rowGap);

      const nodeId = nextId();
      cellMap[node.id] = nodeId;

      const ntype = (node.type || "system").toLowerCase();
      let nodeStyle: string;
      if (ntype === "person") {
        nodeStyle =
          "shape=mxgraph.c4.person2;whiteSpace=wrap;html=1;" +
          "fillColor=#08427b;strokeColor=#073b6f;fontColor=#ffffff;fontSize=11;";
      } else if (ntype === "external" || ntype === "external_system") {
        nodeStyle =
          "rounded=1;whiteSpace=wrap;html=1;" +
          "fillColor=#8c4a58;strokeColor=#7a3b4a;fontColor=#ffffff;fontSize=11;";
      } else if (ntype === "container") {
        nodeStyle =
          "rounded=1;whiteSpace=wrap;html=1;" +
          "fillColor=#438dd5;strokeColor=#3c7fc0;fontColor=#ffffff;fontSize=11;";
      } else {
        // system / service / default
        nodeStyle =
          "rounded=1;whiteSpace=wrap;html=1;" +
          "fillColor=#1168bd;strokeColor=#0e5ba6;fontColor=#ffffff;fontSize=11;";
      }

      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nodeStyle}" vertex="1" parent="${pkgId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  // Relationships — dashed arrows
  edges.forEach((edge) => {
    const srcId = cellMap[edge.from];
    const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const edgeStyle =
      "edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#38d9c0;fontColor=#E0E0E0;" +
      "dashed=1;endArrow=block;endFill=1;";
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${edgeStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// MINDMAP
// ════════════════════════════════════════════════════════════════════════════
function compileMindmapDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];

  const nextId  = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  // Flatten all nodes
  const allNodes: any[] = groups.flatMap((g) => g.nodes || []);

  // Root: first node of first group or synthesised from title
  const rootNode = allNodes[0] || { id: "__root__", label: blueprint.title || "Mindmap" };
  const children = allNodes.slice(1);

  const rootW = 180;
  const rootH = 60;
  const nodeW = 140;
  const nodeH = 44;
  const centerX = 600;
  const centerY = 400;
  const radius = 250;

  const pageW = 1200;
  const pageH = 900;

  let xml = mxfileOpen(pageW, pageH);

  // Root cell
  const rootId = nextId();
  cellMap[rootNode.id] = rootId;
  const rootStyle =
    "ellipse;whiteSpace=wrap;html=1;fontSize=13;fontStyle=1;" +
    "fillColor=#d4ff00;strokeColor=#b8e000;fontColor=#0A0A0A;";
  xml += `        <mxCell id="${rootId}" value="${escapeXml(rootNode.label)}" style="${rootStyle}" vertex="1" parent="1">\n`;
  xml += `          <mxGeometry x="${centerX - rootW / 2}" y="${centerY - rootH / 2}" width="${rootW}" height="${rootH}" as="geometry"/>\n`;
  xml += `        </mxCell>\n`;

  // Child nodes — arranged in a circle around root
  children.forEach((node, i) => {
    const angle = (2 * Math.PI * i) / Math.max(children.length, 1);
    const nx = centerX + radius * Math.cos(angle) - nodeW / 2;
    const ny = centerY + radius * Math.sin(angle) - nodeH / 2;

    const nodeId = nextId();
    cellMap[node.id] = nodeId;
    const nodeStyle =
      "rounded=1;whiteSpace=wrap;html=1;fontSize=11;" +
      "fillColor=#1a1a2e;strokeColor=#38d9c0;fontColor=#E0E0E0;";
    xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nodeStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${Math.round(nx)}" y="${Math.round(ny)}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    // Connect to root
    const connId = nextId();
    const connStyle = "edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#38d9c0;endArrow=none;";
    xml += `        <mxCell id="${connId}" value="" style="${connStyle}" edge="1" parent="1" source="${rootId}" target="${nodeId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  // Additional edges from blueprint
  edges.forEach((edge) => {
    const srcId = cellMap[edge.from];
    const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const edgeStyle =
      "edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#d4ff00;fontColor=#E0E0E0;" +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${edgeStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// GANTT / TIMELINE — horizontal bar layout
// ════════════════════════════════════════════════════════════════════════════
function compileGanttDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const allNodes: any[] = groups.flatMap((g) => g.nodes || []);

  const nextId  = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const rowH    = 36;
  const rowGap  = 10;
  const barW    = 200;
  const labelW  = 180;
  const startX  = labelW + 40;
  const startY  = 60;
  const barColors = ["#1168bd", "#38d9c0", "#d4ff00", "#a855f7", "#ef4444", "#fbbf24"];

  const pageW = startX + barW + 200;
  const pageH = startY + allNodes.length * (rowH + rowGap) + 60;

  let xml = mxfileOpen(pageW, pageH);

  allNodes.forEach((node, idx) => {
    const ny = startY + idx * (rowH + rowGap);
    const fillColor = barColors[idx % barColors.length];

    // Label cell
    const lblId = nextId();
    cellMap[node.id] = lblId;
    const lblStyle =
      "text;html=1;strokeColor=none;fillColor=none;align=right;" +
      "fontColor=#E0E0E0;fontSize=11;verticalAlign=middle;";
    xml += `        <mxCell id="${lblId}" value="${escapeXml(node.label)}" style="${lblStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="10" y="${ny}" width="${labelW}" height="${rowH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    // Bar cell
    const barId = nextId();
    const barStyle =
      `rounded=1;whiteSpace=wrap;html=1;fontSize=10;` +
      `fillColor=${fillColor};strokeColor=none;fontColor=#000000;`;
    xml += `        <mxCell id="${barId}" value="" style="${barStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${startX}" y="${ny}" width="${barW}" height="${rowH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// QUADRANT CHART — 2×2 grid with dot nodes
// ════════════════════════════════════════════════════════════════════════════
function compileQuadrantDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const allNodes: any[] = groups.flatMap((g) => g.nodes || []);

  const nextId  = makeIdGen(2);

  const size    = 600;
  const half    = size / 2;
  const ox      = 60;
  const oy      = 60;
  const dotR    = 20;

  let xml = mxfileOpen(size + ox * 2 + 100, size + oy * 2 + 60);

  // Quadrant background cells
  const quadrants = [
    { label: "Q1 (High Value / Low Effort)", fx: ox,        fy: oy,        fill: "#111827" },
    { label: "Q2 (High Value / High Effort)", fx: ox + half, fy: oy,        fill: "#1a1a2e" },
    { label: "Q3 (Low Value / Low Effort)",  fx: ox,        fy: oy + half,  fill: "#1a1a1a" },
    { label: "Q4 (Low Value / High Effort)", fx: ox + half, fy: oy + half,  fill: "#181018" },
  ];
  quadrants.forEach((q) => {
    const qid = nextId();
    const qStyle =
      `rounded=0;whiteSpace=wrap;html=1;align=center;verticalAlign=top;` +
      `fillColor=${q.fill};strokeColor=#444444;fontColor=#888888;fontSize=10;`;
    xml += `        <mxCell id="${qid}" value="${escapeXml(q.label)}" style="${qStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${q.fx}" y="${q.fy}" width="${half}" height="${half}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  // Dot nodes — distribute across quadrants
  allNodes.forEach((node, idx) => {
    const qi  = idx % 4;
    const qx  = ox + (qi % 2) * half;
    const qy  = oy + Math.floor(qi / 2) * half;
    const nx  = qx + half * 0.3 + (idx % 2) * half * 0.4;
    const ny  = qy + half * 0.3 + Math.floor(idx / 2) * 40;

    const nodeId = nextId();
    const nodeStyle =
      "ellipse;aspect=fixed;whiteSpace=wrap;html=1;fontSize=9;" +
      "fillColor=#d4ff00;strokeColor=#b8e000;fontColor=#0A0A0A;";
    xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nodeStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${Math.round(nx - dotR)}" y="${Math.round(ny - dotR)}" width="${dotR * 2}" height="${dotR * 2}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// FLOWCHART (original swimlane logic — kept intact)
// ════════════════════════════════════════════════════════════════════════════
function compileFlowchartDiagram(
  blueprint: any,
  renderedSvg?: string,
  logoOverrides?: Record<string, LogoEntry>
): string {
  if (!blueprint) return "";

  const direction = blueprint.direction || "TD";
  const groups    = blueprint.groups   || [];
  const edges     = blueprint.edges    || [];

  const nodeW   = 160;
  const nodeH   = 60;
  const nodeGapX = 80;
  const nodeGapY = 75;
  const paddingL = 30;
  const paddingR = 30;
  const paddingT = 55;
  const paddingB = 30;

  // Set up logical groupings
  const nodesByGroup: Record<string, any[]> = {};
  const allGroups: any[] = [];

  if (groups && Array.isArray(groups)) {
    for (const g of groups) {
      allGroups.push({ ...g, nodes: g.nodes ? [...g.nodes] : [] });
    }
  }
  const processedNodeIds = new Set<string>();
  for (const gp of allGroups) {
    nodesByGroup[gp.id] = gp.nodes || [];
    for (const n of gp.nodes || []) processedNodeIds.add(n.id);
  }

  // Orphan nodes referenced in edges
  const missingNodes: any[] = [];
  const referencedNodeIds = new Set<string>();
  if (edges && Array.isArray(edges)) {
    for (const edge of edges) {
      if (edge.from) referencedNodeIds.add(edge.from);
      if (edge.to)   referencedNodeIds.add(edge.to);
    }
  }
  for (const nodeId of referencedNodeIds) {
    if (!processedNodeIds.has(nodeId)) {
      missingNodes.push({
        id: nodeId,
        label: nodeId.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        shape: "rect",
        type: "service",
      });
      processedNodeIds.add(nodeId);
    }
  }
  if (missingNodes.length > 0) {
    allGroups.push({ id: "ungrouped_group", label: "General System Boundary", nodes: missingNodes });
    nodesByGroup["ungrouped_group"] = missingNodes;
  }

  // ── Step 1: Parse SVG node coordinates if available ──────────────────────
  interface NodePos { x: number; y: number; w: number; h: number; left: number; top: number; }
  const parsedNodeLayouts: Record<string, NodePos> = {};
  let hasParsedLayout = false;

  if (renderedSvg && typeof window !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(renderedSvg, "image/svg+xml");
      const allNodeIds = new Set<string>();
      const nodeIdToLabel: Record<string, string> = {};
      for (const gp of allGroups) {
        for (const n of gp.nodes || []) {
          allNodeIds.add(n.id);
          nodeIdToLabel[n.id] = (n.label || "").toLowerCase().replace(/[^\w]/g, "");
        }
      }

      // ── Compute viewBox scale factor ──────────────────────────────────────
      // Mermaid uses a large internal coordinate space in viewBox; translate()
      // values are in those units and must be scaled to match pixel positions.
      let scaleX = 1, scaleY = 1;
      const rootSvg = doc.querySelector("svg");
      if (rootSvg) {
        const vb = rootSvg.getAttribute("viewBox");
        const svgW = parseFloat(rootSvg.getAttribute("width") || "0");
        const svgH = parseFloat(rootSvg.getAttribute("height") || "0");
        if (vb) {
          const parts = vb.trim().split(/[\s,]+/);
          if (parts.length === 4) {
            const vbW = parseFloat(parts[2]);
            const vbH = parseFloat(parts[3]);
            if (svgW > 0 && vbW > 0) scaleX = svgW / vbW;
            if (svgH > 0 && vbH > 0) scaleY = svgH / vbH;
          }
        }
      }

      // ── Helper: parse translate() from a transform string ─────────────────
      const parseTranslate = (transform: string): [number, number] => {
        const m = transform.match(/translate\(\s*(-?[\d.]+)\s*[,\s]\s*(-?[\d.]+)\s*\)/i);
        if (m) return [parseFloat(m[1]), parseFloat(m[2])];
        const m2 = transform.match(/translate\(\s*(-?[\d.]+)\s*\)/i);
        if (m2) return [parseFloat(m2[1]), 0];
        return [0, 0];
      };

      // ── Helper: sum ancestor translate transforms up to <svg> root ────────
      const getAccumulatedTranslate = (el: Element): [number, number] => {
        let tx = 0, ty = 0;
        let cur: Element | null = el.parentElement;
        while (cur && cur.tagName.toLowerCase() !== "svg") {
          const t = cur.getAttribute("transform") || "";
          if (t) { const [dx, dy] = parseTranslate(t); tx += dx; ty += dy; }
          cur = cur.parentElement;
        }
        return [tx * scaleX, ty * scaleY];
      };

      // ── Normalized ID comparison helpers ──────────────────────────────────
      // Mermaid IDs: "flowchart-api_gateway-0", "sequence-Actor-0", "c4-web_client-1"
      const normalizeId = (s: string) =>
        s.toLowerCase()
          .replace(/^(flowchart|sequence|class|state|c4|er|mindmap|gantt|bpmn|dfd|vsm|swimlane|activity|deployment|network|component|usecase|use_case|timing|interaction|package|object|archimate|capability|roadmap|blueprint)-/g, "")
          .replace(/-\d+$/, "")
          .replace(/[-\s]/g, "_");

      const idsMatch = (idAttr: string, nodeId: string): boolean => {
        if (!idAttr || !nodeId) return false;
        if (idAttr === nodeId) return true;
        // "flowchart-<nodeId>-<n>" (with underscores or hyphens)
        if (idAttr.startsWith(`flowchart-${nodeId}-`)) return true;
        if (idAttr.startsWith(`flowchart-${nodeId.replace(/_/g, "-")}-`)) return true;
        // Normalized comparison
        const normAttr = normalizeId(idAttr);
        const normNode = normalizeId(nodeId);
        if (normAttr === normNode) return true;
        if (normAttr.startsWith(normNode + "_") || normAttr.startsWith(normNode + "-")) return true;
        // All underscore-segments of nodeId appear as hyphen-segments in idAttr
        const segments = idAttr.split("-");
        const nodeSegs = nodeId.split("_");
        if (nodeSegs.length > 1 && nodeSegs.every(seg => segments.includes(seg))) return true;
        return false;
      };

      // ── Broad selector: all Mermaid node-like <g> elements ───────────────
      const gNodes = doc.querySelectorAll(
        "g.node, g.mermaid-node, g[class*='node'], " +
        "g[id*='flowchart-'], g[id*='sequence-'], g[id*='c4-'], " +
        "g[id*='er-'], g[id*='class-'], g[id*='state-'], g[class*='actor']"
      );

      for (const el of Array.from(gNodes)) {
        const idAttr = el.getAttribute("id") || "";
        const classAttr = el.getAttribute("class") || "";

        // Skip edges, clusters, labels
        if (classAttr.includes("edge") || classAttr.includes("cluster") ||
            classAttr.includes("edgeLabel") || idAttr.startsWith("edge") ||
            idAttr.includes("Label")) continue;

        let matchedNodeId: string | null = null;

        // 1. ID-based matching (primary)
        for (const nodeId of allNodeIds) {
          if (idsMatch(idAttr, nodeId)) { matchedNodeId = nodeId; break; }
        }

        // 2. Label-text fallback for unmatched elements
        if (!matchedNodeId) {
          const textEl = el.querySelector("text, .label, tspan, foreignObject span");
          const rawText = textEl?.textContent?.toLowerCase().replace(/[^\w]/g, "") || "";
          if (rawText.length > 2) {
            for (const nodeId of allNodeIds) {
              if (!parsedNodeLayouts[nodeId]) {
                const lbl = nodeIdToLabel[nodeId];
                if (lbl && lbl.length > 3 && rawText.includes(lbl)) {
                  matchedNodeId = nodeId; break;
                }
              }
            }
          }
        }

        if (!matchedNodeId) continue;
        if (parsedNodeLayouts[matchedNodeId]) continue; // keep first match

        // ── Compute absolute position from own + parent transforms ─────────
        const ownTransform = el.getAttribute("transform") || "";
        const [ox, oy] = parseTranslate(ownTransform);
        const [pax, pay] = getAccumulatedTranslate(el);
        const cx = (ox * scaleX) + pax;
        const cy = (oy * scaleY) + pay;

        // ── Extract dimensions ────────────────────────────────────────────
        let w = nodeW, h = nodeH;
        const rect = el.querySelector("rect");
        if (rect) {
          const rw = rect.getAttribute("width"); const rh = rect.getAttribute("height");
          if (rw && parseFloat(rw) > 0) w = parseFloat(rw) * scaleX;
          if (rh && parseFloat(rh) > 0) h = parseFloat(rh) * scaleY;
        } else {
          const other = el.querySelector("ellipse, circle, polygon, path, foreignObject");
          if (other) {
            if (other.tagName === "ellipse") {
              const erx = other.getAttribute("rx"); const ery = other.getAttribute("ry");
              if (erx) w = parseFloat(erx) * 2 * scaleX;
              if (ery) h = parseFloat(ery) * 2 * scaleY;
            } else {
              const ow = other.getAttribute("width"); const oh = other.getAttribute("height");
              if (ow && parseFloat(ow) > 0) w = parseFloat(ow) * scaleX;
              if (oh && parseFloat(oh) > 0) h = parseFloat(oh) * scaleY;
            }
          }
        }
        if (w < 10) w = nodeW;
        if (h < 10) h = nodeH;

        // Mermaid centers transforms on node center; rect may carry x/y offsets
        let left = cx - w / 2, top = cy - h / 2;
        if (rect) {
          const rx = rect.getAttribute("x"); const ry = rect.getAttribute("y");
          if (rx && ry) { left = cx + parseFloat(rx) * scaleX; top = cy + parseFloat(ry) * scaleY; }
        }

        parsedNodeLayouts[matchedNodeId] = { x: cx, y: cy, w, h, left, top };
      }

      if (Object.keys(parsedNodeLayouts).length > 0) {
        hasParsedLayout = true;
        console.log(`[drawioCompiler] SVG layout: ${Object.keys(parsedNodeLayouts).length}/${allNodeIds.size} nodes matched (scale ${scaleX.toFixed(2)}×${scaleY.toFixed(2)})`);
      } else {
        console.warn("[drawioCompiler] SVG parse matched 0 nodes — using grid fallback");
      }
    } catch (err) { console.error("Error parsing SVG layout coordinates:", err); }
  }

  // ── Step 2: Global translation shift to (50, 50) ─────────────────────────
  if (hasParsedLayout) {
    let minL = Infinity, minT = Infinity;
    for (const id in parsedNodeLayouts) {
      const p = parsedNodeLayouts[id];
      if (p.left < minL) minL = p.left;
      if (p.top  < minT) minT = p.top;
    }
    if (minL !== Infinity && minT !== Infinity) {
      const sx = 50 - minL, sy = 50 - minT;
      for (const id in parsedNodeLayouts) {
        const p = parsedNodeLayouts[id];
        p.left += sx; p.top += sy; p.x += sx; p.y += sy;
      }
    }
  }

  // ── Step 3: Compute group / node layouts ─────────────────────────────────
  const groupLayouts: Record<string, { x: number; y: number; width: number; height: number; cols: number; rows: number }> = {};
  const nodeLayoutPositions: Record<string, { rx: number; ry: number; w: number; h: number }> = {};

  let fallbackCurrentX = 50, fallbackCurrentY = 50, fallbackRowMaxHeight = 0;
  let maxLayoutX = 1200, maxLayoutY = 900;

  for (let i = 0; i < allGroups.length; i++) {
    const gp = allGroups[i];
    const nodes = nodesByGroup[gp.id] || [];
    const count = nodes.length;
    if (count === 0) continue;

    const parsedNodesInGroup = nodes.filter((n: any) => parsedNodeLayouts[n.id]);

    if (hasParsedLayout && parsedNodesInGroup.length > 0) {
      let gMinL = Infinity, gMaxR = -Infinity, gMinT = Infinity, gMaxB = -Infinity;
      for (const n of parsedNodesInGroup) {
        const p = parsedNodeLayouts[n.id];
        if (p.left         < gMinL) gMinL = p.left;
        if (p.left + p.w   > gMaxR) gMaxR = p.left + p.w;
        if (p.top          < gMinT) gMinT = p.top;
        if (p.top  + p.h   > gMaxB) gMaxB = p.top  + p.h;
      }
      const groupW = (gMaxR - gMinL) + paddingL + paddingR;
      const groupH = (gMaxB - gMinT) + paddingT + paddingB;
      const gx = gMinL - paddingL, gy = gMinT - paddingT;
      groupLayouts[gp.id] = { x: gx, y: gy, width: groupW, height: groupH, cols: 0, rows: 0 };
      maxLayoutX = Math.max(maxLayoutX, gx + groupW + 100);
      maxLayoutY = Math.max(maxLayoutY, gy + groupH + 100);

      for (const node of nodes) {
        const p = parsedNodeLayouts[node.id];
        if (p) {
          nodeLayoutPositions[node.id] = { rx: p.left - gx, ry: p.top - gy, w: p.w, h: p.h };
        } else {
          nodeLayoutPositions[node.id] = { rx: paddingL, ry: paddingT, w: nodeW, h: nodeH };
        }
      }
    } else {
      let cols = 1;
      if (direction === "LR") { cols = count > 3 ? Math.ceil(count / 2) : count; }
      else { cols = count > 4 ? 2 : 1; }
      const rows = Math.ceil(count / cols);
      const groupW = paddingL + paddingR + cols * nodeW + (cols - 1) * nodeGapX;
      const groupH = paddingT + paddingB + rows * nodeH + (rows - 1) * nodeGapY;

      let gx = fallbackCurrentX, gy = fallbackCurrentY;
      if (direction === "LR") {
        groupLayouts[gp.id] = { x: gx, y: gy, width: groupW, height: groupH, cols, rows };
        fallbackCurrentX += groupW + 130;
      } else {
        const groupsPerRow = 2;
        const colIdx = i % groupsPerRow;
        if (colIdx === 0 && i > 0) {
          fallbackCurrentY += fallbackRowMaxHeight + 130;
          fallbackCurrentX = 50;
          fallbackRowMaxHeight = 0;
          gx = fallbackCurrentX; gy = fallbackCurrentY;
        }
        groupLayouts[gp.id] = { x: gx, y: gy, width: groupW, height: groupH, cols, rows };
        fallbackRowMaxHeight = Math.max(fallbackRowMaxHeight, groupH);
        fallbackCurrentX += groupW + 130;
      }
      maxLayoutX = Math.max(maxLayoutX, gx + groupW + 100);
      maxLayoutY = Math.max(maxLayoutY, gy + groupH + 100);

      for (let idx = 0; idx < nodes.length; idx++) {
        const node = nodes[idx];
        const r = Math.floor(idx / cols), c = idx % cols;
        nodeLayoutPositions[node.id] = {
          rx: paddingL + c * (nodeW + nodeGapX),
          ry: paddingT + r * (nodeH + nodeGapY),
          w: nodeW, h: nodeH,
        };
      }
    }
  }

  // ── Step 4: Build XML ─────────────────────────────────────────────────────
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<mxfile host="ArchPrompt" modified="${new Date().toISOString()}" agent="ArchPrompt" version="21.5.0" type="device">\n`;
  xml += `  <diagram id="diag_${Math.random().toString(36).substring(2, 9)}" name="Architecture">\n`;
  xml += `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1.0" pageWidth="${maxLayoutX}" pageHeight="${maxLayoutY}" background="#0A0A0A" math="0" shadow="0">\n`;
  xml += `      <root>\n`;
  xml += `        <mxCell id="0"/>\n`;
  xml += `        <mxCell id="1" parent="0"/>\n`;

  let currentId = 2;
  const nodeCellIdMap: Record<string, number> = {};

  // Group boxes
  for (const gp of allGroups) {
    const layout = groupLayouts[gp.id];
    if (!layout) continue;
    const groupCellId = currentId++;
    nodeCellIdMap[gp.id] = groupCellId;
    const gStyle =
      "swimlane;html=1;whiteSpace=wrap;collapsible=0;recursiveResize=0;container=1;" +
      "fillColor=#121212;strokeColor=#333333;strokeWidth=1.5;" +
      "fontColor=#E0E0E0;fontSize=11;fontStyle=1;startSize=32;align=center;verticalAlign=top;shadow=0;";
    xml += `        <mxCell id="${groupCellId}" value="${escapeXml(gp.label)}" style="${gStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${layout.x}" y="${layout.y}" width="${layout.width}" height="${layout.height}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    const nodes = nodesByGroup[gp.id] || [];
    for (const node of nodes) {
      const nodeCellId = currentId++;
      nodeCellIdMap[node.id] = nodeCellId;
      const lp = nodeLayoutPositions[node.id] || { rx: paddingL, ry: paddingT, w: nodeW, h: nodeH };
      const logo = logoOverrides?.[node.id] ?? resolveLogoForNode(node.label ?? "");
      const nStyle = getNodeStyle(node.type || "service", node.shape || "rect", logo?.path);
      xml += `        <mxCell id="${nodeCellId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${groupCellId}">\n`;
      xml += `          <mxGeometry x="${lp.rx}" y="${lp.ry}" width="${lp.w}" height="${lp.h}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    }
  }

  // Edge frequency pre-calculation
  const sourceEdgeCount: Record<string, number> = {};
  const targetEdgeCount: Record<string, number> = {};
  const sourceEdgeIndex: Record<string, number> = {};
  const targetEdgeIndex: Record<string, number> = {};
  if (edges && Array.isArray(edges)) {
    for (const edge of edges) {
      if (edge.from) sourceEdgeCount[edge.from] = (sourceEdgeCount[edge.from] || 0) + 1;
      if (edge.to)   targetEdgeCount[edge.to]   = (targetEdgeCount[edge.to]   || 0) + 1;
    }
  }

  // Edge cells
  if (edges && Array.isArray(edges)) {
    for (const edge of edges) {
      const srcCellId = nodeCellIdMap[edge.from];
      const tgtCellId = nodeCellIdMap[edge.to];
      if (!srcCellId || !tgtCellId) continue;

      const edgeCellId = currentId++;
      const eLabel = escapeXml(edge.label || "");
      const sIdx = sourceEdgeIndex[edge.from] || 0; sourceEdgeIndex[edge.from] = sIdx + 1;
      const tIdx = targetEdgeIndex[edge.to]   || 0; targetEdgeIndex[edge.to]   = tIdx + 1;
      const sTotal = sourceEdgeCount[edge.from] || 1;
      const tTotal = targetEdgeCount[edge.to]   || 1;

      let exitPort = "", entryPort = "";
      const sLayout = parsedNodeLayouts[edge.from];
      const tLayout = parsedNodeLayouts[edge.to];

      if (hasParsedLayout && sLayout && tLayout) {
        const dx = tLayout.x - sLayout.x, dy = tLayout.y - sLayout.y;
        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) {
            exitPort  = `exitX=1;exitY=${sTotal > 1 ? (0.2 + 0.6 * sIdx / (sTotal - 1)) : 0.5}`;
            entryPort = `entryX=0;entryY=${tTotal > 1 ? (0.2 + 0.6 * tIdx / (tTotal - 1)) : 0.5}`;
          } else {
            exitPort  = `exitX=0;exitY=${sTotal > 1 ? (0.2 + 0.6 * sIdx / (sTotal - 1)) : 0.5}`;
            entryPort = `entryX=1;entryY=${tTotal > 1 ? (0.2 + 0.6 * tIdx / (tTotal - 1)) : 0.5}`;
          }
        } else {
          if (dy > 0) {
            exitPort  = `exitX=${sTotal > 1 ? (0.2 + 0.6 * sIdx / (sTotal - 1)) : 0.5};exitY=1`;
            entryPort = `entryX=${tTotal > 1 ? (0.2 + 0.6 * tIdx / (tTotal - 1)) : 0.5};entryY=0`;
          } else {
            exitPort  = `exitX=${sTotal > 1 ? (0.2 + 0.6 * sIdx / (sTotal - 1)) : 0.5};exitY=0`;
            entryPort = `entryX=${tTotal > 1 ? (0.2 + 0.6 * tIdx / (tTotal - 1)) : 0.5};entryY=1`;
          }
        }
      } else {
        if (direction === "LR") {
          exitPort  = `exitX=1;exitY=${sTotal > 1 ? (0.2 + 0.6 * sIdx / (sTotal - 1)) : 0.5}`;
          entryPort = `entryX=0;entryY=${tTotal > 1 ? (0.2 + 0.6 * tIdx / (tTotal - 1)) : 0.5}`;
        } else {
          exitPort  = `exitX=${sTotal > 1 ? (0.2 + 0.6 * sIdx / (sTotal - 1)) : 0.5};exitY=1`;
          entryPort = `entryX=${tTotal > 1 ? (0.2 + 0.6 * tIdx / (tTotal - 1)) : 0.5};entryY=0`;
        }
      }

      const eStyle = getEdgeStyle(edge.style || "solid", exitPort, entryPort);
      xml += `        <mxCell id="${edgeCellId}" value="${eLabel}" style="${eStyle}" edge="1" parent="1" source="${srcCellId}" target="${tgtCellId}">\n`;
      xml += `          <mxGeometry relative="1" as="geometry">\n`;
      xml += `            <mxPoint as="sourcePoint"/>\n`;
      xml += `            <mxPoint as="targetPoint"/>\n`;
      xml += `          </mxGeometry>\n`;
      xml += `        </mxCell>\n`;
    }
  }

  xml += `      </root>\n`;
  xml += `    </mxGraphModel>\n`;
  xml += `  </diagram>\n`;
  xml += `</mxfile>\n`;

  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN DISPATCHER — public export
// ════════════════════════════════════════════════════════════════════════════
export function compileBlueprintToDrawio(
  blueprint: any,
  renderedSvg?: string,
  logoOverrides?: Record<string, LogoEntry>
): string {
  if (!blueprint) return "";

  const kind = (blueprint.diagramKind || "flowchart").toLowerCase();

  if (kind === "er") {
    return compileErDiagram(blueprint);
  }
  if (kind === "sequence") {
    return compileSequenceDiagram(blueprint);
  }
  if (kind === "class") {
    return compileClassDiagram(blueprint);
  }
  if (kind === "state") {
    return compileStateDiagram(blueprint);
  }
  if (kind === "c4context" || kind === "c4container" || kind === "c4component") {
    return compileC4Diagram(blueprint);
  }
  if (kind === "mindmap") {
    return compileMindmapDiagram(blueprint);
  }
  if (kind === "gantt" || kind === "timeline") {
    return compileGanttDiagram(blueprint);
  }
  if (kind === "quadrant") {
    return compileQuadrantDiagram(blueprint);
  }
  if (kind === "archimate") return compileArchimateView(blueprint);
  if (kind === "bpmn") return compileBpmnDiagram(blueprint);
  if (kind === "dfd") return compileDfdDiagram(blueprint);
  if (kind === "vsm") return compileVsmDiagram(blueprint);
  if (kind === "capability_map") return compileCapabilityMap(blueprint);
  if (kind === "network_topology") return compileNetworkTopology(blueprint);
  if (kind === "deployment") return compileDeploymentDiagram(blueprint);
  if (kind === "component") return compileComponentDiagram(blueprint);
  if (kind === "use_case") return compileUseCaseDiagram(blueprint);
  if (kind === "activity") return compileActivityDiagram(blueprint);
  if (kind === "communication") return compileCommunicationDiagram(blueprint);
  if (kind === "package") return compilePackageDiagram(blueprint);
  if (kind === "object") return compileObjectDiagram(blueprint);
  if (kind === "timing") return compileTimingDiagram(blueprint);
  if (kind === "interaction_overview") return compileInteractionOverview(blueprint);
  if (kind === "it_roadmap") return compileItRoadmap(blueprint);
  if (kind === "service_blueprint") return compileServiceBlueprint(blueprint);
  if (kind === "swimlane") return compileSwimlaneDiagram(blueprint);

  // Default: flowchart / swimlane (handles "flowchart" and anything unknown)
  return compileFlowchartDiagram(blueprint, renderedSvg, logoOverrides);
}

// ════════════════════════════════════════════════════════════════════════════
// ARCHIMATE VIEW
// ════════════════════════════════════════════════════════════════════════════
function compileArchimateView(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const layerW = 1100;
  const layerH = 160;
  const nodeW  = 160;
  const nodeH  = 60;
  const padL   = 30;
  const padT   = 55;
  const nodeGap = 20;

  const pageH = groups.length * (layerH + 20) + 100;
  let xml = mxfileOpen(layerW + 100, pageH);

  const layerColors: Record<string, { fill: string; stroke: string }> = {
    motivation: { fill: "#1a1224", stroke: "#9d72ff" },
    strategy:   { fill: "#0f1a2a", stroke: "#3b82f6" },
    business:   { fill: "#1a2035", stroke: "#fbbf24" },
    application:{ fill: "#1a2e2b", stroke: "#38d9c0" },
    technology: { fill: "#111215", stroke: "#5b8df8" },
    physical:   { fill: "#1a1a1a", stroke: "#999999" },
  };

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gy = 50 + gi * (layerH + 20);
    const labelLower = (grp.label || "").toLowerCase();
    const colorKey = Object.keys(layerColors).find(k => labelLower.includes(k)) || "business";
    const colors = layerColors[colorKey];

    const grpId = nextId();
    cellMap[grp.id] = grpId;
    const grpStyle = `swimlane;startSize=32;fillColor=${colors.fill};strokeColor=${colors.stroke};` +
      `strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;`;
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="50" y="${gy}" width="${layerW}" height="${layerH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    nodes.forEach((node, ni) => {
      const nx = padL + ni * (nodeW + nodeGap);
      const ny = padT;
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=${colors.fill};strokeColor=${colors.stroke};fontColor=#e4eaf8;fontSize=10;`;
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from];
    const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#9d72ff;fontColor=#e4eaf8;fontSize=10;` +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// BPMN DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileBpmnDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const poolW  = 1200;
  const laneH  = 160;
  const nodeW  = 140;
  const nodeH  = 55;
  const padL   = 30;
  const padT   = 55;
  const nodeGap = 20;

  const pageH = groups.length * (laneH + 20) + 100;
  let xml = mxfileOpen(poolW + 100, pageH);

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gy = 50 + gi * (laneH + 20);

    const grpId = nextId();
    cellMap[grp.id] = grpId;
    const grpStyle = `swimlane;startSize=32;fillColor=#111215;strokeColor=#5b8df8;` +
      `strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;`;
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="50" y="${gy}" width="${poolW}" height="${laneH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    nodes.forEach((node, ni) => {
      const nx = padL + ni * (nodeW + nodeGap);
      const ny = padT;
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const ntype = (node.type || "task").toLowerCase();
      const label = node.label || "";
      let nStyle: string;
      if (ntype === "event" || label.startsWith("🟢") || label.startsWith("🔴")) {
        const isEnd = label.startsWith("🔴");
        nStyle = isEnd
          ? `doubleEllipse;whiteSpace=wrap;html=1;fillColor=#2a1a18;strokeColor=#f87171;fontColor=#e4eaf8;fontSize=10;aspect=fixed;`
          : `ellipse;whiteSpace=wrap;html=1;fillColor=#0e1f28;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;aspect=fixed;`;
      } else if (ntype === "gateway") {
        nStyle = `rhombus;whiteSpace=wrap;html=1;fillColor=#2a1a18;strokeColor=#f87171;fontColor=#e4eaf8;fontSize=10;`;
      } else {
        nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
      }
      const w = (ntype === "event") ? 44 : nodeW;
      const h = (ntype === "event") ? 44 : nodeH;
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${w}" height="${h}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from];
    const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;` +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// DFD — DATA FLOW DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileDfdDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 150; const nodeH = 55;
  const colGap = 80; const rowGap = 70;
  const count = groups.reduce((s: number, g: any) => s + (g.nodes || []).length, 0);
  const cols = Math.max(1, Math.ceil(Math.sqrt(count)));

  let xml = mxfileOpen(cols * (nodeW + colGap) + 100, Math.ceil(count / cols) * (nodeH + rowGap) + 100);

  let idx = 0;
  groups.forEach((grp) => {
    const nodes: any[] = grp.nodes || [];
    nodes.forEach((node) => {
      const c = idx % cols;
      const r = Math.floor(idx / cols);
      const nx = 50 + c * (nodeW + colGap);
      const ny = 50 + r * (nodeH + rowGap);
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const ntype = (node.type || "process").toLowerCase();
      let nStyle: string;
      if (ntype === "external" || ntype === "external_system") {
        nStyle = `rounded=0;whiteSpace=wrap;html=1;fillColor=#25183a;strokeColor=#9d72ff;fontColor=#e4eaf8;fontSize=10;`;
      } else if (ntype === "store" || ntype === "database") {
        nStyle = `shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#101614;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;boundedLbl=1;`;
      } else {
        nStyle = `ellipse;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
      }
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="1">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
      idx++;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// VSM — VALUE STREAM MAP
// ════════════════════════════════════════════════════════════════════════════
function compileVsmDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 140; const nodeH = 60;
  const colGap = 80;
  const allNodes: any[] = groups.flatMap((g: any) => g.nodes || []);
  const pageW = allNodes.length * (nodeW + colGap) + 100;

  let xml = mxfileOpen(pageW, 300);

  allNodes.forEach((node, ni) => {
    const nx = 50 + ni * (nodeW + colGap);
    const ny = 80;
    const nodeId = nextId();
    cellMap[node.id] = nodeId;
    const ntype = (node.type || "process").toLowerCase();
    let nStyle: string;
    if (ntype === "store" || ntype === "database" || (node.label || "").includes("📦")) {
      nStyle = `rhombus;whiteSpace=wrap;html=1;fillColor=#2a1a18;strokeColor=#f87171;fontColor=#e4eaf8;fontSize=10;`;
    } else {
      nStyle = `rounded=0;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
    }
    xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;` +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// CAPABILITY MAP
// ════════════════════════════════════════════════════════════════════════════
function compileCapabilityMap(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const domainW = 320; const domainH = 200;
  const nodeW = 130; const nodeH = 50;
  const padL = 20; const padT = 50; const nodeGap = 10;
  const cols = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
  const colGap = 40; const rowGap = 40;

  const pageW = cols * (domainW + colGap) + 100;
  const pageH = Math.ceil(groups.length / cols) * (domainH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  const matColors = ["", "#4a1a1a/#f87171", "#3a2a1a/#fbbf24", "#2a3a1a/#d4ff00", "#1a3a2a/#38d9c0", "#1a2a3a/#5b8df8"];

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gc = gi % cols;
    const gr = Math.floor(gi / cols);
    const gx = 50 + gc * (domainW + colGap);
    const gy = 50 + gr * (domainH + rowGap);
    const grpId = nextId();
    cellMap[grp.id] = grpId;
    const grpStyle = `swimlane;startSize=32;fillColor=#1a1a2e;strokeColor=#5b8df8;strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;`;
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${domainW}" height="${domainH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    const nodeCols = Math.max(1, Math.floor((domainW - padL * 2) / (nodeW + nodeGap)));
    nodes.forEach((node, ni) => {
      const nc = ni % nodeCols;
      const nr = Math.floor(ni / nodeCols);
      const nx = padL + nc * (nodeW + nodeGap);
      const ny = padT + nr * (nodeH + nodeGap);
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const matLevel = Math.min(5, Math.max(1, parseInt((node.meta?.maturity || node.maturity || "3"), 10) || 3));
      const colorPair = matColors[matLevel].split("/");
      const fill = colorPair[0] || "#1a2035";
      const stroke = colorPair[1] || "#5b8df8";
      const nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontColor=#e4eaf8;fontSize=10;`;
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// NETWORK TOPOLOGY
// ════════════════════════════════════════════════════════════════════════════
function compileNetworkTopology(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 130; const nodeH = 55;
  const colGap = 60; const rowGap = 70;
  const padL = 30; const padT = 55; const nodeGap = 20;
  const grpCols = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
  const grpW = padL * 2 + 3 * (nodeW + nodeGap);
  const grpH = padT + padT + 2 * (nodeH + rowGap);
  const pageW = grpCols * (grpW + colGap) + 100;
  const pageH = Math.ceil(groups.length / grpCols) * (grpH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gc = gi % grpCols;
    const gr = Math.floor(gi / grpCols);
    const gx = 50 + gc * (grpW + colGap);
    const gy = 50 + gr * (grpH + rowGap);
    const grpId = nextId();
    cellMap[grp.id] = grpId;
    const grpStyle = `swimlane;startSize=32;fillColor=#111215;strokeColor=#38d9c0;strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;dashed=1;`;
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${grpW}" height="${Math.max(grpH, padT + Math.ceil(nodes.length / 3) * (nodeH + nodeGap) + 30)}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    const nodeCols = Math.max(1, Math.min(3, nodes.length));
    nodes.forEach((node, ni) => {
      const nc = ni % nodeCols;
      const nr = Math.floor(ni / nodeCols);
      const nx = padL + nc * (nodeW + nodeGap);
      const ny = padT + nr * (nodeH + nodeGap);
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const ntype = (node.type || "service").toLowerCase();
      const label = node.label || "";
      let nStyle: string;
      if (ntype === "database" || label.includes("🖥️")) {
        nStyle = `shape=cylinder3;whiteSpace=wrap;html=1;fillColor=#101614;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;boundedLbl=1;`;
      } else if (ntype === "queue" || label.includes("🔀")) {
        nStyle = `shape=hexagon;whiteSpace=wrap;html=1;fillColor=#1c1110;strokeColor=#ef4444;fontColor=#e4eaf8;fontSize=10;`;
      } else if (label.includes("🔥")) {
        nStyle = `rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#0e1f28;strokeColor=#fbbf24;fontColor=#e4eaf8;fontSize=10;`;
      } else {
        nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=#111215;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
      }
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// DEPLOYMENT DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileDeploymentDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 150; const nodeH = 55;
  const padL = 30; const padT = 55; const nodeGap = 20;
  const grpCols = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
  const grpW = padL * 2 + 3 * (nodeW + nodeGap);
  const grpH = padT + 30 + 2 * (nodeH + nodeGap);
  const colGap = 50; const rowGap = 50;
  const pageW = grpCols * (grpW + colGap) + 100;
  const pageH = Math.ceil(groups.length / grpCols) * (grpH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gc = gi % grpCols;
    const gr = Math.floor(gi / grpCols);
    const gx = 50 + gc * (grpW + colGap);
    const gy = 50 + gr * (grpH + rowGap);
    const grpId = nextId();
    cellMap[grp.id] = grpId;
    const grpStyle = `swimlane;startSize=32;fillColor=#111215;strokeColor=#5b8df8;strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;dashed=1;`;
    const actualH = padT + 30 + Math.ceil(nodes.length / 3) * (nodeH + nodeGap);
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${grpW}" height="${Math.max(grpH, actualH)}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    const nodeCols = Math.max(1, Math.min(3, nodes.length));
    nodes.forEach((node, ni) => {
      const nc = ni % nodeCols;
      const nr = Math.floor(ni / nodeCols);
      const nx = padL + nc * (nodeW + nodeGap);
      const ny = padT + nr * (nodeH + nodeGap);
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const nStyle = `rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#1a2e2b;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;`;
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;` +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// COMPONENT DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileComponentDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 160; const nodeH = 60;
  const padL = 30; const padT = 50; const nodeGap = 20;
  const grpCols = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
  const grpW = padL * 2 + 2 * (nodeW + nodeGap);
  const grpH = padT + 30 + 2 * (nodeH + nodeGap);
  const colGap = 60; const rowGap = 60;
  const pageW = grpCols * (grpW + colGap) + 100;
  const pageH = Math.ceil(groups.length / grpCols) * (grpH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gc = gi % grpCols;
    const gr = Math.floor(gi / grpCols);
    const gx = 50 + gc * (grpW + colGap);
    const gy = 50 + gr * (grpH + rowGap);
    const grpId = nextId();
    cellMap[grp.id] = grpId;
    const grpStyle = `swimlane;startSize=32;fillColor=#1a2035;strokeColor=#5b8df8;strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;`;
    const actualH = padT + 30 + Math.ceil(nodes.length / 2) * (nodeH + nodeGap);
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${grpW}" height="${Math.max(grpH, actualH)}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    const nodeCols = Math.max(1, Math.min(2, nodes.length));
    nodes.forEach((node, ni) => {
      const nc = ni % nodeCols;
      const nr = Math.floor(ni / nodeCols);
      const nx = padL + nc * (nodeW + nodeGap);
      const ny = padT + nr * (nodeH + nodeGap);
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const ntype = (node.type || "component").toLowerCase();
      const nStyle = ntype === "gateway" || (node.shape === "round")
        ? `ellipse;whiteSpace=wrap;html=1;fillColor=#0e1f28;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;`
        : `rounded=1;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;` +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// USE CASE DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileUseCaseDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 150; const nodeH = 55;
  const padL = 30; const padT = 55; const nodeGap = 20;
  const grpCols = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
  const grpW = padL * 2 + 3 * (nodeW + nodeGap);
  const grpH = padT + 30 + 2 * (nodeH + nodeGap);
  const colGap = 50; const rowGap = 50;
  const pageW = grpCols * (grpW + colGap) + 100;
  const pageH = Math.ceil(groups.length / grpCols) * (grpH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gc = gi % grpCols;
    const gr = Math.floor(gi / grpCols);
    const gx = 50 + gc * (grpW + colGap);
    const gy = 50 + gr * (grpH + rowGap);
    const grpId = nextId();
    cellMap[grp.id] = grpId;
    const grpStyle = `swimlane;startSize=32;fillColor=#0c1524;strokeColor=#3b82f6;strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;dashed=1;`;
    const actualH = padT + 30 + Math.ceil(nodes.length / 3) * (nodeH + nodeGap);
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${grpW}" height="${Math.max(grpH, actualH)}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    const nodeCols = Math.max(1, Math.min(3, nodes.length));
    nodes.forEach((node, ni) => {
      const nc = ni % nodeCols;
      const nr = Math.floor(ni / nodeCols);
      const nx = padL + nc * (nodeW + nodeGap);
      const ny = padT + nr * (nodeH + nodeGap);
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const ntype = (node.type || "use_case_node").toLowerCase();
      let nStyle: string;
      if (ntype === "actor" || ntype === "person") {
        nStyle = `shape=mxgraph.uml.actor;whiteSpace=wrap;html=1;fillColor=#0c1524;strokeColor=#3b82f6;fontColor=#e4eaf8;fontSize=10;`;
      } else {
        nStyle = `ellipse;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#9d72ff;fontColor=#e4eaf8;fontSize=10;`;
      }
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#9d72ff;fontColor=#e4eaf8;fontSize=10;dashed=1;`;
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// ACTIVITY DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileActivityDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 160; const nodeH = 55;
  const colGap = 80; const rowGap = 60;
  const allNodes: any[] = groups.flatMap((g: any) => g.nodes || []);
  const cols = Math.max(1, Math.ceil(Math.sqrt(allNodes.length)));
  const pageW = cols * (nodeW + colGap) + 100;
  const pageH = Math.ceil(allNodes.length / cols) * (nodeH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  allNodes.forEach((node, ni) => {
    const nc = ni % cols;
    const nr = Math.floor(ni / cols);
    const nx = 50 + nc * (nodeW + colGap);
    const ny = 50 + nr * (nodeH + rowGap);
    const nodeId = nextId();
    cellMap[node.id] = nodeId;
    const ntype = (node.type || "service").toLowerCase();
    const label = node.label || "";
    let nStyle: string;
    let w = nodeW; let h = nodeH;
    if (ntype === "event" || label.includes("⬤")) {
      nStyle = `ellipse;aspect=fixed;whiteSpace=wrap;html=1;fillColor=#38d9c0;strokeColor=#38d9c0;fontColor=#000;fontSize=10;`;
      w = 40; h = 40;
    } else if (label.includes("⊗") || label.toLowerCase().includes("final")) {
      nStyle = `doubleEllipse;aspect=fixed;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
      w = 40; h = 40;
    } else if (ntype === "gateway" || node.shape === "diamond") {
      nStyle = `rhombus;whiteSpace=wrap;html=1;fillColor=#2a1a18;strokeColor=#fbbf24;fontColor=#e4eaf8;fontSize=10;`;
    } else if (label.includes("◼") || ntype === "process") {
      nStyle = `rounded=0;whiteSpace=wrap;html=1;fillColor=#111215;strokeColor=#999999;fontColor=#e4eaf8;fontSize=10;`;
      w = nodeW; h = 12;
    } else {
      nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
    }
    xml += `        <mxCell id="${nodeId}" value="${escapeXml(label)}" style="${nStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${nx}" y="${ny}" width="${w}" height="${h}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// COMMUNICATION DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileCommunicationDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 150; const nodeH = 55;
  const colGap = 100; const rowGap = 80;
  const allNodes: any[] = groups.flatMap((g: any) => g.nodes || []);
  const cols = Math.max(1, Math.ceil(Math.sqrt(allNodes.length)));
  const pageW = cols * (nodeW + colGap) + 100;
  const pageH = Math.ceil(allNodes.length / cols) * (nodeH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  allNodes.forEach((node, ni) => {
    const nc = ni % cols;
    const nr = Math.floor(ni / cols);
    const nx = 50 + nc * (nodeW + colGap);
    const ny = 50 + nr * (nodeH + rowGap);
    const nodeId = nextId();
    cellMap[node.id] = nodeId;
    const nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
    xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#d4ff00;fontColor=#e4eaf8;fontSize=10;" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// PACKAGE DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compilePackageDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 150; const nodeH = 50;
  const padL = 30; const padT = 55; const nodeGap = 15;
  const grpCols = Math.max(1, Math.ceil(Math.sqrt(groups.length)));
  const grpW = padL * 2 + 2 * (nodeW + nodeGap);
  const grpH = padT + 30 + 2 * (nodeH + nodeGap);
  const colGap = 60; const rowGap = 60;
  const pageW = grpCols * (grpW + colGap) + 100;
  const pageH = Math.ceil(groups.length / grpCols) * (grpH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gc = gi % grpCols;
    const gr = Math.floor(gi / grpCols);
    const gx = 50 + gc * (grpW + colGap);
    const gy = 50 + gr * (grpH + rowGap);
    const grpId = nextId();
    cellMap[grp.id] = grpId;
    const grpStyle = `swimlane;startSize=32;fillColor=#1a1a2e;strokeColor=#9d72ff;strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;`;
    const actualH = padT + 30 + Math.ceil(nodes.length / 2) * (nodeH + nodeGap);
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${grpW}" height="${Math.max(grpH, actualH)}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    const nodeCols = Math.max(1, Math.min(2, nodes.length));
    nodes.forEach((node, ni) => {
      const nc = ni % nodeCols;
      const nr = Math.floor(ni / nodeCols);
      const nx = padL + nc * (nodeW + nodeGap);
      const ny = padT + nr * (nodeH + nodeGap);
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#9d72ff;fontColor=#e4eaf8;fontSize=10;`;
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#9d72ff;fontColor=#e4eaf8;fontSize=10;dashed=1;`;
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// OBJECT DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileObjectDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 180; const nodeH = 70;
  const colGap = 80; const rowGap = 70;
  const allNodes: any[] = groups.flatMap((g: any) => g.nodes || []);
  const cols = Math.max(1, Math.ceil(Math.sqrt(allNodes.length)));
  const pageW = cols * (nodeW + colGap) + 100;
  const pageH = Math.ceil(allNodes.length / cols) * (nodeH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  allNodes.forEach((node, ni) => {
    const nc = ni % cols;
    const nr = Math.floor(ni / cols);
    const nx = 50 + nc * (nodeW + colGap);
    const ny = 50 + nr * (nodeH + rowGap);
    const nodeId = nextId();
    cellMap[node.id] = nodeId;
    const nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;`;
    xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;` +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// TIMING DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileTimingDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const rowH = 80; const stateW = 120; const stateH = 40;
  const padL = 140; const stateGap = 10;
  const pageW = padL + 8 * (stateW + stateGap) + 100;
  const pageH = groups.length * (rowH + 20) + 100;
  let xml = mxfileOpen(pageW, pageH);

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gy = 50 + gi * (rowH + 20);

    // Lifeline label
    const lblId = nextId();
    xml += `        <mxCell id="${lblId}" value="${escapeXml(grp.label)}" style="text;html=1;strokeColor=none;fillColor=none;align=right;fontColor=#e4eaf8;fontSize=11;fontStyle=1;verticalAlign=middle;" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="10" y="${gy + (rowH - stateH) / 2}" width="120" height="${stateH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    // Swimlane row
    const rowId = nextId();
    cellMap[grp.id] = rowId;
    xml += `        <mxCell id="${rowId}" value="" style="rounded=0;whiteSpace=wrap;html=1;fillColor=#111215;strokeColor=#333333;fontSize=10;" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${padL}" y="${gy}" width="${nodes.length * (stateW + stateGap)}" height="${rowH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    nodes.forEach((node, ni) => {
      const nx = padL + ni * (stateW + stateGap);
      const ny = gy + (rowH - stateH) / 2;
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const nStyle = `rounded=0;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;`;
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="1">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${stateW}" height="${stateH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;dashed=1;" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// INTERACTION OVERVIEW
// ════════════════════════════════════════════════════════════════════════════
function compileInteractionOverview(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 160; const nodeH = 60;
  const colGap = 80; const rowGap = 70;
  const allNodes: any[] = groups.flatMap((g: any) => g.nodes || []);
  const cols = Math.max(1, Math.ceil(Math.sqrt(allNodes.length)));
  const pageW = cols * (nodeW + colGap) + 100;
  const pageH = Math.ceil(allNodes.length / cols) * (nodeH + rowGap) + 100;
  let xml = mxfileOpen(pageW, pageH);

  allNodes.forEach((node, ni) => {
    const nc = ni % cols;
    const nr = Math.floor(ni / cols);
    const nx = 50 + nc * (nodeW + colGap);
    const ny = 50 + nr * (nodeH + rowGap);
    const nodeId = nextId();
    cellMap[node.id] = nodeId;
    const isDecision = (node.shape === "diamond") || (node.type || "").toLowerCase() === "gateway";
    const nStyle = isDecision
      ? `rhombus;whiteSpace=wrap;html=1;fillColor=#2a1a18;strokeColor=#fbbf24;fontColor=#e4eaf8;fontSize=10;`
      : `ellipse;whiteSpace=wrap;html=1;fillColor=#25183a;strokeColor=#9d72ff;fontColor=#e4eaf8;fontSize=10;`;
    xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#9d72ff;fontColor=#e4eaf8;fontSize=10;` +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// IT ROADMAP
// ════════════════════════════════════════════════════════════════════════════
function compileItRoadmap(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const horizonW = 400; const horizonH = 200;
  const nodeW = 160; const nodeH = 50;
  const padL = 20; const padT = 55; const nodeGap = 10;
  const rowGap = 30;
  const pageW = groups.length * (horizonW + 40) + 100;
  const pageH = horizonH + 100;
  let xml = mxfileOpen(pageW, pageH);

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gx = 50 + gi * (horizonW + 40);
    const gy = 50;
    const grpId = nextId();
    cellMap[grp.id] = grpId;

    const horizonColors: Record<number, { fill: string; stroke: string }> = {
      0: { fill: "#0e1f10", stroke: "#38d9c0" },
      1: { fill: "#1f1e0e", stroke: "#fbbf24" },
      2: { fill: "#0e1428", stroke: "#5b8df8" },
    };
    const hc = horizonColors[gi] || horizonColors[2];
    const grpStyle = `swimlane;startSize=32;fillColor=${hc.fill};strokeColor=${hc.stroke};strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;`;
    const actualH = padT + 30 + nodes.length * (nodeH + nodeGap);
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${gx}" y="${gy}" width="${horizonW}" height="${Math.max(horizonH, actualH)}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    nodes.forEach((node, ni) => {
      const nx = padL;
      const ny = padT + ni * (nodeH + nodeGap);
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const isMilestone = (node.shape === "diamond") || (node.label || "").includes("🎯");
      const isGate = (node.shape === "stadium") || (node.label || "").includes("🚦");
      let nStyle: string;
      if (isMilestone) {
        nStyle = `rhombus;whiteSpace=wrap;html=1;fillColor=#0e1f28;strokeColor=#d4ff00;fontColor=#e4eaf8;fontSize=10;`;
      } else if (isGate) {
        nStyle = `rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#0e1f28;strokeColor=#fbbf24;fontColor=#e4eaf8;fontSize=10;`;
      } else {
        nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=${hc.stroke};fontColor=#e4eaf8;fontSize=10;`;
      }
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${isMilestone ? 50 : nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// SERVICE BLUEPRINT
// ════════════════════════════════════════════════════════════════════════════
function compileServiceBlueprint(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const layerW = 1100; const layerH = 140;
  const nodeW = 140; const nodeH = 55;
  const padL = 30; const padT = 50; const nodeGap = 15;
  const layerGap = 20;
  const pageH = groups.length * (layerH + layerGap) + 100;
  let xml = mxfileOpen(layerW + 100, pageH);

  const layerColors = [
    { fill: "#0c1524", stroke: "#3b82f6" },
    { fill: "#1a2e2b", stroke: "#38d9c0" },
    { fill: "#111215", stroke: "#d4ff00" },
    { fill: "#25183a", stroke: "#9d72ff" },
    { fill: "#1a2035", stroke: "#5b8df8" },
    { fill: "#1a1a2e", stroke: "#fbbf24" },
  ];

  groups.forEach((grp, gi) => {
    const nodes: any[] = grp.nodes || [];
    const gy = 50 + gi * (layerH + layerGap);
    const lc = layerColors[gi % layerColors.length];
    const grpId = nextId();
    cellMap[grp.id] = grpId;
    const grpStyle = `swimlane;startSize=32;fillColor=${lc.fill};strokeColor=${lc.stroke};strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;`;
    xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="50" y="${gy}" width="${layerW}" height="${layerH}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    nodes.forEach((node, ni) => {
      const nx = padL + ni * (nodeW + nodeGap);
      const ny = padT;
      const nodeId = nextId();
      cellMap[node.id] = nodeId;
      const nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=${lc.fill};strokeColor=${lc.stroke};fontColor=#e4eaf8;fontSize=10;`;
      xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
      xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    });
  });

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;` +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}

// ════════════════════════════════════════════════════════════════════════════
// SWIMLANE DIAGRAM
// ════════════════════════════════════════════════════════════════════════════
function compileSwimlaneDiagram(blueprint: any): string {
  const groups: any[] = blueprint.groups || [];
  const edges: any[]  = blueprint.edges  || [];
  const direction     = (blueprint.direction || "LR").toUpperCase();
  const nextId = makeIdGen(2);
  const cellMap: Record<string, number> = {};

  const nodeW = 140; const nodeH = 55;
  const padL = 30; const padT = 55; const nodeGap = 20;

  let xml: string;

  if (direction === "LR") {
    const laneH = 160; const laneGap = 20;
    const maxNodes = Math.max(...groups.map((g: any) => (g.nodes || []).length), 1);
    const laneW = padL * 2 + maxNodes * (nodeW + nodeGap);
    const pageW = laneW + 100;
    const pageH = groups.length * (laneH + laneGap) + 100;
    xml = mxfileOpen(pageW, pageH);

    groups.forEach((grp, gi) => {
      const nodes: any[] = grp.nodes || [];
      const gy = 50 + gi * (laneH + laneGap);
      const grpId = nextId();
      cellMap[grp.id] = grpId;
      const grpStyle = `swimlane;startSize=32;fillColor=#1a2035;strokeColor=#5b8df8;strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;`;
      xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
      xml += `          <mxGeometry x="50" y="${gy}" width="${laneW}" height="${laneH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;

      nodes.forEach((node, ni) => {
        const nx = padL + ni * (nodeW + nodeGap);
        const ny = padT;
        const nodeId = nextId();
        cellMap[node.id] = nodeId;
        const isDecision = (node.shape === "diamond") || (node.type || "").toLowerCase() === "gateway";
        const isStart = (node.label || "").includes("▶");
        const isEnd = (node.label || "").includes("⏹");
        let nStyle: string;
        if (isDecision) {
          nStyle = `rhombus;whiteSpace=wrap;html=1;fillColor=#2a1a18;strokeColor=#fbbf24;fontColor=#e4eaf8;fontSize=10;`;
        } else if (isStart || isEnd) {
          nStyle = `rounded=1;arcSize=50;whiteSpace=wrap;html=1;fillColor=#0e1f28;strokeColor=#38d9c0;fontColor=#e4eaf8;fontSize=10;`;
        } else {
          nStyle = `rounded=1;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
        }
        xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
        xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
        xml += `        </mxCell>\n`;
      });
    });
  } else {
    // TD direction
    const laneW = 200; const laneGap = 30;
    const maxNodes = Math.max(...groups.map((g: any) => (g.nodes || []).length), 1);
    const laneH = padT + maxNodes * (nodeH + nodeGap) + 30;
    const pageW = groups.length * (laneW + laneGap) + 100;
    const pageH = laneH + 100;
    xml = mxfileOpen(pageW, pageH);

    groups.forEach((grp, gi) => {
      const nodes: any[] = grp.nodes || [];
      const gx = 50 + gi * (laneW + laneGap);
      const grpId = nextId();
      cellMap[grp.id] = grpId;
      const grpStyle = `swimlane;startSize=32;fillColor=#1a2035;strokeColor=#5b8df8;strokeWidth=1.5;fontColor=#e4eaf8;fontSize=11;fontStyle=1;html=1;collapsible=0;recursiveResize=0;container=1;`;
      xml += `        <mxCell id="${grpId}" value="${escapeXml(grp.label)}" style="${grpStyle}" vertex="1" parent="1">\n`;
      xml += `          <mxGeometry x="${gx}" y="50" width="${laneW}" height="${laneH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;

      nodes.forEach((node, ni) => {
        const nx = padL;
        const ny = padT + ni * (nodeH + nodeGap);
        const nodeId = nextId();
        cellMap[node.id] = nodeId;
        const isDecision = (node.shape === "diamond") || (node.type || "").toLowerCase() === "gateway";
        const nStyle = isDecision
          ? `rhombus;whiteSpace=wrap;html=1;fillColor=#2a1a18;strokeColor=#fbbf24;fontColor=#e4eaf8;fontSize=10;`
          : `rounded=1;whiteSpace=wrap;html=1;fillColor=#1a2035;strokeColor=#5b8df8;fontColor=#e4eaf8;fontSize=10;`;
        xml += `        <mxCell id="${nodeId}" value="${escapeXml(node.label)}" style="${nStyle}" vertex="1" parent="${grpId}">\n`;
        xml += `          <mxGeometry x="${nx}" y="${ny}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
        xml += `        </mxCell>\n`;
      });
    });
  }

  edges.forEach((edge) => {
    const srcId = cellMap[edge.from]; const tgtId = cellMap[edge.to];
    if (!srcId || !tgtId) return;
    const eid = nextId();
    const eStyle = `edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;strokeColor=#d4ff00;fontColor=#e4eaf8;fontSize=10;` +
      (edge.style === "dashed" ? "dashed=1;" : "");
    xml += `        <mxCell id="${eid}" value="${escapeXml(edge.label || "")}" style="${eStyle}" edge="1" parent="1" source="${srcId}" target="${tgtId}">\n`;
    xml += `          <mxGeometry relative="1" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;
  });

  xml += mxfileClose();
  return xml;
}
