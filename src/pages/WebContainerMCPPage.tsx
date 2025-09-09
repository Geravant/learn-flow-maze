import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Container } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import WebContainerCompatCheck from '@/components/WebContainerCompatCheck';
import WebContainerMCPSetup from '@/components/WebContainerMCPSetup';
import SimpleWebContainerDemo from '@/mcp/SimpleWebContainerDemo';
import { MCPClientWebContainer } from '@/mcp/MCPClientWebContainer';

const WebContainerMCPPage: React.FC = () => {
  const navigate = useNavigate();

  const handleServerCreated = (client: MCPClientWebContainer) => {
    console.log('WebContainer MCP server created:', client.getConnectionDetails());
    // You can add the server to your global MCP configuration here
  };

  const handleServerDestroyed = (serverName: string) => {
    console.log('WebContainer MCP server destroyed:', serverName);
    // You can remove the server from your global MCP configuration here
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/mcp')}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to MCP Dashboard</span>
            </Button>
            <div className="border-l border-gray-300 pl-4">
              <h1 className="text-xl font-semibold text-gray-900">WebContainer MCP Servers</h1>
              <p className="text-sm text-gray-600">Run real Node.js MCP servers in your browser</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <Tabs defaultValue="compat" className="max-w-6xl mx-auto">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="compat">Compatibility</TabsTrigger>
            <TabsTrigger value="demo">Simple Demo</TabsTrigger>
            <TabsTrigger value="servers">MCP Servers</TabsTrigger>
          </TabsList>

          <TabsContent value="compat" className="mt-6">
            <WebContainerCompatCheck />
          </TabsContent>

          <TabsContent value="demo" className="mt-6">
            <SimpleWebContainerDemo />
          </TabsContent>

          <TabsContent value="servers" className="mt-6">
            <WebContainerMCPSetup 
              onServerCreated={handleServerCreated}
              onServerDestroyed={handleServerDestroyed}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WebContainerMCPPage;