/**
 * Deterministic Topological Geometry Parser for Draw.io (mxGraph XML)
 * Converts structural blueprint JSON directly into valid, pristine, non-overlapping
 * and beautifully spaced native draw.io XML on a dark enterprise-grid canvas.
 */

export function compileBlueprintToDrawio(blueprint: any): string {
  if (!blueprint) return "";

  const title = blueprint.title || "Architecture Diagram";
  const direction = blueprint.direction || "TD";
  const groups = blueprint.groups || [];
  const edges = blueprint.edges || [];

  // Theme accents matching our gorgeous high-contrast yellow-and-dark palette
  const baseColors: Record<string, { fill: string; stroke: string; width: number }> = {
    service: { fill: "#111215", stroke: "#d4ff00", width: 1.5 },
    database: { fill: "#101614", stroke: "#38d9c0", width: 1.5 },
    external: { fill: "#14111a", stroke: "#a855f7", width: 1.5 },
    ui: { fill: "#1c1a12", stroke: "#fbbf24", width: 1.5 },
    queue: { fill: "#1c1110", stroke: "#ef4444", width: 1.5 },
    gateway: { fill: "#0f161a", stroke: "#0ea5e9", width: 1.5 },
    process: { fill: "#111215", stroke: "#999999", width: 1 },
    person: { fill: "#0c1524", stroke: "#3b82f6", width: 1.5 },
  };

  function getNodeStyle(type: string, shape: string): string {
    const colors = baseColors[type] || baseColors.service;
    let styleParts = [
      "whiteSpace=wrap",
      "html=1",
      "fontSize=11",
      `fillColor=${colors.fill}`,
      `strokeColor=${colors.stroke}`,
      `strokeWidth=${colors.width}`,
      "fontColor=#F0F0F0",
      "fontStyle=1"
    ];

    if (shape === "round" || type === "service") {
      styleParts.push("rounded=1");
    } else if (shape === "diamond") {
      styleParts.push("shape=rhombus");
    } else if (shape === "cylinder" || type === "database") {
      styleParts.push("shape=cylinder3", "boundedLbl=1");
    } else if (shape === "hexagon" || type === "queue") {
      styleParts.push("shape=hexagon");
    } else if (shape === "stadium" || type === "gateway") {
      styleParts.push("rounded=1", "arcSize=50");
    } else {
      styleParts.push("rounded=1");
    }

    return styleParts.join(";");
  }

  function getEdgeStyle(style: string, exitPort?: string, entryPort?: string): string {
    let parts = [
      "edgeStyle=orthogonalEdgeStyle",
      "rounded=0",
      "html=1",
      "strokeColor=#d4ff00",
      "strokeWidth=1.5",
      "fontColor=#F0F0F0",
      "fontSize=10",
      "labelBackgroundColor=#0A0A0A",
      "labelBorderColor=none",
      "orthogonal=1",
      "jettySize=auto"
    ];
    if (style === "dashed") {
      parts.push("dashed=1");
    }
    if (exitPort) {
      parts.push(exitPort);
    }
    if (entryPort) {
      parts.push(entryPort);
    }
    return parts.join(";");
  }

  // XML escaping helper
  function escapeXml(unsafe: string): string {
    if (!unsafe) return "";
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  // Set up logical groupings
  const nodesByGroup: Record<string, any[]> = {};
  const allGroups = [];

  // Deep clone to avoid mutating input state
  if (groups && Array.isArray(groups)) {
    for (const g of groups) {
      allGroups.push({ ...g, nodes: g.nodes ? [...g.nodes] : [] });
    }
  }

  const processedNodeIds = new Set<string>();
  for (const gp of allGroups) {
    nodesByGroup[gp.id] = gp.nodes || [];
    for (const n of gp.nodes || []) {
      processedNodeIds.add(n.id);
    }
  }

  // Map orphan/missing nodes mentioned in edges but not configured in groups
  const missingNodes: any[] = [];
  const referencedNodeIds = new Set<string>();
  if (edges && Array.isArray(edges)) {
    for (const edge of edges) {
      if (edge.from) referencedNodeIds.add(edge.from);
      if (edge.to) referencedNodeIds.add(edge.to);
    }
  }

  for (const nodeId of referencedNodeIds) {
    if (!processedNodeIds.has(nodeId)) {
      missingNodes.push({
        id: nodeId,
        label: nodeId.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
        shape: "rect",
        type: "service"
      });
      processedNodeIds.add(nodeId);
    }
  }

  if (missingNodes.length > 0) {
    allGroups.push({
      id: "ungrouped_group",
      label: "General System Boundary",
      nodes: missingNodes
    });
    nodesByGroup["ungrouped_group"] = missingNodes;
  }

  // Layout geometry calculations:
  // Compact, beautifully aligned grids ensuring absolutely no overlaps
  const nodeW = 160;
  const nodeH = 60;
  const nodeGapX = 80;  // Balanced to keep nodes tight but give enough area for lines
  const nodeGapY = 75;  // Compact vertical gap that still lets routes turn orthogonally
  const paddingL = 30;  // Clean left padding
  const paddingR = 30;  // Clean right padding
  const paddingT = 55;  // Space for group header title
  const paddingB = 30;  // Clean bottom padding

  const groupLayouts: Record<string, { x: number; y: number; width: number; height: number; cols: number; rows: number }> = {};
  
  // Choose optimal group column allocation depending on target direction
  const groupsPerRow = direction === "LR" ? 1 : 2; // For TD direction, group them in a neat 2-column grid

  let currentX = 50;
  let currentY = 50;
  let rowMaxHeight = 0;

  for (let i = 0; i < allGroups.length; i++) {
    const gp = allGroups[i];
    const nodes = nodesByGroup[gp.id] || [];
    const count = nodes.length;

    if (count === 0) continue;

    // Arrange nodes inside groups based on flow direction to match the visual canvas layout
    // For Left-To-Right (LR) diagrams, prioritize wider horizontal layout rows
    // For Top-To-Bottom (TD) diagrams, prioritize taller vertical stacks
    let cols = 1;
    if (direction === "LR") {
      cols = count > 3 ? Math.ceil(count / 2) : count;
    } else {
      cols = count > 4 ? 2 : 1;
    }
    const rows = Math.ceil(count / cols);

    const groupW = paddingL + paddingR + cols * nodeW + (cols - 1) * nodeGapX;
    const groupH = paddingT + paddingB + rows * nodeH + (rows - 1) * nodeGapY;

    if (direction === "LR") {
      // Linear layout flowing from left to right with snug 130px corridors
      groupLayouts[gp.id] = { x: currentX, y: 50, width: groupW, height: groupH, cols, rows };
      currentX += groupW + 130;
    } else {
      // 2-Column Grid Layout flowing vertically with snug 130px corridors to prevent excessive spacing
      const colIdx = i % groupsPerRow;

      if (colIdx === 0 && i > 0) {
        currentY += rowMaxHeight + 130;
        currentX = 50;
        rowMaxHeight = 0;
      }

      groupLayouts[gp.id] = { x: currentX, y: currentY, width: groupW, height: groupH, cols, rows };
      rowMaxHeight = Math.max(rowMaxHeight, groupH);
      currentX += groupW + 130;
    }
  }

  // Find maximum coordinate boundaries to fit the page size perfectly
  let maxLayoutX = 1200;
  let maxLayoutY = 900;
  for (const gp of allGroups) {
    const layout = groupLayouts[gp.id];
    if (layout) {
      maxLayoutX = Math.max(maxLayoutX, layout.x + layout.width + 100);
      maxLayoutY = Math.max(maxLayoutY, layout.y + layout.height + 100);
    }
  }

  // Create standard XML envelope
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<mxfile host="ArchPrompt" modified="${new Date().toISOString()}" agent="ArchPrompt" version="21.5.0" type="device">\n`;
  xml += `  <diagram id="diag_${Math.random().toString(36).substring(2, 9)}" name="Architecture">\n`;
  xml += `    <mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1.0" pageWidth="${maxLayoutX}" pageHeight="${maxLayoutY}" background="#0A0A0A" math="0" shadow="0">\n`;
  xml += `      <root>\n`;
  xml += `        <mxCell id="0"/>\n`;
  xml += `        <mxCell id="1" parent="0"/>\n`;

  let currentId = 2;
  const nodeCellIdMap: Record<string, number> = {};

  // Render group boxes (rendered first so nodes sit nicely on top of them)
  for (const gp of allGroups) {
    const layout = groupLayouts[gp.id];
    if (!layout) continue;

    const groupCellId = currentId++;
    nodeCellIdMap[gp.id] = groupCellId;

    const gLabel = escapeXml(gp.label);
    const gStyle = `swimlane;html=1;whiteSpace=wrap;collapsible=0;recursiveResize=0;container=1;fillColor=#121212;strokeColor=#333333;strokeWidth=1.5;fontColor=#E0E0E0;fontSize=11;fontStyle=1;startSize=32;align=center;verticalAlign=top;shadow=0;`;

    xml += `        <mxCell id="${groupCellId}" value="${gLabel}" style="${gStyle}" vertex="1" parent="1">\n`;
    xml += `          <mxGeometry x="${layout.x}" y="${layout.y}" width="${layout.width}" height="${layout.height}" as="geometry"/>\n`;
    xml += `        </mxCell>\n`;

    // Render individual grid-aligned nodes inside the group
    const nodes = nodesByGroup[gp.id] || [];
    const cols = layout.cols;

    for (let idx = 0; idx < nodes.length; idx++) {
      const node = nodes[idx];
      const nodeCellId = currentId++;
      nodeCellIdMap[node.id] = nodeCellId;

      const r = Math.floor(idx / cols);
      const c = idx % cols;

      const rx = paddingL + c * (nodeW + nodeGapX);
      const ry = paddingT + r * (nodeH + nodeGapY);

      const nLabel = escapeXml(node.label);
      const nStyle = getNodeStyle(node.type || "service", node.shape || "rect");

      xml += `        <mxCell id="${nodeCellId}" value="${nLabel}" style="${nStyle}" vertex="1" parent="${groupCellId}">\n`;
      xml += `          <mxGeometry x="${rx}" y="${ry}" width="${nodeW}" height="${nodeH}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    }
  }

  // Pre-calculate edge frequencies to spread connection ports evenly and avoid overlap
  const sourceEdgeCount: Record<string, number> = {};
  const targetEdgeCount: Record<string, number> = {};
  const sourceEdgeIndex: Record<string, number> = {};
  const targetEdgeIndex: Record<string, number> = {};

  if (edges && Array.isArray(edges)) {
    for (const edge of edges) {
      if (edge.from) {
        sourceEdgeCount[edge.from] = (sourceEdgeCount[edge.from] || 0) + 1;
      }
      if (edge.to) {
        targetEdgeCount[edge.to] = (targetEdgeCount[edge.to] || 0) + 1;
      }
    }
  }

  // Render connector line paths (connected cleanly to IDs with port distribution)
  if (edges && Array.isArray(edges)) {
    for (const edge of edges) {
      const sourceCellId = nodeCellIdMap[edge.from];
      const targetCellId = nodeCellIdMap[edge.to];

      if (!sourceCellId || !targetCellId) continue;

      const edgeCellId = currentId++;
      const eLabel = escapeXml(edge.label || "");

      const sIdx = sourceEdgeIndex[edge.from] || 0;
      sourceEdgeIndex[edge.from] = sIdx + 1;

      const tIdx = targetEdgeIndex[edge.to] || 0;
      targetEdgeIndex[edge.to] = tIdx + 1;

      const sTotal = sourceEdgeCount[edge.from] || 1;
      const tTotal = targetEdgeCount[edge.to] || 1;

      let exitPort = "";
      let entryPort = "";

      if (direction === "LR") {
        // Spread outbound vertically along the right face (exitX=1)
        const exitY = sTotal > 1 ? (0.2 + (0.6 * sIdx) / (sTotal - 1)) : 0.5;
        exitPort = `exitX=1;exitY=${exitY.toFixed(2)}`;

        // Spread inbound vertically along the left face (entryX=0)
        const entryY = tTotal > 1 ? (0.2 + (0.6 * tIdx) / (tTotal - 1)) : 0.5;
        entryPort = `entryX=0;entryY=${entryY.toFixed(2)}`;
      } else {
        // Spread outbound horizontally along the bottom face (exitY=1)
        const exitX = sTotal > 1 ? (0.2 + (0.6 * sIdx) / (sTotal - 1)) : 0.5;
        exitPort = `exitX=${exitX.toFixed(2)};exitY=1`;

        // Spread inbound horizontally along the top face (entryY=0)
        const entryX = tTotal > 1 ? (0.2 + (0.6 * tIdx) / (tTotal - 1)) : 0.5;
        entryPort = `entryX=${entryX.toFixed(2)};entryY=0`;
      }

      const eStyle = getEdgeStyle(edge.style || "solid", exitPort, entryPort);

      xml += `        <mxCell id="${edgeCellId}" value="${eLabel}" style="${eStyle}" edge="1" parent="1" source="${sourceCellId}" target="${targetCellId}">\n`;
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
