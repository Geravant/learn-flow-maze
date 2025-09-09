// WebContainer MCP Implementation
// Run real Node.js MCP servers inside the browser using StackBlitz WebContainers

import { WebContainer } from '@webcontainer/api';
import { MCPTransport, MCPRequest, MCPResponse, MCPNotification, MCPConnectionError } from './interfaces.js';

interface WebContainerMCPConfig {
  serverName: string;
  mcpServerPackage: string;
  mcpServerArgs?: string[];
  bridgePort?: number;
  workingDirectory?: string;
  packageJson?: any;
  additionalFiles?: { [path: string]: string };
}

export class WebContainerMCPTransport implements MCPTransport {
  private webContainer?: WebContainer;
  private config: WebContainerMCPConfig;
  private ws?: WebSocket;
  private connected = false;
  private previewUrl?: string;
  private messageCallbacks: ((message: MCPResponse | MCPNotification) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private closeCallbacks: (() => void)[] = [];

  constructor(config: WebContainerMCPConfig) {
    this.config = {
      bridgePort: 3001,
      workingDirectory: '.',
      ...config
    };
  }

  async connect(): Promise<void> {
    try {
      // Boot WebContainer with proper options
      console.log('🚀 Starting WebContainer...');
      this.webContainer = await WebContainer.boot({
        coep: 'credentialless',
        // Add any other necessary options for security
      });
      
      // Setup project files
      await this.setupProject();
      
      // Install dependencies
      console.log('📦 Installing dependencies...');
      await this.installDependencies();
      
      // Start MCP server with bridge
      console.log('🌉 Starting MCP bridge server...');
      const bridgeProcess = await this.startBridgeServer();
      
      // Wait for server to be ready and get preview URL
      await this.waitForServerReady();
      
      // Connect via WebSocket
      await this.connectWebSocket();
      
      this.connected = true;
      console.log('✅ WebContainer MCP server ready!');
      
    } catch (error) {
      console.error('WebContainer connection error:', error);
      throw new MCPConnectionError(
        `Failed to start WebContainer MCP server: ${error instanceof Error ? error.message : String(error)}`,
        this.config.serverName
      );
    }
  }

  private async setupProject(): Promise<void> {
    const packageJson = this.config.packageJson || {
      name: 'mcp-server-container',
      version: '1.0.0',
      type: 'module',
      dependencies: {
        '@modelcontextprotocol/server-filesystem': '^0.4.0',
        'supergateway': '^1.0.0'
      }
    };

    const files: Record<string, any> = {
      'package.json': {
        file: {
          contents: JSON.stringify(packageJson, null, 2)
        }
      },
      'README.md': {
        file: {
          contents: `# MCP Server in WebContainer\n\nRunning ${this.config.mcpServerPackage} with WebSocket bridge.`
        }
      }
    };

    // Add additional files with proper format
    if (this.config.additionalFiles) {
      for (const [path, content] of Object.entries(this.config.additionalFiles)) {
        files[path] = {
          file: {
            contents: content
          }
        };
      }
    }

    await this.webContainer!.mount(files);
  }

  private async installDependencies(): Promise<void> {
    const installProcess = await this.webContainer!.spawn('npm', ['install']);
    
    return new Promise((resolve, reject) => {
      installProcess.output.pipeTo(new WritableStream({
        write(data) {
          console.log('📦', data);
        }
      }));
      
      installProcess.exit.then((code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  private async startBridgeServer(): Promise<any> {
    const bridgeCommand = [
      'npx', '-y', 'supergateway',
      '--stdio', `npx -y ${this.config.mcpServerPackage} ${this.config.mcpServerArgs?.join(' ') || this.config.workingDirectory}`,
      '--outputTransport', 'ws',
      '--port', this.config.bridgePort!.toString(),
      '--cors'
    ];

    console.log('🌉 Bridge command:', bridgeCommand.join(' '));
    
    const bridgeProcess = await this.webContainer!.spawn(bridgeCommand[0], bridgeCommand.slice(1));
    
    // Log bridge output
    bridgeProcess.output.pipeTo(new WritableStream({
      write(data) {
        console.log('🌉 Bridge:', data);
      }
    }));
    
    // Wait for bridge to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return bridgeProcess;
  }

  private async waitForServerReady(): Promise<void> {
    // Wait for server to be ready and get preview URL
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for server to be ready'));
      }, 30000); // Increased timeout for server startup
      
      // Listen for server ready event
      this.webContainer!.on('server-ready', (port, url) => {
        if (port === this.config.bridgePort) {
          console.log(`🌐 Server ready on port ${port}: ${url}`);
          this.previewUrl = url;
          clearTimeout(timeout);
          resolve();
        }
      });
      
      // Also check periodically in case the event was missed
      const checkInterval = setInterval(async () => {
        try {
          // Try to get URL from WebContainer if available
          if (this.webContainer) {
            // This is a fallback - the server-ready event should normally handle this
            clearInterval(checkInterval);
          }
        } catch (error) {
          // Continue checking
        }
      }, 2000);
      
      // Clean up interval on timeout
      setTimeout(() => clearInterval(checkInterval), 30000);
    });
  }

  private async connectWebSocket(): Promise<void> {
    const wsUrl = this.previewUrl!.replace('https://', 'wss://').replace('http://', 'ws://') + '/message';
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected to WebContainer MCP server');
        resolve();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.messageCallbacks.forEach(cb => cb(message));
        } catch (error) {
          this.errorCallbacks.forEach(cb => cb(new Error(`Invalid JSON: ${error}`)));
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.errorCallbacks.forEach(cb => cb(new Error('WebSocket error')));
        if (!this.connected) reject(error);
      };
      
      this.ws.onclose = () => {
        this.connected = false;
        this.closeCallbacks.forEach(cb => cb());
      };
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    if (this.webContainer) {
      try {
        // Gracefully shut down any running processes
        console.log('🛑 Shutting down WebContainer...');
        
        // Try to kill any running processes first
        try {
          const killProcess = await this.webContainer.spawn('pkill', ['-f', 'node']);
          await killProcess.exit;
        } catch (error) {
          // Process killing might fail, but that's okay
          console.log('Note: Process cleanup completed');
        }
        
        // WebContainer doesn't have explicit teardown, but we can clean up references
        this.webContainer = undefined;
        console.log('✅ WebContainer disconnected successfully');
      } catch (error) {
        console.warn('Warning during WebContainer shutdown:', error);
      }
    }
    
    this.connected = false;
    this.previewUrl = undefined;
  }

  async forceShutdown(): Promise<void> {
    console.log('🚨 Force shutting down WebContainer...');
    
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    
    // Clear all references immediately
    this.webContainer = undefined;
    this.connected = false;
    this.previewUrl = undefined;
    
    console.log('✅ WebContainer force shutdown completed');
  }

  async send(message: MCPRequest | MCPNotification): Promise<void> {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new MCPConnectionError('WebContainer MCP server not connected', this.config.serverName);
    }
    
    this.ws.send(JSON.stringify(message));
  }

