import React, { useState, useEffect } from 'react';
import { MCPDashboard, MCPConfiguration } from '@/mcp/MCPUIComponents';
import { MCPContentProvider } from '@/mcp/MCPContentProvider';
import { MCPConfiguration as MCPConfigType, MCPServerConfiguration } from '@/mcp/interfaces';
import { Button } from '@/components/ui/button';
import { Settings, ArrowLeft, Container } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MCPPage: React.FC = () => {
  const [contentProvider, setContentProvider] = useState<MCPContentProvider | null>(null);
  const [showConfiguration, setShowConfiguration] = useState(false);
  const [config, setConfig] = useState<MCPConfigType>({
    servers: [
      // Example server configuration for demonstration
      {
        name: 'browsermcp',
        type: 'stdio',
        command: 'echo',
        args: ['mcp-server'],
        timeout: 30000,
        description: 'Example browser MCP server'
      } as any
    ],
    disconnectedServers: [],
    globalSettings: {
      enableAutoReconnect: true,
      maxConcurrentConnections: 5,
      defaultTimeout: 30000,
      enableLogging: false, // Less verbose by default
      logLevel: 'info'
    }
  });
  const navigate = useNavigate();

  useEffect(() => {
    // Initialize MCP Content Provider
    const provider = new MCPContentProvider(config);
    provider.initialize().then(() => {
      setContentProvider(provider);
    }).catch(console.error);

    return () => {
      provider.shutdown();
    };
  }, [config]);

  const handleConfigSave = (newServers: MCPServerConfiguration[]) => {
    const newConfig = {
      ...config,
      servers: newServers
    };
    setConfig(newConfig);
    setShowConfiguration(false);
  };

  if (!contentProvider) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing MCP Content Provider...</p>
        </div>
      </div>
    );
  }

  if (showConfiguration) {
    return (
      <div className="min-h-screen bg-gray-50">
        <MCPConfiguration
          initialConfig={config.servers}
          onSave={handleConfigSave}
          onCancel={() => setShowConfiguration(false)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Learning</span>
              </Button>
              <div className="border-l border-gray-300 pl-4">
                <h1 className="text-xl font-semibold text-gray-900">MCP Dashboard</h1>
                <p className="text-sm text-gray-600">Model Context Protocol Management</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => navigate('/mcp/webcontainer')}
                className="flex items-center space-x-2"
              >
                <Container className="w-4 h-4" />
                <span>WebContainer Servers</span>
              </Button>
              <Button
                onClick={() => setShowConfiguration(true)}
                className="flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>Configure</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <MCPDashboard
        contentProvider={contentProvider}
        onConfigChange={(servers) => handleConfigSave(servers)}
      />
    </div>
  );
};

export default MCPPage;