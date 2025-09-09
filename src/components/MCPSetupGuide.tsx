import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Terminal, Chrome, CheckCircle, Copy, ExternalLink } from 'lucide-react';
import { MCPBridgeManager } from '@/mcp/MCPWebSocketBridge';

interface MCPSetupGuideProps {
  onSetupComplete?: () => void;
}

export const MCPSetupGuide: React.FC<MCPSetupGuideProps> = ({ onSetupComplete }) => {
  const [copiedScript, setCopiedScript] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<'websocket' | 'extension'>('websocket');

  const bridgeManager = new MCPBridgeManager();

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const bridgeScript = `// MCP WebSocket Bridge Server
// Save as mcp-bridge-server.js and run with: node mcp-bridge-server.js

const WebSocket = require('ws');
const { spawn } = require('child_process');

const wss = new WebSocket.Server({ port: 8080, path: '/mcp-bridge' });
const mcpProcesses = new Map();

// Add your local MCP servers here
const LOCAL_SERVERS = [
  {
    name: 'my-python-mcp',
    command: 'python',
    args: ['-m', 'my_mcp_server'],
    workingDirectory: '/path/to/your/mcp/server'
  },
  // Add more servers as needed
];

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
          cwd: serverConfig.workingDirectory
        });
        
        mcpProcesses.set(ws, process);
        
        // Pipe MCP server output to WebSocket
        process.stdout.on('data', (chunk) => {
          const lines = chunk.toString().split('\\n');
          lines.forEach(line => {
            if (line.trim()) {
              try {
                ws.send(line);
              } catch (e) {
                console.error('Failed to send to WebSocket:', e);
              }
            }
          });
        });
        
        process.stderr.on('data', (chunk) => {
          console.error('MCP Server Error:', chunk.toString());
        });
        
        // Handle WebSocket messages to MCP server
        const originalOnMessage = ws.onmessage;
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.method !== 'bridge/connect') {
              process.stdin.write(JSON.stringify(message) + '\\n');
            }
          } catch (e) {
            if (originalOnMessage) originalOnMessage.call(ws, event);
          }
        };
        
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
console.log('Available servers:', LOCAL_SERVERS.map(s => s.name).join(', '));`;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Enable Local MCP Servers in Browser
        </h1>
        <p className="text-gray-600">
          Choose a method to connect your local MCP servers to the web app
        </p>
      </div>

      <Tabs value={selectedMethod} onValueChange={(value) => setSelectedMethod(value as any)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="websocket" className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            WebSocket Bridge
          </TabsTrigger>
          <TabsTrigger value="extension" className="flex items-center gap-2">
            <Chrome className="w-4 h-4" />
            Browser Extension
          </TabsTrigger>
        </TabsList>

        <TabsContent value="websocket" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="w-5 h-5" />
                WebSocket Bridge Setup
                <Badge variant="outline">Recommended</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Run a lightweight Node.js bridge server to connect your local MCP servers to the browser.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Step 1: Save the Bridge Server</h3>
                  <div className="relative">
                    <pre className="bg-gray-100 p-4 rounded-md text-xs overflow-x-auto max-h-60">
                      {bridgeScript}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(bridgeScript)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      {copiedScript ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Step 2: Configure Your MCP Servers</h3>
                  <p className="text-sm text-gray-600 mb-2">
                    Edit the LOCAL_SERVERS array in the script with your MCP server configurations:
                  </p>
                  <pre className="bg-gray-100 p-3 rounded text-xs">
{`{
  name: 'my-mcp-server',
  command: 'python',
  args: ['-m', 'my_mcp_server'],
  workingDirectory: '/path/to/server'
}`}
                  </pre>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Step 3: Run the Bridge Server</h3>
                  <pre className="bg-black text-green-400 p-3 rounded text-sm">
                    $ node mcp-bridge-server.js
                  </pre>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Step 4: Add Local Server in LearnFlow</h3>
                  <p className="text-sm text-gray-600">
                    Now you can add local MCP servers in the MCP Dashboard configuration. 
                    The bridge will automatically handle the connection.
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={() => window.open('https://nodejs.org/', '_blank')}
                  variant="outline"
                  className="flex items-center gap-1"
                >
                  <ExternalLink className="w-4 h-4" />
                  Get Node.js
                </Button>
                <Button 
                  onClick={onSetupComplete}
                  className="flex items-center gap-1"
                >
                  <CheckCircle className="w-4 h-4" />
                  I've Set Up the Bridge
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="extension" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Chrome className="w-5 h-5" />
                Browser Extension Setup
                <Badge variant="outline">Coming Soon</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Chrome className="h-4 w-4" />
                <AlertDescription>
                  A dedicated browser extension for seamless local MCP server access.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="text-center py-8 text-gray-500">
                  <Chrome className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Extension Under Development</h3>
                  <p className="text-sm">
                    We're working on a browser extension that will provide seamless access to local MCP servers
                    without needing to run a bridge server.
                  </p>
                </div>

                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2">What the extension will provide:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Direct access to local MCP servers</li>
                    <li>• No additional server setup required</li>
                    <li>• Automatic server discovery</li>
                    <li>• Enhanced security and permissions</li>
                  </ul>
                </div>
              </div>

              <Button 
                variant="outline" 
                disabled
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Extension Coming Soon
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Alternative: Use HTTP MCP Servers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            For immediate browser compatibility, consider deploying your MCP servers with HTTP endpoints instead of stdio.
            This works natively in browsers without any bridge setup.
          </p>
          <Button 
            variant="outline"
            onClick={() => window.open('https://modelcontextprotocol.io/docs/servers/http', '_blank')}
            className="flex items-center gap-1"
          >
            <ExternalLink className="w-4 h-4" />
            Learn About HTTP MCP Servers
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default MCPSetupGuide;