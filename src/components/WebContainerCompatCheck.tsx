import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Container, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface CompatibilityCheck {
  name: string;
  supported: boolean;
  required: boolean;
  description: string;
}

export const WebContainerCompatCheck: React.FC = () => {
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<CompatibilityCheck[]>([]);
  const [overallSupport, setOverallSupport] = useState<boolean | null>(null);
  const [webContainerAvailable, setWebContainerAvailable] = useState(false);

  useEffect(() => {
    // Run basic checks immediately
    runBasicChecks();
  }, []);

  const runBasicChecks = () => {
    const basicChecks: CompatibilityCheck[] = [
      {
        name: 'Browser Environment',
        supported: typeof window !== 'undefined',
        required: true,
        description: 'Running in a browser environment'
      },
      {
        name: 'SharedArrayBuffer',
        supported: typeof SharedArrayBuffer !== 'undefined',
        required: true,
        description: 'Required for WebContainer threading'
      },
      {
        name: 'WebAssembly',
        supported: typeof WebAssembly !== 'undefined',
        required: true,
        description: 'Required for WebContainer runtime'
      },
      {
        name: 'Web Workers',
        supported: typeof Worker !== 'undefined',
        required: true,
        description: 'Required for background processing'
      },
      {
        name: 'Cross-Origin Isolation',
        supported: window.crossOriginIsolated === true,
        required: true,
        description: 'Required security context for SharedArrayBuffer'
      },
      {
        name: 'WebSocket Token',
        supported: typeof globalThis.__WS_TOKEN__ !== 'undefined' || 
                   typeof (window as any).__WS_TOKEN__ !== 'undefined',
        required: true,
        description: 'WebContainer security token (set at runtime)'
      },
      {
        name: 'Secure Context (HTTPS)',
        supported: window.isSecureContext,
        required: false,
        description: 'HTTPS context for enhanced security'
      }
    ];

    setChecks(basicChecks);
    
    const requiredPassing = basicChecks
      .filter(check => check.required)
      .every(check => check.supported);
    
    setOverallSupport(requiredPassing);
  };

  const testWebContainerAPI = async () => {
    setChecking(true);
    
    try {
      // Try to import the WebContainer API
      const { WebContainer } = await import('@webcontainer/api');
      
      console.log('✅ WebContainer API imported successfully');
      setWebContainerAvailable(true);
      
      // Add to checks
      const updatedChecks = [...checks, {
        name: 'WebContainer API',
        supported: true,
        required: true,
        description: 'WebContainer API successfully imported'
      }];
      
      setChecks(updatedChecks);
      
    } catch (error) {
      console.error('❌ WebContainer API import failed:', error);
      
      const updatedChecks = [...checks, {
        name: 'WebContainer API',
        supported: false,
        required: true,
        description: `Failed to import: ${error instanceof Error ? error.message : String(error)}`
      }];
      
      setChecks(updatedChecks);
      setOverallSupport(false);
    } finally {
      setChecking(false);
    }
  };

  const getCheckIcon = (check: CompatibilityCheck) => {
    if (check.supported) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    } else if (check.required) {
      return <AlertCircle className="w-4 h-4 text-red-500" />;
    } else {
      return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getOverallStatus = () => {
    if (overallSupport === null) return 'Not Checked';
    if (webContainerAvailable) return 'Fully Compatible';
    if (overallSupport) return 'Basic Support';
    return 'Not Compatible';
  };

  const getOverallStatusColor = () => {
    if (overallSupport === null) return 'secondary';
    if (webContainerAvailable) return 'default';
    if (overallSupport) return 'default';
    return 'destructive';
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Container className="w-5 h-5" />
          WebContainer Compatibility Check
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">Overall Status:</span>
            <Badge variant={getOverallStatusColor() as any}>
              {getOverallStatus()}
            </Badge>
          </div>
          
          {overallSupport && !webContainerAvailable && (
            <Button onClick={testWebContainerAPI} disabled={checking}>
              {checking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Testing API...
                </>
              ) : (
                'Test WebContainer API'
              )}
            </Button>
          )}
        </div>

        {/* Compatibility Checks */}
        <div className="space-y-3">
          <h3 className="font-medium text-lg">Compatibility Requirements</h3>
          <div className="space-y-2">
            {checks.map((check) => (
              <div 
                key={check.name}
                className={`flex items-center justify-between p-3 rounded-md border ${
                  check.supported 
                    ? 'bg-green-50 border-green-200' 
                    : check.required 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {getCheckIcon(check)}
                  <div>
                    <div className="font-medium">{check.name}</div>
                    <div className="text-sm text-gray-600">{check.description}</div>
                  </div>
                </div>
                <Badge variant={check.required ? 'default' : 'outline'} size="sm">
                  {check.required ? 'Required' : 'Optional'}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Troubleshooting */}
        {overallSupport === false && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <strong>WebContainers are not supported in this environment.</strong>
                <p>To enable WebContainer support:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Use a modern browser (Chrome 92+, Firefox 95+, Safari 16+)</li>
                  <li>Ensure cross-origin isolation headers are set</li>
                  <li>Run on HTTPS or localhost</li>
                  <li>Check that SharedArrayBuffer is available</li>
                </ul>
                <div className="mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open('https://webcontainers.io/guides/browser-support', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-1" />
                    Browser Support Guide
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {webContainerAvailable && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              🎉 WebContainers are fully supported! You can now run Node.js environments directly in your browser.
            </AlertDescription>
          </Alert>
        )}

        {/* Current Environment Info */}
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="font-medium mb-2">Current Environment:</h4>
          <div className="text-sm space-y-1 text-gray-600">
            <div>User Agent: {navigator.userAgent}</div>
            <div>Platform: {navigator.platform}</div>
            <div>Language: {navigator.language}</div>
            <div>Online: {navigator.onLine ? 'Yes' : 'No'}</div>
            <div>Secure Context: {window.isSecureContext ? 'Yes' : 'No'}</div>
            <div>Cross-Origin Isolated: {window.crossOriginIsolated ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default WebContainerCompatCheck;