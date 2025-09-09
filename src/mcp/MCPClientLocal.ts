// Local MCP Client Implementation - stdio transport
// Extends MCPClientBase for local process communication via stdin/stdout
// Note: Only works in Node.js environments, not in browsers

import { MCPClientBase } from './MCPClientBase.js';
import { MCPServerLocalConfig, MCPTransport, MCPRequest, MCPResponse, MCPNotification, MCPConnectionError, MCPError } from './interfaces.js';
import { MCPWebSocketTransport } from './MCPWebSocketBridge.js';
import { MCPExtensionTransport } from './MCPExtensionBridge.js';

// Browser compatibility check
const isBrowser = typeof window !== 'undefined';

// Mock types for browser compatibility
type ChildProcess = any;
type spawn = any;

// Detect available browser bridges
async function detectAvailableBridges(): Promise<string[]> {
  if (!isBrowser) return [];
  
  const bridges: string[] = [];
  
  // Check for browser extension first (no network required)
  if (typeof (window as any).LEARNFLOW_MCP_EXTENSION !== 'undefined') {
    bridges.push('extension');
  }
  
  // Check for WebSocket bridge (async test)
  try {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket('ws://localhost:8080/mcp-bridge');
      const timeout = setTimeout(() => {
        ws.close();
        reject(new Error('Timeout'));
      }, 1000);
      
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve();
      };
      
      ws.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Connection failed'));
      };
    });
    bridges.push('websocket');
  } catch {
    // WebSocket bridge not available - this is expected when bridge isn't running
  }
  
  return bridges;
}

class StdioTransport implements MCPTransport {
  private process?: ChildProcess;
  private messageCallbacks: ((message: MCPResponse | MCPNotification) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private closeCallbacks: (() => void)[] = [];
  private connected = false;
  private buffer = '';
  private config: MCPServerLocalConfig;

  constructor(config: MCPServerLocalConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (isBrowser) {
      throw new MCPConnectionError(
        'Local MCP clients are not supported in browser environments. Use HTTP MCP clients instead.',
        this.config.name
      );
    }

    try {
      // Dynamic import for Node.js child_process
      const { spawn } = await import('child_process');
      
      const options = {
        stdio: ['pipe', 'pipe', 'pipe'] as const,
        env: { ...process.env, ...this.config.env },
        cwd: this.config.workingDirectory || process.cwd(),
        encoding: (this.config.encoding || 'utf8') as BufferEncoding
      };

      this.process = spawn(this.config.command, this.config.args, options);

      this.process.on('error', (error) => {
        this.connected = false;
        this.errorCallbacks.forEach(cb => cb(new MCPConnectionError(
          `Failed to spawn process: ${error.message}`,
          this.config.name,
          error
        )));
      });

      this.process.on('exit', (code, signal) => {
        this.connected = false;
        const reason = signal ? `killed with signal ${signal}` : `exited with code ${code}`;
        this.closeCallbacks.forEach(cb => cb());
        if (code !== 0 && !signal) {
          this.errorCallbacks.forEach(cb => cb(new MCPConnectionError(
            `Process ${reason}`,
            this.config.name
          )));
        }
      });

      if (this.process.stdout) {
        this.process.stdout.setEncoding(this.config.encoding as BufferEncoding || 'utf8');
        this.process.stdout.on('data', (chunk: string) => {
          this.handleData(chunk);
        });
      }

      if (this.process.stderr) {
        this.process.stderr.setEncoding(this.config.encoding as BufferEncoding || 'utf8');
        this.process.stderr.on('data', (chunk: string) => {
          console.error(`[${this.config.name}] stderr:`, chunk.toString());
        });
      }

      // Wait for process to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new MCPConnectionError(
            `Connection timeout after ${this.config.timeout || 30000}ms`,
            this.config.name
          ));
        }, this.config.timeout || 30000);

        if (this.process) {
          this.process.on('spawn', () => {
            clearTimeout(timeout);
            this.connected = true;
            resolve();
          });

          this.process.on('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        }
      });
    } catch (error) {
      throw new MCPConnectionError(
        `Failed to connect to local server: ${error instanceof Error ? error.message : String(error)}`,
        this.config.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.connected = false;
      
      // Try graceful shutdown first
      this.process.kill('SIGTERM');
      
      // Force kill after timeout
      const forceTimeout = setTimeout(() => {
        if (this.process && !this.process.killed) {
          this.process.kill('SIGKILL');
        }
      }, 5000);

      return new Promise<void>((resolve) => {
        if (this.process) {
          this.process.on('exit', () => {
            clearTimeout(forceTimeout);
            resolve();
          });
        } else {
          clearTimeout(forceTimeout);
          resolve();
        }
      });
    }
  }

  async send(message: MCPRequest | MCPNotification): Promise<void> {
    if (!this.connected || !this.process || !this.process.stdin) {
      throw new MCPConnectionError('Not connected to local server', this.config.name);
    }

    try {
      const messageStr = JSON.stringify(message) + '\n';
      const written = this.process.stdin.write(messageStr, this.config.encoding || 'utf8');
      
      if (!written) {
        throw new MCPError('Failed to write message to stdin', -32000, undefined, this.config.name);
      }
    } catch (error) {
      throw new MCPConnectionError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        this.config.name,
        error instanceof Error ? error : undefined
      );
    }
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
    return this.connected && this.process !== undefined && !this.process.killed;
  }

  private handleData(chunk: string): void {
    this.buffer += chunk;
    const messages = this.buffer.split('\n');
    
    // Keep the last potentially incomplete message in buffer
    this.buffer = messages.pop() || '';
    
    for (const messageStr of messages) {
      if (messageStr.trim()) {
        try {
          const message = JSON.parse(messageStr);
          this.messageCallbacks.forEach(cb => cb(message));
        } catch (error) {
          this.errorCallbacks.forEach(cb => cb(new MCPError(
            `Invalid JSON received: ${error instanceof Error ? error.message : String(error)}`,
            -32700,
            { rawMessage: messageStr },
            this.config.name
          )));
        }
      }
    }
  }
}