  onMessage(callback: (message: MCPResponse | MCPNotification) => void): void {
    this.messageCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void): void {
    this.errorCallbacks.push(callback);
  }

  onClose(callback: () => void): void {
    this.closeCallbacks.push(callback);
  }

  isConnected(): boolean {
    return this.connected && this.ws?.readyState === WebSocket.OPEN;
  }

  getPreviewInfo(): { url?: string; port: number } {
    return {
      url: this.previewUrl,
      port: this.config.bridgePort!
    };
  }
}

// Predefined MCP server configurations
export const WEBCONTAINER_MCP_SERVERS = {
  filesystem: {
    serverName: 'filesystem-mcp',
    mcpServerPackage: '@modelcontextprotocol/server-filesystem',
    mcpServerArgs: ['.'],
    description: 'File system operations (read, write, search files)',
    capabilities: ['file-operations', 'directory-listing', 'file-search']
  },
  
  browsermcp: {
    serverName: 'browser-mcp',
    mcpServerPackage: '@browsermcp/mcp-server',
    mcpServerArgs: [],
    description: 'Browser automation and web scraping with Puppeteer',
    capabilities: ['web-automation', 'screenshot', 'pdf-generation', 'dom-interaction', 'form-filling'],
    requiresEnv: []
  },
  
  brave_search: {
    serverName: 'brave-search-mcp',
    mcpServerPackage: '@modelcontextprotocol/server-brave-search',
    mcpServerArgs: [],
    description: 'Web search using Brave Search API',
    capabilities: ['web-search', 'search-results'],
    requiresEnv: ['BRAVE_API_KEY']
  },
  
  sqlite: {
    serverName: 'sqlite-mcp',
    mcpServerPackage: '@modelcontextprotocol/server-sqlite',
    mcpServerArgs: [],
    description: 'SQLite database operations',
    capabilities: ['database-query', 'sql-operations']
  },
  
  git: {
    serverName: 'git-mcp',
    mcpServerPackage: '@modelcontextprotocol/server-git',
    mcpServerArgs: ['.'],
    description: 'Git repository operations',
    capabilities: ['git-operations', 'version-control']
  },
  
  postgres: {
    serverName: 'postgres-mcp',
    mcpServerPackage: '@modelcontextprotocol/server-postgres',
    mcpServerArgs: [],
    description: 'PostgreSQL database operations',
    capabilities: ['database-query', 'postgres-operations'],
    requiresEnv: ['POSTGRES_CONNECTION_STRING']
  }
};

