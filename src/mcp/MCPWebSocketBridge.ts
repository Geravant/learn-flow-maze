// WebSocket Bridge for Local MCP Servers
// Allows browser clients to connect to local MCP servers through a WebSocket proxy

import { MCPTransport, MCPRequest, MCPResponse, MCPNotification, MCPConnectionError } from './interfaces.js';

interface WebSocketBridgeConfig {
  bridgeUrl: string; // ws://localhost:8080/mcp-bridge
  serverName: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

export class MCPWebSocketTransport implements MCPTransport {
  private ws?: WebSocket;
  private config: WebSocketBridgeConfig;
  private messageCallbacks: ((message: MCPResponse | MCPNotification) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private closeCallbacks: (() => void)[] = [];
  private connected = false;
  private reconnectAttempts = 0;

  constructor(config: WebSocketBridgeConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.bridgeUrl);
        
        this.ws.onopen = () => {
          this.connected = true;
          this.reconnectAttempts = 0;
          
          // Send connection request for specific MCP server
          this.send({
            jsonrpc: '2.0',
            id: 'connect',
            method: 'bridge/connect',
            params: { serverName: this.config.serverName }
          });
          
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
          this.connected = false;
          const err = new MCPConnectionError(
            `WebSocket bridge connection failed`,
            this.config.serverName
          );
          this.errorCallbacks.forEach(cb => cb(err));
          if (!this.connected) reject(err);
        };

        this.ws.onclose = () => {
          this.connected = false;
          this.closeCallbacks.forEach(cb => cb());
          this.handleReconnection();
        };

      } catch (error) {
        reject(new MCPConnectionError(
          `Failed to create WebSocket connection: ${error}`,
          this.config.serverName
        ));
      }
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.connected = false;
      this.ws.close();
    }
  }

  async send(message: MCPRequest | MCPNotification): Promise<void> {
    if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new MCPConnectionError('WebSocket bridge not connected', this.config.serverName);
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

  private handleReconnection(): void {
    const maxAttempts = this.config.reconnectAttempts || 3;
    if (this.reconnectAttempts >= maxAttempts) {
      console.log(`WebSocket bridge: Max reconnection attempts (${maxAttempts}) reached for ${this.config.serverName}`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);
    
    setTimeout(() => {
      if (!this.connected) {
        console.log(`WebSocket bridge: Attempting reconnection ${this.reconnectAttempts}/${maxAttempts} for ${this.config.serverName}`);
        this.connect().catch((error) => {
          console.warn(`WebSocket bridge reconnection failed:`, error.message);
        });
      }
    }, delay);
  }
}

// Bridge server configuration for local MCP servers
export interface LocalMCPServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  workingDirectory?: string;
}

export class MCPBridgeManager {
  private bridgeUrl: string;
  private localServers: Map<string, LocalMCPServerConfig> = new Map();

  constructor(bridgeUrl = 'ws://localhost:8080/mcp-bridge') {
    this.bridgeUrl = bridgeUrl;
  }

  addLocalServer(config: LocalMCPServerConfig): void {
    this.localServers.set(config.name, config);
  }

  removeLocalServer(name: string): void {
    this.localServers.delete(name);
  }

  createTransport(serverName: string): MCPWebSocketTransport {
    if (!this.localServers.has(serverName)) {
      throw new Error(`Local server '${serverName}' not configured`);
    }

    return new MCPWebSocketTransport({
      bridgeUrl: this.bridgeUrl,
      serverName,
      reconnectAttempts: 5,
      reconnectDelay: 1000
    });
  }

  async deployBridgeServer(): Promise<string> {
    // This would return instructions or a simple Node.js script
    return `
// MCP WebSocket Bridge Server
// Save as mcp-bridge-server.js and run with: node mcp-bridge-server.js

const WebSocket = require('ws');
const { spawn } = require('child_process');

const wss = new WebSocket.Server({ port: 8080, path: '/mcp-bridge' });
const mcpProcesses = new Map();

const LOCAL_SERVERS = ${JSON.stringify(Array.from(this.localServers.values()), null, 2)};

wss.on('connection', (ws) => {
  console.log('Browser client connected');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      
      if (message.method === 'bridge/connect') {
        const serverName = message.params.serverName;
        const serverConfig = LOCAL_SERVERS.find(s => s.name === serverName);
        
        if (!serverConfig) {
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32000, message: 'Server not found: ' + serverName }
          }));
          return;
        }
        
        // Spawn MCP server process
        const process = spawn(serverConfig.command, serverConfig.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, ...serverConfig.env },
          cwd: serverConfig.workingDirectory
        });
        
        mcpProcesses.set(ws, process);
        
        // Pipe MCP server output to WebSocket
        process.stdout.on('data', (chunk) => {
          const lines = chunk.toString().split('\\n');
          lines.forEach(line => {
            if (line.trim()) {
              ws.send(line);
            }
          });
        });
        
        // Pipe WebSocket input to MCP server
        ws.on('message', (data) => {
          const message = JSON.parse(data);
          if (message.method !== 'bridge/connect') {
            process.stdin.write(JSON.stringify(message) + '\\n');
          }
        });
        
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: { status: 'connected', server: serverName }
        }));
      }
    } catch (error) {
      console.error('Bridge error:', error);
    }
  });
  
  ws.on('close', () => {
    const process = mcpProcesses.get(ws);
    if (process) {
      process.kill();
      mcpProcesses.delete(ws);
    }
    console.log('Browser client disconnected');
  });
});

console.log('MCP WebSocket Bridge running on ws://localhost:8080/mcp-bridge');
    `.trim();
  }
}

export default { MCPWebSocketTransport, MCPBridgeManager };