import React from 'react';
import { Text } from 'ink';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';

// Configure marked to use the terminal renderer with default settings
marked.setOptions({
  renderer: new (TerminalRenderer as any)()
});

/**
 * Clean markdown content to fix invalid language identifiers in code blocks
 * This prevents errors from marked-terminal about unknown languages
 */
function cleanMarkdownContent(content: string): string {
  // Fix common invalid language identifiers in code blocks
  // Pattern: ```language or ``` language
  return content.replace(/```(\s*)(pow|powers|powershell)(\s*\n)/gi, '```$1powershell$3')
                 .replace(/```(\s*)(sh|shell)(\s*\n)/gi, '```$1bash$3');
}

export function MarkdownRenderer({ content }: { content: string }) {
  try {
    // Clean content before parsing to fix invalid language identifiers
    const cleanedContent = cleanMarkdownContent(content);
    
    // Temporarily suppress language errors during parsing
    const originalError = console.error;
    const originalWarn = console.warn;
    
    console.error = (...args: any[]) => {
      const message = args.join(' ');
      // Suppress common language errors from marked-terminal
      if (message.includes('Could not find the language') && 
          (message.includes('pow') || message.includes('powers'))) {
        return; // Silently ignore
      }
      originalError.apply(console, args);
    };
    
    console.warn = (...args: any[]) => {
      const message = args.join(' ');
      // Suppress common language warnings from marked-terminal
      if (message.includes('Could not find the language') && 
          (message.includes('pow') || message.includes('powers'))) {
        return; // Silently ignore
      }
      originalWarn.apply(console, args);
    };
    
    try {
      // Use marked.parse for synchronous parsing
      const result = marked.parse(cleanedContent);
      
      // Restore console methods
      console.error = originalError;
      console.warn = originalWarn;
      
      // Handle both sync and async results
      const rendered = typeof result === 'string' ? result : cleanedContent;
      return <Text>{rendered}</Text>;
    } finally {
      // Always restore console methods
      console.error = originalError;
      console.warn = originalWarn;
    }
  } catch (error) {
    // Fallback to plain text if markdown parsing fails
    // Only log non-suppressed errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!errorMessage.includes('Could not find the language')) {
      console.error('Markdown rendering error:', error);
    }
    return <Text>{content}</Text>;
  }
}