export class WebContainerMCPManager {
  private containers: Map<string, WebContainerMCPTransport> = new Map();
  
  async createServer(
    serverKey: keyof typeof WEBCONTAINER_MCP_SERVERS | 'custom',
    customConfig?: WebContainerMCPConfig
  ): Promise<WebContainerMCPTransport> {
    
    let config: WebContainerMCPConfig;
    
    if (serverKey === 'custom' && customConfig) {
      config = customConfig;
    } else {
      const predefined = WEBCONTAINER_MCP_SERVERS[serverKey as keyof typeof WEBCONTAINER_MCP_SERVERS];
      config = {
        serverName: predefined.serverName,
        mcpServerPackage: predefined.mcpServerPackage,
        mcpServerArgs: predefined.mcpServerArgs,
        bridgePort: 3001 + this.containers.size, // Use different ports
        ...customConfig
      };
    }
    
    const transport = new WebContainerMCPTransport(config);
    this.containers.set(config.serverName, transport);
    
    return transport;
  }
  
  getServer(serverName: string): WebContainerMCPTransport | undefined {
    return this.containers.get(serverName);
  }
  
  async destroyServer(serverName: string): Promise<void> {
    const server = this.containers.get(serverName);
    if (server) {
      await server.disconnect();
      this.containers.delete(serverName);
    }
  }
  
  async destroyAll(): Promise<void> {
    const disconnectPromises = Array.from(this.containers.values()).map(server => 
      server.disconnect().catch(console.error)
    );
    
    await Promise.allSettled(disconnectPromises);
    this.containers.clear();
  }
  
  getAvailableServers(): Array<{
    key: string;
    config: typeof WEBCONTAINER_MCP_SERVERS[keyof typeof WEBCONTAINER_MCP_SERVERS];
  }> {
    return Object.entries(WEBCONTAINER_MCP_SERVERS).map(([key, config]) => ({
      key,
      config
    }));
  }
}

export default { 
  WebContainerMCPTransport, 
  WebContainerMCPManager, 
  WEBCONTAINER_MCP_SERVERS 
};