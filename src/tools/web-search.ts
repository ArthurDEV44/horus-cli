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

/**
 * WebSearchTool - Web search via SearXNG (extensible for Brave/Tavily)
 *
 * Configuration via environment variables:
 * - HORUS_SEARXNG_URL: SearXNG instance URL (default: https://searx.be)
 * - HORUS_SEARCH_PROVIDER: Search provider (default: searxng)
 * - HORUS_BRAVE_API_KEY: Brave Search API key (future)
 * - HORUS_TAVILY_API_KEY: Tavily API key (future)
 */
export class WebSearchTool {
  private provider: SearchProvider;
  private searxngUrl: string;

  constructor() {
    this.provider = (process.env.HORUS_SEARCH_PROVIDER as SearchProvider) || "searxng";
    this.searxngUrl = process.env.HORUS_SEARXNG_URL || "https://searx.be";
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
          return {
            success: false,
            error: "Brave Search not yet implemented. Set HORUS_SEARCH_PROVIDER=searxng",
          };
        case "tavily":
          return {
            success: false,
            error: "Tavily Search not yet implemented. Set HORUS_SEARCH_PROVIDER=searxng",
          };
        default:
          results = await this.searchSearXNG(query, maxResults);
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
