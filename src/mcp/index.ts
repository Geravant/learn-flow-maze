// MCP Client Integration Module - Main Export
// Centralized exports for the Model Context Protocol client integration

// Core interfaces and types
export * from './interfaces.js';

// Client implementations
export { MCPClientBase } from './MCPClientBase.js';
export { MCPClientLocal } from './MCPClientLocal.js';
export { MCPClientHTTP } from './MCPClientHTTP.js';
export { MCPClientWebContainer } from './MCPClientWebContainer.js';

// Content provider integration
export { MCPContentProvider } from './MCPContentProvider.js';

// UI components
export { MCPDashboard, MCPConfiguration } from './MCPUIComponents.js';

// WebContainer integration
export { WebContainerMCPTransport, WebContainerMCPManager, WEBCONTAINER_MCP_SERVERS } from './WebContainerMCP.js';

// Testing utilities
export { MCPIntegrationTest, runMCPIntegrationTests } from './MCPIntegrationTest.js';

// Re-export commonly used types for convenience
export type {
  MCPTool,
  MCPCallToolResult,
  MCPServerConfiguration,
  MCPServerLocalConfig,
  MCPServerRemoteConfig,
  MCPConfiguration,
  MCPContentProviderConfig,
  MCPSessionState,
  MCPConnectionHealth,
  MCPToolExecutionResult,
  MCPUsageMetrics,
  MCPHealthCheck,
  MCPServerInfo
} from './interfaces.js';

// Factory function for creating MCP clients
export function createMCPClient(config: MCPServerConfiguration) {
  const isBrowser = typeof window !== 'undefined';
  
  if (config.type === 'stdio') {
    if (isBrowser) {
      console.warn('Local MCP clients are not supported in browser environments. Consider using HTTP clients instead.');
      throw new Error('Local MCP clients require Node.js environment');
    }
    return new MCPClientLocal(config);
  } else if (config.type === 'webcontainer') {
    return new MCPClientWebContainer(config);
  } else {
    return new MCPClientHTTP(config);
  }
}

// Default export for module
export default {
  MCPClientBase,
  MCPClientLocal,
  MCPClientHTTP,
  MCPContentProvider,
  MCPDashboard,
  MCPConfiguration,
  MCPIntegrationTest,
  createMCPClient,
  runMCPIntegrationTests
};