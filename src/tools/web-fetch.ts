import type { ToolResult } from "../types/index.js";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

export interface WebFetchOptions {
  prompt?: string;
}

interface CacheEntry {
  content: string;
  url: string;
  timestamp: number;
}

/**
 * WebFetchTool - Fetch and extract content from URLs
 * Converts HTML to Markdown for easy consumption
 * Includes 15-minute self-cleaning cache
 */
export class WebFetchTool {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes
  private turndown: TurndownService;

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: "atx",
      codeBlockStyle: "fenced",
      bulletListMarker: "-",
    });

    // Add rules for better markdown conversion
    this.turndown.addRule("removeScripts", {
      filter: ["script", "style", "noscript", "iframe", "nav", "footer", "header"],
      replacement: () => "",
    });

    // Clean cache periodically
    setInterval(() => this.cleanCache(), this.CACHE_TTL);
  }

  /**
   * Fetch content from a URL and convert to markdown
   */
  async fetch(url: string, options: WebFetchOptions = {}): Promise<ToolResult> {
    try {
      // Validate URL
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(url);
        // Upgrade HTTP to HTTPS
        if (parsedUrl.protocol === "http:") {
          parsedUrl.protocol = "https:";
        }
      } catch {
        return {
          success: false,
          error: `Invalid URL: ${url}`,
        };
      }

      const normalizedUrl = parsedUrl.toString();

      // Check cache
      const cached = this.cache.get(normalizedUrl);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return this.formatResponse(cached.content, normalizedUrl, options.prompt, true);
      }

      // Fetch the URL
      const response = await fetch(normalizedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HorusCLI/1.0; +https://github.com/horus-cli)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      });

      // Check for redirects to different hosts
      const finalUrl = response.url;
      const finalParsedUrl = new URL(finalUrl);
      if (finalParsedUrl.host !== parsedUrl.host) {
        return {
          success: true,
          output: `Redirected to different host: ${finalUrl}\nPlease fetch the new URL directly.`,
          data: {
            redirected: true,
            originalUrl: normalizedUrl,
            redirectUrl: finalUrl,
          },
        };
      }

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const contentType = response.headers.get("content-type") || "";

      // Handle non-HTML content
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
        if (contentType.includes("application/json")) {
          const json = await response.json();
          const content = JSON.stringify(json, null, 2);
          this.cache.set(normalizedUrl, { content, url: normalizedUrl, timestamp: Date.now() });
          return this.formatResponse(content, normalizedUrl, options.prompt, false);
        }

        if (contentType.includes("text/plain") || contentType.includes("text/markdown")) {
          const content = await response.text();
          this.cache.set(normalizedUrl, { content, url: normalizedUrl, timestamp: Date.now() });
          return this.formatResponse(content, normalizedUrl, options.prompt, false);
        }

        return {
          success: false,
          error: `Unsupported content type: ${contentType}`,
        };
      }

      // Parse HTML
      const html = await response.text();
      const $ = cheerio.load(html);

      // Remove unwanted elements
      $("script, style, noscript, iframe, nav, footer, header, aside, .sidebar, .advertisement, .ads").remove();

      // Extract main content
      let mainContent = "";

      // Try to find main content area
      const mainSelectors = ["main", "article", '[role="main"]', ".main-content", ".content", "#content", ".post-content"];
      for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0) {
          mainContent = element.html() || "";
          break;
        }
      }

      // Fallback to body if no main content found
      if (!mainContent) {
        mainContent = $("body").html() || html;
      }

      // Convert to markdown
      const markdown = this.turndown.turndown(mainContent);

      // Clean up markdown
      const cleanedMarkdown = this.cleanMarkdown(markdown);

      // Get page title
      const title = $("title").text().trim() || $("h1").first().text().trim() || "Untitled";

      // Format final content
      const content = `# ${title}\n\n${cleanedMarkdown}`;

      // Cache the result
      this.cache.set(normalizedUrl, { content, url: normalizedUrl, timestamp: Date.now() });

      return this.formatResponse(content, normalizedUrl, options.prompt, false);
    } catch (error: any) {
      return {
        success: false,
        error: `Fetch error: ${error.message}`,
      };
    }
  }

  /**
   * Format the response with optional prompt extraction note
   */
  private formatResponse(
    content: string,
    url: string,
    prompt?: string,
    fromCache?: boolean
  ): ToolResult {
    // Truncate if too long
    const maxLength = 50000;
    let truncated = false;
    let finalContent = content;

    if (content.length > maxLength) {
      finalContent = content.substring(0, maxLength) + "\n\n... (content truncated)";
      truncated = true;
    }

    let output = finalContent;
    if (fromCache) {
      output = `(from cache)\n\n${output}`;
    }

    if (prompt) {
      output = `Requested info: "${prompt}"\n\n${output}`;
    }

    return {
      success: true,
      output,
      data: {
        url,
        contentLength: content.length,
        truncated,
        fromCache,
      },
    };
  }

  /**
   * Clean up markdown content
   */
  private cleanMarkdown(markdown: string): string {
    return markdown
      // Remove excessive newlines
      .replace(/\n{4,}/g, "\n\n\n")
      // Remove empty links
      .replace(/\[]\([^)]*\)/g, "")
      // Clean up whitespace
      .replace(/[ \t]+$/gm, "")
      // Remove lines with only whitespace
      .replace(/^\s*$/gm, "")
      .trim();
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}
