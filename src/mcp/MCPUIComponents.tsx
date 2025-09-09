// MCP UI Components - Management interface for MCP servers and tools
// React components for configuring, monitoring, and managing MCP integrations

import React, { useState, useEffect, useCallback } from 'react';
import { MCPContentProvider } from './MCPContentProvider.js';
import { 
  MCPServerConfiguration, 
  MCPTool, 
  MCPHealthCheck, 
  MCPServerLocalConfig, 
  MCPServerRemoteConfig,
  MCPUsageMetrics 
} from './interfaces.js';

interface MCPProviderStatus {
  name: string;
  type: string;
  connected: boolean;
  tools: number;
  capabilities: string[];
  health?: MCPHealthCheck;
  lastError?: string;
}

interface MCPUIComponentsProps {
  contentProvider: MCPContentProvider;
  onConfigChange?: (config: MCPServerConfiguration[]) => void;
}

export const MCPDashboard: React.FC<MCPUIComponentsProps> = ({ 
  contentProvider, 
  onConfigChange 
}) => {
  const [providers, setProviders] = useState<MCPProviderStatus[]>([]);
  const [metrics, setMetrics] = useState<Record<string, any>>({});
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const refreshData = useCallback(async () => {
    try {
      const [providerData, metricsData] = await Promise.all([
        contentProvider.getAvailableProviders(),
        contentProvider.getMetrics()
      ]);
      
      setProviders(providerData);
      setMetrics(metricsData);
    } catch (error) {
      console.error('Failed to refresh MCP data:', error);
    } finally {
      setLoading(false);
    }
  }, [contentProvider]);

  useEffect(() => {
    refreshData();
    
    // Set up auto-refresh
    const interval = setInterval(refreshData, 5000);
    setRefreshInterval(interval);
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      clearInterval(interval);
    };
  }, [refreshData]);

  const getStatusColor = (connected: boolean, lastError?: string): string => {
    if (lastError) return 'text-red-500';
    return connected ? 'text-green-500' : 'text-yellow-500';
  };

  const getStatusText = (connected: boolean, lastError?: string): string => {
    if (lastError) return 'Error';
    return connected ? 'Connected' : 'Disconnected';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading MCP Dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">MCP Dashboard</h1>
        <p className="text-gray-600">Manage and monitor your Model Context Protocol providers</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Providers</h3>
          <p className="text-2xl font-bold text-gray-900">{providers.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Connected</h3>
          <p className="text-2xl font-bold text-green-600">
            {providers.filter(p => p.connected).length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Available Tools</h3>
          <p className="text-2xl font-bold text-blue-600">
            {providers.reduce((sum, p) => sum + p.tools, 0)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Cache Size</h3>
          <p className="text-2xl font-bold text-purple-600">
            {metrics.cache?.size || 0}
          </p>
        </div>
      </div>

      {/* Providers List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">MCP Providers</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {providers.map((provider) => (
            <div 
              key={provider.name} 
              className="px-6 py-4 hover:bg-gray-50 cursor-pointer"
              onClick={() => setSelectedProvider(provider.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={`w-3 h-3 rounded-full mr-3 ${
                    provider.connected ? 'bg-green-500' : 'bg-yellow-500'
                  }`}></div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">
                      {provider.name}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {provider.type} • {provider.tools} tools
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex flex-wrap gap-1">
                    {provider.capabilities.map((cap) => (
                      <span 
                        key={cap}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                  <span className={`text-sm font-medium ${getStatusColor(provider.connected)}`}>
                    {getStatusText(provider.connected)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Provider Details Modal */}
      {selectedProvider && (
        <MCPProviderDetails 
          providerName={selectedProvider}
          contentProvider={contentProvider}
          onClose={() => setSelectedProvider(null)}
        />
      )}
    </div>
  );
};

interface MCPProviderDetailsProps {
  providerName: string;
  contentProvider: MCPContentProvider;
  onClose: () => void;
}

const MCPProviderDetails: React.FC<MCPProviderDetailsProps> = ({
  providerName,
  contentProvider,
  onClose
}) => {
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [metrics, setMetrics] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        const [allProviders, allMetrics] = await Promise.all([
          contentProvider.getAvailableProviders(),
          contentProvider.getMetrics()
        ]);
        
        const provider = allProviders.find(p => p.name === providerName);
        const providerMetrics = allMetrics.providers[providerName] || {};
        
        // Get tools from the actual client
        // Note: This would need to be exposed through contentProvider
        setTools([]);
        setMetrics(providerMetrics);
      } catch (error) {
        console.error('Failed to load provider details:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [providerName, contentProvider]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">{providerName}</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Metrics */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Metrics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-500">Total Requests</p>
                    <p className="text-xl font-semibold">{metrics.totalRequests || 0}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-500">Success Rate</p>
                    <p className="text-xl font-semibold">
                      {((metrics.successRate || 0) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-500">Avg Response</p>
                    <p className="text-xl font-semibold">
                      {(metrics.averageResponseTime || 0).toFixed(0)}ms
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded">
                    <p className="text-sm text-gray-500">Last Used</p>
                    <p className="text-sm">
                      {metrics.lastUsed ? new Date(metrics.lastUsed).toLocaleString() : 'Never'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tools */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Available Tools</h3>
                <div className="space-y-2">
                  {tools.length > 0 ? tools.map((tool) => (
                    <div key={tool.name} className="border border-gray-200 rounded p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900">{tool.name}</h4>
                          <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
                          {tool.category && (
                            <span className="inline-block mt-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                              {tool.category}
                            </span>
                          )}
                        </div>
                        {tool.examples && tool.examples.length > 0 && (
                          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                            {tool.examples.length} examples
                          </span>
                        )}
                      </div>
                    </div>
                  )) : (
                    <p className="text-gray-500 text-center py-4">No tools information available</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface MCPConfigurationProps {
  initialConfig: MCPServerConfiguration[];
  onSave: (config: MCPServerConfiguration[]) => void;
  onCancel: () => void;
}

export const MCPConfiguration: React.FC<MCPConfigurationProps> = ({
  initialConfig,
  onSave,
  onCancel
}) => {
  const [config, setConfig] = useState<MCPServerConfiguration[]>(initialConfig);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newServer, setNewServer] = useState<Partial<MCPServerConfiguration>>({});

  const addServer = () => {
    if (!newServer.name || !newServer.type) return;
    
    const serverConfig: MCPServerConfiguration = {
      name: newServer.name,
      type: newServer.type as any,
      disabled: false,
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 1000,
      ...(newServer.type === 'stdio' ? {
        command: (newServer as any).command || '',
        args: (newServer as any).args || []
      } : {
        url: (newServer as any).url || ''
      })
    } as MCPServerConfiguration;

    setConfig([...config, serverConfig]);
    setNewServer({});
  };

  const removeServer = (index: number) => {
    setConfig(config.filter((_, i) => i !== index));
  };

  const updateServer = (index: number, updates: Partial<MCPServerConfiguration>) => {
    const updated = [...config];
    updated[index] = { ...updated[index], ...updates };
    setConfig(updated);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">MCP Configuration</h1>
        <p className="text-gray-600">Configure your Model Context Protocol servers and settings</p>
      </div>

      {/* Existing Servers */}
      <div className="space-y-4 mb-8">
        <h2 className="text-lg font-semibold text-gray-900">Configured Servers</h2>
        {config.map((server, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900">{server.name}</h3>
              <div className="flex items-center space-x-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={!server.disabled}
                    onChange={(e) => updateServer(index, { disabled: !e.target.checked })}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">Enabled</span>
                </label>
                <button
                  onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  {editingIndex === index ? 'Cancel' : 'Edit'}
                </button>
                <button
                  onClick={() => removeServer(index)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Remove
                </button>
              </div>
            </div>
            
            {editingIndex === index ? (
              <MCPServerConfigForm
                server={server}
                onUpdate={(updates) => updateServer(index, updates)}
                onSave={() => setEditingIndex(null)}
              />
            ) : (
              <div className="text-sm text-gray-600">
                <p>Type: {server.type}</p>
                {server.type === 'stdio' ? (
                  <p>Command: {(server as MCPServerLocalConfig).command}</p>
                ) : (
                  <p>URL: {(server as MCPServerRemoteConfig).url}</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add New Server */}
      <div className="border border-dashed border-gray-300 rounded-lg p-6">
        <h3 className="font-medium text-gray-900 mb-4">Add New Server</h3>
        <MCPServerConfigForm
          server={newServer}
          onUpdate={(updates) => setNewServer({ ...newServer, ...updates })}
          onSave={addServer}
          isNew
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 mt-8">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(config)}
          className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md"
        >
          Save Configuration
        </button>
      </div>
    </div>
  );
};

interface MCPServerConfigFormProps {
  server: Partial<MCPServerConfiguration>;
  onUpdate: (updates: Partial<MCPServerConfiguration>) => void;
  onSave: () => void;
  isNew?: boolean;
}

const MCPServerConfigForm: React.FC<MCPServerConfigFormProps> = ({
  server,
  onUpdate,
  onSave,
  isNew = false
}) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Server Name
          </label>
          <input
            type="text"
            value={server.name || ''}
            onChange={(e) => onUpdate({ name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="my-mcp-server"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            value={server.type || ''}
            onChange={(e) => onUpdate({ type: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select type...</option>
            <option value="stdio">Local (stdio)</option>
            <option value="sse">Remote (SSE)</option>
            <option value="http-stream">Remote (HTTP Stream)</option>
          </select>
        </div>
      </div>

      {server.type === 'stdio' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Command
            </label>
            <input
              type="text"
              value={(server as any).command || ''}
              onChange={(e) => onUpdate({ command: e.target.value } as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="python -m my_mcp_server"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Arguments (one per line)
            </label>
            <textarea
              value={(server as any).args?.join('\n') || ''}
              onChange={(e) => onUpdate({ args: e.target.value.split('\n').filter(Boolean) } as any)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="--config\n/path/to/config.json"
            />
          </div>
        </div>
      )}

      {server.type && server.type !== 'stdio' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Server URL
          </label>
          <input
            type="url"
            value={(server as any).url || ''}
            onChange={(e) => onUpdate({ url: e.target.value } as any)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="https://api.example.com/mcp"
          />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Timeout (ms)
          </label>
          <input
            type="number"
            value={server.timeout || 30000}
            onChange={(e) => onUpdate({ timeout: parseInt(e.target.value) || 30000 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Retry Attempts
          </label>
          <input
            type="number"
            value={server.retryAttempts || 3}
            onChange={(e) => onUpdate({ retryAttempts: parseInt(e.target.value) || 3 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Priority
          </label>
          <input
            type="number"
            value={server.priority || 0}
            onChange={(e) => onUpdate({ priority: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {isNew && (
        <div className="flex justify-end">
          <button
            onClick={onSave}
            disabled={!server.name || !server.type}
            className="px-4 py-2 text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md"
          >
            Add Server
          </button>
        </div>
      )}
    </div>
  );
};

export default { MCPDashboard, MCPConfiguration };