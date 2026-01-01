import type { ToolResult } from "../types/index.js";

export interface WebSearchOptions {
  allowedDomains?: string[];
  blockedDomains?: string[];
  maxResults?: number;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  engine?: string;
}

type SearchProvider = "searxng" | "brave" | "tavily";

interface SearXNGResult {
  title: string;
  url: string;
  content: string;
  engine: string;
  score?: number;
}

interface SearXNGResponse {
  query: string;
  results: SearXNGResult[];
  number_of_results: number;
}

// Brave Search API types
interface BraveWebResult {
  title: string;
  url: string;
  description: string;
  is_source_local?: boolean;
  is_source_both?: boolean;
  language?: string;
  family_friendly?: boolean;
}

interface BraveSearchResponse {
  type: string;
  query: {
    original: string;
    altered?: string;
    spellcheck_off?: boolean;
  };
  web?: {
    type: string;
    results: BraveWebResult[];
  };
  mixed?: {
    type: string;
    main: Array<{ type: string; index: number }>;
  };
}

/**
 * WebSearchTool - Web search via multiple providers
 *
 * Configuration via environment variables:
 * - HORUS_SEARCH_PROVIDER: Search provider (default: brave if API key set, else searxng)
 * - HORUS_SEARXNG_URL: SearXNG instance URL (default: https://searx.be)
 * - HORUS_BRAVE_API_KEY: Brave Search API key
 * - HORUS_TAVILY_API_KEY: Tavily API key (future)
 */
export class WebSearchTool {
  private provider: SearchProvider;
  private searxngUrl: string;
  private braveApiKey: string | undefined;

  constructor() {
    this.braveApiKey = process.env.HORUS_BRAVE_API_KEY;
    this.searxngUrl = process.env.HORUS_SEARXNG_URL || "https://searx.be";

    // Auto-select provider based on available credentials
    const envProvider = process.env.HORUS_SEARCH_PROVIDER as SearchProvider;
    if (envProvider) {
      this.provider = envProvider;
    } else if (this.braveApiKey) {
      this.provider = "brave";
    } else {
      this.provider = "searxng";
    }
  }

  /**
   * Search the web using configured provider
   */
  async search(query: string, options: WebSearchOptions = {}): Promise<ToolResult> {
    try {
      if (!query || query.trim().length === 0) {
        return {
          success: false,
          error: "Search query cannot be empty",
        };
      }

      const maxResults = options.maxResults || 10;

      let results: SearchResult[];

      switch (this.provider) {
        case "searxng":
          results = await this.searchSearXNG(query, maxResults);
          break;
        case "brave":
          if (!this.braveApiKey) {
            return {
              success: false,
              error: "Brave Search requires HORUS_BRAVE_API_KEY environment variable",
            };
          }
          results = await this.searchBrave(query, maxResults);
          break;
        case "tavily":
          return {
            success: false,
            error: "Tavily Search not yet implemented. Set HORUS_SEARCH_PROVIDER=searxng or brave",
          };
        default:
          // Fallback: try Brave if key available, else SearXNG
          if (this.braveApiKey) {
            results = await this.searchBrave(query, maxResults);
          } else {
            results = await this.searchSearXNG(query, maxResults);
          }
      }

      // Apply domain filters
      if (options.allowedDomains && options.allowedDomains.length > 0) {
        results = results.filter((r) => {
          try {
            const domain = new URL(r.url).hostname;
            return options.allowedDomains!.some((d) => domain.includes(d));
          } catch {
            return false;
          }
        });
      }

      if (options.blockedDomains && options.blockedDomains.length > 0) {
        results = results.filter((r) => {
          try {
            const domain = new URL(r.url).hostname;
            return !options.blockedDomains!.some((d) => domain.includes(d));
          } catch {
            return true;
          }
        });
      }

      // Limit results
      results = results.slice(0, maxResults);

      if (results.length === 0) {
        return {
          success: true,
          output: `No results found for: "${query}"`,
          data: { query, results: [], count: 0 },
        };
      }

      // Format as markdown
      const output = this.formatResults(query, results);

      return {
        success: true,
        output,
        data: {
          query,
          results,
          count: results.length,
          provider: this.provider,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Search error: ${error.message}`,
      };
    }
  }

  /**
   * Search using SearXNG
   */
  private async searchSearXNG(query: string, maxResults: number): Promise<SearchResult[]> {
    const searchUrl = new URL("/search", this.searxngUrl);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("categories", "general");
    searchUrl.searchParams.set("language", "auto");

    const response = await fetch(searchUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; HorusCLI/1.0)",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`SearXNG returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as SearXNGResponse;

    if (!data.results || !Array.isArray(data.results)) {
      throw new Error("Invalid SearXNG response format");
    }

    return data.results.slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content,
      engine: r.engine,
    }));
  }

  /**
   * Search using Brave Search API
   */
  private async searchBrave(query: string, maxResults: number): Promise<SearchResult[]> {
    const searchUrl = new URL("https://api.search.brave.com/res/v1/web/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("count", String(Math.min(maxResults, 20))); // Brave max is 20
    searchUrl.searchParams.set("text_decorations", "false");
    searchUrl.searchParams.set("search_lang", "en");

    const response = await fetch(searchUrl.toString(), {
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": this.braveApiKey!,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid Brave API key. Check HORUS_BRAVE_API_KEY");
      }
      if (response.status === 429) {
        throw new Error("Brave API rate limit exceeded. Try again later or upgrade plan");
      }
      throw new Error(`Brave Search returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as BraveSearchResponse;

    if (!data.web?.results || !Array.isArray(data.web.results)) {
      return []; // No web results
    }

    return data.web.results.slice(0, maxResults).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
      engine: "brave",
    }));
  }

  /**
   * Format search results as markdown
   */
  private formatResults(query: string, results: SearchResult[]): string {
    const lines: string[] = [
      `## Search Results for: "${query}"`,
      "",
    ];

    results.forEach((result, index) => {
      lines.push(`### ${index + 1}. ${result.title}`);
      lines.push(`[${result.url}](${result.url})`);
      if (result.snippet) {
        lines.push("");
        lines.push(result.snippet);
      }
      lines.push("");
    });

    lines.push("---");
    lines.push(`Found ${results.length} result(s) via ${this.provider}`);

    return lines.join("\n");
  }

  /**
   * Get current provider info
   */
  getProviderInfo(): { provider: SearchProvider; url?: string } {
    return {
      provider: this.provider,
      url: this.provider === "searxng" ? this.searxngUrl : undefined,
    };
  }

  /**
   * Set SearXNG URL at runtime
   */
  setSearXNGUrl(url: string): void {
    this.searxngUrl = url;
  }
}
