"use client";

import React, { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { motion, AnimatePresence } from "motion/react";
import { compileBlueprintToDrawio } from "../lib/drawioCompiler";
import { Sparkles, Layers, Code, FileText, Download, Play, RotateCcw, Maximize2, CreditCard as Edit3, Settings, History, TriangleAlert as AlertTriangle, RefreshCw, Copy, Check, Eye, ChevronRight, Database, Image as ImageIcon, FolderTree, MapPin, Clock, ExternalLink, BookOpen, Compass, Paperclip, Trash2 } from "lucide-react";

// ----------------------------------------------------
// LOCAL STORAGE HISTORY KEY
// ----------------------------------------------------
const HISTORY_STORAGE_KEY = "arch_prompt_history_v1";

// ----------------------------------------------------
// STATIC CONSTANTS & OPTIONS
// ----------------------------------------------------

const EXAMPLES = {
  microservices: `A microservices e-commerce platform with an API gateway, authentication service, product catalogue service, shopping cart, order management, payment processing via Stripe, notification service, Kafka event bus, and separate PostgreSQL databases per service.`,
  auth: `An OAuth 2.0 / OpenID Connect authentication flow showing the user browser, application client, authorization server, resource server, token validation, and refresh token lifecycle.`,
  ci: `A CI/CD pipeline for a Node.js app: developer pushes to GitHub, triggers GitHub Actions, runs unit tests, builds Docker image, pushes to ECR, deploys to ECS staging, runs integration tests, then promotes to ECS production with a manual approval gate.`,
  database: `An e-commerce database schema with Users, Orders, OrderItems, Products, Categories, Reviews, Addresses, and Payments tables showing primary keys and relationships.`,
  cloud: `An AWS cloud infrastructure with a VPC containing public and private subnets, an Application Load Balancer, ECS Fargate containers, RDS Aurora, ElastiCache Redis, S3 for assets, CloudFront CDN, and Route 53 DNS.`,
  c4: `A C4 System Context diagram for an online banking platform showing customers, internal banking system, email notification system, and external payment gateway.`,
  roadmap: `A 12-month product roadmap for a SaaS platform with Q1 foundation work (auth, billing), Q2 core features (dashboard, reporting), Q3 integrations (Salesforce, Slack), and Q4 scaling (performance, enterprise SSO).`
};

// File exporter helper defined at module scope to avoid purity and hoisting warnings
const downloadBlob = (content: string, filename: string, contentType: string) => {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

interface HistoryEntry {
  id: number;
  prompt: string;
  mermaidCode: string;
  blueprint: any;
  drawioXML: string | null;
  ts: string;
}

export default function Home() {
  // ----------------------------------------------------
  // APPLICATION STATE
  // ----------------------------------------------------
  const [diagramType, setDiagramType] = useState<string>("auto");
  const [compilerMethod, setCompilerMethod] = useState<"visual" | "deterministic" | "gemini">("deterministic");
  const [promptInput, setPromptInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [stateHistory, setStateHistory] = useState<HistoryEntry[]>([]);
  const [activeTab, setActiveTab] = useState<string>("diagram");
  const [historyIdCounter, setHistoryIdCounter] = useState<number>(1);

  // Core generated structural outputs
  const [lastBlueprint, setLastBlueprint] = useState<any>(null);
  const [mermaidCode, setMermaidCode] = useState<string>("");
  const [canvasSvg, setCanvasSvg] = useState<string>("");
  const [canvasError, setCanvasError] = useState<string | null>(null);

  // Pipeline execution tracking
  const [pipelineStage, setPipelineStage] = useState<number>(0); // 0=idle, 1=Parse, 2=Compile Mermaid, 3=Compile Drawio, 4=Completed
  const [activeProvider, setActiveProvider] = useState<string>("gemini-3.5-flash");

  // Pan / Zoom Controls
  const [zoom, setZoom] = useState({ scale: 1, x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Draw.io Editor State
  const [drawioReady, setDrawioReady] = useState(false);
  const [drawioStatus, setDrawioStatus] = useState<"empty" | "loading" | "loaded" | "error">("empty");
  const [drawioError, setDrawioError] = useState<string | null>(null);
  const [drawioXML, setDrawioXML] = useState<string | null>(null);
  const [drawioFormatOpen, setDrawioFormatOpen] = useState(false);

  // GitHub Export State
  const [githubModalOpen, setGithubModalOpen] = useState(false);
  const [githubOwner, setGithubOwner] = useState<string>("");
  const [githubRepo, setGithubRepo] = useState<string>("");
  const [githubBranch, setGithubBranch] = useState<string>("main");
  const [githubPath, setGithubPath] = useState<string>("diagrams/architecture.drawio");
  const [githubCommitMessage, setGithubCommitMessage] = useState<string>("");
  const [githubExportType, setGithubExportType] = useState<"drawio" | "svg" | "mermaid">("drawio");
  const [githubPushing, setGithubPushing] = useState<boolean>(false);

  // UI Utilities
  const [toast, setToast] = useState<{ message: string; isErr: boolean } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // AI Co-pilot Refinement State
  const [copilotPrompt, setCopilotPrompt] = useState<string>("");
  const [copilotLoading, setCopilotLoading] = useState<boolean>(false);

  // File Upload State
  const [selectedFile, setSelectedFile] = useState<{
    fileName: string;
    fileContent: string;
    fileType: string;
  } | null>(null);

  // Interactive Customizer Panel States
  const [rightPanelTab, setRightPanelTab] = useState<"inspector" | "diagnostics">("inspector");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Derived selected target node for properties inspector to prevent render ref access errors
  const activeSelectedTargetNode = (() => {
    if (!selectedNodeId || !lastBlueprint) return null;
    for (const g of lastBlueprint.groups || []) {
      const found = g.nodes?.find((n: any) => n.id === selectedNodeId);
      if (found) return found;
    }
    return null;
  })();

  // Quick Create Node / Edge States
  const [newNodeLabel, setNewNodeLabel] = useState<string>("");
  const [newNodeType, setNewNodeType] = useState<string>("service");
  const [newNodeShape, setNewNodeShape] = useState<string>("rect");
  const [newNodeGroup, setNewNodeGroup] = useState<string>("");

  const [newEdgeFrom, setNewEdgeFrom] = useState<string>("");
  const [newEdgeTo, setNewEdgeTo] = useState<string>("");
  const [newEdgeLabel, setNewEdgeLabel] = useState<string>("");
  const [newEdgeStyle, setNewEdgeStyle] = useState<string>("solid");

  // References
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ----------------------------------------------------
  // ROBUST PURE CALLBACK UTILITIES
  // ----------------------------------------------------
  const triggerToast = React.useCallback((msg: string, isErr = false) => {
    setToast({ message: msg, isErr });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    const isText = file.type.startsWith("text/") || 
                   file.type === "application/json" || 
                   file.type === "text/csv" ||
                   file.name.endsWith(".md") || 
                   file.name.endsWith(".txt") || 
                   file.name.endsWith(".json") || 
                   file.name.endsWith(".yaml") || 
                   file.name.endsWith(".yml");

    reader.onload = (event) => {
      const content = event.target?.result as string;
      setSelectedFile({
        fileName: file.name,
        fileContent: content,
        fileType: isText ? "text/plain" : file.type || "application/octet-stream",
      });
      triggerToast(`Loaded file: ${file.name} ✓`, false);
    };

    if (isText) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  const renderDrawioSVGInCanvas = React.useCallback((base64Svg: string) => {
    try {
      // Decode data URI
      const base64Content = base64Svg.split(",")[1] || base64Svg;
      const decoded = atob(base64Content);
      setCanvasSvg(decoded);
      setCanvasError(null);
      triggerToast("Canvas synchronized with draw.io edits! ✓", false);
    } catch (e: any) {
      console.error("Failed importing drawio edits:", e);
      triggerToast("Failed to sync diagram changes", true);
    }
  }, [triggerToast]);

  const handleMermaidLoad = () => {
    if (typeof window !== "undefined" && (window as any).mermaid) {
      (window as any).mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        flowchart: { useMaxWidth: false, htmlLabels: true },
      });
    }
  };

  // ----------------------------------------------------
  // INITIAL BOOTSTRAP / LOAD HISTORY
  // ----------------------------------------------------
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        const historyData = JSON.parse(stored);
        setTimeout(() => {
          setStateHistory(historyData);
          if (Array.isArray(historyData) && historyData.length > 0) {
            const maxId = Math.max(...historyData.map((e: any) => e.id || 0));
            setHistoryIdCounter(maxId + 1);
          }
        }, 0);
      }
    } catch (e) {
      console.error("Failed loading search history", e);
    }
  }, []);

  useEffect(() => {
    // Set up message listener for draw.io iframe postMessages
    const handleDrawioMessage = (evt: MessageEvent) => {
      if (evt.origin !== "https://embed.diagrams.net") return;
      try {
        const msg = JSON.parse(evt.data);
        console.log("[Draw.io Event]", msg.event, msg);

        switch (msg.event) {
          case "init":
            setDrawioReady(true);
            setDrawioStatus("loaded");
            // If we have an XML diagram queued up, load it in!
            if (drawioXML) {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ action: "load", xml: drawioXML, autosave: 1 }),
                "*"
              );
            }
            break;

          case "load":
            setDrawioStatus("loaded");
            break;

          case "save":
            if (msg.xml) {
              setDrawioXML(msg.xml);
              triggerToast("Draw.io updates saved successfully! ✓", false);
            }
            break;

          case "autosave":
            if (msg.xml) {
              setDrawioXML(msg.xml);
              // Auto request actual rendered SVG update back to Mermaid preview canvas
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ action: "export", format: "xmlsvg" }),
                "*"
              );
            }
            break;

          case "export":
            if (msg.format === "xmlsvg" && msg.data) {
              // Convert embedded raw material representation back into our primary Mermaid rendering canvas
              renderDrawioSVGInCanvas(msg.data);
            } else if (msg.xml) {
              setDrawioXML(msg.xml);
            }
            break;
        }
      } catch (e) {
        console.error("Error decoding drawio iframe packet", e);
      }
    };

    window.addEventListener("message", handleDrawioMessage);
    return () => {
      window.removeEventListener("message", handleDrawioMessage);
    };
  }, [drawioXML, renderDrawioSVGInCanvas, triggerToast]);

  // Sync to local storage
  const saveHistoryToLocalStorage = (newHistory: HistoryEntry[]) => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(newHistory));
    } catch (e) {
      console.error("Failed to store search history", e);
    }
  };

  // ----------------------------------------------------
  // REUSABLE DIAGRAM ENGINES PIEPELINE
  // ----------------------------------------------------
  const compileBlueprintToDiagrams = async (targetBlueprint: any, promptToSave = "") => {
    setCanvasError(null);
    setDrawioError(null);
    setDrawioStatus("loading");

    try {
      // --------------------------------------------------
      // STAGE 2: PARALLEL MERMAID COMPILATION
      // --------------------------------------------------
      setPipelineStage(2);

      const s2Res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: 2, blueprint: targetBlueprint })
      });

      if (!s2Res.ok) {
        const errJson = await s2Res.json();
        throw new Error(errJson.error || "Failed to compile Mermaid representation.");
      }

      const { code } = await s2Res.json();
      setMermaidCode(code);

      // Render the Mermaid SVG client side
      const renderedSvg = await renderMermaidMarkup(code);

      // Land user on the Canvas preview tab right away
      setActiveTab("diagram");
      setPipelineStage(3); // Completed Stage 2. Moving to draw.io delivery phase.

      let drawioDataXML: string | null = null;

      if (compilerMethod === "visual") {
        if (renderedSvg) {
          try {
            const xml = compileSvgToDrawioXml(renderedSvg);
            drawioDataXML = xml;
            setDrawioXML(xml);
            setDrawioStatus("loaded");
            if (drawioReady) {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ action: "load", xml, autosave: 1 }),
                "*"
              );
            }
          } catch (localErr: any) {
            console.error("Visual compilation to drawio failed, falling back to deterministic...", localErr);
            try {
              const xml = compileBlueprintToDrawio(targetBlueprint, renderedSvg || canvasSvg || undefined);
              drawioDataXML = xml;
              setDrawioXML(xml);
              setDrawioStatus("loaded");
              if (drawioReady) {
                iframeRef.current?.contentWindow?.postMessage(
                  JSON.stringify({ action: "load", xml, autosave: 1 }),
                  "*"
                );
              }
            } catch (fallbackErr: any) {
              setDrawioStatus("error");
              setDrawioError(fallbackErr.message || "Failed to compile visual diagram.");
            }
          }
        } else {
          try {
            const xml = compileBlueprintToDrawio(targetBlueprint, renderedSvg || canvasSvg || undefined);
            drawioDataXML = xml;
            setDrawioXML(xml);
            setDrawioStatus("loaded");
            if (drawioReady) {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ action: "load", xml, autosave: 1 }),
                "*"
              );
            }
          } catch (fallbackErr: any) {
            setDrawioStatus("error");
            setDrawioError("No SVG was rendered and deterministic fallback failed.");
          }
        }
      } else if (compilerMethod === "deterministic") {
        try {
          const xml = compileBlueprintToDrawio(targetBlueprint, renderedSvg || canvasSvg || undefined);
          drawioDataXML = xml;
          setDrawioXML(xml);
          setDrawioStatus("loaded");

          if (drawioReady) {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ action: "load", xml, autosave: 1 }),
              "*"
            );
          }
        } catch (localErr: any) {
          console.error("Local geometric compilation failed, falling back to server...", localErr);
          setDrawioStatus("loading");
          const fallbackRes = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage: 3, blueprint: targetBlueprint })
          });
          if (fallbackRes.ok) {
            const { xml } = await fallbackRes.json();
            drawioDataXML = xml;
            setDrawioXML(xml);
            setDrawioStatus("loaded");
            if (drawioReady) {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ action: "load", xml, autosave: 1 }),
                "*"
              );
            }
          } else {
            throw new Error("Both local layout compilation and server-side fallback processes failed.");
          }
        }
      } else {
        const serverS3Res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: 3, blueprint: targetBlueprint })
        });
        if (serverS3Res.ok) {
          const { xml } = await serverS3Res.json();
          drawioDataXML = xml;
          setDrawioXML(xml);
          setDrawioStatus("loaded");

          if (drawioReady) {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ action: "load", xml, autosave: 1 }),
              "*"
            );
          }
        } else {
          try {
            const xml = compileBlueprintToDrawio(targetBlueprint, renderedSvg || canvasSvg || undefined);
            drawioDataXML = xml;
            setDrawioXML(xml);
            setDrawioStatus("loaded");
            if (drawioReady) {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ action: "load", xml, autosave: 1 }),
                "*"
              );
            }
          } catch (localFallbackErr: any) {
            setDrawioStatus("error");
            setDrawioError(localFallbackErr.message || "Failed to generate standard selectable elements.");
          }
        }
      }

      setPipelineStage(4);

      if (promptToSave) {
        // Create history record
        const historyRecord: HistoryEntry = {
          id: historyIdCounter,
          prompt: promptToSave,
          mermaidCode: code,
          blueprint: targetBlueprint,
          drawioXML: drawioDataXML,
          ts: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };

        setHistoryIdCounter(prev => prev + 1);

        const revisedHistory = [historyRecord, ...stateHistory].slice(0, 10);
        setStateHistory(revisedHistory);
        saveHistoryToLocalStorage(revisedHistory);
      }

      setTimeout(() => {
        setPipelineStage(0);
      }, 3500);

    } catch (err: any) {
      console.error("Compilation pipeline exception:", err);
      setPipelineStage(0);
      setCanvasError(err.message || "An unexpected error occurred during diagram synthesis.");
      setDrawioColorPalleteError(err.message);
    }
  };

  const setDrawioColorPalleteError = (msg: string) => {
    setDrawioStatus("error");
    setDrawioError(msg || "Pipeline crashed.");
  };

  // ----------------------------------------------------
  // PIPELINE INITIATOR
  // ----------------------------------------------------
  const handleGenerate = async () => {
    if (!promptInput.trim()) {
      triggerToast("Please describe the architecture you want to build.", true);
      return;
    }
    if (loading) return;

    setLoading(true);
    setCanvasError(null);
    setDrawioError(null);
    setDrawioStatus("loading");

    // Clear outputs on start
    setLastBlueprint(null);
    setMermaidCode("");
    setCanvasSvg("");
    setDrawioXML(null);

    const currentPrompt = promptInput;

    try {
      // --------------------------------------------------
      // STAGE 1: PARSE TO BLUEPRINT
      // --------------------------------------------------
      setPipelineStage(1);
      const s1Res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: 1,
          prompt: currentPrompt,
          diagramType: diagramType,
          file: selectedFile
        })
      });

      if (!s1Res.ok) {
        const errJson = await s1Res.json();
        throw new Error(errJson.error || "Failed parsing system layout structure.");
      }

      const { blueprint } = await s1Res.json();
      setLastBlueprint(blueprint);

      // Run Stages 2 and 3 modularly
      await compileBlueprintToDiagrams(blueprint, currentPrompt);
      setPromptInput("");
      setSelectedFile(null);

    } catch (err: any) {
      console.error(err);
      setPipelineStage(0);
      setCanvasError(err.message || "An unexpected error occurred during diagram synthesis.");
      setDrawioStatus("error");
      setDrawioError(err.message || "Pipeline crashed.");
      triggerToast(err.message || "Generation pipeline failed.", true);
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------------------------------
  // DIAGRAM AI CO-PILOT REFINEMENT (Stage 4)
  // ----------------------------------------------------
  const handleCopilotRefine = async () => {
    if (!copilotPrompt.trim()) {
      triggerToast("Please state what edits or additions you want to make.", true);
      return;
    }
    if (!lastBlueprint) {
      triggerToast("Generate a base diagram first to use the AI Refinement Co-pilot.", true);
      return;
    }
    if (loading) return;

    setLoading(true);
    setCopilotLoading(true);

    try {
      setPipelineStage(1);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: 4,
          blueprint: lastBlueprint,
          instruction: copilotPrompt,
          file: selectedFile
        })
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "AI refinement failed.");
      }

      const { blueprint: updatedBlueprint } = await res.json();
      setLastBlueprint(updatedBlueprint);

      // Synchronize Mermaid & Draw.io maps modularly
      await compileBlueprintToDiagrams(updatedBlueprint, `AI Edit: ${copilotPrompt}`);
      setCopilotPrompt("");
      setSelectedFile(null);
      triggerToast("AI co-pilot edits successfully applied! ✓", false);

    } catch (err: any) {
      console.error(err);
      triggerToast(err.message || "AI refinement failed.", true);
    } finally {
      setLoading(false);
      setCopilotLoading(false);
    }
  };

  // ----------------------------------------------------
  // INTERACTIVE GRAPH CREATORS & QUICK FIX HANDLERS
  // ----------------------------------------------------
  const handleCreateNode = () => {
    if (!newNodeLabel.trim()) {
      triggerToast("Please provide a component name.", true);
      return;
    }
    const safeId = "node_" + newNodeLabel.toLowerCase().replace(/[^a-z0-9]/g, "_");
    const targetGroupId = newNodeGroup || lastBlueprint?.groups?.[0]?.id || "default_group";
    
    const updatedBlueprint = { ...lastBlueprint };
    
    // Ensure target group exists
    let targetGroup = updatedBlueprint.groups?.find((g: any) => g.id === targetGroupId);
    if (!targetGroup) {
      targetGroup = { id: targetGroupId, label: "New Services", nodes: [] };
      updatedBlueprint.groups = updatedBlueprint.groups || [];
      updatedBlueprint.groups.push(targetGroup);
    }
    if (!targetGroup.nodes) targetGroup.nodes = [];
    
    // Insert node
    targetGroup.nodes.push({
      id: safeId,
      label: newNodeLabel,
      type: newNodeType,
      shape: newNodeShape
    });

    setNewNodeLabel("");
    setLastBlueprint(updatedBlueprint);
    compileBlueprintToDiagrams(updatedBlueprint);
    triggerToast(`Created component "${newNodeLabel}"! ✓`, false);
  };

  const handleCreateEdge = () => {
    if (!newEdgeFrom || !newEdgeTo) {
      triggerToast("Please select both source and target components.", true);
      return;
    }
    const updatedBlueprint = { ...lastBlueprint };
    if (!updatedBlueprint.edges) updatedBlueprint.edges = [];
    
    updatedBlueprint.edges.push({
      from: newEdgeFrom,
      to: newEdgeTo,
      label: newEdgeLabel || "",
      style: newEdgeStyle || "solid"
    });

    setNewEdgeLabel("");
    setLastBlueprint(updatedBlueprint);
    compileBlueprintToDiagrams(updatedBlueprint);
    triggerToast("Connection wired successfully! ✓", false);
  };

  const getArchitectureScanResults = (blueprint: any) => {
    if (!blueprint) return [];
    
    const reports: any[] = [];
    const allNodes = blueprint.groups?.flatMap((g: any) => g.nodes || []) || [];
    const allEdges = blueprint.edges || [];

    const hasDatabase = allNodes.some((n: any) => n.type === "database");
    const hasGateway = allNodes.some((n: any) => n.type === "gateway" || n.type === "ui");
    const hasQueue = allNodes.some((n: any) => n.type === "queue");
    
    // Check 1: Missing Ingress Gateway / UI layer
    if (!hasGateway && allNodes.length > 2) {
      reports.push({
        id: "missing_gateway",
        type: "high",
        title: "Public API Protection (High Risk)",
        description: "Services are directly exposed to the public edge without an Ingress controller, Load Balancer, or API Gateway.",
        recommendation: "Add an API Gateway or Reverse Proxy component to handle centralized rate limiting, CORS configuration, SSL termination, and request routing.",
        canQuickFix: true,
        quickFixLabel: "Add API Gateway",
        actionPayload: { action: "add_gateway" }
      });
    }

    // Check 2: Single Point of Failure (Database protection check)
    if (hasDatabase) {
      const dbNodes = allNodes.filter((n: any) => n.type === "database");
      const hasReplicaGroup = blueprint.groups?.some((g: any) => g.label?.toLowerCase().includes("replica") || g.label?.toLowerCase().includes("secondary") || g.label?.toLowerCase().includes("cluster"));
      
      if (dbNodes.length === 1 && !hasReplicaGroup) {
        reports.push({
          id: "database_spof",
          type: "medium",
          title: "Database Isolation & SPOF (Medium Risk)",
          description: "A single master Database node acts as a Single Point of Failure with no failover replica.",
          recommendation: "Introduce a database replication node group (Multi-AZ Cluster or Standby Read-Replica) to isolate physical server failures.",
          canQuickFix: true,
          quickFixLabel: "Add DB Replica",
          actionPayload: { action: "add_db_replica" }
        });
      }
    }

    // Check 3: Synchronous Heavy Requests to DB
    const hasDirectDBSync = allEdges.some((e: any) => {
      const srcNode = allNodes.find((n: any) => n.id === e.from);
      const destNode = allNodes.find((n: any) => n.id === e.to);
      return srcNode && destNode && (srcNode.type === "gateway" || srcNode.type === "ui") && destNode.type === "database";
    });

    if (hasDirectDBSync) {
      reports.push({
        id: "sync_db_write",
        type: "medium",
        title: "Direct Public DB Queries (Medium Risk)",
        description: "Direct client/gateway requests hit database clusters. This opens the network layer to potential query inundations.",
        recommendation: "Funnel client requests downstream through processing services or integrate caching microservices (e.g. AWS ElastiCache) in front of physical databases.",
        canQuickFix: false,
      });
    }

    // Check 4: Queue adoption check for high loads
    if (allNodes.length > 5 && !hasQueue) {
      reports.push({
        id: "missing_queue",
        type: "info",
        title: "Loose Coupling check (Opportunity)",
        description: "No message queue buffer found. Modular services interact strictly via synchronous RPC or HTTP.",
        recommendation: "Introduce an event-driven system backbone (e.g. RabbitMQ, AWS SQS, or Apache Kafka) for transaction throttling and async resilience.",
        canQuickFix: true,
        quickFixLabel: "Add Message Queue",
        actionPayload: { action: "add_queue" }
      });
    }

    // Check 5: Orphan nodes detection
    const connectedNodeIds = new Set();
    for (const e of allEdges) {
      connectedNodeIds.add(e.from);
      connectedNodeIds.add(e.to);
    }
    const orphans = allNodes.filter((n: any) => !connectedNodeIds.has(n.id));
    if (orphans.length > 0) {
      reports.push({
        id: "orphan_components",
        type: "info",
        title: "Dangling Elements Detect (Design Check)",
        description: `Your architecture has ${orphans.length} component(s) with zero communication connections: ${orphans.map((o: any) => o.label).join(", ")}.`,
        recommendation: "Ensure all microservices are connected to matching orchestration gateways or client services.",
        canQuickFix: false
      });
    }

    return reports;
  };

  const handleQuickFixAudit = (reportId: string, actionPayload: any) => {
    if (!lastBlueprint) return;
    const updatedBlueprint = { ...lastBlueprint };
    
    if (actionPayload.action === "add_gateway") {
      const gatewayId = "api_gateway";
      const allNodes = updatedBlueprint.groups?.flatMap((g: any) => g.nodes || []) || [];
      const firstService = allNodes.find((n: any) => n.type === "service")?.id;

      if (updatedBlueprint.groups?.[0]) {
        updatedBlueprint.groups[0].nodes = updatedBlueprint.groups[0].nodes || [];
        updatedBlueprint.groups[0].nodes.unshift({
          id: gatewayId,
          label: "API Gateway",
          type: "gateway",
          shape: "stadium"
        });
      }
      if (firstService) {
        updatedBlueprint.edges = updatedBlueprint.edges || [];
        updatedBlueprint.edges.unshift({
          from: gatewayId,
          to: firstService,
          label: "Central Route",
          style: "solid"
        });
      }
      triggerToast("Central Ingress API Gateway established! ✓", false);
    } 
    else if (actionPayload.action === "add_db_replica") {
      let dbNode: any = null;
      let dbGroup: any = null;
      for (const g of updatedBlueprint.groups || []) {
        const found = g.nodes?.find((n: any) => n.type === "database");
        if (found) {
          dbNode = found;
          dbGroup = g;
          break;
        }
      }
      if (dbNode && dbGroup) {
        const replicaId = `${dbNode.id}_replica`;
        dbGroup.nodes.push({
          id: replicaId,
          label: `${dbNode.label} Replica`,
          type: "database",
          shape: "cylinder"
        });
        updatedBlueprint.edges = updatedBlueprint.edges || [];
        updatedBlueprint.edges.push({
          from: dbNode.id,
          to: replicaId,
          label: "Replication Sync",
          style: "dashed"
        });
        triggerToast("Database hot standby read-replica synced! ✓", false);
      }
    }
    else if (actionPayload.action === "add_queue") {
      const queueId = "message_queue";
      const services = updatedBlueprint.groups?.flatMap((g: any) => g.nodes || []).filter((n: any) => n.type === "service");
      const firstService = services?.[0]?.id;
      const secondService = services?.[1]?.id;

      if (updatedBlueprint.groups?.[0]) {
        updatedBlueprint.groups[0].nodes = updatedBlueprint.groups[0].nodes || [];
        updatedBlueprint.groups[0].nodes.push({
          id: queueId,
          label: "Kafka Bus",
          type: "queue",
          shape: "hexagon"
        });
      }
      if (firstService && secondService) {
        updatedBlueprint.edges = updatedBlueprint.edges || [];
        updatedBlueprint.edges.push({
          from: firstService,
          to: queueId,
          label: "Emit Event",
          style: "solid"
        });
        updatedBlueprint.edges.push({
          from: queueId,
          to: secondService,
          label: "Consume Batch",
          style: "solid"
        });
        triggerToast("Kafka message queue broker deployed! ✓", false);
      }
    }

    setLastBlueprint(updatedBlueprint);
    compileBlueprintToDiagrams(updatedBlueprint);
  };

  // ----------------------------------------------------
  // CLIENT MERMAID GENERATOR RENDERER
  // ----------------------------------------------------
  const sanitizeMermaidCode = (code: string): string => {
    // Normalize line endings
    let clean = code.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // ── Category 1: Diagram-type declarations ────────────────────────────────
    // These are standalone keywords with NO parentheses that may be squashed
    // directly against another word character (e.g. "C4Contexttitle").
    // MUST NOT use \b because the preceding character is also a word char.
    const DIAGRAM_DECLARATIONS = [
      "C4Context", "C4Container", "C4Component",
      "sequenceDiagram", "erDiagram", "classDiagram", "stateDiagram-v2",
      "flowchart", "mindmap", "quadrantChart", "gantt", "timeline", "graph"
    ];

    // ── Category 2: C4 function keywords (always followed by `(`) ────────────
    // These can appear after any character, including another word char.
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
    // These are preceded by whitespace in valid code but may be squashed after
    // punctuation/symbols. Matched without requiring \b (which fails
    // word-char → word-char boundaries like "Platformtitle").
    const PLAIN_KEYWORDS = [
      "direction",
      "classDef", "class",
      "participant", "actor", "autonumber", "loop", "rect", "opt", "alt", "else",
      "state", "dateFormat", "axisFormat", "section",
      "x-axis", "y-axis", "quadrant-1", "quadrant-2", "quadrant-3", "quadrant-4",
      "title", "end"
    ];

    // ── Category 4: Structural block keywords ─────────────────────────────────
    // subgraph and end MUST always start on a fresh line regardless of what
    // character precedes them. Critically, they can appear directly after a
    // direction word-char (e.g. "TDsubgraph") so we CANNOT use the
    // (?<![\w]) lookbehind used in Category 3 — it would block the match.
    // Instead use the same unconditional ([^\n])(keyword) pattern as Cat 1.
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
        // Match any non-newline char immediately followed by the keyword
        for (const kw of DIAGRAM_DECLARATIONS) {
          const pattern = kw === "graph" ? "(?<!sub)graph" : kw;
          const regex = new RegExp(`([^\\n])(${pattern})`, "g");
          seg = seg.replace(regex, "$1\n$2");
          // Also split if followed immediately by a letter (e.g. C4Contexttitle -> C4Context\ntitle)
          const trailingRegex = new RegExp(`(${pattern})([a-zA-Z])`, "g");
          seg = seg.replace(trailingRegex, "$1\n$2");
        }

        // Category 2 — C4 function calls: keyword followed by (
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

        // Category 3 — plain keywords: use (?<![\w]) instead of \b so we
        // correctly split word-char→keyword transitions (e.g. "Platformtitle").
        // NOTE: subgraph/end are intentionally excluded — they live in Cat 4.
        for (const kw of PLAIN_KEYWORDS) {
          // Escape any special regex chars in the keyword (e.g. `-` in x-axis)
          const escaped = kw.replace(/[-]/g, "\\-");
          // (?<![\w]) is a lookbehind: keyword must NOT be preceded by a word char
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

    // ── Final safety-net passes (applied AFTER the multi-pass loop) ─────────
    // These target specific squash patterns that survive unquoted-segment
    // processing: flowchart/graph declarations merged with the next statement.

    // 1. flowchart/graph + direction squashed against subgraph / end / another graph keyword.
    //    IMPORTANT: use explicit direction alternation instead of \w+ so "TD" doesn't
    //    get swallowed together with the following keyword into one token.
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
  };

  interface ValidationResult {
    isValid: boolean;
    lineNum?: number;
    lineContent?: string;
    errorMsg?: string;
  }

  const validateMermaidStatements = (code: string): ValidationResult => {
    const lines = code.split("\n");
    const keywords = [
      "C4Context", "C4Container", "C4Component", "direction",
      "Person", "System", "Container", "Component", "Boundary", "Rel",
      "subgraph", "end", "classDef", "class", "participant", "actor",
      "erDiagram", "classDiagram", "stateDiagram-v2", "gantt", "timeline", "mindmap",
      "quadrantChart", "title", "flowchart", "graph"
    ];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("%%")) continue;
      
      let statementCount = 0;
      const matchedKeywords: string[] = [];
      
      // Split by double quotes to ignore keywords inside labels
      const parts = line.split('"');
      const outsideQuotes = parts.filter((_, idx) => idx % 2 === 0).join(" ");
      
      for (const kw of keywords) {
        let regex: RegExp;
        if (["Person", "System", "Container", "Component", "Boundary", "Rel"].includes(kw)) {
          regex = new RegExp(`\\b${kw}\\s*\\(`, "i");
        } else {
          regex = new RegExp(`\\b${kw}\\b`, "i");
        }
        
        if (regex.test(outsideQuotes)) {
          statementCount++;
          matchedKeywords.push(kw);
        }
      }
      
      if (statementCount > 1) {
        return {
          isValid: false,
          lineNum: i + 1,
          lineContent: lines[i],
          errorMsg: `Validation failed: Line ${i + 1} contains multiple squashed statements: "${lines[i]}" (detected keywords: ${matchedKeywords.join(", ")})`
        };
      }
    }
    
    return { isValid: true };
  };

  const renderMermaidMarkup = async (code: string): Promise<string | null> => {
    if (typeof window === "undefined" || !(window as any).mermaid) {
      setCanvasError("Mermaid.js CDN library is not loaded onto browser.");
      return null;
    }
    const cleanCode = sanitizeMermaidCode(code);

    const sanitizeMermaid = (c: string): string => {
      return c
        .replace(/\r\n/g, '\n')
        // Fix merged flowchart declaration + subgraph
        .replace(/(flowchart\s+(?:LR|RL|TD|TB|BT))(subgraph)/gi, '$1\n$2')
        // Fix any other keyword merges on the same line
        .replace(/(flowchart\s+(?:LR|RL|TD|TB|BT))(graph)/gi, '$1\n$2')
        // Ensure end keyword is always on its own line
        .replace(/([^\n])\b(end)\b(\s*\n)/gi, '$1\nend\n')
        // Collapse excessive blank lines
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    };

    const finalCode = sanitizeMermaid(cleanCode);

    if (finalCode !== code) {
      setMermaidCode(finalCode);
    }

    // Pre-rendering statement validation
    const validation = validateMermaidStatements(finalCode);
    if (!validation.isValid) {
      console.warn("Validation failed for Mermaid source code:", validation.errorMsg);
      setCanvasError(validation.errorMsg || "Syntax validation failed.");
      return null;
    }

    const m = (window as any).mermaid;
    const renderId = "mermaid-render-" + Math.random().toString(36).substring(2, 9);
    try {
      const { svg } = await m.render(renderId, finalCode);
      setCanvasSvg(svg);
      setCanvasError(null);
      // Auto centers the dynamic diagram view
      setTimeout(() => {
        autoFitDiagramView();
      }, 50);
      return svg;
    } catch (e: any) {
      console.error("Client side parsing failed:", e);
      setCanvasError(e.message || "The compile engine failed to parse visual code styles.");
      // Clean up bad renderer states
      const badElem = document.getElementById(renderId);
      if (badElem) badElem.remove();
      return null;
    }
  };

  /**
   * Wraps the Mermaid-rendered SVG as a base64 image inside a draw.io mxfile.
   * This guarantees pixel-perfect visual parity between the canvas and the iframe.
   */
  const compileSvgToDrawioXml = (svgString: string, title = "Architecture Diagram"): string => {
    // Parse SVG dimensions from viewBox or width/height attributes
    let svgW = 1600;
    let svgH = 900;
    const vbMatch = svgString.match(/viewBox="[^"]*?(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)\s+(\d+\.?\d*)"/);
    if (vbMatch) {
      svgW = Math.ceil(parseFloat(vbMatch[3]));
      svgH = Math.ceil(parseFloat(vbMatch[4]));
    } else {
      const wMatch = svgString.match(/width="(\d+\.?\d*)"/);
      const hMatch = svgString.match(/height="(\d+\.?\d*)"/);
      if (wMatch) svgW = Math.ceil(parseFloat(wMatch[1]));
      if (hMatch) svgH = Math.ceil(parseFloat(hMatch[1]));
    }

    // Ensure the SVG has xmlns so browsers can parse it as a standalone image
    let normalizedSvg = svgString;
    if (!normalizedSvg.includes("xmlns=")) {
      normalizedSvg = normalizedSvg.replace("<svg", `<svg xmlns="http://www.w3.org/2000/svg"`);
    }

    // Encode as a data URI that draw.io can embed as an image shape
    const base64Svg = btoa(unescape(encodeURIComponent(normalizedSvg)));
    const dataUri = `data:image/svg+xml;base64,${base64Svg}`;

    const escapeXmlAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const safeDataUri = escapeXmlAttr(dataUri);

    // Add a comfortable 40px margin on all sides
    const margin = 40;
    const pageW = svgW + margin * 2;
    const pageH = svgH + margin * 2;

    return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="ArchPrompt" modified="${new Date().toISOString()}" agent="ArchPrompt" version="21.5.0" type="device">
  <diagram id="diag_${Math.random().toString(36).substring(2, 9)}" name="${escapeXmlAttr(title)}">
    <mxGraphModel dx="1200" dy="800" grid="0" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1.0" pageWidth="${pageW}" pageHeight="${pageH}" background="#0A0A0A" math="0" shadow="0">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <mxCell id="2" value="" style="shape=image;verticalLabelPosition=bottom;labelBackgroundColor=none;verticalAlign=top;align=center;strokeColor=none;fillColor=none;image;image=${safeDataUri};aspect=fixed;" vertex="1" parent="1">
          <mxGeometry x="${margin}" y="${margin}" width="${svgW}" height="${svgH}" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>`;
  };

  const manualPushCodeToCanvas = async (customCode: string) => {
    setMermaidCode(customCode);
    await renderMermaidMarkup(customCode);
  };

  // ----------------------------------------------------
  // ZOOM AND PAN ENGINE
  // ----------------------------------------------------
  const handleMouseDown = (e: React.MouseEvent) => {
    if (canvasError || !canvasSvg) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - zoom.x, y: e.clientY - zoom.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setZoom((prev) => ({
      ...prev,
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!canvasSvg) return;
    e.preventDefault();
    const zoomIntensity = 0.08;
    const scaleFactor = e.deltaY < 0 ? 1 + zoomIntensity : 1 - zoomIntensity;
    const nextScale = Math.min(Math.max(zoom.scale * scaleFactor, 0.05), 10);
    setZoom((prev) => ({ ...prev, scale: nextScale }));
  };

  const autoFitDiagramView = () => {
    const container = containerRef.current;
    if (!container) return;
    const svgEl = container.querySelector("svg");
    if (!svgEl) {
      setZoom({ scale: 1, x: 0, y: 0 });
      return;
    }

    const cWidth = container.clientWidth;
    const cHeight = container.clientHeight;
    const svgWidth = svgEl.viewBox?.baseVal?.width || svgEl.clientWidth || 800;
    const svgHeight = svgEl.viewBox?.baseVal?.height || svgEl.clientHeight || 500;

    const scale = Math.min((cWidth - 48) / svgWidth, (cHeight - 48) / svgHeight, 1.4);
    const x = (cWidth - svgWidth * scale) / 2;
    const y = (cHeight - svgHeight * scale) / 2;

    setZoom({ scale: Math.max(scale, 0.1), x, y });
  };

  // ----------------------------------------------------
  // DRAW.IO ACTIONS PROXIES
  // ----------------------------------------------------
  const toggleDrawioFormatPanel = () => {
    const updatedState = !drawioFormatOpen;
    setDrawioFormatOpen(updatedState);
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "format", open: updatedState }),
      "*"
    );
  };

  const triggerDrawioOutline = () => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "outline" }),
      "*"
    );
  };

  const requestDrawioSyncToCanvas = () => {
    if (!drawioReady) return;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: "export", format: "xmlsvg" }),
      "*"
    );
  };

  const retryDrawioGeneration = async () => {
    if (!lastBlueprint) {
      triggerToast("No historical blueprint session exists.", true);
      return;
    }
    setDrawioStatus("loading");
    setDrawioError(null);
    try {
      if (compilerMethod === "visual") {
        if (canvasSvg) {
          const xml = compileSvgToDrawioXml(canvasSvg);
          setDrawioXML(xml);
          setDrawioStatus("loaded");
          if (drawioReady) {
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ action: "load", xml, autosave: 1 }),
              "*"
            );
          }
          triggerToast("Visual parity compiled successfully! ✓", false);
        } else if (mermaidCode) {
          const renderedSvg = await renderMermaidMarkup(mermaidCode);
          if (renderedSvg) {
            const xml = compileSvgToDrawioXml(renderedSvg);
            setDrawioXML(xml);
            setDrawioStatus("loaded");
            if (drawioReady) {
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ action: "load", xml, autosave: 1 }),
                "*"
              );
            }
            triggerToast("Visual parity compiled successfully! ✓", false);
          } else {
            throw new Error("Could not render Mermaid SVG for Visual parity compilation.");
          }
        } else {
          throw new Error("SVG content not found for Visual parity compiler.");
        }
      } else if (compilerMethod === "deterministic") {
        const xml = compileBlueprintToDrawio(lastBlueprint, canvasSvg || undefined);
        setDrawioXML(xml);
        setDrawioStatus("loaded");
        if (drawioReady) {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ action: "load", xml, autosave: 1 }),
            "*"
          );
        }
        triggerToast("Selectable elements re-compiled successfully! ✓", false);
      } else {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: 3, blueprint: lastBlueprint })
        });
        if (!res.ok) {
          const errJson = await res.json();
          throw new Error(errJson.error || "Retry compilation failed.");
        }
        const { xml } = await res.json();
        setDrawioXML(xml);
        setDrawioStatus("loaded");
        if (drawioReady) {
          iframeRef.current?.contentWindow?.postMessage(
            JSON.stringify({ action: "load", xml, autosave: 1 }),
            "*"
          );
        }
        triggerToast("Selectable elements re-compiled successfully! ✓", false);
      }
    } catch (err: any) {
      setDrawioStatus("error");
      setDrawioError(err.message || "Failed on retry compilation.");
    }
  };

  // Automatically re-compile draw.io XML when the compiler method changes
  useEffect(() => {
    if (lastBlueprint) {
      retryDrawioGeneration();
    }
  }, [compilerMethod]);

  // ----------------------------------------------------
  // RESTORE HISTORIC GENERATIONS
  // ----------------------------------------------------
  const handleRestoreHistory = async (entry: HistoryEntry) => {
    setLastBlueprint(entry.blueprint);
    setMermaidCode(entry.mermaidCode);
    setDrawioXML(entry.drawioXML);
    setCanvasError(null);
    setDrawioError(null);

    await renderMermaidMarkup(entry.mermaidCode);

    if (entry.drawioXML) {
      setDrawioStatus("loaded");
      if (drawioReady) {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ action: "load", xml: entry.drawioXML, autosave: 1 }),
          "*"
        );
      }
    } else {
      setDrawioStatus("empty");
    }

    setActiveTab("diagram");
    triggerToast("Loaded diagram from history ✓", false);
  };

  const handleResetWorkspace = () => {
    setLastBlueprint(null);
    setMermaidCode("");
    setCanvasSvg("");
    setDrawioXML(null);
    setCanvasError(null);
    setDrawioError(null);
    setDrawioStatus("empty");
    setZoom({ scale: 1, x: 0, y: 0 });
    triggerToast("Workspace cleared.", false);
  };

  const exportPngFile = () => {
    if (!canvasSvg) return;
    try {
      const svgString = canvasSvg;
      const parser = new DOMParser();
      const doc = parser.parseFromString(svgString, "image/svg+xml");
      const rootSvg = doc.querySelector("svg");
      if (!rootSvg) return;

      rootSvg.removeAttribute("class");
      rootSvg.removeAttribute("transform");
      rootSvg.removeAttribute("style");

      const width = rootSvg.viewBox?.baseVal?.width || rootSvg.clientWidth || 1000;
      const height = rootSvg.viewBox?.baseVal?.height || rootSvg.clientHeight || 700;

      const scale = 2; // Output resolution expansion
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.scale(scale, scale);

      const serialized = new XMLSerializer().serializeToString(rootSvg);
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(serialized);

      img.onload = () => {
        ctx.fillStyle = "transparent";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0);
        const imgUrl = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = imgUrl;
        a.download = "architecture-diagram.png";
        a.click();
        triggerToast("PNG exported at 2x resolution! ✓", false);
      };
    } catch (e) {
      console.error(e);
      triggerToast("Failed PNG serialization.", true);
    }
  };

  const exportSvgFile = () => {
    if (!canvasSvg) return;
    const cleanSvg = canvasSvg.replace(/<rect[^>]*class="[^"]*mermaid-main-bg"[^>]*>/i, "");
    downloadBlob(cleanSvg, "architecture.svg", "image/svg+xml");
    triggerToast("SVG file downloaded! ✓", false);
  };

  const copyToClipboard = (text: string, type: "code" | "json") => {
    navigator.clipboard.writeText(text);
    if (type === "code") {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
    triggerToast("Copied to clipboard!", false);
  };

  const getDiagramKindBadge = (code: string) => {
    const firstLine = code.trim().toLowerCase();
    if (firstLine.startsWith("flowchart") || firstLine.startsWith("graph")) return "Flowchart / Schema";
    if (firstLine.startsWith("sequencediagram")) return "Sequence Diagram";
    if (firstLine.startsWith("erdiagram")) return "ER Diagram";
    if (firstLine.startsWith("classdiagram")) return "Class Diagram";
    if (firstLine.startsWith("statediagram-v2") || firstLine.startsWith("statediagram")) return "State Diagram";
    if (firstLine.startsWith("c4context")) return "C4 Standard Context";
    if (firstLine.startsWith("c4container")) return "C4 Container Diagram";
    if (firstLine.startsWith("c4component")) return "C4 Component Diagram";
    if (firstLine.startsWith("gantt")) return "Gantt Timeline";
    if (firstLine.startsWith("timeline")) return "Chronological Timeline";
    if (firstLine.startsWith("mindmap")) return "Concept Mindmap";
    if (firstLine.startsWith("quadrantchart")) return "2x2 Quadrant Chart";
    return "Architecture Preview";
  };

  // ----------------------------------------------------
  // GITHUB PUSH FUNCTIONALITY
  // ----------------------------------------------------
  const handleGithubPush = async () => {
    if (!githubOwner.trim() || !githubRepo.trim()) {
      triggerToast("Please provide repository owner and name", true);
      return;
    }

    let contentToPush = "";
    let fileExtension = "";
    let contentType = "";

    switch (githubExportType) {
      case "drawio":
        if (!drawioXML) {
          triggerToast("No Draw.io XML available to export", true);
          return;
        }
        contentToPush = drawioXML;
        fileExtension = ".drawio";
        contentType = "Draw.io XML";
        break;
      case "svg":
        if (!canvasSvg) {
          triggerToast("No SVG diagram available to export", true);
          return;
        }
        contentToPush = canvasSvg;
        fileExtension = ".svg";
        contentType = "SVG diagram";
        break;
      case "mermaid":
        if (!mermaidCode) {
          triggerToast("No Mermaid code available to export", true);
          return;
        }
        contentToPush = mermaidCode;
        fileExtension = ".mmd";
        contentType = "Mermaid source";
        break;
    }

    setGithubPushing(true);

    try {
      const finalPath = githubPath.endsWith(fileExtension) ? githubPath : `${githubPath}${fileExtension}`;
      const commitMsg = githubCommitMessage.trim() || `Update ${contentType}: ${lastBlueprint?.title || "Architecture Diagram"}`;

      const res = await fetch("/api/github-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: githubOwner,
          repo: githubRepo,
          branch: githubBranch,
          path: finalPath,
          message: commitMsg,
          content: contentToPush,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "GitHub push failed");
      }

      triggerToast(`Successfully pushed to GitHub! ${data.url ? `View: ${data.url}` : ""}`, false);
      setGithubModalOpen(false);
      setGithubCommitMessage("");
    } catch (err: any) {
      console.error("GitHub push error:", err);
      triggerToast(err.message || "Failed to push to GitHub", true);
    } finally {
      setGithubPushing(false);
    }
  };

  const openGithubModal = () => {
    if (!drawioXML && !canvasSvg && !mermaidCode) {
      triggerToast("Generate a diagram first before exporting to GitHub", true);
      return;
    }
    setGithubModalOpen(true);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0A0A0A] font-sans antialiased text-[#F0F0F0]">
      {/* Script for loading Mermaid.js with proper hydration bounds */}
      <Script
        src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"
        strategy="afterInteractive"
        onLoad={handleMermaidLoad}
      />

      {/* --------------------------------------------------
          LEFT PANEL / SIDEBAR
          -------------------------------------------------- */}
      <aside className="w-[340px] flex-shrink-0 bg-[#0A0A0A] border-r border-white/10 flex flex-col h-full overflow-hidden select-none">
        
        {/* Branding header area */}
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-[#d4ff00]/10 border border-[#d4ff00]/25 flex items-center justify-center text-[#d4ff00] shadow-[0_0_15px_rgba(212,255,0,0.12)]">
              <Sparkles className="h-4.5 w-4.5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-light italic tracking-tighter text-[#F0F0F0]">
                ArchPrompt
              </h1>
              <p className="text-[9px] text-[#999999]/80 tracking-[0.25em] uppercase font-mono">
                Diagram Studio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 leading-none">
            <span className="h-1.5 w-1.5 rounded-full bg-[#d4ff00] shadow-[0_0_8px_#d4ff00]" />
            <span className="text-[9px] uppercase tracking-widest text-[#999999] font-mono font-medium">Active</span>
          </div>
        </div>

        {/* Form controls area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {/* Diagnostic status dot */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#d4ff00]" />
              <p className="text-xs font-mono font-medium text-[#F0F0F0]">
                Gemini Protocol Active
              </p>
            </div>
            <span className="text-[9px] font-mono bg-[#d4ff00]/15 text-[#d4ff00] border border-[#d4ff00]/25 px-2 py-0.5 rounded-md uppercase tracking-wide">
              3.5 Flash
            </span>
          </div>

          {/* Selector widget */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#999999] uppercase tracking-wider text-[9px] flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-[#d4ff00]" />
              Diagram Engine Modality
            </label>
            <div className="relative">
              <select
                value={diagramType}
                onChange={(e) => setDiagramType(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-xs text-[#F0F0F0] focus:outline-none focus:border-[#d4ff00] transition-colors cursor-pointer appearance-none"
              >
                <option value="auto" className="bg-[#0A0A0A]">🌟 Auto-detect optimal model</option>
                <optgroup label="Enterprise Core Systems" className="bg-[#0A0A0A]">
                  <option value="c4context">C4 Context Diagram</option>
                  <option value="c4container">C4 Container Map</option>
                  <option value="c4component">C4 Component Structure</option>
                </optgroup>
                <optgroup label="Processes & Workflows" className="bg-[#0A0A0A]">
                  <option value="flowchart">Standard Architecture Flowchart</option>
                  <option value="sequence">Interactive Sequence flow</option>
                  <option value="state">Unified State machine v2</option>
                </optgroup>
                <optgroup label="Entity Structure" className="bg-[#0A0A0A]">
                  <option value="er">Physical Entity Relation (ERD)</option>
                  <option value="class">Logical UML Class Schema</option>
                </optgroup>
                <optgroup label="Strategic Planning & Alignment" className="bg-[#0A0A0A]">
                  <option value="gantt">Project Gantt chart</option>
                  <option value="timeline">History / Chronology Roadmap</option>
                  <option value="mindmap">Tree-structured Brainstorm</option>
                  <option value="quadrant">Priority Matrix (2x2 Quadrant)</option>
                </optgroup>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[#999999]">
                <ChevronRight className="h-4 w-4 rotate-90" />
              </div>
            </div>
          </div>

          {/* Draw.io Compiler Engine Selector */}
          <div className="space-y-1.5 opacity-95">
            <label className="text-xs font-medium text-[#999999] uppercase tracking-wider text-[9px] flex items-center gap-2">
              <Settings className="h-3.5 w-3.5 text-[#d4ff00]" />
              Draw.io Compiler Method
            </label>
            <div className="grid grid-cols-3 gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
              <button
                type="button"
                onClick={() => setCompilerMethod("visual")}
                className={`py-2 text-[10px] font-mono font-bold tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  compilerMethod === "visual"
                    ? "bg-[#d4ff00]/10 text-[#d4ff00] border border-[#d4ff00]/25 shadow-[0_0_8px_rgba(212,255,0,0.08)] font-bold"
                    : "text-[#999999] hover:text-[#F0F0F0] hover:bg-white/5 border border-transparent font-normal"
                }`}
                title="Embed the exact Mermaid SVG inside draw.io to guarantee pixel-perfect visual parity"
              >
                <Eye className="h-3 w-3" />
                Visual
              </button>
              <button
                type="button"
                onClick={() => setCompilerMethod("deterministic")}
                className={`py-2 text-[10px] font-mono font-bold tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  compilerMethod === "deterministic"
                    ? "bg-[#d4ff00]/10 text-[#d4ff00] border border-[#d4ff00]/25 shadow-[0_0_8px_rgba(212,255,0,0.08)] font-bold"
                    : "text-[#999999] hover:text-[#F0F0F0] hover:bg-white/5 border border-transparent font-normal"
                }`}
                title="Use ultra-fast algorithmic topology mapping for perfect geometric alignments instantly"
              >
                <Layers className="h-3 w-3" />
                Topology
              </button>
              <button
                type="button"
                onClick={() => setCompilerMethod("gemini")}
                className={`py-2 text-[10px] font-mono font-bold tracking-wider uppercase rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  compilerMethod === "gemini"
                    ? "bg-[#d4ff00]/10 text-[#d4ff00] border border-[#d4ff00]/25 shadow-[0_0_8px_rgba(212,255,0,0.08)] font-bold"
                    : "text-[#999999] hover:text-[#F0F0F0] hover:bg-white/5 border border-transparent font-normal"
                }`}
                title="Use multi-stage Gemini AI translation prompts (slower, may vary)"
              >
                <Sparkles className="h-3 w-3" />
                Gemini AI
              </button>
            </div>
          </div>

          {/* Architecture Prompt Box */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="text-xs font-medium text-[#999999] uppercase tracking-wider text-[9px] flex items-center gap-2">
                <Code className="h-3.5 w-3.5 text-[#d4ff00]" />
                Describe System Architecture
              </label>
              <span className="text-[10px] font-mono text-[#999999]/40">
                {promptInput.length} / 1200
              </span>
            </div>
            <textarea
              value={promptInput}
              onChange={(e) => setPromptInput(e.target.value.slice(0, 1200))}
              placeholder="Describe microservices, AWS configurations, Docker pipelines, C4 databases, API Gateways, endpoints, auth lifecycles, and relational keys in plain English..."
              className="w-full h-36 bg-white/5 border border-white/10 rounded-xl p-3.5 text-xs text-[#F0F0F0] placeholder-[#999999]/40 focus:outline-none focus:border-[#d4ff00] transition-colors resize-none leading-relaxed transition-all input-autofocus"
            />
            {/* File Upload Section */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white/5 border border-white/10 rounded-xl mt-2 select-none">
              <div className="flex items-center gap-2">
                <Paperclip className="h-3.5 w-3.5 text-[#d4ff00]" />
                <span className="text-[10px] text-[#999999]">
                  {selectedFile ? (
                    <span className="text-[#F0F0F0] font-mono font-medium max-w-[190px] inline-block truncate">
                      📎 {selectedFile.fileName}
                    </span>
                  ) : (
                    "Attach background schema (PDF, Code, CSV, JSON, PNG, JPG)"
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {selectedFile ? (
                  <button
                    type="button"
                    onClick={() => setSelectedFile(null)}
                    className="p-1 px-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-100 rounded-lg text-[9px] uppercase font-mono transition cursor-pointer"
                  >
                    Clear File
                  </button>
                ) : (
                  <label className="p-1 px-2.5 bg-white/5 hover:bg-white/10 border border-white/15 hover:border-[#d4ff00]/40 text-[#F0F0F0] rounded-lg text-[9px] uppercase font-bold tracking-wider transition cursor-pointer flex items-center gap-1">
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept=".txt,.json,.yaml,.yml,.csv,.md,.pdf,image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Example Quickstart Chips */}
          <div className="space-y-2">
            <span className="text-[9px] uppercase tracking-[0.2em] font-medium text-[#999999]/60 block">
              Reference Protocols
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
              {Object.keys(EXAMPLES).map((key) => {
                const label = key.toUpperCase();
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setPromptInput(EXAMPLES[key as keyof typeof EXAMPLES]);
                      triggerToast(`Loaded sample ${label}!`, false);
                    }}
                    className="px-2.5 py-1.5 text-[11px] rounded-lg bg-white/5 border border-white/10 text-[#F0F0F0] hover:bg-white/10 hover:border-[#d4ff00]/40 transition duration-150 cursor-pointer text-left truncate max-w-full font-mono"
                  >
                    ✦ {key.charAt(0).toUpperCase() + key.slice(1)} Schema
                  </button>
                );
              })}
            </div>
          </div>

          {/* Synthesis Trigger Button */}
          <div className="pt-2">
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 bg-[#d4ff00] hover:bg-white text-black text-xs font-bold uppercase tracking-widest rounded-full flex items-center justify-center gap-2 transition duration-200 cursor-pointer shadow-[0_4px_15px_rgba(212,255,0,0.18)] hover:shadow-[0_4px_25px_rgba(212,255,0,0.35)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed select-none focus:outline-none"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-black" />
                  Compiling Protocol...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-current text-black" />
                  Execute Changes
                </>
              )}
            </button>
          </div>

          {/* AI Diagram Refiner Co-pilot (Active Blueprint Only) */}
          {lastBlueprint && (
            <div className="bg-[#d4ff00]/5 border border-[#d4ff00]/15 rounded-xl p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#d4ff00]" />
                <h3 className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wide">
                  AI Diagram Co-pilot
                </h3>
              </div>
              <p className="text-[10px] text-[#999999] leading-relaxed">
                Refine the current layout iteratively. Describe changes (e.g., &quot;add an elasticache buffer&quot;, &quot;make PostgreSQL green&quot;, &quot;delete billing service&quot;).
              </p>
              <div className="space-y-1.5">
                <textarea
                  value={copilotPrompt}
                  onChange={(e) => setCopilotPrompt(e.target.value)}
                  placeholder="Describe diagram modifications..."
                  className="w-full h-16 bg-white/5 border border-white/10 rounded-lg p-2 text-xs text-[#F0F0F0] placeholder-[#999999]/35 focus:outline-none focus:border-[#d4ff00] resize-none"
                />
                
                {/* Copilot File Attachment Indicator */}
                <div className="flex items-center justify-between text-[10px] text-[#999999] py-0.5">
                  {selectedFile ? (
                    <div className="flex items-center gap-1.5 bg-[#d4ff00]/5 border border-[#d4ff00]/15 rounded px-2 py-0.5 max-w-full truncate font-mono text-[9px] text-white">
                      <span>📎 Attached: {selectedFile.fileName}</span>
                      <button type="button" onClick={() => setSelectedFile(null)} className="text-red-400 hover:text-red-300 font-bold text-xs leading-none" title="Remove attachment">×</button>
                    </div>
                  ) : (
                    <label className="text-[9px] uppercase font-bold tracking-wider hover:text-white cursor-pointer border border-dashed border-white/10 rounded px-2 py-1 flex items-center gap-1 select-none">
                      <span>📎 Attach reference schema file</span>
                      <input
                        type="file"
                        accept=".txt,.json,.yaml,.yml,.csv,.md,.pdf,image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleCopilotRefine}
                  disabled={loading || !copilotPrompt.trim()}
                  className="w-full py-1.5 bg-[#d4ff00]/15 hover:bg-[#d4ff00]/25 text-[#d4ff00] border border-[#d4ff00]/25 rounded-lg text-[10px] font-bold uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1"
                >
                  {copilotLoading ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Refining...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3" />
                      Apply Refinement
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Pipeline execution progress checklist */}
          {loading && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-3.5">
              <span className="text-[9px] font-medium text-[#999999]/60 block tracking-wider uppercase">
                Active Compiler Engine Tasks
              </span>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3 text-xs">
                  <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${pipelineStage >= 1 ? "bg-[#d4ff00]/15 text-[#d4ff00] border border-[#d4ff00]/25" : "bg-white/5 text-[#999999]"}`}>
                    {pipelineStage > 1 ? "✓" : "1"}
                  </div>
                  <span className={pipelineStage === 1 ? "text-[#d4ff00] font-medium" : "text-[#999999]"}>
                    Parsing description parameters
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${pipelineStage >= 2 ? "bg-[#d4ff00]/15 text-[#d4ff00] border border-[#d4ff00]/25" : "bg-white/5 text-[#999999]"}`}>
                    {pipelineStage > 2 ? "✓" : "2"}
                  </div>
                  <span className={pipelineStage === 2 ? "text-[#d4ff00] font-medium" : "text-[#999999]"}>
                    Compiling visual diagram layouts
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${pipelineStage >= 3 ? "bg-[#d4ff00]/15 text-[#d4ff00] border border-[#d4ff00]/25" : "bg-white/5 text-[#999999]"}`}>
                    {pipelineStage > 3 ? "✓" : "3"}
                  </div>
                  <span className={pipelineStage === 3 ? "text-[#d4ff00] font-medium" : "text-[#999999]"}>
                    Finalising draw.io coordinate models
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Generation history */}
          {stateHistory.length > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-[9px] uppercase font-bold text-[#999999]/60 tracking-wider">
                  Past Generations
                </span>
                <span className="text-[9px] font-mono text-[#999999]/40">
                  {stateHistory.length} items
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {stateHistory.map((entry, index) => (
                  <button
                    key={entry.id}
                    onClick={() => handleRestoreHistory(entry)}
                    className="w-full text-left p-2.5 bg-white/5 border border-white/10 rounded-lg hover:bg-neutral-900 transition group cursor-pointer"
                  >
                    <div className="flex justify-between items-center gap-1">
                      <span className="text-[11px] font-semibold text-[#F0F0F0] group-hover:text-[#d4ff00] transition truncate w-[75%]">
                        {entry.blueprint?.title || "Untitled Architecture"}
                      </span>
                      <span className="text-[9px] font-mono text-[#999999]/40">
                        {entry.ts}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#999999]/70 truncate mt-0.5 max-w-full">
                      {entry.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Workspace state controller footer */}
        <div className="p-4 border-t border-white/10 bg-[#0A0A0A] flex gap-2">
          <button
            onClick={handleResetWorkspace}
            className="flex-1 py-2 text-xs bg-transparent border border-white/10 hover:bg-white/5 text-[#F0F0F0] rounded-lg transition text-center font-medium cursor-pointer"
          >
            Clear Screen
          </button>
          <a
            href="https://ai.studio/build"
            target="_blank"
            className="px-3 py-2 text-xs bg-white/5 hover:bg-white/10 text-[#F0F0F0] rounded-lg transition text-center border border-white/10 flex items-center justify-center animate-pulse"
            title="Google AI Studio Workspace"
          >
            <Compass className="h-4 w-4 text-[#d4ff00]" />
          </a>
        </div>

      </aside>

      {/* --------------------------------------------------
          MAIN CONTENT WORKSPACE
          -------------------------------------------------- */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0A0A0A]">
        {/* UPPER TABS BAR */}
        <header className="h-[60px] border-b border-white/10 bg-[#0A0A0A] px-6 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {[
              { id: "diagram", label: "Diagram Canvas", icon: Eye },
              { id: "drawio", label: "Draw.io Editor", icon: Edit3 },
              { id: "code", label: "Mermaid Source", icon: Code },
              { id: "blueprint", label: "Blueprint JSON", icon: FileText },
              { id: "export-presets", label: "Export File", icon: Download }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition duration-150 cursor-pointer ${activeTab === tab.id ? "bg-white/5 text-[#F0F0F0] border border-white/10" : "text-[#999999] hover:text-[#F0F0F0]"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {tab.id === "drawio" && drawioStatus === "loading" && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#d4ff00] animate-ping" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Model information and capabilities badge */}
          {lastBlueprint && (
            <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 px-3.5 py-1.5 rounded-lg">
              <Layers className="h-3.5 w-3.5 text-[#d4ff00]" />
              <span className="text-xs font-bold text-[#F0F0F0] tracking-wide">
                {lastBlueprint.title}
              </span>
              <span className="text-[10px] font-mono bg-[#d4ff00]/15 text-[#d4ff00] border border-[#d4ff00]/25 px-2 py-0.5 rounded-md uppercase tracking-wider font-semibold">
                {mermaidCode ? getDiagramKindBadge(mermaidCode) : "Flowchart"}
              </span>
            </div>
          )}
        </header>

        {/* MAIN BODY AREA FOR ACTIVE TAB */}
        <div className="flex-1 relative overflow-hidden bg-[#0A0A0A]">
          <AnimatePresence mode="wait">
            
            {/* 1. DIAGRAM INTERACTIVE CANVAS */}
            {activeTab === "diagram" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col overflow-hidden"
              >
                {/* Visual warning state banner */}
                <div className="bg-white/5 border-b border-white/10 px-5 py-2.5 flex items-center justify-between text-xs text-[#999999]">
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-[#d4ff00]" />
                    <span>This canvas shows the <b className="text-[#F0F0F0]">Mermaid Diagram</b>. Edit in Draw.io tab, then click <b className="text-[#d4ff00]">Sync to Canvas</b> to see changes here.</span>
                  </p>
                  {mermaidCode && (
                    <button
                      onClick={() => setActiveTab("drawio")}
                      className="px-3 py-1.5 bg-[#d4ff00]/10 text-[#d4ff00] border border-[#d4ff00]/20 hover:bg-[#d4ff00]/20 transition rounded-lg text-[11px] font-semibold flex items-center gap-1 hover:shadow-[0_0_10px_rgba(212,255,0,0.1)]"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit in Draw.io
                    </button>
                  )}
                </div>

                {/* Split Interactive View Layout */}
                <div className="flex-1 w-full h-full flex flex-col md:flex-row overflow-hidden">
                  
                  {/* Viewport canvas element */}
                  <div
                    ref={containerRef}
                    className="flex-1 h-full relative cursor-grab active:cursor-grabbing select-none overflow-hidden"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onWheel={handleWheel}
                  >
                    {canvasError ? (
                      <div className="absolute inset-0 flex items-center justify-center p-6 bg-[#0A0A0A]/85 select-text">
                        <div className="max-w-md bg-white/5 border border-red-500/20 rounded-2xl p-6 text-center space-y-4">
                          <div className="h-12 w-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto border border-red-500/20">
                            <AlertTriangle className="h-5 w-5" />
                          </div>
                          <h3 className="text-sm font-bold text-[#F0F0F0]">
                            Mermaid Rendering Exception
                          </h3>
                          <p className="text-xs text-[#999999] leading-relaxed font-mono text-left bg-[#0A0A0A] p-3 rounded-lg border border-white/5 max-h-40 overflow-y-auto">
                            {canvasError}
                          </p>
                          <button
                            onClick={() => setActiveTab("code")}
                            className="px-4 py-2 bg-white/5 text-xs text-[#F0F0F0] border border-white/10 rounded-xl hover:bg-white/10 transition cursor-pointer font-semibold"
                          >
                            Review Mermaid Source
                          </button>
                        </div>
                      </div>
                    ) : canvasSvg ? (
                      <div
                        className="absolute origin-top-left pointer-events-none"
                        style={{
                          transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
                          transition: isDragging ? "none" : "transform 0.08s ease-out"
                        }}
                        dangerouslySetInnerHTML={{ __html: canvasSvg }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-4">
                        <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#999999] shadow-lg">
                          <Compass className="h-8 w-8 text-[#d4ff00] animate-pulse" />
                        </div>
                        <div className="text-center space-y-1 max-w-sm">
                          <h3 className="text-sm font-medium tracking-tight text-[#F0F0F0] font-serif italic text-lg decoration-1">
                            Visualize Architecture Structures
                          </h3>
                          <p className="text-xs text-[#999999] leading-relaxed">
                            Enter your cloud services, databases, workflows, or authentication prompts in the left panel to synthesize architecture models.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Absolute canvas action floaters */}
                    {canvasSvg && !canvasError && (
                      <div className="absolute bottom-5 right-5 flex items-center gap-1.5 p-1.5 bg-[#0C0C0E]/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl z-20">
                        <button
                          onClick={autoFitDiagramView}
                          className="p-2 bg-transparent border border-white/10 text-[#F0F0F0] rounded-lg hover:bg-white/5 transition cursor-pointer"
                          title="Fit Viewport bounds"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setZoom({ scale: 1, x: 0, y: 0 })}
                          className="p-2 bg-transparent border border-white/10 text-[#F0F0F0] rounded-lg hover:bg-white/5 transition cursor-pointer"
                          title="Reset coordinates"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <button
                          onClick={exportPngFile}
                          className="px-2.5 py-1.5 bg-transparent border border-white/10 hover:bg-white/5 text-[10px] text-[#F0F0F0] font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer font-mono"
                          title="Translucent 2X resolution PNG"
                        >
                          <Download className="h-3 w-3" />
                          PNG
                        </button>
                        <button
                          onClick={exportSvgFile}
                          className="px-2.5 py-1.5 bg-transparent border border-white/10 hover:bg-white/5 text-[10px] text-[#F0F0F0] font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer font-mono"
                          title="Pruned translucent SVG"
                        >
                          <Download className="h-3 w-3" />
                          SVG
                        </button>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <button
                          onClick={openGithubModal}
                          className="px-2.5 py-1.5 bg-[#d4ff00]/10 border border-[#d4ff00]/30 hover:bg-[#d4ff00]/20 text-[10px] text-[#d4ff00] font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                          title="Push diagram to GitHub repository"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                          </svg>
                          GitHub
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Design Inspector Sidebar Drawer Panel (Only if Blueprint loads) */}
                  {lastBlueprint && (
                    <div className="w-full md:w-[350px] border-t md:border-t-0 md:border-l border-white/10 bg-[#0C0C0E] flex flex-col h-[380px] md:h-full overflow-hidden select-text z-10">
                      {/* Sub-tabs header */}
                      <div className="p-3 border-b border-white/5 bg-[#0a0a0c] space-y-2">
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4 text-[#d4ff00]" />
                          <span className="text-xs font-bold text-[#F0F0F0] uppercase tracking-wider">Design Inspector</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 bg-white/5 p-1 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setRightPanelTab("inspector")}
                            className={`py-1.5 text-[10px] font-semibold rounded-lg transition-all cursor-pointer ${rightPanelTab === "inspector" ? "bg-[#d4ff00]/10 text-[#d4ff00] font-bold" : "text-[#999999] hover:text-[#F0F0F0]"}`}
                          >
                            Properties
                          </button>
                          <button
                            type="button"
                            onClick={() => setRightPanelTab("diagnostics")}
                            className={`py-1.5 text-[10px] font-semibold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${rightPanelTab === "diagnostics" ? "bg-[#d4ff00]/10 text-[#d4ff00] font-bold" : "text-[#999999] hover:text-[#F0F0F0]"}`}
                          >
                            Security Scan
                            {getArchitectureScanResults(lastBlueprint).filter(r => r.type === "high" || r.type === "medium").length > 0 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-ping" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Side-Panel Scrollable Content */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        
                        {/* TAB A: PROPERTIES CUSTOMIZER */}
                        {rightPanelTab === "inspector" && (
                          <div className="space-y-4">
                            
                            {/* 1. Component Editor Header */}
                            <div className="space-y-2.5">
                              <label className="text-[10px] font-bold text-[#999999] uppercase tracking-wider block">
                                Modify Element Properties
                              </label>

                              {/* Dropdown to select Node elements */}
                              <select
                                value={selectedNodeId || ""}
                                onChange={(e) => setSelectedNodeId(e.target.value || null)}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#F0F0F0] focus:outline-none focus:border-[#d4ff00]"
                              >
                                <option value="" className="bg-[#0c0c0e]">-- Select Component to Edit --</option>
                                {lastBlueprint.groups?.map((g: any) => (
                                  <optgroup key={g.id} label={g.label} className="bg-[#0c0c0e]">
                                    {g.nodes?.map((n: any) => (
                                      <option key={n.id} value={n.id} className="bg-[#0c0c0e]">
                                        {n.label} ({n.type})
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>

                              {/* Node Editor Form if selected */}
                              {selectedNodeId && activeSelectedTargetNode ? (
                                <div className="bg-white/5 border border-white/5 rounded-xl p-3 space-y-3">
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-[#999999] uppercase tracking-wider block">Display Label</span>
                                    <input
                                      type="text"
                                      value={activeSelectedTargetNode.label}
                                      onChange={(e) => {
                                        const label = e.target.value;
                                        const updated = { ...lastBlueprint };
                                        for (const g of updated.groups || []) {
                                          const idx = g.nodes?.findIndex((n: any) => n.id === selectedNodeId);
                                          if (idx !== -1 && idx !== undefined) { g.nodes[idx].label = label; break; }
                                        }
                                        setLastBlueprint(updated);
                                        compileBlueprintToDiagrams(updated);
                                      }}
                                      className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#F0F0F0]"
                                    />
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-1">
                                      <span className="text-[9px] font-bold text-[#999999] uppercase tracking-wider block">Element Type</span>
                                      <select
                                        value={activeSelectedTargetNode.type}
                                        onChange={(e) => {
                                          const type = e.target.value;
                                          const updated = { ...lastBlueprint };
                                          for (const g of updated.groups || []) {
                                            const idx = g.nodes?.findIndex((n: any) => n.id === selectedNodeId);
                                            if (idx !== -1 && idx !== undefined) { g.nodes[idx].type = type; break; }
                                          }
                                          setLastBlueprint(updated);
                                          compileBlueprintToDiagrams(updated);
                                        }}
                                        className="w-full bg-[#0C0C0E] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-[#F0F0F0]"
                                      >
                                        <option value="service">Service</option>
                                        <option value="database">Database</option>
                                        <option value="ui">UI Layer</option>
                                        <option value="gateway">Gateway</option>
                                        <option value="queue">Queue Broker</option>
                                        <option value="external">External API</option>
                                        <option value="person">User Actor</option>
                                      </select>
                                    </div>

                                    <div className="space-y-1">
                                      <span className="text-[9px] font-bold text-[#999999] uppercase tracking-wider block">Shape Outline</span>
                                      <select
                                        value={activeSelectedTargetNode.shape || "rect"}
                                        onChange={(e) => {
                                          const shape = e.target.value;
                                          const updated = { ...lastBlueprint };
                                          for (const g of updated.groups || []) {
                                            const idx = g.nodes?.findIndex((n: any) => n.id === selectedNodeId);
                                            if (idx !== -1 && idx !== undefined) { g.nodes[idx].shape = shape; break; }
                                          }
                                          setLastBlueprint(updated);
                                          compileBlueprintToDiagrams(updated);
                                        }}
                                        className="w-full bg-[#0C0C0E] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-[#F0F0F0]"
                                      >
                                        <option value="rect">Rectangle</option>
                                        <option value="round font-mono">Rounded Rect</option>
                                        <option value="cylinder font-mono">Cylinder / DB</option>
                                        <option value="diamond">Decision (Diamond)</option>
                                        <option value="hexagon">Hexagon</option>
                                        <option value="stadium">Stadium</option>
                                      </select>
                                    </div>
                                  </div>

                                  {/* Delete Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updated = { ...lastBlueprint };
                                      for (const g of updated.groups || []) {
                                        g.nodes = g.nodes?.filter((n: any) => n.id !== selectedNodeId) || [];
                                      }
                                      updated.edges = updated.edges?.filter((e: any) => e.from !== selectedNodeId && e.to !== selectedNodeId) || [];
                                      setSelectedNodeId(null);
                                      setLastBlueprint(updated);
                                      compileBlueprintToDiagrams(updated);
                                      triggerToast("Component removed successfully! ✓", false);
                                    }}
                                    className="w-full py-1.5 border border-red-500/20 hover:bg-red-500/10 text-red-400 text-[10px] font-mono tracking-wider uppercase rounded-lg transition"
                                  >
                                    Delete Microservice Component
                                  </button>
                                </div>
                              ) : selectedNodeId ? (
                                <p className="text-[10px] text-red-400">Selected component no longer exists.</p>
                              ) : (
                                <p className="text-[10px] text-[#999999]/50 italic">Select any loaded microservice from the schema above to inspect and customize its style and type visual bindings.</p>
                              )}
                            </div>

                            <hr className="border-white/5" />

                            {/* 2. New Component Tool */}
                            <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 space-y-3">
                              <span className="text-[10px] font-bold text-[#d4ff00] uppercase tracking-wider block">Add Custom Component</span>
                              
                              <div className="space-y-1">
                                <span className="text-[9px] font-medium text-[#999999] uppercase tracking-wider block">Component Name</span>
                                <input
                                  type="text"
                                  value={newNodeLabel}
                                  onChange={(e) => setNewNodeLabel(e.target.value)}
                                  placeholder="e.g. Auth Service, DynamoDB cluster"
                                  className="w-full bg-[#0C0C0E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#F0F0F0]"
                                />
                              </div>

                              <div className="space-y-1">
                                <span className="text-[9px] font-medium text-[#999999] uppercase tracking-wider block">Parent Group Zone</span>
                                <select
                                  value={newNodeGroup}
                                  onChange={(e) => setNewNodeGroup(e.target.value)}
                                  className="w-full bg-[#0C0C0E] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-[#F0F0F0]"
                                >
                                  {lastBlueprint.groups?.map((g: any) => (
                                    <option key={g.id} value={g.id}>{g.label}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-medium text-[#999999] uppercase block font-mono">Type</span>
                                  <select
                                    value={newNodeType}
                                    onChange={(e) => setNewNodeType(e.target.value)}
                                    className="w-full bg-[#0C0C0E] border border-white/10 rounded-lg px-1.5 py-1 text-[11px] text-[#F0F0F0]"
                                  >
                                    <option value="service font-mono">service</option>
                                    <option value="database">database</option>
                                    <option value="gateway">gateway</option>
                                    <option value="queue">queue</option>
                                    <option value="external">external API</option>
                                  </select>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] font-medium text-[#999999] uppercase block font-mono">Shape</span>
                                  <select
                                    value={newNodeShape}
                                    onChange={(e) => setNewNodeShape(e.target.value)}
                                    className="w-full bg-[#0C0C0E] border border-white/10 rounded-lg px-1.5 py-1 text-[11px] text-[#F0F0F0]"
                                  >
                                    <option value="round font-mono">round</option>
                                    <option value="rect">rect</option>
                                    <option value="cylinder font-mono">cylinder</option>
                                    <option value="hexagon">hexagon</option>
                                    <option value="stadium">stadium</option>
                                  </select>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={handleCreateNode}
                                className="w-full py-1.5 bg-[#d4ff00]/10 hover:bg-[#d4ff00]/20 text-[#d4ff00] border border-[#d4ff00]/25 rounded-lg text-[10px] font-bold uppercase tracking-wider transition"
                              >
                                + Build Component
                              </button>
                            </div>

                            <hr className="border-white/5" />

                            {/* 3. New Communication Edge Linker */}
                            <div className="bg-white/5 border border-white/5 rounded-xl p-3.5 space-y-3 font-mono">
                              <span className="text-[10px] font-bold text-[#d4ff00] uppercase tracking-wider block font-sans">Wire Connection Link</span>
                              
                              <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                  <span className="text-[9px] text-[#999999] uppercase tracking-wider block font-sans">Source Node</span>
                                  <select
                                    value={newEdgeFrom}
                                    onChange={(e) => setNewEdgeFrom(e.target.value)}
                                    className="w-full bg-[#0C0C0E] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-[#F0F0F0]"
                                  >
                                    <option value="">-- From --</option>
                                    {lastBlueprint.groups?.flatMap((g: any) => g.nodes || []).map((n: any) => (
                                      <option key={n.id} value={n.id}>{n.label}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-[9px] text-[#999999] uppercase tracking-wider block font-sans">Target Node</span>
                                  <select
                                    value={newEdgeTo}
                                    onChange={(e) => setNewEdgeTo(e.target.value)}
                                    className="w-full bg-[#0C0C0E] border border-white/10 rounded-lg px-2 py-1 text-[11px] text-[#F0F0F0]"
                                  >
                                    <option value="">-- To --</option>
                                    {lastBlueprint.groups?.flatMap((g: any) => g.nodes || []).map((n: any) => (
                                      <option key={n.id} value={n.id}>{n.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="space-y-1">
                                <span className="text-[9px] text-[#999999] uppercase tracking-wider block font-sans">Link Label</span>
                                <input
                                  type="text"
                                  value={newEdgeLabel}
                                  onChange={(e) => setNewEdgeLabel(e.target.value)}
                                  placeholder="e.g. REST API, gRPC, PubSub"
                                  className="w-full bg-[#0C0C0E] border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-[#F0F0F0] font-sans"
                                />
                              </div>

                              <button
                                type="button"
                                onClick={handleCreateEdge}
                                className="w-full py-1.5 bg-[#d4ff00]/10 hover:bg-[#d4ff00]/20 text-[#d4ff00] border border-[#d4ff00]/25 rounded-lg text-[10px] font-bold uppercase tracking-wider transition font-sans"
                              >
                                🔗 Weld Request Link
                              </button>
                            </div>

                          </div>
                        )}

                        {/* TAB B: SECURITY & DIAGNOSTIC RULES */}
                        {rightPanelTab === "diagnostics" && (
                          <div className="space-y-3.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-[#999999] uppercase tracking-wider block">Threat & Scale Auditor</span>
                              <span className="text-[9px] font-mono bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[#999999]">Static Scan</span>
                            </div>

                            {getArchitectureScanResults(lastBlueprint).length > 0 ? (
                              <div className="space-y-3">
                                {getArchitectureScanResults(lastBlueprint).map((report) => (
                                  <div
                                    key={report.id}
                                    className={`p-3.5 rounded-xl border flex flex-col space-y-2.5 ${
                                      report.type === "high"
                                        ? "bg-red-500/5 border-red-500/20 shadow-[0_2px_12px_rgba(239,68,68,0.05)]"
                                        : report.type === "medium"
                                        ? "bg-amber-500/5 border-amber-500/20 shadow-[0_2px_12px_rgba(245,158,11,0.05)]"
                                        : "bg-white/5 border-white/10"
                                    }`}
                                  >
                                    <div className="flex items-start gap-2.5">
                                      <div className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                        report.type === "high"
                                          ? "bg-red-500/20 text-red-400"
                                          : report.type === "medium"
                                          ? "bg-amber-500/20 text-amber-400"
                                          : "bg-white/10 text-white"
                                      }`}>
                                        !
                                      </div>
                                      <div className="space-y-1 flex-1">
                                        <h4 className="text-xs font-bold text-[#F0F0F0] leading-tight">{report.title}</h4>
                                        <p className="text-[11px] text-[#999999] leading-relaxed">{report.description}</p>
                                      </div>
                                    </div>

                                    <div className="pt-2 border-t border-white/5 text-[10px] text-[#999999] leading-relaxed bg-black/20 p-2 rounded-lg">
                                      <span className="font-bold text-white block mb-0.5">Recommendation:</span>
                                      {report.recommendation}
                                    </div>

                                    {/* Auto Quick Fix Button */}
                                    {report.canQuickFix && (
                                      <button
                                        type="button"
                                        onClick={() => handleQuickFixAudit(report.id, report.actionPayload)}
                                        className="py-1 bg-[#d4ff00]/10 hover:bg-[#d4ff00]/20 border border-[#d4ff00]/20 hover:border-[#d4ff00]/40 text-[#d4ff00] text-[10px] rounded-lg transition font-semibold"
                                      >
                                        ⚡ Quick Deploy Fix: {report.quickFixLabel}
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center p-8 bg-white/5 border border-white/5 rounded-2xl space-y-3">
                                <Check className="h-8 w-8 text-[#d4ff00] mx-auto animate-bounce" />
                                <div className="space-y-1">
                                  <h4 className="text-xs font-bold text-[#F0F0F0]">Architecture Scan Passed</h4>
                                  <p className="text-[10px] text-[#999999]">No critical single points of failure, unbuffered direct database queries, or orphan components detected.</p>
                                </div>
                              </div>
                            )}

                          </div>
                        )}

                      </div>
                    </div>
                  )}

                </div>
              </motion.div>
            )}

            {/* 2. LIVE DRAW.IO COMPREHENSIVE EDITOR EMBED */}
            {activeTab === "drawio" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col overflow-hidden bg-[#0A0A0A]"
              >
                {/* Draw.io header controller bar */}
                <div className="bg-[#0A0A0A] border-b border-white/10 px-5 py-2.5 flex items-center justify-between text-xs select-none">
                  <div className="flex items-center gap-2">
                    <Edit3 className="h-4 w-4 text-[#d4ff00]" />
                    <span className="font-semibold text-[#F0F0F0]">Draw.io Interactive Editor</span>
                    <span className="text-[9px] text-[#999999] bg-white/5 border border-white/10 px-2 py-0.5 rounded-md font-mono hidden md:inline uppercase tracking-wider">
                      Live Editable Canvas
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {drawioStatus === "loaded" && (
                      <>
                        <button
                          onClick={toggleDrawioFormatPanel}
                          className={`px-3 py-1.5 border rounded-lg transition duration-150 text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer ${drawioFormatOpen ? "bg-[#d4ff00]/15 text-[#d4ff00] border-[#d4ff00]/35 hover:bg-[#d4ff00]/25" : "bg-white/5 text-[#F0F0F0] border-white/10 hover:bg-white/10"}`}
                          title="Toggle styling/format side controls"
                        >
                          <Settings className="h-3 w-3" />
                          Format
                        </button>
                        <button
                          onClick={triggerDrawioOutline}
                          className="px-3 py-1.5 bg-white/5 text-[#F0F0F0] border border-white/10 hover:bg-white/10 transition rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                          title="Toggle overview minimap"
                        >
                          <Compass className="h-3 w-3" />
                          Overview
                        </button>
                        <div className="h-4 w-px bg-white/10 mx-1" />
                        <button
                          onClick={requestDrawioSyncToCanvas}
                          className="px-4 py-1.5 bg-[#d4ff00]/15 text-[#d4ff00] border border-[#d4ff00]/30 hover:bg-[#d4ff00]/25 transition rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                          title="Synchronize edited diagram back to Mermaid canvas preview"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Sync to Canvas
                        </button>
                        <button
                          onClick={openGithubModal}
                          className="px-3 py-1.5 bg-white/5 text-[#F0F0F0] border border-white/10 hover:bg-white/10 hover:border-[#d4ff00]/30 transition rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                          title="Push diagram to GitHub repository"
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                          </svg>
                          GitHub
                        </button>
                      </>
                    )}
                    {drawioXML && (
                      <button
                        onClick={() => downloadBlob(drawioXML || "", "architecture.drawio", "text/xml")}
                        className="px-3 py-1.5 bg-white/5 text-[#F0F0F0] border border-white/10 hover:bg-white/10 transition rounded-lg text-[11px] font-semibold flex items-center gap-1.5 cursor-pointer"
                        title="Download standard layout XML"
                      >
                        <Download className="h-3 w-3" />
                        Export
                      </button>
                    )}
                  </div>
                </div>

                {/* Draw.io editor states wrapper */}
                <div className="flex-1 w-full h-full relative">
                  
                  {/* Empty state overlay */}
                  {drawioStatus === "empty" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-4 bg-[#0A0A0A] z-10">
                      <div className="h-16 w-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[#999999] shadow-lg">
                        <Layers className="h-8 w-8 text-[#d4ff00]" />
                      </div>
                      <div className="text-center space-y-1 max-w-sm">
                        <h3 className="text-sm font-medium tracking-tight text-[#F0F0F0] font-serif italic text-lg decoration-1">
                          Draw.io XML Workspace
                        </h3>
                        <p className="text-xs text-[#999999] leading-relaxed">
                          Your live-editable layout canvas with selectable nodes and connection cables will appear here once diagrams are rendered.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Loading / Generating model overlay */}
                  {drawioStatus === "loading" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-4 bg-[#0A0A0A]/90 z-10">
                      <RefreshCw className="h-10 w-10 text-[#d4ff00] animate-spin mb-2" />
                      <div className="text-center space-y-1">
                        <h3 className="text-sm font-medium tracking-tight text-[#F0F0F0] font-serif italic text-lg decoration-1">
                          Compiling Draw.io Architecture Model
                        </h3>
                        <p className="text-xs text-[#999999] max-w-xs leading-relaxed">
                          Synthesizing selectable mxGraph nodes, spatial layout coordinates, and connecting ports dynamically inside diagrams.net.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Error state overlay */}
                  {drawioStatus === "error" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 space-y-4 bg-[#0A0A0A] z-10 border border-red-500/10">
                      <div className="h-16 w-16 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center shadow-lg animate-pulse">
                        <AlertTriangle className="h-8 w-8" />
                      </div>
                      <div className="text-center space-y-2 max-w-md">
                        <h3 className="text-sm font-bold text-[#F0F0F0]">
                          Draw.io Stage 3 Parser Failure
                        </h3>
                        <p className="text-xs text-[#999999] bg-[#0A0A0A] p-3 rounded-lg border border-white/5 font-mono text-left max-h-40 overflow-y-auto leading-relaxed">
                          {drawioError || "Failed to produce standard layout XML constraints."}
                        </p>
                        <div className="flex gap-2 items-center justify-center pt-2">
                          <button
                            onClick={retryDrawioGeneration}
                            className="px-4 py-2 bg-[#d4ff00] hover:bg-white text-black text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5 cursor-pointer shadow-lg transition duration-200"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry Synthesis
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Embedded iframe integration */}
                  <iframe
                    id="drawioFrame"
                    ref={iframeRef}
                    src="https://embed.diagrams.net/?embed=1&ui=dark&spin=1&proto=json&noSaveBtn=0&saveAndExit=0&noExitBtn=1&libraries=1&modified=auto&pages=0&math=0&rough=0&toolbar=zoom%20layers%20lightbox"
                    className="w-full h-full border-0 absolute inset-0 bg-[#0A0A0A]"
                    style={{
                      opacity: drawioStatus === "loaded" ? 1 : 0,
                      pointerEvents: drawioStatus === "loaded" ? "auto" : "none",
                      transition: "opacity 0.25s ease-in-out"
                    }}
                  />

                </div>
              </motion.div>
            )}

            {/* 3. MERMAID SOURCE ENGINE EDIT AREA */}
            {activeTab === "code" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col overflow-hidden p-6 gap-4"
              >
                <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-xl text-xs select-none">
                  <div>
                    <h3 className="font-bold text-[#F0F0F0]">Mermaid Compiler Script</h3>
                    <p className="text-xs text-[#999999] mt-0.5">
                      Fine-tune or edit direct flowchart codes. Hit <b>Synchronize Preview Canvas</b> to apply direct modifications.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyToClipboard(mermaidCode, "code")}
                      className="px-3.5 py-2 bg-white/5 border border-white/10 text-xs text-[#F0F0F0] hover:bg-white/10 font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition font-mono"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-[#d4ff00]" /> : <Copy className="h-3.5 w-3.5" />}
                      Copy Script
                    </button>
                    {mermaidCode && (
                      <button
                        onClick={() => manualPushCodeToCanvas(mermaidCode)}
                        className="px-3.5 py-2 bg-[#d4ff00]/10 border border-[#d4ff00]/25 hover:bg-[#d4ff00]/20 text-[#d4ff00] font-bold rounded-lg flex items-center gap-1.5 transition cursor-pointer font-mono"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Synchronize
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-4">
                  <textarea
                    value={mermaidCode}
                    onChange={(e) => setMermaidCode(e.target.value)}
                    placeholder="No compilations compiled yet."
                    className="w-full h-full bg-transparent text-[#F0F0F0] font-mono text-xs focus:outline-none resize-none leading-relaxed custom-scrollbar"
                  />
                </div>
              </motion.div>
            )}

            {/* 4. BLUEPRINT SYSTEM JSON EDITOR */}
            {activeTab === "blueprint" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col overflow-hidden p-6 gap-4"
              >
                <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 rounded-xl text-xs select-none">
                  <div>
                    <h3 className="font-bold text-[#F0F0F0]">Intermediate Blueprint JSON Representation</h3>
                    <p className="text-xs text-[#999999] mt-0.5">
                      This intermediate struct representation coordinates structural diagram nodes, linkages, styles, and topologies. Read-Only.
                    </p>
                  </div>
                  <div>
                    {lastBlueprint && (
                      <button
                        onClick={() => copyToClipboard(JSON.stringify(lastBlueprint, null, 2), "json")}
                        className="px-3.5 py-2 bg-white/5 border border-white/10 text-xs text-[#F0F0F0] hover:bg-white/10 font-semibold rounded-lg flex items-center gap-1.5 cursor-pointer transition select-none font-mono"
                      >
                        {copiedJson ? <Check className="h-3.5 w-3.5 text-[#d4ff00]" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy Blueprint
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-2xl overflow-hidden p-4">
                  <pre className="w-full h-full bg-transparent text-[#d4ff00] font-mono text-xs overflow-auto select-text leading-relaxed custom-scrollbar">
                    {lastBlueprint ? JSON.stringify(lastBlueprint, null, 2) : "No blueprint data modeled yet."}
                  </pre>
                </div>
              </motion.div>
            )}

            {/* 5. ARCHIVE FILE EXPORT PRESETS */}
            {activeTab === "export-presets" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 overflow-y-auto p-8 flex flex-col h-full custom-scrollbar"
              >
                <div className="max-w-4xl mx-auto w-full space-y-6">
                  {/* Title card */}
                  <div>
                    <h2 className="font-serif text-2xl italic tracking-tight text-[#F0F0F0]">
                      Export Design Diagrams
                    </h2>
                    <p className="text-xs text-[#999999] mt-1 pr-6 leading-relaxed">
                      Download system structural designs to use directly in documentation hubs, PowerPoint presentations, or team development pipelines.
                    </p>
                  </div>

                  {/* Standard exporter presets grid */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* PNG Card */}
                    <div className="bg-white/5 border border-white/10 hover:border-[#d4ff00]/25 transition p-5 rounded-2xl flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <div className="h-8 w-8 rounded-full bg-[#d4ff00]/10 text-[#d4ff00] border border-[#d4ff00]/20 flex items-center justify-center">
                          <ImageIcon className="h-4 w-4" />
                        </div>
                        <h4 className="text-xs font-bold text-[#F0F0F0]">Portable Network Graphics (.png)</h4>
                        <p className="text-[11px] text-[#999999] leading-relaxed">
                          Download a translucent backdrop picture representation at double standard resolution (2X). Best fit for presentations and slides.
                        </p>
                      </div>
                      <button
                        onClick={exportPngFile}
                        disabled={!canvasSvg}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-semibold text-[#F0F0F0] rounded-xl border border-white/10 cursor-pointer transition flex items-center justify-center gap-1.5 font-mono"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download PNG Image
                      </button>
                    </div>

                    {/* SVG Card */}
                    <div className="bg-white/5 border border-white/10 hover:border-[#d4ff00]/25 transition p-5 rounded-2xl flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <div className="h-8 w-8 rounded-full bg-[#d4ff00]/10 text-[#d4ff00] border border-[#d4ff00]/20 flex items-center justify-center">
                          <Compass className="h-4 w-4" />
                        </div>
                        <h4 className="text-xs font-bold text-[#F0F0F0]">Vector Graphic Representation (.svg)</h4>
                        <p className="text-[11px] text-[#999999] leading-relaxed">
                          Clean vector data format. Infinitely scalable to fits any webpage dimensions or vector designer scopes.
                        </p>
                      </div>
                      <button
                        onClick={exportSvgFile}
                        disabled={!canvasSvg}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-semibold text-[#F0F0F0] rounded-xl border border-white/10 cursor-pointer transition flex items-center justify-center gap-1.5 font-mono"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download SVG File
                      </button>
                    </div>

                    {/* Draw.io (.drawio) */}
                    <div className="bg-white/5 border border-white/10 hover:border-[#d4ff00]/25 transition p-5 rounded-2xl flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <div className="h-8 w-8 rounded-full bg-[#d4ff00]/10 text-[#d4ff00] border border-[#d4ff00]/20 flex items-center justify-center">
                          <Layers className="h-4 w-4" />
                        </div>
                        <h4 className="text-xs font-bold text-[#F0F0F0]">Draw.io Document (.drawio)</h4>
                        <p className="text-[11px] text-[#999999] leading-relaxed">
                          Pruned editable XML file containing structural vector assets. Opens directly inside Diagrams.net workspaces safely.
                        </p>
                      </div>
                      <button
                        onClick={() => downloadBlob(drawioXML || "", "architecture.drawio", "text/xml")}
                        disabled={!drawioXML}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-semibold text-[#F0F0F0] rounded-xl border border-white/10 cursor-pointer transition flex items-center justify-center gap-1.5 font-mono"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Draw.io XML
                      </button>
                    </div>

                    {/* Mermaid Source Code */}
                    <div className="bg-white/5 border border-white/10 hover:border-[#d4ff00]/25 transition p-5 rounded-2xl flex flex-col justify-between space-y-4">
                      <div className="space-y-1.5">
                        <div className="h-8 w-8 rounded-full bg-[#d4ff00]/10 text-[#d4ff00] border border-[#d4ff00]/20 flex items-center justify-center">
                          <Code className="h-4 w-4" />
                        </div>
                        <h4 className="text-xs font-bold text-[#F0F0F0]">Mermaid Markup Script (.mmd)</h4>
                        <p className="text-[11px] text-[#999999] leading-relaxed">
                          Download the raw text markup syntax file to integrate direct compiler renders in markdown hubs or GitHub readmes.
                        </p>
                      </div>
                      <button
                        onClick={() => downloadBlob(mermaidCode, "architecture.mmd", "text/plain")}
                        disabled={!mermaidCode}
                        className="w-full py-2 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-xs font-semibold text-[#F0F0F0] rounded-xl border border-white/10 cursor-pointer transition flex items-center justify-center gap-1.5 font-mono"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download Mermaid MMD
                      </button>
                    </div>

                    {/* GitHub Push */}
                    <div className="bg-gradient-to-br from-[#d4ff00]/5 to-transparent border border-[#d4ff00]/20 hover:border-[#d4ff00]/40 transition p-5 rounded-2xl flex flex-col justify-between space-y-4 md:col-span-2">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-[#d4ff00]/15 text-[#d4ff00] border border-[#d4ff00]/30 flex items-center justify-center flex-shrink-0">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                          </svg>
                        </div>
                        <div className="space-y-1.5 flex-1">
                          <h4 className="text-xs font-bold text-[#F0F0F0]">Push to GitHub Repository</h4>
                          <p className="text-[11px] text-[#999999] leading-relaxed">
                            Export your diagram directly to a GitHub repository. Supports .drawio, .svg, and .mmd formats. Requires a GitHub Personal Access Token with repo permissions.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={openGithubModal}
                        disabled={!drawioXML && !canvasSvg && !mermaidCode}
                        className="w-full py-2.5 bg-[#d4ff00]/10 hover:bg-[#d4ff00]/20 disabled:opacity-40 text-xs font-bold text-[#d4ff00] rounded-xl border border-[#d4ff00]/30 cursor-pointer transition flex items-center justify-center gap-2"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                        Push to GitHub
                      </button>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>

      {/* --------------------------------------------------
          FLOATING GLOBAL ALERTS / TOASTS
          -------------------------------------------------- */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 35, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-[9999] select-none pointer-events-none"
          >
            <div
              className={`px-4.5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 backdrop-blur-md border ${toast.isErr ? "bg-[#0A0A0A]/95 text-red-400 border-red-500/20 shadow-[0_4px_25px_rgba(248,113,113,0.08)]" : "bg-[#0A0A0A]/95 text-[#F0F0F0] border-white/15 shadow-[0_4px_25px_rgba(0,0,0,0.6)]"}`}
            >
              {toast.isErr ? (
                <AlertTriangle className="h-4.5 w-4.5 text-red-500" />
               ) : (
                <Check className="h-4.5 w-4.5 text-[#d4ff00]" />
              )}
              <span className="text-xs font-semibold">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GitHub Push Modal */}
      <AnimatePresence>
        {githubModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setGithubModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#0d0d0d] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#d4ff00]/10 text-[#d4ff00] border border-[#d4ff00]/20 flex items-center justify-center">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                    </svg>
                  </div>
                  <h3 className="text-sm font-bold text-[#F0F0F0]">Push to GitHub</h3>
                </div>
                <button
                  onClick={() => setGithubModalOpen(false)}
                  className="p-1.5 hover:bg-white/5 rounded-lg transition cursor-pointer"
                >
                  <svg className="h-4 w-4 text-[#999999]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-4">
                {/* Export Type Selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#999999] uppercase tracking-wider block">Export Format</label>
                  <div className="grid grid-cols-3 gap-2 bg-white/5 p-1 rounded-xl">
                    {[
                      { id: "drawio", label: "Draw.io", ext: ".drawio" },
                      { id: "svg", label: "SVG", ext: ".svg" },
                      { id: "mermaid", label: "Mermaid", ext: ".mmd" }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        onClick={() => {
                          setGithubExportType(opt.id as any);
                          setGithubPath(prev => {
                            const basePath = prev.replace(/\.(drawio|svg|mmd)$/, "");
                            return `${basePath}${opt.ext}`;
                          });
                        }}
                        className={`py-2 text-[10px] font-semibold rounded-lg transition-all cursor-pointer ${
                          githubExportType === opt.id
                            ? "bg-[#d4ff00]/15 text-[#d4ff00] border border-[#d4ff00]/25"
                            : "text-[#999999] hover:text-[#F0F0F0] border border-transparent"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Repository Owner */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#999999] uppercase tracking-wider block">Repository Owner</label>
                  <input
                    type="text"
                    value={githubOwner}
                    onChange={(e) => setGithubOwner(e.target.value)}
                    placeholder="e.g. your-username"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F0F0F0] placeholder-[#999999]/40 focus:outline-none focus:border-[#d4ff00] transition"
                  />
                </div>

                {/* Repository Name */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#999999] uppercase tracking-wider block">Repository Name</label>
                  <input
                    type="text"
                    value={githubRepo}
                    onChange={(e) => setGithubRepo(e.target.value)}
                    placeholder="e.g. architecture-docs"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F0F0F0] placeholder-[#999999]/40 focus:outline-none focus:border-[#d4ff00] transition"
                  />
                </div>

                {/* Branch */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#999999] uppercase tracking-wider block">Branch</label>
                  <input
                    type="text"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F0F0F0] placeholder-[#999999]/40 focus:outline-none focus:border-[#d4ff00] transition"
                  />
                </div>

                {/* File Path */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#999999] uppercase tracking-wider block">File Path</label>
                  <input
                    type="text"
                    value={githubPath}
                    onChange={(e) => setGithubPath(e.target.value)}
                    placeholder="diagrams/architecture.drawio"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F0F0F0] placeholder-[#999999]/40 focus:outline-none focus:border-[#d4ff00] transition"
                  />
                </div>

                {/* Commit Message */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-[#999999] uppercase tracking-wider block">Commit Message (optional)</label>
                  <input
                    type="text"
                    value={githubCommitMessage}
                    onChange={(e) => setGithubCommitMessage(e.target.value)}
                    placeholder={`Update diagram: ${lastBlueprint?.title || "Architecture"}`}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-[#F0F0F0] placeholder-[#999999]/40 focus:outline-none focus:border-[#d4ff00] transition"
                  />
                </div>

                <div className="text-[10px] text-[#999999]/60 bg-white/5 border border-white/5 rounded-lg p-2">
                  <strong>Note:</strong> Requires GITHUB_TOKEN environment variable with repo permissions.
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-2">
                <button
                  onClick={() => setGithubModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-[#999999] hover:text-[#F0F0F0] border border-white/10 hover:border-white/20 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGithubPush}
                  disabled={githubPushing || !githubOwner.trim() || !githubRepo.trim()}
                  className="px-5 py-2 bg-[#d4ff00] hover:bg-[#e5ff4d] text-black text-xs font-bold rounded-lg transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {githubPushing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Pushing...
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                      Push to GitHub
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