export class MCPClientLocal extends MCPClientBase {
  private preferredBridge?: string;

  constructor(config: MCPServerLocalConfig, options?: { preferredBridge?: 'websocket' | 'extension' | 'stdio' }) {
    super(config);
    this.preferredBridge = options?.preferredBridge;
  }

  protected createTransport(): MCPTransport {
    const config = this.server as MCPServerLocalConfig;
    
    if (isBrowser) {
      // For now, always try WebSocket bridge first in browser
      // Bridge detection will be handled during connection attempt
      return new MCPWebSocketTransport({
        bridgeUrl: 'ws://localhost:8080/mcp-bridge',
        serverName: config.name,
        reconnectAttempts: 3
      });
    }
    
    return new StdioTransport(this.server as MCPServerLocalConfig);
  }

  async validateConfig(): Promise<boolean> {
    const config = this.server as MCPServerLocalConfig;
    
    if (isBrowser) {
      throw new MCPError('Local MCP clients are not supported in browser environments', -32000, undefined, config.name);
    }
    
    if (!config.command) {
      throw new MCPError('Local server command is required', -32000, undefined, config.name);
    }

    if (!Array.isArray(config.args)) {
      throw new MCPError('Local server args must be an array', -32000, undefined, config.name);
    }

    // Check if command exists and is executable
    try {
      const { spawn } = await import('child_process');
      const testProcess = spawn(config.command, ['--version'], { 
        stdio: 'ignore',
        timeout: 5000
      });
      
      return new Promise((resolve) => {
        testProcess.on('error', () => resolve(false));
        testProcess.on('exit', (code) => resolve(code !== null));
        testProcess.on('close', (code) => resolve(code !== null));
      });
    } catch {
      return false;
    }
  }

  getConnectionDetails(): Record<string, any> {
    const config = this.server as MCPServerLocalConfig;
    return {
      type: 'stdio',
      command: config.command,
      args: config.args,
      workingDirectory: config.workingDirectory || process.cwd(),
      env: Object.keys(config.env || {}),
      pid: (this.transport as StdioTransport)?.['process']?.pid
    };
  }

  async restart(): Promise<void> {
    const wasConnected = this.isConnected();
    
    if (wasConnected) {
      await this.disconnect();
    }
    
    // Wait a bit before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.connect();
  }

  getProcessInfo(): { pid?: number; uptime?: number; memoryUsage?: NodeJS.MemoryUsage } | null {
    const process = (this.transport as StdioTransport)?.['process'];
    if (!process) return null;

    return {
      pid: process.pid,
      uptime: process.uptime ? process.uptime() : undefined,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : undefined
    };
  }
}

export default MCPClientLocal;