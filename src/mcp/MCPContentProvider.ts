// MCP Content Provider - Integration with existing content generation system
// Bridges MCP tools with LearnFlow's content generation architecture

import { MCPClientLocal } from './MCPClientLocal.js';
import { MCPClientHTTP } from './MCPClientHTTP.js';
import { MCPClientBase } from './MCPClientBase.js';
import { 
  MCPServerConfiguration, 
  MCPTool, 
  MCPCallToolResult, 
  MCPContentProviderConfig,
  MCPError,
  MCPToolExecutionResult,
  MCPConfiguration
} from './interfaces.js';

interface ContentRequest {
  type: 'text' | 'image' | 'video' | 'audio' | 'data';
  prompt: string;
  parameters?: Record<string, any>;
  context?: {
    topic?: string;
    learningLevel?: string;
    preferences?: Record<string, any>;
    previousContent?: any[];
  };
  constraints?: {
    maxLength?: number;
    format?: string;
    style?: string;
    language?: string;
  };
}

interface ContentResult {
  content: any;
  metadata: {
    provider: string;
    toolName: string;
    generationTime: number;
    quality: number;
    cached: boolean;
  };
  alternatives?: any[];
  error?: string;
}

export class MCPContentProvider {
  private clients: Map<string, MCPClientBase> = new Map();
  private config: MCPConfiguration;
  private providerConfigs: Map<string, MCPContentProviderConfig> = new Map();
  private cache: Map<string, { result: ContentResult; timestamp: number }> = new Map();
  private metrics: Map<string, {
    totalRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
    lastUsed: Date;
  }> = new Map();

  constructor(config: MCPConfiguration) {
    this.config = config;
    this.initializeClients();
  }

  private initializeClients(): void {
    for (const serverConfig of this.config.servers) {
      try {
        let client: MCPClientBase;
        
        if (serverConfig.type === 'stdio') {
          client = new MCPClientLocal(serverConfig);
        } else {
          client = new MCPClientHTTP(serverConfig);
        }

        this.clients.set(serverConfig.name, client);
        
        // Set up event listeners
        client.on('connected', () => {
          console.log(`MCP Content Provider: ${serverConfig.name} connected`);
        });
        
        client.on('disconnected', (reason) => {
          console.log(`MCP Content Provider: ${serverConfig.name} disconnected - ${reason}`);
        });
        
        client.on('error', (error) => {
          console.log(`MCP Content Provider: ${serverConfig.name} error: ${error.message || error}`);
        });
        
        client.on('toolsChanged', (tools) => {
          this.updateProviderCapabilities(serverConfig.name, tools);
        });
        
      } catch (error) {
        console.error(`Failed to initialize MCP client ${serverConfig.name}:`, error);
      }
    }
  }

  async initialize(): Promise<void> {
    const connectionPromises = Array.from(this.clients.entries()).map(async ([name, client]) => {
      try {
        await client.connect();
        await this.loadProviderConfig(name);
      } catch (error) {
        console.error(`Failed to connect to MCP server ${name}:`, error);
      }
    });

    await Promise.allSettled(connectionPromises);
  }

  async generateContent(request: ContentRequest): Promise<ContentResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = this.getCacheKey(request);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    // Find suitable providers
    const providers = this.findSuitableProviders(request);
    if (providers.length === 0) {
      throw new MCPError(
        `No suitable MCP providers found for content type: ${request.type}`,
        -32000,
        { requestType: request.type }
      );
    }

    // Try providers in order of priority
    let lastError: Error | undefined;
    
    for (const provider of providers) {
      try {
        const result = await this.generateWithProvider(provider, request);
        
        // Cache successful results
        this.cacheResult(cacheKey, result);
        
        // Update metrics
        this.updateMetrics(provider.serverName, true, Date.now() - startTime);
        
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.updateMetrics(provider.serverName, false, Date.now() - startTime);
        
        // Try fallback behavior if configured
        const config = this.providerConfigs.get(provider.serverName);
        if (config?.fallbackBehavior === 'placeholder') {
          return this.createPlaceholderContent(request, error);
        }
      }
    }

