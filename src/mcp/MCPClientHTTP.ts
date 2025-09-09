// HTTP MCP Client Implementation - HTTP/SSE transport
// Extends MCPClientBase for HTTP-based communication with remote MCP servers

import { MCPClientBase } from './MCPClientBase.js';
import { MCPServerRemoteConfig, MCPTransport, MCPRequest, MCPResponse, MCPNotification, MCPConnectionError, MCPError } from './interfaces.js';

class HTTPTransport implements MCPTransport {
  private config: MCPServerRemoteConfig;
  private messageCallbacks: ((message: MCPResponse | MCPNotification) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private closeCallbacks: (() => void)[] = [];
  private connected = false;
  private eventSource?: EventSource;
  private abortController?: AbortController;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: MCPServerRemoteConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.abortController = new AbortController();

    try {
      if (this.config.type === 'sse') {
        await this.connectSSE();
      } else {
        await this.connectHTTP();
      }
      
      this.connected = true;
      this.reconnectAttempts = 0;
    } catch (error) {
      this.connected = false;
      throw new MCPConnectionError(
        `Failed to connect to ${this.config.url}: ${error instanceof Error ? error.message : String(error)}`,
        this.config.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async connectSSE(): Promise<void> {
    const headers = this.buildHeaders();
    const url = new URL(this.config.url);
    
    // Add headers as query parameters for SSE (since SSE doesn't support custom headers in browser)
    if (this.config.auth?.type === 'bearer' && this.config.auth.token) {
      url.searchParams.set('authorization', `Bearer ${this.config.auth.token}`);
    }
    
    this.eventSource = new EventSource(url.toString());

    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new MCPConnectionError(
          `SSE connection timeout after ${this.config.timeout || 30000}ms`,
          this.config.name
        ));
      }, this.config.timeout || 30000);

      this.eventSource!.onopen = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.eventSource!.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.messageCallbacks.forEach(cb => cb(message));
        } catch (error) {
          this.errorCallbacks.forEach(cb => cb(new MCPError(
            `Invalid JSON in SSE message: ${error instanceof Error ? error.message : String(error)}`,
            -32700,
            { rawData: event.data },
            this.config.name
          )));
        }
      };

      this.eventSource!.onerror = (event) => {
        clearTimeout(timeout);
        const error = new MCPConnectionError(
          `SSE connection error`,
          this.config.name
        );
        
        if (this.connected) {
          this.handleReconnection(error);
        } else {
          reject(error);
        }
      };

      this.eventSource!.addEventListener('close', () => {
        this.connected = false;
        this.closeCallbacks.forEach(cb => cb());
      });
    });
  }

  private async connectHTTP(): Promise<void> {
    // For HTTP streaming, we'll use fetch with ReadableStream
    const headers = this.buildHeaders();
    headers['Accept'] = 'application/x-ndjson';
    
    try {
      const response = await fetch(this.config.url, {
        method: 'GET',
        headers,
        signal: this.abortController!.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('No response body available for streaming');
      }

      this.processHTTPStream(response.body.getReader());
    } catch (error) {
      throw new MCPConnectionError(
        `HTTP connection failed: ${error instanceof Error ? error.message : String(error)}`,
        this.config.name,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async processHTTPStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          this.connected = false;
          this.closeCallbacks.forEach(cb => cb());
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              this.messageCallbacks.forEach(cb => cb(message));
            } catch (error) {
              this.errorCallbacks.forEach(cb => cb(new MCPError(
                `Invalid JSON in HTTP stream: ${error instanceof Error ? error.message : String(error)}`,
                -32700,
                { rawLine: line },
                this.config.name
              )));
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // Normal disconnection
      }
      
      this.errorCallbacks.forEach(cb => cb(new MCPConnectionError(
        `HTTP stream error: ${error instanceof Error ? error.message : String(error)}`,
        this.config.name,
        error instanceof Error ? error : undefined
      )));
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    
    if (this.abortController) {
      this.abortController.abort();
    }
    
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }

  async send(message: MCPRequest | MCPNotification): Promise<void> {
    if (!this.connected) {
      throw new MCPConnectionError('Not connected to remote server', this.config.name);
    }

    const headers = this.buildHeaders();
    headers['Content-Type'] = 'application/json';

    try {
      const response = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: this.abortController?.signal
      });

      if (!response.ok) {
        throw new MCPError(
          `HTTP ${response.status}: ${response.statusText}`,
          -32000,
          { status: response.status, statusText: response.statusText },
          this.config.name
        );
      }

      // For requests, we expect a response
      if ('id' in message) {
        const responseData = await response.json();
        this.messageCallbacks.forEach(cb => cb(responseData));
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new MCPConnectionError('Request aborted', this.config.name);
      }
      
      throw new MCPConnectionError(
        `Failed to send HTTP request: ${error instanceof Error ? error.message : String(error)}`,
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
    return this.connected;
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'LearnFlow-MCP-Client/1.0',
      ...this.config.headers
    };

    if (this.config.auth) {
      switch (this.config.auth.type) {
        case 'bearer':
          if (this.config.auth.token) {
            headers['Authorization'] = `Bearer ${this.config.auth.token}`;
          }
          break;
        case 'basic':
          if (this.config.auth.username && this.config.auth.password) {
            const credentials = btoa(`${this.config.auth.username}:${this.config.auth.password}`);
            headers['Authorization'] = `Basic ${credentials}`;
          }
          break;
        case 'apikey':
          if (this.config.auth.apiKey) {
            const headerName = this.config.auth.apiKeyHeader || 'X-API-Key';
            headers[headerName] = this.config.auth.apiKey;
          }
          break;
      }
    }

    return headers;
  }

  private async handleReconnection(error: Error): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.errorCallbacks.forEach(cb => cb(new MCPConnectionError(
        `Max reconnection attempts (${this.maxReconnectAttempts}) exceeded`,
        this.config.name
      )));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (reconnectError) {
        this.handleReconnection(reconnectError instanceof Error ? reconnectError : new Error(String(reconnectError)));
      }
    }, delay);
  }
}

