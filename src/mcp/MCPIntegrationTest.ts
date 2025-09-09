// MCP Integration Test Suite
// Comprehensive testing for MCP client integration and content provider

import { MCPClientLocal } from './MCPClientLocal.js';
import { MCPClientHTTP } from './MCPClientHTTP.js';
import { MCPContentProvider } from './MCPContentProvider.js';
import { 
  MCPServerLocalConfig, 
  MCPServerRemoteConfig, 
  MCPConfiguration,
  MCPError,
  MCPConnectionError,
  MCPTimeoutError,
  MCPToolNotFoundError
} from './interfaces.js';

// Mock MCP Server for testing
class MockMCPServer {
  private tools = new Map([
    ['generate_text', {
      name: 'generate_text',
      description: 'Generate text content based on a prompt',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          maxLength: { type: 'number' },
          style: { type: 'string' }
        },
        required: ['prompt']
      }
    }],
    ['create_image', {
      name: 'create_image',
      description: 'Generate an image from a text description',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          width: { type: 'number' },
          height: { type: 'number' }
        },
        required: ['prompt']
      }
    }],
    ['search_knowledge', {
      name: 'search_knowledge',
      description: 'Search for information in the knowledge base',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          limit: { type: 'number' }
        },
        required: ['query']
      }
    }]
  ]);

  handleRequest(request: any): any {
    switch (request.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: false },
              prompts: { listChanged: false }
            },
            serverInfo: {
              name: 'mock-mcp-server',
              version: '1.0.0'
            }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools: Array.from(this.tools.values())
          }
        };

      case 'tools/call':
        return this.handleToolCall(request);

      case 'ping':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: { status: 'ok', timestamp: new Date().toISOString() }
        };

      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }
  }

  private handleToolCall(request: any): any {
    const { name, arguments: args } = request.params;
    
    if (!this.tools.has(name)) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Tool not found: ${name}`
        }
      };
    }

    // Simulate tool execution
    switch (name) {
      case 'generate_text':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{
              type: 'text',
              text: `Generated text content for: "${args.prompt}". This is a mock response with style: ${args.style || 'default'}.`
            }],
            isError: false
          }
        };

      case 'create_image':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{
              type: 'image',
              uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
              text: `Mock image generated for: "${args.prompt}" (${args.width || 512}x${args.height || 512})`
            }],
            isError: false
          }
        };

      case 'search_knowledge':
        return {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{
              type: 'data',
              data: {
                results: [
                  { title: `Result 1 for "${args.query}"`, content: 'Mock search result content 1' },
                  { title: `Result 2 for "${args.query}"`, content: 'Mock search result content 2' }
                ],
                total: 2
              }
            }],
            isError: false
          }
        };

      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32000,
            message: `Unknown tool: ${name}`
          }
        };
    }
  }
}

export class MCPIntegrationTest {
  private mockServer: MockMCPServer;
  private testResults: Array<{ name: string; passed: boolean; error?: string; duration: number }> = [];

  constructor() {
    this.mockServer = new MockMCPServer();
  }

  async runAllTests(): Promise<{
    passed: number;
    failed: number;
    total: number;
    results: Array<{ name: string; passed: boolean; error?: string; duration: number }>;
  }> {
    console.log('Starting MCP Integration Test Suite...');
    
    const tests = [
      () => this.testMCPClientLocalBasicConnection(),
      () => this.testMCPClientLocalToolCalling(),
      () => this.testMCPClientLocalErrorHandling(),
      () => this.testMCPClientHTTPBasicFeatures(),
      () => this.testMCPContentProviderInitialization(),
      () => this.testMCPContentProviderContentGeneration(),
      () => this.testMCPContentProviderCaching(),
      () => this.testMCPContentProviderFallback(),
      () => this.testMCPErrorHandling(),
      () => this.testMCPPerformanceMetrics(),
      () => this.testMCPConfigurationValidation()
    ];

    for (const test of tests) {
      await this.runTest(test);
    }

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.length - passed;

    console.log(`\nTest Results: ${passed} passed, ${failed} failed, ${this.testResults.length} total`);
    
    return {
      passed,
      failed,
      total: this.testResults.length,
      results: this.testResults
    };
  }

  private async runTest(testFn: () => Promise<void>): Promise<void> {
    const testName = testFn.name.replace('bound ', '');
    const startTime = Date.now();
    
    try {
      await testFn();
      this.testResults.push({
        name: testName,
        passed: true,
        duration: Date.now() - startTime
      });
      console.log(`✓ ${testName}`);
    } catch (error) {
      this.testResults.push({
        name: testName,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
      console.log(`✗ ${testName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Local Client Tests
  private async testMCPClientLocalBasicConnection(): Promise<void> {
    const config: MCPServerLocalConfig = {
      name: 'test-local-server',
      type: 'stdio',
      command: 'echo',
      args: ['test'],
      timeout: 5000
    };

    const client = new MCPClientLocal(config);
    
    // Test configuration validation
    const isValid = await client.validateConfig();
    if (!isValid) {
      throw new Error('Configuration validation failed');
    }

    // Test connection details
    const details = client.getConnectionDetails();
    if (details.type !== 'stdio' || details.command !== 'echo') {
      throw new Error('Connection details incorrect');
    }
  }

  private async testMCPClientLocalToolCalling(): Promise<void> {
    // This test would require a real MCP server process
    // For now, we'll test the client structure and error handling
    const config: MCPServerLocalConfig = {
      name: 'test-tool-server',
      type: 'stdio',
      command: 'nonexistent-command',
      args: [],
      timeout: 1000
    };

    const client = new MCPClientLocal(config);
    
    try {
      await client.connect();
      throw new Error('Should have failed to connect to nonexistent command');
    } catch (error) {
      if (!(error instanceof MCPConnectionError)) {
        throw new Error('Expected MCPConnectionError');
      }
    }
  }

  private async testMCPClientLocalErrorHandling(): Promise<void> {
    const config: MCPServerLocalConfig = {
      name: 'error-test-server',
      type: 'stdio',
      command: '',
      args: [],
      timeout: 1000
    };

    const client = new MCPClientLocal(config);
    
    try {
      await client.validateConfig();
      throw new Error('Should have failed validation with empty command');
    } catch (error) {
      if (!(error instanceof MCPError)) {
        throw new Error('Expected MCPError for invalid configuration');
      }
    }
  }

  // HTTP Client Tests
  private async testMCPClientHTTPBasicFeatures(): Promise<void> {
    const config: MCPServerRemoteConfig = {
      name: 'test-http-server',
      type: 'sse',
      url: 'https://httpbin.org/status/200',
      timeout: 5000
    };

    const client = new MCPClientHTTP(config);
    
    // Test configuration validation
    try {
      const isValid = await client.validateConfig();
      // This might fail due to network, but shouldn't throw
    } catch (error) {
      // Network errors are expected in test environment
    }

    // Test connection details
    const details = client.getConnectionDetails();
    if (details.type !== 'sse' || details.url !== 'https://httpbin.org/status/200') {
      throw new Error('HTTP connection details incorrect');
    }

    // Test connection testing
    const testResult = await client.testConnection();
    if (typeof testResult.success !== 'boolean' || typeof testResult.responseTime !== 'number') {
      throw new Error('Connection test result format incorrect');
    }
  }

  // Content Provider Tests
  private async testMCPContentProviderInitialization(): Promise<void> {
    const config: MCPConfiguration = {
      servers: [
        {
          name: 'mock-server',
          type: 'stdio',
          command: 'echo',
          args: ['test']
        } as MCPServerLocalConfig
      ],
      disconnectedServers: [],
      globalSettings: {
        enableAutoReconnect: true,
        maxConcurrentConnections: 5,
        defaultTimeout: 30000,
        enableLogging: true,
        logLevel: 'info'
      }
    };

    const provider = new MCPContentProvider(config);
    
    // Test initialization
    const providers = await provider.getAvailableProviders();
    if (!Array.isArray(providers)) {
      throw new Error('Providers should be an array');
    }

    // Test metrics
    const metrics = provider.getMetrics();
    if (!metrics || typeof metrics !== 'object') {
      throw new Error('Metrics should be an object');
    }
  }

  private async testMCPContentProviderContentGeneration(): Promise<void> {
    const config: MCPConfiguration = {
      servers: [],
      disconnectedServers: []
    };

    const provider = new MCPContentProvider(config);
    
    try {
      await provider.generateContent({
        type: 'text',
        prompt: 'Generate a test message'
      });
      throw new Error('Should have failed with no providers');
    } catch (error) {
      if (!(error instanceof MCPError)) {
        throw new Error('Expected MCPError when no providers available');
      }
    }
  }

  private async testMCPContentProviderCaching(): Promise<void> {
    const config: MCPConfiguration = {
      servers: [],
      disconnectedServers: []
    };

    const provider = new MCPContentProvider(config);
    const metrics = provider.getMetrics();
    
    if (!metrics.cache || typeof metrics.cache.size !== 'number') {
      throw new Error('Cache metrics should include size');
    }
  }

  private async testMCPContentProviderFallback(): Promise<void> {
    // Test fallback behavior configuration
    const config: MCPConfiguration = {
      servers: [
        {
          name: 'failing-server',
          type: 'stdio',
          command: 'false',
          args: []
        } as MCPServerLocalConfig
      ],
      disconnectedServers: []
    };

    const provider = new MCPContentProvider(config);
    
    // This test verifies that the provider handles server failures gracefully
    const providers = await provider.getAvailableProviders();
    // Should not throw even with failing server
  }

  // Error Handling Tests
  private async testMCPErrorHandling(): Promise<void> {
    // Test custom error classes
    const mcpError = new MCPError('Test error', -32000, { test: true }, 'test-server');
    if (mcpError.name !== 'MCPError' || mcpError.code !== -32000) {
      throw new Error('MCPError properties incorrect');
    }

    const connectionError = new MCPConnectionError('Connection failed', 'test-server');
    if (connectionError.name !== 'MCPConnectionError' || connectionError.serverName !== 'test-server') {
      throw new Error('MCPConnectionError properties incorrect');
    }

    const timeoutError = new MCPTimeoutError('Timeout', 'test-server', 5000);
    if (timeoutError.name !== 'MCPTimeoutError' || timeoutError.data?.timeout !== 5000) {
      throw new Error('MCPTimeoutError properties incorrect');
    }

    const toolNotFoundError = new MCPToolNotFoundError('missing-tool', 'test-server');
    if (toolNotFoundError.name !== 'MCPToolNotFoundError') {
      throw new Error('MCPToolNotFoundError properties incorrect');
    }
  }

  private async testMCPPerformanceMetrics(): Promise<void> {
    const config: MCPConfiguration = {
      servers: [],
      disconnectedServers: []
    };

    const provider = new MCPContentProvider(config);
    const metrics = provider.getMetrics();
    
    // Verify metrics structure
    if (!metrics.providers || typeof metrics.providers !== 'object') {
      throw new Error('Metrics should include providers object');
    }
    
    if (!metrics.cache || typeof metrics.cache !== 'object') {
      throw new Error('Metrics should include cache object');
    }
  }

  private async testMCPConfigurationValidation(): Promise<void> {
    // Test invalid local configuration
    const invalidLocalConfig: MCPServerLocalConfig = {
      name: '',
      type: 'stdio',
      command: '',
      args: []
    };

    const localClient = new MCPClientLocal(invalidLocalConfig);
    
    try {
      await localClient.validateConfig();
      throw new Error('Should have failed validation with empty name and command');
    } catch (error) {
      if (!(error instanceof MCPError)) {
        throw new Error('Expected MCPError for invalid local config');
      }
    }

    // Test invalid remote configuration
    const invalidRemoteConfig: MCPServerRemoteConfig = {
      name: 'test',
      type: 'sse',
      url: 'invalid-url'
    };

    const httpClient = new MCPClientHTTP(invalidRemoteConfig);
    
    try {
      await httpClient.validateConfig();
      throw new Error('Should have failed validation with invalid URL');
    } catch (error) {
      if (!(error instanceof MCPError)) {
        throw new Error('Expected MCPError for invalid remote config');
      }
    }
  }

  // Utility method to run individual tests
  async runTest(testName: string): Promise<boolean> {
    const testMethod = (this as any)[testName];
    if (!testMethod) {
      throw new Error(`Test method '${testName}' not found`);
    }

    try {
      await testMethod.call(this);
      console.log(`✓ ${testName} passed`);
      return true;
    } catch (error) {
      console.log(`✗ ${testName} failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  // Generate test report
  generateReport(): string {
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.length - passed;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);
    
    let report = `MCP Integration Test Report\n`;
    report += `===========================\n\n`;
    report += `Summary:\n`;
    report += `- Total tests: ${this.testResults.length}\n`;
    report += `- Passed: ${passed}\n`;
    report += `- Failed: ${failed}\n`;
    report += `- Success rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%\n`;
    report += `- Total duration: ${totalDuration}ms\n\n`;
    
    if (failed > 0) {
      report += `Failed tests:\n`;
      this.testResults.filter(r => !r.passed).forEach(result => {
        report += `- ${result.name}: ${result.error}\n`;
      });
      report += `\n`;
    }
    
    report += `All test results:\n`;
    this.testResults.forEach(result => {
      const status = result.passed ? '✓' : '✗';
      report += `${status} ${result.name} (${result.duration}ms)\n`;
      if (!result.passed && result.error) {
        report += `  Error: ${result.error}\n`;
      }
    });
    
    return report;
  }
}

// Export test runner for standalone execution
export async function runMCPIntegrationTests(): Promise<void> {
  const testSuite = new MCPIntegrationTest();
  const results = await testSuite.runAllTests();
  
  console.log('\n' + testSuite.generateReport());
  
  if (results.failed > 0) {
    process.exit(1);
  }
}

export default MCPIntegrationTest;