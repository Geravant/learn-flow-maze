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
  Loader2
} from 'lucide-react';

export const SimpleWebContainerDemo: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'supported' | 'not-supported'>('idle');
  const [error, setError] = useState<string>('');

  const checkWebContainerSupport = async () => {
    setStatus('checking');
    setError('');
    
    try {
      // Check if we're in the right environment
      if (typeof window === 'undefined') {
        throw new Error('WebContainers require a browser environment');
      }

      // Check for required features
      const requiredFeatures = {
        'SharedArrayBuffer': typeof SharedArrayBuffer !== 'undefined',
        'WebAssembly': typeof WebAssembly !== 'undefined',
        'Worker': typeof Worker !== 'undefined',
        'crossOriginIsolated': window.crossOriginIsolated || false,
        'WebSocket Token': typeof globalThis.__WS_TOKEN__ !== 'undefined' || 
                          typeof (window as any).__WS_TOKEN__ !== 'undefined'
      };

      console.log('WebContainer feature check:', requiredFeatures);

      const missingFeatures = Object.entries(requiredFeatures)
        .filter(([_, supported]) => !supported)
        .map(([feature]) => feature);

      if (missingFeatures.length > 0) {
        throw new Error(`Missing required features: ${missingFeatures.join(', ')}`);
      }

      // Try to import WebContainer API
      const { WebContainer } = await import('@webcontainer/api');
      
      console.log('✅ WebContainer API loaded successfully');
      setStatus('supported');
      
    } catch (err) {
      console.error('WebContainer support check failed:', err);
      setStatus('not-supported');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startSimpleDemo = async () => {
    setError(''); // Clear previous errors
    
    try {
      const { WebContainer } = await import('@webcontainer/api');
      
      // Boot WebContainer
      console.log('🚀 Booting WebContainer...');
      const webcontainer = await WebContainer.boot();
      console.log('✅ WebContainer booted successfully');
      
      // Create a simple project with proper WebContainer file format
      console.log('📁 Creating project files...');
      await webcontainer.mount({
        'package.json': {
          file: {
            contents: JSON.stringify({
              name: 'simple-demo',
              version: '1.0.0',
              scripts: {
                start: 'node index.js'
              }
            }, null, 2)
          }
        },
        'index.js': {
          file: {
            contents: `console.log('Hello from WebContainer!');
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('Architecture:', process.arch);
console.log('Current working directory:', process.cwd());
console.log('Available memory:', process.memoryUsage());
console.log('Environment variables:', Object.keys(process.env).slice(0, 5).join(', ') + '...');
console.log('✅ WebContainer Node.js demo completed successfully!');
`
          }
        }
      });
      
      // Run the demo
      console.log('📦 Starting demo script...');
      const process = await webcontainer.spawn('node', ['index.js']);
      
      // Capture output
      let output = '';
      process.output.pipeTo(new WritableStream({
        write(data) {
          console.log('📄 Output:', data);
          output += data;
        }
      }));
      
      const exitCode = await process.exit;
      console.log('🏁 Demo completed with exit code:', exitCode);
      
      if (exitCode === 0) {
        console.log('🎉 WebContainer demo completed successfully!');
        console.log('Full output:', output);
      } else {
        throw new Error(`Process exited with code ${exitCode}`);
      }
      
    } catch (err) {
      console.error('❌ Demo failed:', err);
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />;
      case 'supported':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'not-supported':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Container className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'checking':
        return 'default';
      case 'supported':
        return 'default';
      case 'not-supported':
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
          WebContainer Support Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span className="font-medium">Status:</span>
            <Badge variant={getStatusColor() as any}>
              {status === 'idle' ? 'Not Checked' : 
               status === 'checking' ? 'Checking...' :
               status === 'supported' ? 'Supported' : 'Not Supported'}
            </Badge>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={checkWebContainerSupport} disabled={status === 'checking'}>
              Check Support
            </Button>
            {status === 'supported' && (
              <Button onClick={startSimpleDemo} variant="outline">
                <Play className="w-4 h-4 mr-1" />
                Run Demo
              </Button>
            )}
          </div>
        </div>

        {error && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <strong>Error:</strong> {error}
            </AlertDescription>
          </Alert>
        )}

        {status === 'supported' && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              🎉 WebContainers are supported! You can run real Node.js environments in this browser.
            </AlertDescription>
          </Alert>
        )}

        {status === 'not-supported' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              WebContainers require specific browser features. Try:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Use Chrome, Edge, or Firefox (latest versions)</li>
                <li>Enable cross-origin isolation headers</li>
                <li>Use a development server with proper headers</li>
                <li>Check if SharedArrayBuffer is available</li>
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-gray-50 p-4 rounded-md text-sm">
          <h4 className="font-medium mb-2">About WebContainers:</h4>
          <p className="text-gray-600">
            WebContainers run real Node.js environments entirely in your browser. They provide:
          </p>
          <ul className="list-disc list-inside mt-2 text-gray-600 space-y-1">
            <li>Full npm package ecosystem</li>
            <li>Real file system operations</li>
            <li>Network requests and servers</li>
            <li>Complete development environment</li>
          </ul>
          <p className="mt-2 text-gray-600">
            Perfect for running MCP servers without any external setup!
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimpleWebContainerDemo;