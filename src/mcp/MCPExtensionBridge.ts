// Browser Extension Bridge for Local MCP Servers
// Allows web apps to access local MCP servers through a browser extension

import { MCPTransport, MCPRequest, MCPResponse, MCPNotification, MCPConnectionError } from './interfaces.js';

interface ExtensionMessage {
  type: 'MCP_REQUEST' | 'MCP_RESPONSE' | 'MCP_ERROR' | 'MCP_CONNECT' | 'MCP_DISCONNECT';
  serverId: string;
  data?: any;
  error?: string;
}

export class MCPExtensionTransport implements MCPTransport {
  private serverId: string;
  private connected = false;
  private messageCallbacks: ((message: MCPResponse | MCPNotification) => void)[] = [];
  private errorCallbacks: ((error: Error) => void)[] = [];
  private closeCallbacks: (() => void)[] = [];
  private extensionId: string;

  constructor(serverId: string, extensionId: string) {
    this.serverId = serverId;
    this.extensionId = extensionId;
    this.setupExtensionListener();
  }

  private setupExtensionListener(): void {
    // Listen for messages from extension
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      
      const message: ExtensionMessage = event.data;
      if (!message.type?.startsWith('MCP_')) return;
      if (message.serverId !== this.serverId) return;

      switch (message.type) {
        case 'MCP_RESPONSE':
          this.messageCallbacks.forEach(cb => cb(message.data));
          break;
        case 'MCP_ERROR':
          this.errorCallbacks.forEach(cb => cb(new Error(message.error)));
          break;
      }
    });
  }

  async connect(): Promise<void> {
    if (!this.isExtensionAvailable()) {
      throw new MCPConnectionError(
        'MCP Browser Extension not found. Please install the LearnFlow MCP Extension.',
        this.serverId
      );
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new MCPConnectionError('Extension connection timeout', this.serverId));
      }, 10000);

      // Request connection through extension
      this.postToExtension({
        type: 'MCP_CONNECT',
        serverId: this.serverId
      });

      const handleResponse = (event: MessageEvent) => {
        const message: ExtensionMessage = event.data;
        if (message.type === 'MCP_RESPONSE' && message.serverId === this.serverId) {
          clearTimeout(timeout);
          window.removeEventListener('message', handleResponse);
          this.connected = true;
          resolve();
        }
      };

      window.addEventListener('message', handleResponse);
    });
  }

  async disconnect(): Promise<void> {
    if (this.connected) {
      this.postToExtension({
        type: 'MCP_DISCONNECT',
        serverId: this.serverId
      });
      this.connected = false;
      this.closeCallbacks.forEach(cb => cb());
    }
  }

  async send(message: MCPRequest | MCPNotification): Promise<void> {
    if (!this.connected) {
      throw new MCPConnectionError('Extension not connected', this.serverId);
    }

    this.postToExtension({
      type: 'MCP_REQUEST',
      serverId: this.serverId,
      data: message
    });
  }

  private postToExtension(message: ExtensionMessage): void {
    window.postMessage(message, '*');
  }

  private isExtensionAvailable(): boolean {
    // Check if extension is installed by looking for injected globals
    return typeof (window as any).LEARNFLOW_MCP_EXTENSION !== 'undefined';
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
}

// Extension manifest and setup instructions
export function generateExtensionManifest(): string {
  return JSON.stringify({
    manifest_version: 3,
    name: "LearnFlow MCP Bridge",
    version: "1.0.0",
    description: "Bridge for accessing local MCP servers from LearnFlow web app",
    permissions: ["activeTab", "storage"],
    host_permissions: ["*://localhost/*", "*://127.0.0.1/*"],
    background: {
      service_worker: "background.js"
    },
    content_scripts: [{
      matches: ["*://localhost/*", "*://127.0.0.1/*", "*://your-learnflow-domain.com/*"],
      js: ["content.js"]
    }],
    web_accessible_resources: [{
      resources: ["bridge.js"],
      matches: ["*://localhost/*", "*://127.0.0.1/*"]
    }]
  }, null, 2);
}

export function generateExtensionContentScript(): string {
  return `
// LearnFlow MCP Extension Content Script
// Injects bridge between web page and background script

// Signal to web page that extension is available
window.LEARNFLOW_MCP_EXTENSION = true;

const mcpConnections = new Map();

// Listen for messages from web page
window.addEventListener('message', async (event) => {
  if (event.source !== window) return;
  
  const message = event.data;
  if (!message.type?.startsWith('MCP_')) return;

  try {
    switch (message.type) {
      case 'MCP_CONNECT':
        // Forward to background script to start local MCP server
        const response = await chrome.runtime.sendMessage({
          action: 'connectMCP',
          serverId: message.serverId
        });
        
        window.postMessage({
          type: 'MCP_RESPONSE',
          serverId: message.serverId,
          data: response
        }, '*');
        break;

      case 'MCP_REQUEST':
        // Forward MCP request to background script
        const result = await chrome.runtime.sendMessage({
          action: 'mcpRequest',
          serverId: message.serverId,
          request: message.data
        });
        
        window.postMessage({
          type: 'MCP_RESPONSE',
          serverId: message.serverId,
          data: result
        }, '*');
        break;

      case 'MCP_DISCONNECT':
        await chrome.runtime.sendMessage({
          action: 'disconnectMCP',
          serverId: message.serverId
        });
        break;
    }
  } catch (error) {
    window.postMessage({
      type: 'MCP_ERROR',
      serverId: message.serverId,
      error: error.message
    }, '*');
  }
});

// Listen for background script messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'MCP_NOTIFICATION') {
    window.postMessage({
      type: 'MCP_RESPONSE',
      serverId: message.serverId,
      data: message.data
    }, '*');
  }
});
`;
}

export default { MCPExtensionTransport, generateExtensionManifest, generateExtensionContentScript };