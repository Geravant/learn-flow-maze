interface TextToken {
  text: string;
  bounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  element: Element;
  type: 'word' | 'phrase' | 'sentence';
  context: string; // The larger context this token belongs to
}

interface TapLocation {
  x: number;
  y: number;
  element: Element;
}

interface ContextualTokens {
  primaryTokens: string[]; // Closest tokens to tap
  contextualConcepts: string[]; // Related concepts based on those tokens
  area: string; // What area was tapped (definition, examples, etc.)
}

class TextTokenService {
  
  // Extract text tokens from a given element and its children
  extractTokensFromElement(element: Element, context: string = 'general'): TextToken[] {
    const tokens: TextToken[] = [];
    
    // Get all text nodes
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    
    let node: Text | null;
    while (node = walker.nextNode() as Text) {
      const parentElement = node.parentElement;
      if (!parentElement || this.shouldSkipElement(parentElement)) continue;
      
      const text = node.textContent?.trim();
      if (!text || text.length < 3) continue; // Skip very short text
      
      // Split into words and phrases
      const words = this.tokenizeText(text);
      
      words.forEach((word, index) => {
        const bounds = this.getTextBounds(node, word, index);
        if (bounds) {
          tokens.push({
            text: word,
            bounds,
            element: parentElement,
            type: this.determineTokenType(word),
            context
          });
        }
      });
    }
    
    return tokens;
  }
  
