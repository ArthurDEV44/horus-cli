/**
 * Horus CLI Design System
 *
 * A modern, minimalist design system inspired by top-tier tech CLIs
 * (Vercel, Railway, Claude Code, Linear)
 *
 * Philosophy: Stability, Quality, Elegance
 */

// Color Palette - Sophisticated and minimal
export const Colors = {
  // Primary Brand Colors
  brand: {
    primary: '#A78BFA',      // Soft Purple
    secondary: '#60A5FA',    // Soft Blue
    accent: '#34D399',       // Soft Green
  },

  // Semantic Colors
  success: '#10B981',        // Green
  error: '#EF4444',          // Red
  warning: '#F59E0B',        // Amber
  info: '#3B82F6',           // Blue

  // Grayscale (for terminal rendering)
  gray: {
    100: 'gray',             // Lightest
    200: 'gray',
    300: 'gray',
    400: 'gray',
    500: 'gray',             // Mid
    600: 'gray',
    700: 'gray',
    800: 'gray',
    900: 'gray',             // Darkest
  },

  // Text Colors
  text: {
    primary: 'white',
    secondary: 'gray',
    tertiary: 'gray',
    muted: 'gray',
    inverse: 'black',
  },

  // Status Colors
  status: {
    active: 'green',
    inactive: 'gray',
    processing: 'cyan',
    pending: 'yellow',
  },

  // Syntax Highlighting
  syntax: {
    keyword: 'magenta',
    string: 'green',
    number: 'yellow',
    comment: 'gray',
    function: 'blue',
    class: 'cyan',
  },
} as const;

// Icons - Modern, minimalist Unicode symbols
export const Icons = {
  // Status
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',

  // UI Elements
  arrow: {
    right: '→',
    left: '←',
    up: '↑',
    down: '↓',
  },

  // Tools & Actions
  tool: '⚡',
  file: '📄',
  folder: '📁',
  code: '⟨⟩',
  search: '🔍',
  edit: '✎',
  create: '+',
  delete: '×',

  // States
  loading: '◐',
  processing: '◑',
  completed: '◉',
  pending: '○',

  // Models & AI
  model: '◈',
  brain: '◉',
  chip: '⬡',

  // Misc
  clock: '◷',
  context: '⧉',
  memory: '▦',
  token: '◆',
} as const;

// Borders - Minimal and elegant
export const Borders = {
  light: {
    top: '─',
    bottom: '─',
    left: '│',
    right: '│',
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
  },
  heavy: {
    top: '━',
    bottom: '━',
    left: '┃',
    right: '┃',
    topLeft: '┏',
    topRight: '┓',
    bottomLeft: '┗',
    bottomRight: '┛',
  },
  rounded: {
    top: '─',
    bottom: '─',
    left: '│',
    right: '│',
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
  },
  double: {
    top: '═',
    bottom: '═',
    left: '║',
    right: '║',
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
  },
} as const;

// Spacing - Consistent and harmonious
export const Spacing = {
  xs: 0.5,
  sm: 1,
  md: 2,
  lg: 3,
  xl: 4,
} as const;

// Typography - Clear hierarchy
export const Typography = {
  size: {
    xs: 'small',
    sm: 'normal',
    md: 'normal',
    lg: 'normal',
    xl: 'large',
  },
  weight: {
    normal: false,
    bold: true,
  },
} as const;

// Animations - Subtle and purposeful
export const Animations = {
  spinnerFrames: ['◐', '◓', '◑', '◒'],
  dotsFrames: ['   ', '.  ', '.. ', '...'],
  pulseFrames: ['○', '◎', '◉', '◎'],
  barFrames: ['▱', '▰▱', '▰▰▱', '▰▰▰'],
} as const;

// Layout - Consistent structure
export const Layout = {
  maxWidth: 120,
  minWidth: 80,
  headerHeight: 3,
  footerHeight: 2,
  sidebarWidth: 30,
} as const;

// Formatters - Utility functions for consistent formatting
export const Formatters = {
  /**
   * Format number with thousands separators
   * @example formatNumber(128000) => "128,000"
   */
  formatNumber: (num: number): string => {
    return num.toLocaleString('en-US');
  },

  /**
   * Format context size to human-readable
   * @example formatContext(128000) => "128K"
   */
  formatContext: (tokens: number): string => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(1)}M`;
    }
    if (tokens >= 1000) {
      return `${Math.floor(tokens / 1000)}K`;
    }
    return `${tokens}`;
  },

  /**
   * Format time duration
   * @example formatTime(65) => "1m 5s"
   */
  formatTime: (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  },

  /**
   * Truncate text with ellipsis
   * @example truncate("very long text", 10) => "very lo..."
   */
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  },
} as const;

// Export everything as a unified design system
export const DesignSystem = {
  Colors,
  Icons,
  Borders,
  Spacing,
  Typography,
  Animations,
  Layout,
  Formatters,
} as const;

export type DesignSystemType = typeof DesignSystem;
