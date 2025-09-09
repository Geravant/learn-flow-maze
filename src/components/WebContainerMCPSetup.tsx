import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Container, 
  Play, 
  Square, 
  RefreshCcw, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink,
  Code,
  Database,
  Search,
  FolderOpen,
  GitBranch,
  Zap
} from 'lucide-react';
import { MCPClientWebContainer, MCPServerWebContainerConfig } from '@/mcp/MCPClientWebContainer';
import { WEBCONTAINER_MCP_SERVERS } from '@/mcp/WebContainerMCP';

interface WebContainerMCPSetupProps {
  onServerCreated?: (client: MCPClientWebContainer) => void;
  onServerDestroyed?: (serverName: string) => void;
}

const ServerIcons = {
  filesystem: FolderOpen,
  brave_search: Search,
  sqlite: Database,
  git: GitBranch,
  postgres: Database,
  browsermcp: Code
};

const ServerColors = {
  filesystem: 'bg-blue-500',
  brave_search: 'bg-orange-500', 
  sqlite: 'bg-green-500',
  git: 'bg-purple-500',
  postgres: 'bg-indigo-500',
  browsermcp: 'bg-gray-700'
};

export const WebContainerMCPSetup: React.FC<WebContainerMCPSetupProps> = ({
  onServerCreated,
  onServerDestroyed
}) => {
  const [selectedServer, setSelectedServer] = useState<keyof typeof WEBCONTAINER_MCP_SERVERS>('filesystem');
  const [isSupported, setIsSupported] = useState<boolean | null>(null);
  const [runningServers, setRunningServers] = useState<Map<string, MCPClientWebContainer>>(new Map());
  const [serverStates, setServerStates] = useState<Map<string, {
    status: 'starting' | 'running' | 'error' | 'stopped';
    progress: number;
    error?: string;
    previewUrl?: string;
  }>>(new Map());
  const [envVars, setEnvVars] = useState<Record<string, string>>({});
  const [customArgs, setCustomArgs] = useState<string>('');

  useEffect(() => {
    checkWebContainerSupport();
  }, []);

  const checkWebContainerSupport = async () => {
    const info = await MCPClientWebContainer.getWebContainerInfo();
    setIsSupported(info.supported);
  };

  const startServer = async (serverKey: keyof typeof WEBCONTAINER_MCP_SERVERS) => {
    const serverConfig = WEBCONTAINER_MCP_SERVERS[serverKey];
    const serverName = `${serverConfig.serverName}-${Date.now()}`;
    
    // Update UI state
    setServerStates(prev => new Map(prev).set(serverName, {
      status: 'starting',
      progress: 10
    }));

    try {
      // Parse custom arguments
      const args = customArgs.trim() ? customArgs.split(' ') : serverConfig.mcpServerArgs;
      
      // Create WebContainer MCP client
      const client = MCPClientWebContainer.createFromPredefined(serverKey, {
        name: serverName,
        mcpServerArgs: args,
        envVars: Object.keys(envVars).length > 0 ? envVars : undefined
      });

      // Set up progress tracking
      client.on('connecting', () => {
        setServerStates(prev => new Map(prev).set(serverName, {
          status: 'starting',
          progress: 30
        }));
      });

      client.on('connected', async () => {
        const info = await client.getContainerInfo();
        setServerStates(prev => new Map(prev).set(serverName, {
          status: 'running',
          progress: 100,
          previewUrl: info.previewUrl
        }));
      });

      client.on('error', (error) => {
        setServerStates(prev => new Map(prev).set(serverName, {
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : String(error)
        }));
      });

      client.on('disconnected', () => {
        setServerStates(prev => new Map(prev).set(serverName, {
          status: 'stopped',
          progress: 0
        }));
      });

      // Update progress during connection
      setServerStates(prev => new Map(prev).set(serverName, {
        status: 'starting',
        progress: 50
      }));

      // Connect to server
      await client.connect();
      
      // Store running server
      setRunningServers(prev => new Map(prev).set(serverName, client));
      
      // Notify parent component
      onServerCreated?.(client);
      
    } catch (error) {
      setServerStates(prev => new Map(prev).set(serverName, {
        status: 'error',
        progress: 0,
        error: error instanceof Error ? error.message : String(error)
      }));
    }
  };

  const stopServer = async (serverName: string, force: boolean = false) => {
    const client = runningServers.get(serverName);
    if (client) {
      try {
        if (force) {
          // Force shutdown - immediate termination
          setServerStates(prev => new Map(prev).set(serverName, {
            status: 'starting', // Use starting to show progress
            progress: 20
          }));
          await client.forceShutdown();
        } else {
          // Graceful shutdown
          setServerStates(prev => new Map(prev).set(serverName, {
            status: 'starting', // Use starting to show progress  
            progress: 10
          }));
          await client.disconnect();
        }
        
        setRunningServers(prev => {
          const newMap = new Map(prev);
          newMap.delete(serverName);
          return newMap;
        });
        onServerDestroyed?.(serverName);
        
      } catch (error) {
        console.error(`Failed to ${force ? 'force shutdown' : 'stop'} server:`, error);
        setServerStates(prev => new Map(prev).set(serverName, {
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : String(error)
        }));
        return;
      }
    }
    
    setServerStates(prev => new Map(prev).set(serverName, {
      status: 'stopped',
      progress: 0
    }));
  };

  const restartServer = async (serverName: string) => {
    const client = runningServers.get(serverName);
    if (client) {
      setServerStates(prev => new Map(prev).set(serverName, {
        status: 'starting',
        progress: 20
      }));
      
      try {
        await client.restart();
        const info = await client.getContainerInfo();
        setServerStates(prev => new Map(prev).set(serverName, {
          status: 'running',
          progress: 100,
          previewUrl: info.previewUrl
        }));
      } catch (error) {
        setServerStates(prev => new Map(prev).set(serverName, {
          status: 'error',
          progress: 0,
          error: error instanceof Error ? error.message : String(error)
        }));
      }
    }
  };

  if (isSupported === null) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3"></div>
        <span>Checking WebContainer support...</span>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          WebContainers are not supported in this browser. Please use a modern browser like Chrome, Edge, or Firefox.
          WebContainers require features like SharedArrayBuffer and cross-origin isolation.
        </AlertDescription>
      </Alert>
    );
  }

  const selectedConfig = WEBCONTAINER_MCP_SERVERS[selectedServer];
  const IconComponent = ServerIcons[selectedServer];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
          <Container className="w-8 h-8" />
          WebContainer MCP Servers
        </h1>
        <p className="text-gray-600">
          Run real Node.js MCP servers entirely in your browser using WebContainers
        </p>
      </div>

      <Tabs defaultValue="start" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="start">Start New Server</TabsTrigger>
          <TabsTrigger value="running">Running Servers ({runningServers.size})</TabsTrigger>
        </TabsList>

        <TabsContent value="start" className="space-y-6">
          {/* Server Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Choose MCP Server</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(WEBCONTAINER_MCP_SERVERS).map(([key, config]) => {
                  const IconComp = ServerIcons[key as keyof typeof ServerIcons];
                  const isSelected = selectedServer === key;
                  
                  return (
                    <Card 
                      key={key}
                      className={`cursor-pointer transition-all ${
                        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedServer(key as keyof typeof WEBCONTAINER_MCP_SERVERS)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-md ${ServerColors[key as keyof typeof ServerColors]} text-white`}>
                            <IconComp className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900">{config.serverName}</h3>
                            <p className="text-sm text-gray-600 mt-1">{config.description}</p>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {config.capabilities.slice(0, 2).map(cap => (
                                <Badge key={cap} variant="outline" className="text-xs">
                                  {cap}
                                </Badge>
                              ))}
                              {config.capabilities.length > 2 && (
                                <Badge variant="outline" className="text-xs">
                                  +{config.capabilities.length - 2} more
                                </Badge>
                              )}
                            </div>
                            {config.requiresEnv && (
                              <div className="mt-2">
                                <Badge variant="destructive" className="text-xs">
                                  Requires Environment Variables
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IconComponent className="w-5 h-5" />
                Configure {selectedConfig.serverName}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Custom Arguments */}
              <div>
                <Label htmlFor="custom-args">Custom Arguments</Label>
                <Input
                  id="custom-args"
                  placeholder={selectedConfig.mcpServerArgs?.join(' ') || 'No default arguments'}
                  value={customArgs}
                  onChange={(e) => setCustomArgs(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Override default arguments for the MCP server
                </p>
              </div>

              {/* Environment Variables */}
              {selectedConfig.requiresEnv && (
                <div>
                  <Label htmlFor="env-vars">Environment Variables</Label>
                  <Textarea
                    id="env-vars"
                    placeholder={`Required:\n${selectedConfig.requiresEnv.join('\n')}\n\nFormat: KEY=value`}
                    value={Object.entries(envVars).map(([k, v]) => `${k}=${v}`).join('\n')}
                    onChange={(e) => {
                      const vars: Record<string, string> = {};
                      e.target.value.split('\n').forEach(line => {
                        const [key, ...valueParts] = line.split('=');
                        if (key && valueParts.length > 0) {
                          vars[key.trim()] = valueParts.join('=').trim();
                        }
                      });
                      setEnvVars(vars);
                    }}
                    rows={4}
                  />
                </div>
              )}

              {/* Start Button */}
              <Button 
                onClick={() => startServer(selectedServer)}
                className="w-full"
                size="lg"
              >
                <Play className="w-4 h-4 mr-2" />
                Start {selectedConfig.serverName}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="running" className="space-y-4">
          {runningServers.size === 0 ? (
            <Card>
              <CardContent className="text-center py-8 text-gray-500">
                <Container className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No servers currently running</p>
                <p className="text-sm">Start a server from the "Start New Server" tab</p>
              </CardContent>
            </Card>
          ) : (
            Array.from(runningServers.entries()).map(([serverName, client]) => {
              const state = serverStates.get(serverName);
              const StatusIcon = state?.status === 'running' ? CheckCircle : 
                               state?.status === 'error' ? AlertCircle : Container;
              
              return (
                <Card key={serverName}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <StatusIcon className={`w-5 h-5 ${
                          state?.status === 'running' ? 'text-green-500' :
                          state?.status === 'error' ? 'text-red-500' : 'text-yellow-500'
                        }`} />
                        {serverName}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          state?.status === 'running' ? 'default' :
                          state?.status === 'error' ? 'destructive' : 'secondary'
                        }>
                          {state?.status || 'unknown'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {state?.status === 'starting' && (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Starting server...</span>
                          <span>{state.progress}%</span>
                        </div>
                        <Progress value={state.progress} />
                      </div>
                    )}
                    
                    {state?.error && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{state.error}</AlertDescription>
                      </Alert>
                    )}
                    
                    {state?.previewUrl && (
                      <div>
                        <Label>Preview URL</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Input value={state.previewUrl} readOnly className="flex-1" />
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => window.open(state.previewUrl, '_blank')}
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restartServer(serverName)}
                        disabled={state?.status === 'starting'}
                      >
                        <RefreshCcw className="w-4 h-4 mr-1" />
                        Restart
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => stopServer(serverName, false)}
                        disabled={state?.status === 'starting'}
                      >
                        <Square className="w-4 h-4 mr-1" />
                        Stop
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => stopServer(serverName, true)}
                        disabled={state?.status === 'starting'}
                        title="Force immediate shutdown - use if regular stop fails"
                      >
                        <Zap className="w-4 h-4 mr-1" />
                        Force Stop
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default WebContainerMCPSetup;