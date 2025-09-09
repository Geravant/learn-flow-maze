import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Container, 
  Play, 
  CheckCircle, 
  AlertCircle,
  Loader2 as Loader
} from 'lucide-react';
import { MCPClientWebContainer } from '@/mcp/MCPClientWebContainer';

export const MCPWebContainerDemo: React.FC = () => {
  const [client, setClient] = useState<MCPClientWebContainer | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'running' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [serverInfo, setServerInfo] = useState<any>(null);

  const startFilesystemServer = async () => {
    setStatus('starting');
    setError('');
    
    try {
      // Create a filesystem MCP server
      const mcpClient = MCPClientWebContainer.createFromPredefined('filesystem', {
        name: 'demo-filesystem-server',
        timeout: 60000
      });
      
      // Set up event listeners
      mcpClient.on('connected', async () => {
        setStatus('running');
        const info = await mcpClient.getContainerInfo();
        setServerInfo(info);
        console.log('🎉 WebContainer MCP Server connected!', info);
      });
      
      mcpClient.on('error', (error) => {
        setStatus('error');
        setError(error instanceof Error ? error.message : String(error));
        console.error('❌ WebContainer MCP Error:', error);
      });
      
      mcpClient.on('disconnected', () => {
        setStatus('idle');
        setServerInfo(null);
        console.log('🔌 WebContainer MCP Disconnected');
      });
      
      // Connect
      await mcpClient.connect();
      setClient(mcpClient);
      
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
      console.error('Failed to start WebContainer MCP:', err);
    }
  };

  const stopServer = async () => {
    if (client) {
      await client.disconnect();
      setClient(null);
      setStatus('idle');
      setServerInfo(null);
    }
  };

  const testServerTools = async () => {
    if (!client || !client.isConnected()) {
      setError('Server not connected');
      return;
    }

    try {
      // List available tools
      const tools = client.getAvailableTools();
      console.log('📋 Available MCP tools:', tools);
      
      // Try to call a tool (this is just a demo)
      if (tools.length > 0) {
        console.log('🔧 First available tool:', tools[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'starting':
        return <Loader className="w-4 h-4 animate-spin text-yellow-500" />;
      case 'running':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Container className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'starting':
        return 'warning';
      case 'running':
        return 'default';
      case 'error':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Container className="w-5 h-5" />
          WebContainer MCP Demo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">Server Status:</span>
            <Badge variant={getStatusColor() as any}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </Badge>
          </div>
          
          {status === 'idle' && (
            <Button onClick={startFilesystemServer} className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Start Demo Server
            </Button>
          )}
          
          {status === 'running' && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={testServerTools}>
                Test Tools
              </Button>
              <Button size="sm" variant="destructive" onClick={stopServer}>
                Stop Server
              </Button>
            </div>
          )}
        </div>

        {status === 'starting' && (
          <Alert>
            <Loader className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Starting WebContainer and installing MCP server... This may take up to 60 seconds.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-red-600">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {serverInfo && (
          <div className="bg-gray-50 p-4 rounded-md space-y-2">
            <h4 className="font-medium">Server Information:</h4>
            <div className="text-sm space-y-1">
              <div>
                <span className="font-medium">Package:</span> {serverInfo.serverPackage}
              </div>
              <div>
                <span className="font-medium">Bridge Port:</span> {serverInfo.bridgePort}
              </div>
              <div>
                <span className="font-medium">Status:</span> {serverInfo.status}
              </div>
              {serverInfo.previewUrl && (
                <div>
                  <span className="font-medium">Preview URL:</span>{' '}
                  <a 
                    href={serverInfo.previewUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {serverInfo.previewUrl}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p>
            This demo starts a real Node.js MCP filesystem server inside your browser using WebContainers.
            The server runs completely client-side with full npm package support.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default MCPWebContainerDemo;