    // All providers failed
    if (lastError) {
      throw lastError;
    }
    
    throw new MCPError(
      'All MCP providers failed to generate content',
      -32000,
      { requestType: request.type }
    );
  }

  private async generateWithProvider(
    provider: { serverName: string; toolName: string; tool: MCPTool },
    request: ContentRequest
  ): Promise<ContentResult> {
    const client = this.clients.get(provider.serverName);
    if (!client) {
      throw new MCPError(
        `MCP client not found: ${provider.serverName}`,
        -32000,
        undefined,
        provider.serverName
      );
    }

    const startTime = Date.now();
    
    // Prepare tool arguments based on the tool's input schema
    const args = this.prepareToolArguments(provider.tool, request);
    
    try {
      const result = await client.callTool(provider.toolName, args);
      
      return this.processToolResult(
        result,
        provider.serverName,
        provider.toolName,
        Date.now() - startTime
      );
    } catch (error) {
      throw new MCPError(
        `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`,
        -32000,
        { toolName: provider.toolName },
        provider.serverName
      );
    }
  }

  private findSuitableProviders(request: ContentRequest): Array<{
    serverName: string;
    toolName: string;
    tool: MCPTool;
    priority: number;
  }> {
    const providers: Array<{
      serverName: string;
      toolName: string;
      tool: MCPTool;
      priority: number;
    }> = [];

    for (const [serverName, client] of this.clients.entries()) {
      if (!client.isConnected()) continue;
      
      const config = this.providerConfigs.get(serverName);
      const tools = client.getAvailableTools();
      
      for (const tool of tools) {
        if (this.isToolSuitable(tool, request, config)) {
          const priority = this.calculateToolPriority(tool, request, config, serverName);
          providers.push({ serverName, toolName: tool.name, tool, priority });
        }
      }
    }

    // Sort by priority (higher first)
    return providers.sort((a, b) => b.priority - a.priority);
  }

  private isToolSuitable(
    tool: MCPTool, 
    request: ContentRequest, 
    config?: MCPContentProviderConfig
  ): boolean {
    // Check if tool is in the appropriate category
    const toolCategories = {
      'text': config?.contentGenerationTools || [],
      'image': config?.assetGenerationTools || [],
      'video': config?.assetGenerationTools || [],
      'audio': config?.assetGenerationTools || [],
      'data': config?.knowledgeRetrievalTools || []
    };

    const categoryTools = toolCategories[request.type] || [];
    
    // If specific tools are configured, check if this tool is included
    if (categoryTools.length > 0) {
      return categoryTools.includes(tool.name) || categoryTools.includes(`${tool.serverName}.${tool.name}`);
    }

    // Fallback: check tool name and description for content type hints
    const contentTypeHints = {
      'text': ['text', 'content', 'generate', 'write', 'create'],
      'image': ['image', 'picture', 'visual', 'draw', 'render'],
      'video': ['video', 'animation', 'movie', 'clip'],
      'audio': ['audio', 'sound', 'music', 'voice'],
      'data': ['data', 'information', 'knowledge', 'search', 'retrieve']
    };

    const hints = contentTypeHints[request.type] || [];
    const toolText = `${tool.name} ${tool.description}`.toLowerCase();
    
    return hints.some(hint => toolText.includes(hint));
  }

  private calculateToolPriority(
    tool: MCPTool,
    request: ContentRequest,
    config?: MCPContentProviderConfig,
    serverName?: string
  ): number {
    let priority = 50; // Base priority

    // Server priority
    const serverConfig = this.config.servers.find(s => s.name === serverName);
    if (serverConfig?.priority) {
      priority += serverConfig.priority;
    }

    // Tool category match
    if (tool.category === request.type) {
      priority += 20;
    }

    // Recent success rate
    const metrics = this.metrics.get(`${serverName}.${tool.name}`);
    if (metrics) {
      const successRate = metrics.successfulRequests / metrics.totalRequests;
      priority += successRate * 30;
      
      // Penalize slow tools
      if (metrics.averageResponseTime > 10000) {
        priority -= 10;
      }
    }

    // Tool has examples
    if (tool.examples && tool.examples.length > 0) {
      priority += 5;
    }

    return priority;
  }

  private prepareToolArguments(tool: MCPTool, request: ContentRequest): Record<string, any> {
    const args: Record<string, any> = {};
    const schema = tool.inputSchema;

    // Map common request fields to tool schema
    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties as Record<string, any>)) {
        // Map prompt variations
        if (['prompt', 'text', 'content', 'query', 'input'].includes(propName.toLowerCase())) {
          args[propName] = request.prompt;
        }
        
        // Map type variations
        if (['type', 'format', 'contentType'].includes(propName.toLowerCase())) {
          args[propName] = request.type;
        }
        
        // Map parameters
        if (propName.toLowerCase() === 'parameters' && request.parameters) {
          args[propName] = request.parameters;
        }
        
        // Map context fields
        if (request.context) {
          if (propName.toLowerCase() === 'context') {
            args[propName] = request.context;
          } else if (propName.toLowerCase() === 'topic' && request.context.topic) {
            args[propName] = request.context.topic;
          } else if (propName.toLowerCase() === 'level' && request.context.learningLevel) {
            args[propName] = request.context.learningLevel;
          }
        }
        
        // Map constraint fields
        if (request.constraints) {
          for (const [constraintKey, constraintValue] of Object.entries(request.constraints)) {
            if (propName.toLowerCase() === constraintKey.toLowerCase()) {
              args[propName] = constraintValue;
            }
          }
        }
      }
    }

    // Add any additional parameters from the request
    if (request.parameters) {
      Object.assign(args, request.parameters);
    }

    return args;
  }

  private processToolResult(
    result: MCPToolExecutionResult,
    serverName: string,
    toolName: string,
    executionTime: number
  ): ContentResult {
    if (result.isError) {
      throw new MCPError(
        `Tool returned error: ${result.errorCode || 'unknown'}`,
        -32000,
        result,
        serverName
      );
    }

    // Extract content from MCP result
    let content = null;
    const alternatives: any[] = [];

    for (const item of result.content) {
      const itemContent = item.text || item.data || item.uri;
      
      if (!content) {
        content = itemContent;
      } else {
        alternatives.push(itemContent);
      }
    }

    // Calculate quality score based on various factors
    const quality = this.calculateContentQuality(result, executionTime);

    return {
      content,
      metadata: {
        provider: serverName,
        toolName,
        generationTime: executionTime,
        quality,
        cached: result.cached || false
      },
      alternatives: alternatives.length > 0 ? alternatives : undefined
    };
  }

  private calculateContentQuality(result: MCPToolExecutionResult, executionTime: number): number {
    let quality = 0.5; // Base quality

    // Factor in execution time (faster is generally better for user experience)
    if (executionTime < 1000) quality += 0.3;
    else if (executionTime < 5000) quality += 0.1;
    else if (executionTime > 15000) quality -= 0.2;

    // Factor in result content richness
    if (result.content.length > 1) quality += 0.1;
    
    // Factor in metadata presence
    if (result.meta && Object.keys(result.meta).length > 0) quality += 0.1;

    return Math.max(0, Math.min(1, quality));
  }

  private createPlaceholderContent(request: ContentRequest, error: any): ContentResult {
    const placeholders = {
      'text': `[Content unavailable: ${error instanceof Error ? error.message : String(error)}]`,
      'image': { type: 'placeholder', alt: 'Content unavailable', error: String(error) },
      'video': { type: 'placeholder', alt: 'Video unavailable', error: String(error) },
      'audio': { type: 'placeholder', alt: 'Audio unavailable', error: String(error) },
      'data': { type: 'placeholder', message: 'Data unavailable', error: String(error) }
    };

    return {
      content: placeholders[request.type] || placeholders['text'],
      metadata: {
        provider: 'placeholder',
        toolName: 'placeholder',
        generationTime: 0,
        quality: 0,
        cached: false
      },
      error: String(error)
    };
  }

  private getCacheKey(request: ContentRequest): string {
    return btoa(JSON.stringify({
      type: request.type,
      prompt: request.prompt,
      parameters: request.parameters,
      context: request.context,
      constraints: request.constraints
    }));
  }

  private getFromCache(key: string): ContentResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // Check TTL
    const maxAge = 5 * 60 * 1000; // 5 minutes default
    if (Date.now() - cached.timestamp > maxAge) {
      this.cache.delete(key);
      return null;
    }

    // Mark as cached
    const result = { ...cached.result };
    result.metadata.cached = true;
    return result;
  }

  private cacheResult(key: string, result: ContentResult): void {
    // Respect cache size limits
    if (this.cache.size > 100) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      result: { ...result },
      timestamp: Date.now()
    });
  }

  private updateMetrics(serverName: string, success: boolean, responseTime: number): void {
    const key = serverName;
    const existing = this.metrics.get(key) || {
      totalRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0,
      lastUsed: new Date()
    };

    existing.totalRequests += 1;
    if (success) existing.successfulRequests += 1;
    existing.averageResponseTime = (existing.averageResponseTime + responseTime) / 2;
    existing.lastUsed = new Date();

    this.metrics.set(key, existing);
  }

  private async loadProviderConfig(serverName: string): Promise<void> {
    const client = this.clients.get(serverName);
    if (!client) return;

    try {
      const tools = client.getAvailableTools();
      
      // Auto-categorize tools based on their names and descriptions
      const config: MCPContentProviderConfig = {
        serverName,
        contentGenerationTools: tools
          .filter(t => /text|content|generate|write|create/i.test(`${t.name} ${t.description}`))
          .map(t => t.name),
        assetGenerationTools: tools
          .filter(t => /image|picture|visual|draw|render|video|audio/i.test(`${t.name} ${t.description}`))
          .map(t => t.name),
        knowledgeRetrievalTools: tools
          .filter(t => /data|information|knowledge|search|retrieve/i.test(`${t.name} ${t.description}`))
          .map(t => t.name),
        validationTools: tools
          .filter(t => /validate|verify|check|test/i.test(`${t.name} ${t.description}`))
          .map(t => t.name),
        fallbackBehavior: 'error',
        caching: {
          enabled: true,
          ttl: 5 * 60 * 1000, // 5 minutes
          maxSize: 100
        }
      };

      this.providerConfigs.set(serverName, config);
    } catch (error) {
      console.warn(`Failed to load provider config for ${serverName}:`, error);
    }
  }

  private updateProviderCapabilities(serverName: string, tools: MCPTool[]): void {
    // Update provider config when tools change
    this.loadProviderConfig(serverName);
  }

  // Public API methods

  async getAvailableProviders(): Promise<Array<{
    name: string;
    type: string;
    connected: boolean;
    tools: number;
    capabilities: string[];
  }>> {
    const providers = [];
    
    for (const [name, client] of this.clients.entries()) {
      const config = this.providerConfigs.get(name);
      const tools = client.getAvailableTools();
      
      const capabilities: string[] = [];
      if (config?.contentGenerationTools && config.contentGenerationTools.length > 0) {
        capabilities.push('text generation');
      }
      if (config?.assetGenerationTools && config.assetGenerationTools.length > 0) {
        capabilities.push('asset generation');
      }
      if (config?.knowledgeRetrievalTools && config.knowledgeRetrievalTools.length > 0) {
        capabilities.push('knowledge retrieval');
      }

      providers.push({
        name,
        type: client.getConnectionDetails().type,
        connected: client.isConnected(),
        tools: tools.length,
        capabilities
      });
    }

    return providers;
  }

  getMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    
    for (const [key, data] of this.metrics.entries()) {
      metrics[key] = {
        ...data,
        successRate: data.totalRequests > 0 ? data.successfulRequests / data.totalRequests : 0
      };
    }

    return {
      providers: metrics,
      cache: {
        size: this.cache.size,
        hitRate: 0 // TODO: implement cache hit rate tracking
      }
    };
  }

  async shutdown(): Promise<void> {
    const disconnectPromises = Array.from(this.clients.values()).map(client => 
      client.disconnect().catch(console.error)
    );
    
    await Promise.allSettled(disconnectPromises);
    
    this.clients.clear();
    this.cache.clear();
    this.metrics.clear();
  }
}

export default MCPContentProvider;