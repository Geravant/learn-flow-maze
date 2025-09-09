import { useState, useEffect, useCallback } from 'react';
import { MCPContentProvider } from '@/mcp/MCPContentProvider';
import { MCPConfiguration, MCPServerConfiguration } from '@/mcp/interfaces';

// Browser compatibility check
const isBrowser = typeof window !== 'undefined';

// Default MCP configuration - can be extended by users
const DEFAULT_MCP_CONFIG: MCPConfiguration = {
  servers: [
    // Example HTTP server configuration (browser-compatible)
    // {
    //   name: 'remote-mcp-server',
    //   type: 'sse',
    //   url: 'https://api.example.com/mcp',
    //   timeout: 30000,
    //   description: 'Remote MCP server for content generation'
    // }
    
    // Local server configurations only work in Node.js environments
    // {
    //   name: 'local-python-mcp',
    //   type: 'stdio',
    //   command: 'python',
    //   args: ['-m', 'mcp_server'],
    //   timeout: 30000,
    //   description: 'Local Python MCP server (Node.js only)'
    // }
  ],
  disconnectedServers: [],
  globalSettings: {
    enableAutoReconnect: true,
    maxConcurrentConnections: 3,
    defaultTimeout: 30000,
    enableLogging: false,
    logLevel: 'info'
  }
};

export interface UseMCPReturn {
  provider: MCPContentProvider | null;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  generateContent: (request: {
    type: 'text' | 'image' | 'video' | 'audio' | 'data';
    prompt: string;
    parameters?: Record<string, any>;
  }) => Promise<any>;
  getAvailableProviders: () => Promise<Array<{
    name: string;
    type: string;
    connected: boolean;
    tools: number;
    capabilities: string[];
  }>>;
  addServer: (server: MCPServerConfiguration) => void;
  removeServer: (serverName: string) => void;
  reconnect: () => Promise<void>;
}

export function useMCP(customConfig?: Partial<MCPConfiguration>): UseMCPReturn {
  const [provider, setProvider] = useState<MCPContentProvider | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<MCPConfiguration>(() => ({
    ...DEFAULT_MCP_CONFIG,
    ...customConfig
  }));

  // Initialize MCP provider
  useEffect(() => {
    let mounted = true;
    
    const initializeProvider = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const newProvider = new MCPContentProvider(config);
        
        // Add error handling - but don't treat individual server errors as fatal
        // Individual server connection failures are expected in browser environments

        await newProvider.initialize();
        
        if (mounted) {
          setProvider(newProvider);
          setIsInitialized(true);
        }
      } catch (err) {
        console.error('Failed to initialize MCP provider:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize MCP');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeProvider();

    return () => {
      mounted = false;
      if (provider) {
        provider.shutdown();
      }
    };
  }, [config]);

  // Generate content using MCP
  const generateContent = useCallback(async (request: {
    type: 'text' | 'image' | 'video' | 'audio' | 'data';
    prompt: string;
    parameters?: Record<string, any>;
  }) => {
    if (!provider) {
      throw new Error('MCP provider not initialized');
    }

    try {
      const result = await provider.generateContent({
        type: request.type,
        prompt: request.prompt,
        parameters: request.parameters,
        context: {
          // You can add learning context here
          learningLevel: 'intermediate',
          preferences: {}
        }
      });

      return result;
    } catch (err) {
      console.error('MCP content generation failed:', err);
      throw err;
    }
  }, [provider]);

  // Get available providers
  const getAvailableProviders = useCallback(async () => {
    if (!provider) {
      return [];
    }
    return await provider.getAvailableProviders();
  }, [provider]);

  // Add a new server
  const addServer = useCallback((server: MCPServerConfiguration) => {
    setConfig(prev => ({
      ...prev,
      servers: [...prev.servers, server]
    }));
  }, []);

  // Remove a server
  const removeServer = useCallback((serverName: string) => {
    setConfig(prev => ({
      ...prev,
      servers: prev.servers.filter(s => s.name !== serverName)
    }));
  }, []);

  // Reconnect all providers
  const reconnect = useCallback(async () => {
    if (provider) {
      await provider.shutdown();
    }
    
    const newProvider = new MCPContentProvider(config);
    await newProvider.initialize();
    setProvider(newProvider);
  }, [config]);

  return {
    provider,
    isInitialized,
    isLoading,
    error,
    generateContent,
    getAvailableProviders,
    addServer,
    removeServer,
    reconnect
  };
}

export default useMCP;