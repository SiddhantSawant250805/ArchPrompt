import { resolveLogoForNode, LogoEntry } from "./logoRegistry";

export function compileBlueprintToDrawio(
  blueprint: any,
  renderedSvg?: string,
  logoOverrides?: Record<string, LogoEntry>
): string {
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

  function getNodeStyle(type: string, shape: string, logoPath?: string): string {
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

    if (logoPath) {
      styleParts.push(`image;image=${logoPath}`, "imageAlign=left", "imageVerticalAlign=top", "imageWidth=20", "imageHeight=20");
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

  // Layout geometry constants
  const nodeW = 160;
  const nodeH = 60;
  const nodeGapX = 80;
  const nodeGapY = 75;
  const paddingL = 30;
  const paddingR = 30;
  const paddingT = 55;
  const paddingB = 30;

  // ── Step 1: Parse SVG node coordinates if available ──
  interface NodePos {
    x: number;
    y: number;
    w: number;
    h: number;
    left: number;
    top: number;
  }

  const parsedNodeLayouts: Record<string, NodePos> = {};
  let hasParsedLayout = false;

  if (renderedSvg && typeof window !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(renderedSvg, "image/svg+xml");
      
      const allNodeIds = new Set<string>();
      for (const gp of allGroups) {
        for (const n of gp.nodes || []) {
          allNodeIds.add(n.id);
        }
      }

      const gNodes = doc.querySelectorAll("g.node, g.mermaid-node");
      for (const el of Array.from(gNodes)) {
        const idAttr = el.getAttribute("id") || "";
        let matchedNodeId: string | null = null;
        for (const nodeId of allNodeIds) {
          if (idAttr === nodeId ||
              idAttr.startsWith(`flowchart-${nodeId}-`) ||
              idAttr.split("-").includes(nodeId) ||
              idAttr.replace(/^c4-/, "") === nodeId ||
              idAttr.replace(/^c4-/, "").split("-")[0] === nodeId) {
            matchedNodeId = nodeId;
            break;
          }
        }

        if (matchedNodeId) {
          const transform = el.getAttribute("transform") || "";
          const translateMatch = transform.match(/translate\(\s*(-?\d+\.?\d*)\s*[\s,]\s*(-?\d+\.?\d*)\s*\)/i);
          if (translateMatch) {
            const cx = parseFloat(translateMatch[1]);
            const cy = parseFloat(translateMatch[2]);

            let w = nodeW;
            let h = nodeH;
            const rect = el.querySelector("rect");
            if (rect) {
              const rectW = rect.getAttribute("width");
              const rectH = rect.getAttribute("height");
              if (rectW) w = parseFloat(rectW);
              if (rectH) h = parseFloat(rectH);
            } else {
              const other = el.querySelector("path, polygon, circle, ellipse, foreignObject");
              if (other) {
                const otherW = other.getAttribute("width");
                const otherH = other.getAttribute("height");
                if (otherW && otherH) {
                  w = parseFloat(otherW);
                  h = parseFloat(otherH);
                }
              }
            }

            let left = cx - w / 2;
            let top = cy - h / 2;

            const rectX = rect?.getAttribute("x");
            const rectY = rect?.getAttribute("y");
            if (rectX && rectY) {
              left = cx + parseFloat(rectX);
              top = cy + parseFloat(rectY);
            }

            parsedNodeLayouts[matchedNodeId] = { x: cx, y: cy, w, h, left, top };
          }
        }
      }

      if (Object.keys(parsedNodeLayouts).length > 0) {
        hasParsedLayout = true;
      }
    } catch (err) {
      console.error("Error parsing SVG layout coordinates:", err);
    }
  }

  // ── Step 2: Global translation shift to start diagram at (50, 50) ──
  if (hasParsedLayout) {
    let minL = Infinity;
    let minT = Infinity;
    for (const id in parsedNodeLayouts) {
      const pos = parsedNodeLayouts[id];
      if (pos.left < minL) minL = pos.left;
      if (pos.top < minT) minT = pos.top;
    }

    if (minL !== Infinity && minT !== Infinity) {
      const shiftX = 50 - minL;
      const shiftY = 50 - minT;
      for (const id in parsedNodeLayouts) {
        const pos = parsedNodeLayouts[id];
        pos.left += shiftX;
        pos.top += shiftY;
        pos.x += shiftX;
        pos.y += shiftY;
      }
    }
  }

  // ── Step 3: Compute layouts for groups and nodes ──
  const groupLayouts: Record<string, { x: number; y: number; width: number; height: number; cols: number; rows: number }> = {};
  const nodeLayoutPositions: Record<string, { rx: number; ry: number; w: number; h: number }> = {};

  let fallbackCurrentX = 50;
  let fallbackCurrentY = 50;
  let fallbackRowMaxHeight = 0;

  let maxLayoutX = 1200;
  let maxLayoutY = 900;

  for (let i = 0; i < allGroups.length; i++) {
    const gp = allGroups[i];
    const nodes = nodesByGroup[gp.id] || [];
    const count = nodes.length;
    if (count === 0) continue;

    const parsedNodesInGroup = nodes.filter(n => parsedNodeLayouts[n.id]);

    if (hasParsedLayout && parsedNodesInGroup.length > 0) {
      let groupMinL = Infinity;
      let groupMaxR = -Infinity;
      let groupMinT = Infinity;
      let groupMaxB = -Infinity;

      for (const n of parsedNodesInGroup) {
        const pos = parsedNodeLayouts[n.id];
        if (pos.left < groupMinL) groupMinL = pos.left;
        if (pos.left + pos.w > groupMaxR) groupMaxR = pos.left + pos.w;
        if (pos.top < groupMinT) groupMinT = pos.top;
        if (pos.top + pos.h > groupMaxB) groupMaxB = pos.top + pos.h;
      }

      const groupW = (groupMaxR - groupMinL) + paddingL + paddingR;
      const groupH = (groupMaxB - groupMinT) + paddingT + paddingB;
      const gx = groupMinL - paddingL;
      const gy = groupMinT - paddingT;

      groupLayouts[gp.id] = { x: gx, y: gy, width: groupW, height: groupH, cols: 0, rows: 0 };
      maxLayoutX = Math.max(maxLayoutX, gx + groupW + 100);
      maxLayoutY = Math.max(maxLayoutY, gy + groupH + 100);

      for (const node of nodes) {
        const pos = parsedNodeLayouts[node.id];
        if (pos) {
          nodeLayoutPositions[node.id] = {
            rx: pos.left - gx,
            ry: pos.top - gy,
            w: pos.w,
            h: pos.h
          };
        } else {
          nodeLayoutPositions[node.id] = {
            rx: paddingL,
            ry: paddingT,
            w: nodeW,
            h: nodeH
          };
        }
      }
    } else {
      let cols = 1;
      if (direction === "LR") {
        cols = count > 3 ? Math.ceil(count / 2) : count;
      } else {
        cols = count > 4 ? 2 : 1;
      }
      const rows = Math.ceil(count / cols);
      const groupW = paddingL + paddingR + cols * nodeW + (cols - 1) * nodeGapX;
      const groupH = paddingT + paddingB + rows * nodeH + (rows - 1) * nodeGapY;

      let gx = fallbackCurrentX;
      let gy = fallbackCurrentY;

      if (direction === "LR") {
        groupLayouts[gp.id] = { x: gx, y: gy, width: groupW, height: groupH, cols, rows };
        fallbackCurrentX += groupW + 130;
      } else {
        const groupsPerRow = direction === "LR" ? 1 : 2;
        const colIdx = i % groupsPerRow;
        if (colIdx === 0 && i > 0) {
          fallbackCurrentY += fallbackRowMaxHeight + 130;
          fallbackCurrentX = 50;
          fallbackRowMaxHeight = 0;
          gx = fallbackCurrentX;
          gy = fallbackCurrentY;
        }
        groupLayouts[gp.id] = { x: gx, y: gy, width: groupW, height: groupH, cols, rows };
        fallbackRowMaxHeight = Math.max(fallbackRowMaxHeight, groupH);
        fallbackCurrentX += groupW + 130;
      }

      maxLayoutX = Math.max(maxLayoutX, gx + groupW + 100);
      maxLayoutY = Math.max(maxLayoutY, gy + groupH + 100);

      for (let idx = 0; idx < nodes.length; idx++) {
        const node = nodes[idx];
        const r = Math.floor(idx / cols);
        const c = idx % cols;
        const rx = paddingL + c * (nodeW + nodeGapX);
        const ry = paddingT + r * (nodeH + nodeGapY);

        nodeLayoutPositions[node.id] = {
          rx,
          ry,
          w: nodeW,
          h: nodeH
        };
      }
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

  // Render group boxes
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

    // Render individual nodes using their calculated relative coordinates
    const nodes = nodesByGroup[gp.id] || [];
    for (let idx = 0; idx < nodes.length; idx++) {
      const node = nodes[idx];
      const nodeCellId = currentId++;
      nodeCellIdMap[node.id] = nodeCellId;

      const layoutPos = nodeLayoutPositions[node.id] || { rx: paddingL, ry: paddingT, w: nodeW, h: nodeH };
      const nLabel = escapeXml(node.label);
      const logo = logoOverrides?.[node.id] ?? resolveLogoForNode(node.label ?? "");
      const nStyle = getNodeStyle(node.type || "service", node.shape || "rect", logo?.path);

      xml += `        <mxCell id="${nodeCellId}" value="${nLabel}" style="${nStyle}" vertex="1" parent="${groupCellId}">\n`;
      xml += `          <mxGeometry x="${layoutPos.rx}" y="${layoutPos.ry}" width="${layoutPos.w}" height="${layoutPos.h}" as="geometry"/>\n`;
      xml += `        </mxCell>\n`;
    }
  }

  // Pre-calculate edge frequencies
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

  // Render connector line paths with relative geometric distribution
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

      const sLayout = parsedNodeLayouts[edge.from];
      const tLayout = parsedNodeLayouts[edge.to];

      if (hasParsedLayout && sLayout && tLayout) {
        const dx = tLayout.x - sLayout.x;
        const dy = tLayout.y - sLayout.y;

        if (Math.abs(dx) > Math.abs(dy)) {
          if (dx > 0) {
            const exitY = sTotal > 1 ? (0.2 + (0.6 * sIdx) / (sTotal - 1)) : 0.5;
            exitPort = `exitX=1;exitY=${exitY.toFixed(2)}`;
            const entryY = tTotal > 1 ? (0.2 + (0.6 * tIdx) / (tTotal - 1)) : 0.5;
            entryPort = `entryX=0;entryY=${entryY.toFixed(2)}`;
          } else {
            const exitY = sTotal > 1 ? (0.2 + (0.6 * sIdx) / (sTotal - 1)) : 0.5;
            exitPort = `exitX=0;exitY=${exitY.toFixed(2)}`;
            const entryY = tTotal > 1 ? (0.2 + (0.6 * tIdx) / (tTotal - 1)) : 0.5;
            entryPort = `entryX=1;entryY=${entryY.toFixed(2)}`;
          }
        } else {
          if (dy > 0) {
            const exitX = sTotal > 1 ? (0.2 + (0.6 * sIdx) / (sTotal - 1)) : 0.5;
            exitPort = `exitX=${exitX.toFixed(2)};exitY=1`;
            const entryX = tTotal > 1 ? (0.2 + (0.6 * tIdx) / (tTotal - 1)) : 0.5;
            entryPort = `entryX=${entryX.toFixed(2)};entryY=0`;
          } else {
            const exitX = sTotal > 1 ? (0.2 + (0.6 * sIdx) / (sTotal - 1)) : 0.5;
            exitPort = `exitX=${exitX.toFixed(2)};exitY=0`;
            const entryX = tTotal > 1 ? (0.2 + (0.6 * tIdx) / (tTotal - 1)) : 0.5;
            entryPort = `entryX=${entryX.toFixed(2)};entryY=1`;
          }
        }
      } else {
        if (direction === "LR") {
          const exitY = sTotal > 1 ? (0.2 + (0.6 * sIdx) / (sTotal - 1)) : 0.5;
          exitPort = `exitX=1;exitY=${exitY.toFixed(2)}`;
          const entryY = tTotal > 1 ? (0.2 + (0.6 * tIdx) / (tTotal - 1)) : 0.5;
          entryPort = `entryX=0;entryY=${entryY.toFixed(2)}`;
        } else {
          const exitX = sTotal > 1 ? (0.2 + (0.6 * sIdx) / (sTotal - 1)) : 0.5;
          exitPort = `exitX=${exitX.toFixed(2)};exitY=1`;
          const entryX = tTotal > 1 ? (0.2 + (0.6 * tIdx) / (tTotal - 1)) : 0.5;
          entryPort = `entryX=${entryX.toFixed(2)};entryY=0`;
        }
      }

      const eStyle = getEdgeStyle(edge.style || "solid", exitPort, entryPort);

      xml += `        <mxCell id="${edgeCellId}" value="${eStyle === "" ? "" : eLabel}" style="${eStyle}" edge="1" parent="1" source="${sourceCellId}" target="${targetCellId}">\n`;
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
