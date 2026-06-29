// ── REPO SYSTEM: Phase 9 ──────────────────────────────────────
// lib/merger/drawioMerger.ts
// Pure TypeScript module to merge child draw.io mxGraph XML schemas into parent diagram schemas.

/**
 * Merges a child draw.io XML string into a parent draw.io XML string at the specified proxy cell.
 * Namespaces all child cells to prevent collision, positions them relative to the proxy cell,
 * and reroutes any parent connectors to the child's entry/exit boundaries.
 */
export function mergeDrawio(
  parentXml: string,
  proxyCellId: string,
  sourceXml: string,
  refProxyId: string,
  entryNodes: string[],
  exitNodes: string[]
): string {
  if (typeof window === "undefined") return parentXml;

  const parser = new DOMParser();
  const parentDoc = parser.parseFromString(parentXml, "text/xml");
  const childDoc = parser.parseFromString(sourceXml, "text/xml");

  const ns = `ref_${refProxyId}_`;

  // 1. Locate the proxy cell in the parent diagram
  const proxyCell = parentDoc.getElementById(proxyCellId) || 
                    parentDoc.querySelector(`mxCell[id="${proxyCellId}"]`);
  
  if (!proxyCell) {
    // If proxy cell isn't found by direct ID, search by ref proxy attributes or name matching
    return parentXml;
  }

  // Get proxy cell coordinates to offset child cells
  let offsetX = 0;
  let offsetY = 0;
  const proxyGeometry = proxyCell.querySelector("mxGeometry");
  if (proxyGeometry) {
    offsetX = parseFloat(proxyGeometry.getAttribute("x") || "0");
    offsetY = parseFloat(proxyGeometry.getAttribute("y") || "0");
  }

  // 2. Extract child cells from child XML root
  const childRoot = childDoc.querySelector("mxGraphModel > root");
  if (!childRoot) return parentXml;

  const childCells = Array.from(childRoot.children) as Element[];
  
  // 3. Namespace child cell IDs and parent pointer references
  const processedChildCells: Element[] = [];

  for (const cell of childCells) {
    const id = cell.getAttribute("id");
    // Skip default root container nodes 0 and 1
    if (id === "0" || id === "1") continue;

    const cloned = cell.cloneNode(true) as Element;
    
    // Namespace ID
    if (id) {
      cloned.setAttribute("id", `${ns}${id}`);
    }

    // Namespace parent link if it points to custom child container (not 1 or 0)
    const parentLink = cell.getAttribute("parent");
    if (parentLink && parentLink !== "0" && parentLink !== "1") {
      cloned.setAttribute("parent", `${ns}${parentLink}`);
    } else {
      // Re-parent child root cells directly under parent's default container (usually "1")
      cloned.setAttribute("parent", "1");
    }

    // Namespace source and target links if it is an edge
    const sourceLink = cell.getAttribute("source");
    if (sourceLink) {
      cloned.setAttribute("source", `${ns}${sourceLink}`);
    }
    const targetLink = cell.getAttribute("target");
    if (targetLink) {
      cloned.setAttribute("target", `${ns}${targetLink}`);
    }

    // Offset spatial layout coordinates by proxy position
    const geom = cloned.querySelector("mxGeometry");
    if (geom && geom.getAttribute("vertex") === "1") {
      const currentX = parseFloat(geom.getAttribute("x") || "0");
      const currentY = parseFloat(geom.getAttribute("y") || "0");
      geom.setAttribute("x", (currentX + offsetX).toString());
      geom.setAttribute("y", (currentY + offsetY).toString());
    }

    processedChildCells.push(cloned);
  }

  // 4. Reroute parent edges connected to proxy cell to/from child entry/exit boundaries
  const parentRoot = parentDoc.querySelector("mxGraphModel > root");
  if (!parentRoot) return parentXml;

  const parentCells = Array.from(parentRoot.children) as Element[];
  for (const cell of parentCells) {
    const source = cell.getAttribute("source");
    const target = cell.getAttribute("target");

    if (target === proxyCellId) {
      // Connect to first entry node boundary (or duplicate edge for multiple entry nodes)
      const primaryEntry = entryNodes[0] || "0";
      cell.setAttribute("target", `${ns}${primaryEntry}`);
    }

    if (source === proxyCellId) {
      // Connect to first exit node boundary
      const primaryExit = exitNodes[0] || "0";
      cell.setAttribute("source", `${ns}${primaryExit}`);
    }
  }

  // 5. Remove proxy cell from parent document
  proxyCell.parentNode?.removeChild(proxyCell);

  // 6. Append processed child cells into parent document root
  for (const cell of processedChildCells) {
    // Import element to parent document context
    const imported = parentDoc.importNode(cell, true);
    parentRoot.appendChild(imported);
  }

  // 7. Serialize back to standard draw.io XML representation
  const serializer = new XMLSerializer();
  return serializer.serializeToString(parentDoc);
}
// ── END REPO SYSTEM: Phase 9 ──────────────────────────────────
