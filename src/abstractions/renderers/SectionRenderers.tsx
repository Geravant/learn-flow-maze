// Section Renderers - Generic section rendering components for different content types
// Provides flexible, themed rendering of various section types

import React from 'react';
import { CardSection, CardTheme, defaultTheme } from '../interfaces';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { 
  FileText, 
  Image, 
  Video, 
  Code, 
  List, 
  Quote, 
  AlertTriangle,
  Info,
  CheckCircle,
  Lightbulb,
  Link2,
  Download,
  Play
} from 'lucide-react';

export interface SectionRendererProps {
  section: CardSection;
  theme?: CardTheme;
  onSectionTap?: (section: CardSection) => void;
  isInteractive?: boolean;
  className?: string;
}

export interface CustomSectionRenderer {
  (props: SectionRendererProps): React.ReactNode;
}

// Base section renderer
export function BaseSectionRenderer({ 
  section, 
  theme = defaultTheme, 
  onSectionTap, 
  isInteractive = false,
  className = ""
}: SectionRendererProps) {
  const handleClick = () => {
    if (isInteractive && onSectionTap) {
      onSectionTap(section);
    }
  };

  const baseClasses = `
    transition-all duration-200 
    ${isInteractive ? 'cursor-pointer hover:bg-muted/50' : ''} 
    ${className}
  `;

  // Route to specific renderer based on section type
  switch (section.type) {
    case 'text':
      return <TextSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    case 'image':
      return <ImageSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    case 'video':
      return <VideoSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    case 'code':
      return <CodeSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    case 'list':
      return <ListSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    case 'quote':
      return <QuoteSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    case 'alert':
      return <AlertSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    case 'interactive':
      return <InteractiveSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    case 'progress':
      return <ProgressSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    case 'link':
      return <LinkSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
    default:
      return <DefaultSectionRenderer {...{ section, theme, onSectionTap, isInteractive, className: baseClasses }} />;
  }
}

// Text section renderer
export function TextSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const content = typeof section.content === 'string' ? section.content : JSON.stringify(section.content);
  
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: theme?.primaryColor }}>
          <FileText size={16} />
          {section.title}
        </h3>
      )}
      <div 
        className="prose prose-sm max-w-none leading-relaxed"
        style={{ color: theme?.textColor }}
        dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br/>') }}
      />
      {section.metadata?.tags && (
        <div className="flex flex-wrap gap-1 mt-3">
          {section.metadata.tags.map((tag: string, index: number) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

// Image section renderer
export function ImageSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const imageData = typeof section.content === 'object' ? section.content : { url: section.content };
  
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: theme?.primaryColor }}>
          <Image size={16} />
          {section.title}
        </h3>
      )}
      <div className="relative group">
        <img
          src={imageData.url}
          alt={imageData.alt || section.title || 'Section image'}
          className="w-full rounded-lg shadow-sm transition-transform group-hover:scale-[1.02]"
        />
        {imageData.caption && (
          <p className="text-sm text-muted-foreground mt-2 text-center">
            {imageData.caption}
          </p>
        )}
        {isInteractive && (
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
            <Button variant="secondary" size="sm">
              View Full Size
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// Video section renderer
export function VideoSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const videoData = typeof section.content === 'object' ? section.content : { url: section.content };
  
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: theme?.primaryColor }}>
          <Video size={16} />
          {section.title}
        </h3>
      )}
      <div className="relative group">
        <video
          src={videoData.url}
          poster={videoData.thumbnail}
          controls
          className="w-full rounded-lg shadow-sm"
          style={{ maxHeight: '300px' }}
        >
          Your browser does not support the video tag.
        </video>
        {videoData.description && (
          <p className="text-sm text-muted-foreground mt-2">
            {videoData.description}
          </p>
        )}
      </div>
    </div>
  );
}

