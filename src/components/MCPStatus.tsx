import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Network, AlertCircle, CheckCircle } from 'lucide-react';
import { useMCP } from '@/hooks/useMCP';
import { useNavigate } from 'react-router-dom';

interface MCPStatusProps {
  showLabel?: boolean;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'badge' | 'button' | 'indicator';
}

export const MCPStatus: React.FC<MCPStatusProps> = ({ 
  showLabel = false, 
  size = 'sm',
  variant = 'badge'
}) => {
  const { isInitialized, isLoading, error, getAvailableProviders } = useMCP();
  const [providers, setProviders] = React.useState<any[]>([]);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isInitialized) {
      getAvailableProviders().then(setProviders).catch(console.error);
    }
  }, [isInitialized, getAvailableProviders]);

  const connectedCount = providers.filter(p => p.connected).length;
  const totalCount = providers.length;

  const getStatusColor = () => {
    if (isLoading) return 'bg-yellow-500';
    if (error) return 'bg-red-500';
    if (connectedCount > 0) return 'bg-green-500';
    return 'bg-gray-500';
  };

  const getStatusIcon = () => {
    if (isLoading) return <Network className="w-3 h-3 animate-pulse" />;
    if (error) return <AlertCircle className="w-3 h-3" />;
    if (connectedCount > 0) return <CheckCircle className="w-3 h-3" />;
    return <Network className="w-3 h-3" />;
  };

  const getStatusText = () => {
    if (isLoading) return 'Initializing MCP';
    if (error) return 'MCP Error';
    if (connectedCount > 0) return `${connectedCount}/${totalCount} MCP`;
    if (totalCount > 0) return 'MCP Offline';
    return 'No MCP Servers';
  };

  if (variant === 'indicator') {
    return (
      <div className="flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        {showLabel && (
          <span className="text-xs text-gray-600">{getStatusText()}</span>
        )}
      </div>
    );
  }

  if (variant === 'button') {
    return (
      <Button
        size={size}
        variant="outline"
        onClick={() => navigate('/mcp')}
        className="flex items-center gap-1"
      >
        {getStatusIcon()}
        {showLabel && <span className="text-xs">{getStatusText()}</span>}
      </Button>
    );
  }

  return (
    <Badge
      variant={error ? 'destructive' : connectedCount > 0 ? 'default' : 'secondary'}
      className="flex items-center gap-1 cursor-pointer hover:opacity-80"
      onClick={() => navigate('/mcp')}
    >
      {getStatusIcon()}
      {showLabel && <span className="text-xs">{getStatusText()}</span>}
    </Badge>
  );
};

export default MCPStatus;