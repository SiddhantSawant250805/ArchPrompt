// ── REPO SYSTEM: Phase 7 ──────────────────────────────────────
// lib/merger/blueprintMerger.ts
// Pure TypeScript module to merge two intermediate blueprint representations.

interface BlueprintNode {
  id: string;
  label: string;
  type: string;
  shape?: string;
  [key: string]: any;
}

interface BlueprintGroup {
  id: string;
  label: string;
  nodes: BlueprintNode[];
  [key: string]: any;
}

interface BlueprintEdge {
  from: string;
  to: string;
  label?: string;
  style?: string;
  [key: string]: any;
}

interface Blueprint {
  title: string;
  groups: BlueprintGroup[];
  edges: BlueprintEdge[];
  [key: string]: any;
}

/**
 * Merges a referenced application's blueprint into a parent blueprint at a specific proxy node.
 * Namespaces all child nodes and groups to avoid collision. Reroutes external links pointing
 * to/from the proxy node to the child application's calculated entry/exit boundary nodes.
 */
export function mergeBlueprint(
  parentBlueprint: Blueprint,
  refProxyNode: BlueprintNode,
  sourceAppBlueprint: Blueprint,
  entryNodes: string[],
  exitNodes: string[]
): Blueprint {
  // Deep clone to keep the function pure
  const merged: Blueprint = structuredClone(parentBlueprint);
  const child: Blueprint = structuredClone(sourceAppBlueprint);

  const proxyId = refProxyNode.id;
  const ns = `ref_${proxyId}_`;

  // 1. Remove proxy node from parent groups
  for (const group of merged.groups) {
    if (group.nodes) {
      group.nodes = group.nodes.filter(n => n.id !== proxyId);
    }
  }

  // 2. Add child groups with prefixed IDs and namespaced nodes
  if (child.groups) {
    for (const childGroup of child.groups) {
      const mergedNodes = (childGroup.nodes || []).map(node => ({
        ...node,
        id: `${ns}${node.id}`,
      }));

      // Create a unified group zone for this child's group
      const newGroup: BlueprintGroup = {
        ...childGroup,
        id: `${ns}${childGroup.id}`,
        label: `${refProxyNode.refAppName} :: ${childGroup.label}`,
        nodes: mergedNodes,
      };

      merged.groups.push(newGroup);
    }
  }

  // 3. Add namespaced child edges
  if (child.edges) {
    for (const childEdge of child.edges) {
      merged.edges.push({
        ...childEdge,
        from: `${ns}${childEdge.from}`,
        to: `${ns}${childEdge.to}`,
      });
    }
  }

  // 4. Reroute parent edges connected to proxy node to/from child entry/exit nodes
  const newEdges: BlueprintEdge[] = [];

  for (const parentEdge of merged.edges) {
    if (parentEdge.to === proxyId) {
      // Incoming edge to proxy node: split to all entry nodes of the child app
      for (const entryId of entryNodes) {
        newEdges.push({
          ...parentEdge,
          to: `${ns}${entryId}`,
        });
      }
    } else if (parentEdge.from === proxyId) {
      // Outgoing edge from proxy node: split to start from all exit nodes of the child app
      for (const exitId of exitNodes) {
        newEdges.push({
          ...parentEdge,
          from: `${ns}${exitId}`,
        });
      }
    } else {
      // Unaffected parent edge
      newEdges.push(parentEdge);
    }
  }

  merged.edges = newEdges;
  return merged;
}
// ── END REPO SYSTEM: Phase 7 ──────────────────────────────────
