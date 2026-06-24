"use client";

import { memo } from "react";
import { Bot, BrainCircuit, Braces, Cpu, Network, ShieldCheck, Sparkles, Wrench } from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { TeamNodeData } from "@/lib/types";

function AgentNodeComponent({ data, selected }: NodeProps<Node<TeamNodeData>>) {
  return <article className={`flow-node agent-flow-node ${data.primary ? "primary-node" : ""} ${data.disabled ? "disabled-node" : ""} ${selected ? "selected-node" : ""}`} style={{ "--node-accent": data.color || undefined } as React.CSSProperties}>
    <Handle className="team-handle target-handle" id="target-left" type="target" position={Position.Left} />
    <Handle className="team-handle target-handle" id="target-top" type="target" position={Position.Top} />
    <div className="flow-node-icon">{data.primary ? <BrainCircuit size={20} /> : <Bot size={19} />}</div>
    <div className="flow-node-copy">
      <span>{data.primary ? "AGENT PRINCIPAL" : data.mode === "all" ? "AGENT POLYVALENT" : "SOUS-AGENT"}</span>
      <strong title={data.label}>{data.label}</strong>
      <p>{data.description || "Aucune description"}</p>
    </div>
    <footer className="flow-node-meta">
      <span title={data.model || "Modèle hérité"}>{data.model || "Modèle hérité"}</span>
      <b>{data.count || 0} liens</b>
    </footer>
    <Handle className="team-handle source-handle" id="source-right" type="source" position={Position.Right} />
    <Handle className="team-handle source-handle" id="source-bottom" type="source" position={Position.Bottom} />
  </article>;
}

function ResourceNode({ data, selected, kind }: NodeProps<Node<TeamNodeData>> & { kind: "skill" | "mcp" | "tool" | "model" }) {
  const Icon = kind === "skill" ? Sparkles : kind === "mcp" ? Network : kind === "model" ? Cpu : data.name === "edit" ? Braces : data.name === "external_directory" ? ShieldCheck : Wrench;
  return <article className={`flow-node resource-flow-node ${kind}-node ${data.disabled ? "disabled-node" : ""} ${selected ? "selected-node" : ""}`}>
    <Handle className="team-handle target-handle" id="target" type="target" position={Position.Left} />
    <Icon size={19} />
    <div className="resource-node-copy">
      <span>{kind === "skill" ? "SKILL" : kind === "mcp" ? "MCP" : kind === "model" ? "MODÈLE" : "OUTIL NATIF"}</span>
      <strong title={data.label}>{data.label}</strong>
      <p>{data.description}</p>
    </div>
  </article>;
}

function SkillNodeComponent(props: NodeProps<Node<TeamNodeData>>) { return <ResourceNode {...props} kind="skill" />; }
function McpNodeComponent(props: NodeProps<Node<TeamNodeData>>) { return <ResourceNode {...props} kind="mcp" />; }
function ToolNodeComponent(props: NodeProps<Node<TeamNodeData>>) { return <ResourceNode {...props} kind="tool" />; }
function ModelNodeComponent(props: NodeProps<Node<TeamNodeData>>) { return <ResourceNode {...props} kind="model" />; }

export const AgentNode = memo(AgentNodeComponent);
export const SkillNode = memo(SkillNodeComponent);
export const McpNode = memo(McpNodeComponent);
export const ToolNode = memo(ToolNodeComponent);
export const ModelNode = memo(ModelNodeComponent);
