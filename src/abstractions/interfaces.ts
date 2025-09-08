// Core abstraction interfaces for the Generic Card System
// Based on UI-logic-abstraction.md design document

// Generic card content interface
export interface CardContent {
  id: string;
  title: string;
  sections: CardSection[];
  metadata: Record<string, any>;
  tags?: string[];
  createdAt: Date;
  lastModified: Date;
}

// Generic card section
export interface CardSection {
  id: string;
  type: string; // "text", "list", "image", "code", "custom"
  title?: string;
  content: any;
  loading?: boolean;
  error?: string;
  priority: number; // For progressive loading order
  metadata: Record<string, any>;
}

// Generic cached card
export interface CachedCard {
  id: string;
  content: CardContent;
  generatedAssets?: {
    images?: string[];
    audio?: string[];
    videos?: string[];
  };
  loadingProgress: number; // 0-100
  isFullyLoaded: boolean;
  stackPosition?: number;
  lastAccessed: Date;
  createdAt: Date;
  metadata: Record<string, any>;
}

// Generic content generation interface
export interface ContentProvider {
  name: string;
  generateContent(prompt: string, options?: any): Promise<CardContent>;
  generateSection(
    cardId: string, 
    sectionType: string, 
    context: any
  ): Promise<CardSection>;
  validateContent(content: CardContent): boolean;
  getSupportedSectionTypes(): string[];
}

// Progressive content loading
export interface ProgressiveContentProvider extends ContentProvider {
  generateProgressively(
    prompt: string,
    onSectionComplete: (section: CardSection) => void,
    options?: any
  ): Promise<CardContent>;
}

// Card actions interface
export interface CardActions {
  onSwipeUp?: (content: CardContent) => void;
  onSwipeDown?: (content: CardContent) => void;
  onSwipeLeft?: (content: CardContent) => void;
  onSwipeRight?: (content: CardContent) => void;
  onDoubleTap?: (content: CardContent, location: {x: number, y: number}) => void;
  onLongPress?: (content: CardContent) => void;
  onSectionTap?: (section: CardSection, content: CardContent) => void;
}

// Card theme interface
export interface CardTheme {
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  sectionStyles: Record<string, React.CSSProperties>;
}

// Generic card display component props
export interface GenericCardProps {
  content: CardContent;
  cachedAssets?: {
    images?: string[];
    audio?: string[];
    videos?: string[];
  };
  actions: CardActions;
  isActive?: boolean;
  renderCustomSection?: (section: CardSection) => React.ReactNode;
  theme?: CardTheme;
}

// Session configuration
export interface SessionConfiguration {
  name: string;
  maxCacheSize: number;
  enableProgressiveLoading: boolean;
  enableAssetGeneration: boolean;
  supportedGestures: string[];
  theme: CardTheme;
  placeholderProvider?: PlaceholderProvider;
}

// Placeholder provider interface
export interface PlaceholderProvider {
  generatePlaceholder(prompt: string): Promise<string>;
  generateSectionPlaceholder(sectionType: string, context: any): Promise<string>;
}

// Session statistics
export interface SessionStats {
  cardsGenerated: number;
  totalTime: number;
  averageLoadTime: number;
  errorsEncountered: number;
  cacheHitRate: number;
}

// Generic session props
export interface GenericSessionProps {
  contentProvider: ContentProvider;
  initialPrompt?: string;
  sessionConfig: SessionConfiguration;
  onComplete?: (stats: SessionStats) => void;
  onError?: (error: Error) => void;
}

// Default themes
export const defaultTheme: CardTheme = {
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
  backgroundColor: '#ffffff',
  textColor: '#1e293b',
  sectionStyles: {
    text: { padding: '16px', lineHeight: '1.6' },
    list: { padding: '16px' },
    image: { padding: '8px', textAlign: 'center' as const },
    code: { 
      padding: '16px', 
      backgroundColor: '#f8fafc', 
      fontFamily: 'monospace',
      borderRadius: '8px'
    },
    custom: { padding: '16px' }
  }
};

export const learningTheme: CardTheme = {
  primaryColor: '#10b981',
  secondaryColor: '#6b7280',
  backgroundColor: '#f0fdf4',
  textColor: '#065f46',
  sectionStyles: {
    text: { padding: '20px', lineHeight: '1.7', fontSize: '16px' },
    list: { padding: '20px' },
    image: { padding: '12px', textAlign: 'center' as const },
    code: { 
      padding: '20px', 
      backgroundColor: '#ecfdf5', 
      fontFamily: 'monospace',
      borderRadius: '12px',
      border: '1px solid #10b981'
    },
    custom: { padding: '20px' }
  }
};

export const codeExplorerTheme: CardTheme = {
  primaryColor: '#8b5cf6',
  secondaryColor: '#6b7280',
  backgroundColor: '#faf5ff',
  textColor: '#581c87',
  sectionStyles: {
    text: { padding: '16px', lineHeight: '1.6' },
    list: { padding: '16px' },
    image: { padding: '8px', textAlign: 'center' as const },
    code: { 
      padding: '20px', 
      backgroundColor: '#f3e8ff', 
      fontFamily: 'JetBrains Mono, monospace',
      borderRadius: '8px',
      border: '1px solid #8b5cf6'
    },
    custom: { padding: '16px' }
  }
};

export const researchTheme: CardTheme = {
  primaryColor: '#dc2626',
  secondaryColor: '#6b7280',
  backgroundColor: '#fef2f2',
  textColor: '#7f1d1d',
  sectionStyles: {
    text: { padding: '20px', lineHeight: '1.8', fontSize: '15px' },
    list: { padding: '20px' },
    image: { padding: '12px', textAlign: 'center' as const },
    code: { 
      padding: '16px', 
      backgroundColor: '#fee2e2', 
      fontFamily: 'monospace',
      borderRadius: '8px'
    },
    custom: { padding: '20px' }
  }
};