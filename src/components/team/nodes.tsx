"use client";

import { memo } from "react";
import {
  Bot,
  BrainCircuit,
  Braces,
  Cpu,
  Network,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { HANDLE_IDS } from "@/lib/team/graph";
import type { TeamNodeData } from "@/lib/types";

function AgentNodeComponent({ data, selected }: NodeProps<Node<TeamNodeData>>) {
  return (
    <article
      className={`flow-node agent-flow-node ${data.primary ? "primary-node" : ""} ${data.disabled ? "disabled-node" : ""} ${selected ? "selected-node" : ""} ${data.unlinked ? "unlinked-node" : ""}`}
      style={{ "--node-accent": data.color || undefined } as React.CSSProperties}
    >
      <SemanticHandle
        id={HANDLE_IDS.taskIn}
        type="target"
        position={Position.Left}
        className="task-port task-in-port"
        label="Parent"
        title="Incoming delegation: this agent can be called by a parent"
      />
      <SemanticHandle
        id={HANDLE_IDS.skillOut}
        type="source"
        position={Position.Top}
        className="skill-port"
        label="Skills"
        title="Skills accessible to this agent"
      />
      <SemanticHandle
        id={HANDLE_IDS.taskOut}
        type="source"
        position={Position.Right}
        className="task-port task-out-port"
        label="Delegate"
        title="Outgoing delegation to a sub-agent"
        style={{ top: "36%" }}
      />
      <SemanticHandle
        id={HANDLE_IDS.modelOut}
        type="source"
        position={Position.Right}
        className="model-port"
        label="Model"
        title="Model used by this agent"
        style={{ top: "72%" }}
      />
      <SemanticHandle
        id={HANDLE_IDS.mcpOut}
        type="source"
        position={Position.Bottom}
        className="mcp-port"
        label="MCP"
        title="MCP servers accessible to this agent"
        style={{ left: "38%" }}
      />
      <SemanticHandle
        id={HANDLE_IDS.toolOut}
        type="source"
        position={Position.Bottom}
        className="tool-port"
        label="Tools"
        title="Native tools accessible to this agent"
        style={{ left: "68%" }}
      />

      <div className="flow-node-icon">{data.primary ? <BrainCircuit size={20} /> : <Bot size={19} />}</div>
      <div className="flow-node-copy">
        <span>{data.primary ? "PRIMARY AGENT" : data.mode === "all" ? "ALL-ROUND AGENT" : "SUB-AGENT"}</span>
        <strong title={data.label}>{data.label}</strong>
        <p>{data.description || "No description"}</p>
      </div>
      <footer className="flow-node-meta">
        <span title={data.model || "Inherited model"}>{data.model || "Inherited model"}</span>
        <b>{data.count || 0} links</b>
      </footer>
    </article>
  );
}

function ResourceNode({
  data,
  selected,
  kind,
}: NodeProps<Node<TeamNodeData>> & { kind: "skill" | "mcp" | "tool" | "model" }) {
  const Icon = kind === "skill"
    ? Sparkles
    : kind === "mcp"
      ? Network
      : kind === "model"
        ? Cpu
        : data.name === "edit"
          ? Braces
          : data.name === "external_directory"
            ? ShieldCheck
            : Wrench;

  const handle = kind === "skill"
    ? { id: HANDLE_IDS.skillIn, position: Position.Bottom, className: "skill-port", label: "Agents" }
    : kind === "model"
      ? { id: HANDLE_IDS.modelIn, position: Position.Left, className: "model-port", label: "Agents" }
      : kind === "mcp"
        ? { id: HANDLE_IDS.mcpIn, position: Position.Top, className: "mcp-port", label: "Agents" }
        : { id: HANDLE_IDS.toolIn, position: Position.Top, className: "tool-port", label: "Agents" };

  return (
    <article className={`flow-node resource-flow-node ${kind}-node ${data.disabled ? "disabled-node" : ""} ${data.unlinked ? "unlinked-node" : ""} ${selected ? "selected-node" : ""}`}>
      <SemanticHandle
        id={handle.id}
        type="target"
        position={handle.position}
        className={handle.className}
        label={handle.label}
        title={`Connection ${kind === "skill" ? "skill" : kind === "model" ? "model" : kind === "mcp" ? "MCP" : "tool"}`}
      />
      <Icon size={19} />
      <div className="resource-node-copy">
        <span>{kind === "skill" ? "SKILL" : kind === "mcp" ? "MCP" : kind === "model" ? "MODEL" : "NATIVE TOOL"}</span>
        <strong title={data.label}>{data.label}</strong>
        <p>{data.description}</p>
        {data.unlinked ? <em className="unlinked-badge">Not associated · connect this node to an agent</em> : null}
      </div>
    </article>
  );
}

function SemanticHandle({
  id,
  type,
  position,
  className,
  label,
  title,
  style,
}: {
  id: string;
  type: "source" | "target";
  position: Position;
  className: string;
  label: string;
  title: string;
  style?: React.CSSProperties;
}) {
  return (
    <Handle
      id={id}
      type={type}
      position={position}
      className={`team-handle semantic-handle ${className}`}
      title={title}
      aria-label={title}
      data-port-label={label}
      style={style}
    />
  );
}

function SkillNodeComponent(props: NodeProps<Node<TeamNodeData>>) {
  return <ResourceNode {...props} kind="skill" />;
}
function McpNodeComponent(props: NodeProps<Node<TeamNodeData>>) {
  return <ResourceNode {...props} kind="mcp" />;
}
function ToolNodeComponent(props: NodeProps<Node<TeamNodeData>>) {
  return <ResourceNode {...props} kind="tool" />;
}
function ModelNodeComponent(props: NodeProps<Node<TeamNodeData>>) {
  return <ResourceNode {...props} kind="model" />;
}

export const AgentNode = memo(AgentNodeComponent);
export const SkillNode = memo(SkillNodeComponent);
export const McpNode = memo(McpNodeComponent);
export const ToolNode = memo(ToolNodeComponent);
export const ModelNode = memo(ModelNodeComponent);