// Code section renderer
export function CodeSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const codeData = typeof section.content === 'object' ? section.content : { code: section.content };
  
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: theme?.primaryColor }}>
          <Code size={16} />
          {section.title}
        </h3>
      )}
      <div className="relative">
        <pre className="bg-muted/50 p-4 rounded-lg overflow-x-auto text-sm font-mono">
          <code className={`language-${codeData.language || 'text'}`}>
            {codeData.code}
          </code>
        </pre>
        {codeData.language && (
          <Badge 
            variant="secondary" 
            className="absolute top-2 right-2 text-xs"
          >
            {codeData.language}
          </Badge>
        )}
        {isInteractive && (
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(codeData.code);
            }}
          >
            Copy Code
          </Button>
        )}
      </div>
    </div>
  );
}

// List section renderer
export function ListSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const listData = typeof section.content === 'object' ? section.content : { items: [section.content] };
  const isOrdered = listData.type === 'ordered';
  
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: theme?.primaryColor }}>
          <List size={16} />
          {section.title}
        </h3>
      )}
      {isOrdered ? (
        <ol className="space-y-2 ml-6 list-decimal">
          {listData.items.map((item: string, index: number) => (
            <li key={index} className="text-sm leading-relaxed" style={{ color: theme?.textColor }}>
              {item}
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-2 ml-6 list-disc">
          {listData.items.map((item: string, index: number) => (
            <li key={index} className="text-sm leading-relaxed" style={{ color: theme?.textColor }}>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Quote section renderer
export function QuoteSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const quoteData = typeof section.content === 'object' ? section.content : { text: section.content };
  
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: theme?.primaryColor }}>
          <Quote size={16} />
          {section.title}
        </h3>
      )}
      <blockquote className="border-l-4 pl-4 py-2" style={{ borderColor: theme?.primaryColor }}>
        <p className="text-lg font-medium italic mb-2" style={{ color: theme?.textColor }}>
          "{quoteData.text}"
        </p>
        {quoteData.author && (
          <footer className="text-sm text-muted-foreground">
            — {quoteData.author}
            {quoteData.source && (
              <span>, <em>{quoteData.source}</em></span>
            )}
          </footer>
        )}
      </blockquote>
    </div>
  );
}

// Alert section renderer
export function AlertSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const alertData = typeof section.content === 'object' ? section.content : { message: section.content, type: 'info' };
  
  const alertConfig = {
    info: { icon: Info, bgClass: 'bg-blue-50 border-blue-200', iconColor: 'text-blue-600' },
    warning: { icon: AlertTriangle, bgClass: 'bg-yellow-50 border-yellow-200', iconColor: 'text-yellow-600' },
    error: { icon: AlertTriangle, bgClass: 'bg-red-50 border-red-200', iconColor: 'text-red-600' },
    success: { icon: CheckCircle, bgClass: 'bg-green-50 border-green-200', iconColor: 'text-green-600' },
    tip: { icon: Lightbulb, bgClass: 'bg-purple-50 border-purple-200', iconColor: 'text-purple-600' }
  };
  
  const config = alertConfig[alertData.type as keyof typeof alertConfig] || alertConfig.info;
  const IconComponent = config.icon;
  
  return (
    <div 
      className={`p-4 rounded-lg border ${config.bgClass} ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: theme?.primaryColor }}>
          <IconComponent size={16} className={config.iconColor} />
          {section.title}
        </h3>
      )}
      <div className="flex items-start gap-3">
        <IconComponent size={20} className={`flex-shrink-0 mt-0.5 ${config.iconColor}`} />
        <p className="text-sm leading-relaxed" style={{ color: theme?.textColor }}>
          {alertData.message}
        </p>
      </div>
    </div>
  );
}

// Interactive section renderer
export function InteractiveSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const interactiveData = typeof section.content === 'object' ? section.content : { type: 'button', label: 'Click me' };
  
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3" style={{ color: theme?.primaryColor }}>
          {section.title}
        </h3>
      )}
      <div className="space-y-3">
        {interactiveData.description && (
          <p className="text-sm text-muted-foreground">
            {interactiveData.description}
          </p>
        )}
        <Button
          variant="default"
          size="sm"
          style={{ backgroundColor: theme?.primaryColor }}
          onClick={(e) => {
            e.stopPropagation();
            onSectionTap?.(section);
          }}
        >
          {interactiveData.label}
        </Button>
      </div>
    </div>
  );
}

// Progress section renderer
export function ProgressSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const progressData = typeof section.content === 'object' ? section.content : { value: 0, max: 100 };
  const percentage = (progressData.value / progressData.max) * 100;
  
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3" style={{ color: theme?.primaryColor }}>
          {section.title}
        </h3>
      )}
      <div className="space-y-2">
        {progressData.label && (
          <div className="flex justify-between text-sm">
            <span style={{ color: theme?.textColor }}>{progressData.label}</span>
            <span className="text-muted-foreground">
              {Math.round(percentage)}%
            </span>
          </div>
        )}
        <Progress value={percentage} className="w-full" />
        {progressData.description && (
          <p className="text-xs text-muted-foreground mt-2">
            {progressData.description}
          </p>
        )}
      </div>
    </div>
  );
}

// Link section renderer
export function LinkSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  const linkData = typeof section.content === 'object' ? section.content : { url: section.content, title: 'Link' };
  
  return (
    <div 
      className={`p-4 rounded-lg ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3 flex items-center gap-2" style={{ color: theme?.primaryColor }}>
          <Link2 size={16} />
          {section.title}
        </h3>
      )}
      <Card className="p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h4 className="font-medium text-sm mb-1" style={{ color: theme?.textColor }}>
              {linkData.title}
            </h4>
            {linkData.description && (
              <p className="text-xs text-muted-foreground mb-2">
                {linkData.description}
              </p>
            )}
            <p className="text-xs font-mono text-muted-foreground truncate">
              {linkData.url}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              window.open(linkData.url, '_blank');
            }}
          >
            Open
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Default fallback renderer
export function DefaultSectionRenderer({ section, theme, onSectionTap, isInteractive, className }: SectionRendererProps) {
  return (
    <div 
      className={`p-4 rounded-lg border border-dashed ${className}`}
      onClick={() => isInteractive && onSectionTap?.(section)}
    >
      {section.title && (
        <h3 className="font-semibold mb-3" style={{ color: theme?.primaryColor }}>
          {section.title}
        </h3>
      )}
      <div className="text-center text-muted-foreground py-4">
        <p className="text-sm">
          Unsupported section type: <code className="bg-muted px-1 rounded">{section.type}</code>
        </p>
        <pre className="text-xs mt-2 bg-muted/50 p-2 rounded overflow-x-auto">
          {JSON.stringify(section.content, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// Registry for custom section renderers
export class SectionRendererRegistry {
  private static renderers: Map<string, CustomSectionRenderer> = new Map();

  static register(sectionType: string, renderer: CustomSectionRenderer) {
    this.renderers.set(sectionType, renderer);
  }

  static unregister(sectionType: string) {
    this.renderers.delete(sectionType);
  }

  static get(sectionType: string): CustomSectionRenderer | undefined {
    return this.renderers.get(sectionType);
  }

  static has(sectionType: string): boolean {
    return this.renderers.has(sectionType);
  }

  static getAll(): Map<string, CustomSectionRenderer> {
    return new Map(this.renderers);
  }
}

// Enhanced section renderer that supports custom renderers
export function EnhancedSectionRenderer(props: SectionRendererProps) {
  const customRenderer = SectionRendererRegistry.get(props.section.type);
  
  if (customRenderer) {
    return <>{customRenderer(props)}</>;
  }
  
  return <BaseSectionRenderer {...props} />;
}

export default EnhancedSectionRenderer;