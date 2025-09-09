// MCP Client Integration - Core Interfaces and Types
// TypeScript definitions for Model Context Protocol client implementation

// Core MCP types based on the MCP specification
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  serverName: string;
  version?: string;
  category?: string;
  examples?: Array<{
    name: string;
    description: string;
    arguments: Record<string, any>;
  }>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
    type: string;
  }>;
}

export interface MCPCallToolResult {
  content: Array<{
    type: 'text' | 'image' | 'data' | 'resource';
    text?: string;
    data?: any;
    uri?: string;
    mimeType?: string;
    annotations?: {
      audience?: Array<'human' | 'assistant'>;
      priority?: number;
    };
  }>;
  isError?: boolean;
  errorCode?: string;
  meta?: Record<string, any>;
}

export interface MCPListResourcesResult {
  resources: MCPResource[];
  nextCursor?: string;
}

export interface MCPReadResourceResult {
  contents: Array<{
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string; // base64 encoded
  }>;
}

export interface MCPServerCapabilities {
  experimental?: Record<string, any>;
  logging?: {};
  prompts?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  tools?: {
    listChanged?: boolean;
  };
}

export interface MCPClientCapabilities {
  experimental?: Record<string, any>;
  roots?: {
    listChanged?: boolean;
  };
  sampling?: {};
}

// Server configuration types
export interface MCPServerConfig {
  name: string;
  type: 'stdio' | 'sse' | 'http-stream' | 'streaming-http' | 'webcontainer';
  disabled?: boolean;
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
  description?: string;
  category?: string;
  priority?: number;
}

export interface MCPServerLocalConfig extends MCPServerConfig {
  type: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
  encoding?: string;
  encodingErrorHandler?: string;
  workingDirectory?: string;
}

export interface MCPServerRemoteConfig extends MCPServerConfig {
  type: 'sse' | 'http-stream' | 'streaming-http';
  url: string;
  headers?: Record<string, string>;
  verify?: boolean;
  auth?: {
    type: 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
}

export type MCPServerConfiguration = MCPServerLocalConfig | MCPServerRemoteConfig;

export interface MCPConfiguration {
  servers: MCPServerConfiguration[];
  disconnectedServers: Array<{
    name: string;
    error: string;
    timestamp: Date;
    retryCount: number;
  }>;
  globalSettings?: {
    enableAutoReconnect?: boolean;
    maxConcurrentConnections?: number;
    defaultTimeout?: number;
    enableLogging?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
  };
}

// JSON-RPC types for MCP communication
export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// Session and connection state types
export interface MCPSessionState {
  sessionId: string;
  serverName: string;
  connected: boolean;
  initialized: boolean;
  protocolVersion: string;
  capabilities: {
    client: MCPClientCapabilities;
    server: MCPServerCapabilities;
  };
  lastActivity: Date;
  statistics: {
    requestsSent: number;
    responsesReceived: number;
    errorsCount: number;
    averageResponseTime: number;
    totalDataTransferred: number;
  };
}

export interface MCPConnectionHealth {
  serverName: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastPing?: Date;
  responseTime?: number;
  errorCount: number;
  uptime: number;
  reconnectAttempts: number;
  capabilities: MCPServerCapabilities;
}

// Event types for MCP client
export interface MCPClientEvents {
  connected: (serverName: string) => void;
  disconnected: (serverName: string, reason?: string) => void;
  error: (serverName: string, error: Error) => void;
  toolsChanged: (serverName: string, tools: MCPTool[]) => void;
  resourcesChanged: (serverName: string) => void;
  promptsChanged: (serverName: string) => void;
  notification: (serverName: string, notification: MCPNotification) => void;
  reconnecting: (serverName: string, attempt: number) => void;
  reconnected: (serverName: string) => void;
}

// Tool execution context and results
export interface MCPToolExecutionContext {
  toolName: string;
  serverName: string;
  arguments: Record<string, any>;
  requestId: string;
  timestamp: Date;
  timeout?: number;
  metadata?: Record<string, any>;
}

export interface MCPToolExecutionResult extends MCPCallToolResult {
  executionTime: number;
  context: MCPToolExecutionContext;
  cached?: boolean;
  serverResponse?: MCPResponse;
}

// Resource management types
export interface MCPResourceSubscription {
  uri: string;
  serverName: string;
  callback: (resource: MCPResource) => void;
  subscriptionId: string;
}

export interface MCPResourceCache {
  uri: string;
  content: MCPReadResourceResult;
  lastAccessed: Date;
  serverName: string;
  size: number;
  mimeType?: string;
}

// Content provider integration types
export interface MCPContentProviderConfig {
  serverName: string;
  contentGenerationTools?: string[];
  assetGenerationTools?: string[];
  knowledgeRetrievalTools?: string[];
  validationTools?: string[];
  fallbackBehavior?: 'error' | 'empty' | 'placeholder';
  caching?: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

// Analytics and monitoring types
export interface MCPUsageMetrics {
  serverName: string;
  timeWindow: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    dataTransferred: number;
    mostUsedTools: Array<{
      toolName: string;
      usageCount: number;
      averageExecutionTime: number;
    }>;
    errorDistribution: Record<string, number>;
  };
}

// Error types
export class MCPError extends Error {
  constructor(
    message: string,
    public code: number = -32000,
    public data?: any,
    public serverName?: string
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(message: string, serverName: string, cause?: Error) {
    super(message, -32001, { cause: cause?.message }, serverName);
    this.name = 'MCPConnectionError';
  }
}

export class MCPTimeoutError extends MCPError {
  constructor(message: string, serverName: string, timeout: number) {
    super(message, -32002, { timeout }, serverName);
    this.name = 'MCPTimeoutError';
  }
}

export class MCPToolNotFoundError extends MCPError {
  constructor(toolName: string, serverName: string) {
    super(`Tool '${toolName}' not found on server '${serverName}'`, -32601, { toolName }, serverName);
    this.name = 'MCPToolNotFoundError';
  }
}

// Utility types
export interface MCPHealthCheck {
  serverName: string;
  timestamp: Date;
  healthy: boolean;
  responseTime?: number;
  error?: string;
  details: {
    connected: boolean;
    toolsAvailable: number;
    resourcesAvailable: number;
    lastSuccessfulRequest?: Date;
  };
}

export interface MCPServerInfo {
  name: string;
  version: string;
  description?: string;
  vendor?: string;
  capabilities: MCPServerCapabilities;
  metadata?: Record<string, any>;
  health: MCPHealthCheck;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
}

// Transport layer abstractions
export interface MCPTransport {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: MCPRequest | MCPNotification): Promise<void>;
  onMessage(callback: (message: MCPResponse | MCPNotification) => void): void;
  onError(callback: (error: Error) => void): void;
  onClose(callback: () => void): void;
  isConnected(): boolean;
}

export interface MCPTransportFactory {
  createTransport(config: MCPServerConfiguration): MCPTransport;
  supportsConfig(config: MCPServerConfiguration): boolean;
}

export default {
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPToolNotFoundError
};