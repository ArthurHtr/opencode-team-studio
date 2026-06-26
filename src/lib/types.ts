export type PermissionAction = "allow" | "ask" | "deny";
export type PermissionChoice = PermissionAction | "inherit";
export type AgentMode = "primary" | "subagent" | "all";
export type AgentSource = "builtin" | "config" | "file";

export type PermissionValue = PermissionAction | Record<string, PermissionAction>;
export type PermissionConfig = Record<string, PermissionValue>;

export type AgentDefinition = {
  name: string;
  source: AgentSource;
  builtin: boolean;
  description: string;
  mode: AgentMode;
  prompt: string;
  model?: string;
  variant?: string;
  temperature?: number;
  top_p?: number;
  steps?: number;
  hidden?: boolean;
  disable?: boolean;
  color?: string;
  options: Record<string, unknown>;
  permission: PermissionConfig;
  /** Unknown or newer OpenCode properties that must survive round-trips. */
  extra: Record<string, unknown>;
};

export type SkillDefinition = {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata: Record<string, string>;
  body: string;
};

export type McpDefinition = {
  name: string;
  type: "local" | "remote" | "disabled";
  enabled: boolean;
  command: string[];
  cwd?: string;
  environment: Record<string, string>;
  url?: string;
  headers: Record<string, string>;
  oauth?: false | {
    clientId?: string;
    clientSecret?: string;
    scope?: string;
    callbackPort?: number;
    redirectUri?: string;
  };
  timeout?: number;
};

export type ProviderModel = {
  id: string;
  name?: string;
  variants: string[];
};

export type ProviderSummary = {
  id: string;
  name?: string;
  models: ProviderModel[];
};

export type GraphPosition = { x: number; y: number };
export type GraphViewport = { x: number; y: number; zoom: number };
export type GraphLayout = {
  positions: Record<string, GraphPosition>;
  viewport?: GraphViewport;
  /** Nodes explicitly placed from the visual resource palette for this view. */
  pinnedNodeIds?: string[];
};
export type StudioLayout = {
  version: 2;
  views: Record<string, GraphLayout>;
};

/**
 * Reserved for Studio-only metadata. Version 2 intentionally contains no
 * visual clusters. Older cluster fields are ignored when they are read.
 */
export type StudioMetadata = {
  version: 2;
};

export type BackupSummary = {
  id: string;
  path: string;
  createdAt: string;
  reason: string;
  sizeBytes?: number;
};

export type TeamSnapshot = {
  agents: AgentDefinition[];
  skills: SkillDefinition[];
  mcps: McpDefinition[];
  providers: ProviderSummary[];
  globalPermission: PermissionConfig;
  defaultAgent: string;
  defaultModel?: string;
  layout: StudioLayout;
  metadata: StudioMetadata;
  latestBackup?: BackupSummary;
};

export type RelationKind = "task" | "skill" | "mcp" | "tool" | "model";
export type TeamRelation = {
  source: string;
  target: string;
  kind: RelationKind;
  action: PermissionAction;
  inherited?: boolean;
  explicit?: boolean;
};

export type TeamApplyInput = {
  snapshot: TeamSnapshot;
  layout: StudioLayout;
  metadata: StudioMetadata;
  reason?: string;
};

export type ResourceKind = "agents" | "skills" | "commands";
export type ResourceSummary = {
  name: string;
  description: string;
  path: string;
  mode?: string;
  model?: string;
  disabled?: boolean;
  metadata: Record<string, unknown>;
};
export type ResourceDocument = ResourceSummary & { body: string };

export type ConfigSection = { key: string; value: unknown };

export type TeamNodeKind = "agent" | "skill" | "mcp" | "tool" | "model";
export type TeamNodeData = {
  kind: TeamNodeKind;
  name: string;
  label: string;
  description?: string;
  mode?: AgentMode;
  model?: string;
  disabled?: boolean;
  primary?: boolean;
  count?: number;
  color?: string;
  status?: PermissionAction | "inherit";
  /** True when the node was explicitly placed from the palette in this view. */
  pinned?: boolean;
  /** True when a palette node is visible but not yet linked to the current graph. */
  unlinked?: boolean;
};