  // Find tokens near a tap location
  findTokensNearTap(tapLocation: TapLocation, maxDistance: number = 50): TextToken[] {
    // Safety check for null element
    if (!tapLocation.element) {
      console.warn('❌ No element found in tap location, falling back to document');
      return [];
    }
    
    const cardElement = tapLocation.element.closest('.learning-card') || tapLocation.element;
    const context = this.determineContextFromElement(tapLocation.element);
    
    console.log('🎯 Finding tokens in element:', cardElement.className, 'with context:', context);
    
    const allTokens = this.extractTokensFromElement(cardElement, context);
    
    // Calculate distance from tap to each token
    const tokensWithDistance = allTokens.map(token => ({
      token,
      distance: this.calculateDistance(tapLocation, token)
    }));
    
    // Filter and sort by distance
    return tokensWithDistance
      .filter(({ distance }) => distance <= maxDistance)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5) // Take closest 5 tokens
      .map(({ token }) => token);
  }
  
  // Generate contextual concepts based on extracted tokens
  generateContextualConcepts(tokens: TextToken[], currentTopic: string): ContextualTokens {
    if (tokens.length === 0) {
      return {
        primaryTokens: [],
        contextualConcepts: this.getDefaultConcepts(currentTopic),
        area: 'general'
      };
    }
    
    const primaryTokens = tokens.map(t => t.text);
    const area = tokens[0]?.context || 'general';
    
    // Generate concepts based on the tokens found
    const contextualConcepts = this.generateConceptsFromTokens(tokens, currentTopic);
    
    return {
      primaryTokens,
      contextualConcepts,
      area
    };
  }
  
  // Tokenize text into meaningful words/phrases
  private tokenizeText(text: string): string[] {
    // Split by common delimiters but preserve meaningful phrases
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words: string[] = [];
    
    sentences.forEach(sentence => {
      // Extract individual words
      const sentenceWords = sentence.split(/\s+/).filter(w => w.length > 2);
      words.push(...sentenceWords);
      
      // Extract meaningful phrases (2-3 words)
      for (let i = 0; i < sentenceWords.length - 1; i++) {
        if (sentenceWords[i].length > 3 && sentenceWords[i + 1].length > 3) {
          words.push(`${sentenceWords[i]} ${sentenceWords[i + 1]}`);
        }
      }
    });
    
    return words.filter(w => w.trim().length > 0);
  }
  
  // Get bounding box for a specific text token
  private getTextBounds(textNode: Text, token: string, tokenIndex: number): TextToken['bounds'] | null {
    try {
      const range = document.createRange();
      const fullText = textNode.textContent || '';
      const tokenStart = fullText.indexOf(token);
      
      if (tokenStart === -1) return null;
      
      range.setStart(textNode, tokenStart);
      range.setEnd(textNode, tokenStart + token.length);
      
      const rect = range.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom
      };
    } catch (error) {
      return null;
    }
  }
  
  // Calculate distance from tap to token center
  private calculateDistance(tapLocation: TapLocation, token: TextToken): number {
    const tokenCenterX = (token.bounds.left + token.bounds.right) / 2;
    const tokenCenterY = (token.bounds.top + token.bounds.bottom) / 2;
    
    return Math.sqrt(
      Math.pow(tapLocation.x - tokenCenterX, 2) + 
      Math.pow(tapLocation.y - tokenCenterY, 2)
    );
  }
  
  // Determine context from the tapped element
  private determineContextFromElement(element: Element): string {
    if (!element) {
      console.warn('❌ No element provided for context determination');
      return 'general';
    }
    
    try {
      if (element.closest('[data-section="definition"]') || element.textContent?.includes('Description')) {
        return 'definition';
      } else if (element.closest('[data-section="examples"]') || element.textContent?.includes('Examples')) {
        return 'examples';
      } else if (element.closest('[data-section="visualAid"]') || element.textContent?.includes('Visual')) {
        return 'visualAid';
      } else if (element.closest('[data-section="keyPoints"]') || element.textContent?.includes('Key Points')) {
        return 'keyPoints';
      }
    } catch (error) {
      console.warn('❌ Error determining context from element:', error);
    }
    
    return 'general';
  }
  
  // Determine if token is a word, phrase, or sentence
  private determineTokenType(text: string): TextToken['type'] {
    const wordCount = text.split(/\s+/).length;
    
    if (wordCount === 1) return 'word';
    if (wordCount <= 4) return 'phrase';
    return 'sentence';
  }
  
  // Check if element should be skipped during tokenization
  private shouldSkipElement(element: Element): boolean {
    const tagName = element.tagName.toLowerCase();
    const skipTags = ['script', 'style', 'svg', 'path', 'button'];
    return skipTags.includes(tagName);
  }
  
  // Generate concepts from extracted tokens
  private generateConceptsFromTokens(tokens: TextToken[], currentTopic: string): string[] {
    const concepts: string[] = [];
    const uniqueWords = new Set<string>();
    
    tokens.forEach(token => {
      // Extract meaningful words from tokens
      const words = token.text.split(/\s+/).filter(w => w.length > 3);
      words.forEach(word => uniqueWords.add(word.toLowerCase()));
    });
    
    const wordArray = Array.from(uniqueWords);
    
    // Generate related concepts based on the context and words found
    wordArray.slice(0, 3).forEach(word => {
      concepts.push(`${word.charAt(0).toUpperCase() + word.slice(1)} in ${currentTopic}`);
      concepts.push(`Advanced ${word.charAt(0).toUpperCase() + word.slice(1)}`);
    });
    
    // Add context-specific concepts
    if (tokens[0]?.context === 'definition') {
      concepts.push(`${currentTopic} Fundamentals`, `Basic ${currentTopic}`, `Understanding ${currentTopic}`);
    } else if (tokens[0]?.context === 'examples') {
      concepts.push(`${currentTopic} Applications`, `Real-world ${currentTopic}`, `${currentTopic} Use Cases`);
    } else if (tokens[0]?.context === 'visualAid') {
      concepts.push(`${currentTopic} Diagrams`, `Visual ${currentTopic}`, `${currentTopic} Models`);
    } else {
      concepts.push(`${currentTopic} Research`, `${currentTopic} Theory`, `${currentTopic} Methods`);
    }
    
    // Remove duplicates and limit to 6 concepts
    return [...new Set(concepts)].slice(0, 6);
  }
  
  // Default concepts when no tokens are found
  private getDefaultConcepts(currentTopic: string): string[] {
    return [
      `${currentTopic} Basics`,
      `Advanced ${currentTopic}`,
      `${currentTopic} Applications`,
      `${currentTopic} Theory`,
      `${currentTopic} Research`,
      `Modern ${currentTopic}`
    ];
  }
  
  // Convert pointer event to tap location
  extractTapLocation(event: React.PointerEvent): TapLocation {
    // Try multiple ways to get the element
    const element = (event.currentTarget || event.target || document.elementFromPoint(event.clientX, event.clientY)) as Element;
    
    console.log('🎯 Extracting tap location:', {
      clientX: event.clientX,
      clientY: event.clientY,
      currentTarget: event.currentTarget,
      target: event.target,
      elementFound: !!element,
      elementClass: element?.className
    });
    
    return {
      x: event.clientX,
      y: event.clientY,
      element: element
    };
  }
}

// Export singleton instance
export const textTokenService = new TextTokenService();
export default textTokenService;
export type { TextToken, TapLocation, ContextualTokens };