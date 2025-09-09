// WebContainer MCP Client Implementation
// Extends MCPClientBase to use WebContainer-based MCP servers

import { MCPClientBase } from './MCPClientBase.js';
import { WebContainerMCPTransport, WEBCONTAINER_MCP_SERVERS } from './WebContainerMCP.js';
import { MCPServerConfiguration, MCPTransport, MCPConnectionError, MCPError } from './interfaces.js';

export interface MCPServerWebContainerConfig extends MCPServerConfiguration {
  type: 'webcontainer';
  mcpServerPackage: string;
  mcpServerArgs?: string[];
  bridgePort?: number;
  workingDirectory?: string;
  envVars?: Record<string, string>;
  additionalFiles?: { [path: string]: string };
  serverKey?: keyof typeof WEBCONTAINER_MCP_SERVERS;
}

export class MCPClientWebContainer extends MCPClientBase {
  constructor(config: MCPServerWebContainerConfig) {
    super(config);
  }

  protected createTransport(): MCPTransport {
    const config = this.server as MCPServerWebContainerConfig;
    
    return new WebContainerMCPTransport({
      serverName: config.name,
      mcpServerPackage: config.mcpServerPackage,
      mcpServerArgs: config.mcpServerArgs,
      bridgePort: config.bridgePort,
      workingDirectory: config.workingDirectory,
      additionalFiles: {
        // Add environment variables as .env file
        '.env': this.generateEnvFile(config.envVars),
        ...config.additionalFiles
      }
    });
  }

  async validateConfig(): Promise<boolean> {
    const config = this.server as MCPServerWebContainerConfig;
    
    if (!config.mcpServerPackage) {
      throw new MCPError('WebContainer MCP server package is required', -32000, undefined, config.name);
    }

    // Check if WebContainer is available
    try {
      const { WebContainer } = await import('@webcontainer/api');
      return true;
    } catch (error) {
      console.warn('WebContainer API not available:', error);
      return false;
    }
  }

  private generateEnvFile(envVars?: Record<string, string>): string {
    if (!envVars) return '';
    
    return Object.entries(envVars)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
  }

  getConnectionDetails(): Record<string, any> {
    const config = this.server as MCPServerWebContainerConfig;
    const transport = this.transport as WebContainerMCPTransport;
    
    return {
      type: 'webcontainer',
      mcpServerPackage: config.mcpServerPackage,
      mcpServerArgs: config.mcpServerArgs,
      bridgePort: config.bridgePort,
      workingDirectory: config.workingDirectory,
      previewInfo: transport?.getPreviewInfo?.() || null,
      connected: this.isConnected()
    };
  }

  async getContainerInfo(): Promise<{
    previewUrl?: string;
    bridgePort: number;
    serverPackage: string;
    status: 'starting' | 'running' | 'error' | 'stopped';
  }> {
    const config = this.server as MCPServerWebContainerConfig;
    const transport = this.transport as WebContainerMCPTransport;
    
    const previewInfo = transport?.getPreviewInfo?.() || { port: config.bridgePort || 3001 };
    
    return {
      previewUrl: previewInfo.url,
      bridgePort: previewInfo.port,
      serverPackage: config.mcpServerPackage,
      status: this.isConnected() ? 'running' : transport ? 'starting' : 'stopped'
    };
  }

  async restart(): Promise<void> {
    console.log('🔄 Restarting WebContainer MCP server...');
    
    if (this.isConnected()) {
      await this.disconnect();
    }
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.connect();
  }

  async forceShutdown(): Promise<void> {
    console.log('🚨 Force shutting down WebContainer MCP server...');
    
    const transport = this.transport as WebContainerMCPTransport;
    if (transport && transport.forceShutdown) {
      await transport.forceShutdown();
    }
    
    // Clear the transport reference
    this.transport = undefined;
    this.emit('disconnected');
  }

  static createFromPredefined(
    serverKey: keyof typeof WEBCONTAINER_MCP_SERVERS,
    overrides: Partial<MCPServerWebContainerConfig> = {}
  ): MCPClientWebContainer {
    const predefined = WEBCONTAINER_MCP_SERVERS[serverKey];
    
    const config: MCPServerWebContainerConfig = {
      name: predefined.serverName,
      type: 'webcontainer',
      mcpServerPackage: predefined.mcpServerPackage,
      mcpServerArgs: predefined.mcpServerArgs,
      description: predefined.description,
      timeout: 60000, // WebContainer startup can take time
      retryAttempts: 2,
      retryDelay: 3000,
      serverKey,
      ...overrides
    };
    
    return new MCPClientWebContainer(config);
  }

  static getAvailableServers(): Array<{
    key: keyof typeof WEBCONTAINER_MCP_SERVERS;
    name: string;
    description: string;
    capabilities: string[];
    requiresEnv?: string[];
  }> {
    return Object.entries(WEBCONTAINER_MCP_SERVERS).map(([key, config]) => ({
      key: key as keyof typeof WEBCONTAINER_MCP_SERVERS,
      name: config.serverName,
      description: config.description,
      capabilities: config.capabilities,
      requiresEnv: config.requiresEnv
    }));
  }

  // Helper method to check WebContainer support
  static async isSupported(): Promise<boolean> {
    try {
      const { WebContainer } = await import('@webcontainer/api');
      return true;
    } catch (error) {
      return false;
    }
  }

  static async getWebContainerInfo(): Promise<{
    supported: boolean;
    reason?: string;
    availableServers: number;
  }> {
    const supported = await this.isSupported();
    
    return {
      supported,
      reason: supported ? undefined : 'WebContainer API not available (requires modern browser)',
      availableServers: Object.keys(WEBCONTAINER_MCP_SERVERS).length
    };
  }
}

export default MCPClientWebContainer;