export class MCPClientHTTP extends MCPClientBase {
  constructor(config: MCPServerRemoteConfig) {
    super(config);
  }

  protected createTransport(): MCPTransport {
    return new HTTPTransport(this.server as MCPServerRemoteConfig);
  }

  async validateConfig(): Promise<boolean> {
    const config = this.server as MCPServerRemoteConfig;
    
    if (!config.url) {
      throw new MCPError('Remote server URL is required', -32000, undefined, config.name);
    }

    try {
      new URL(config.url);
    } catch {
      throw new MCPError('Invalid URL format', -32000, undefined, config.name);
    }

    if (!['sse', 'http-stream', 'streaming-http'].includes(config.type)) {
      throw new MCPError('Invalid remote server type', -32000, undefined, config.name);
    }

    // Test connection
    try {
      const headers = this.buildTestHeaders(config);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(config.url, {
        method: 'HEAD',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeout);
      return response.ok;
    } catch {
      return false;
    }
  }

  private buildTestHeaders(config: MCPServerRemoteConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': 'LearnFlow-MCP-Client/1.0',
      ...config.headers
    };

    if (config.auth?.type === 'bearer' && config.auth.token) {
      headers['Authorization'] = `Bearer ${config.auth.token}`;
    }

    return headers;
  }

  getConnectionDetails(): Record<string, any> {
    const config = this.server as MCPServerRemoteConfig;
    return {
      type: config.type,
      url: config.url,
      headers: Object.keys(config.headers || {}),
      auth: config.auth ? {
        type: config.auth.type,
        hasCredentials: !!(
          config.auth.token || 
          config.auth.apiKey || 
          (config.auth.username && config.auth.password)
        )
      } : undefined,
      verify: config.verify !== false
    };
  }

  async testConnection(): Promise<{ success: boolean; responseTime: number; error?: string }> {
    const startTime = Date.now();
    
    try {
      const config = this.server as MCPServerRemoteConfig;
      const headers = this.buildTestHeaders(config);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(config.url, {
        method: 'HEAD',
        headers,
        signal: controller.signal
      });

      clearTimeout(timeout);
      const responseTime = Date.now() - startTime;

      return {
        success: response.ok,
        responseTime,
        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
      };
    } catch (error) {
      return {
        success: false,
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async updateAuth(auth: MCPServerRemoteConfig['auth']): Promise<void> {
    const config = this.server as MCPServerRemoteConfig;
    config.auth = auth;
    
    // Reconnect with new auth if currently connected
    if (this.isConnected()) {
      await this.disconnect();
      await this.connect();
    }
  }
}

export default MCPClientHTTP;