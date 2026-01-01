/**
 * PlanningModeService - Singleton managing planning mode state
 *
 * Planning mode is a read-only mode where the agent can explore
 * the codebase but cannot make modifications.
 */

export type OperationMode = 'normal' | 'auto-edit' | 'planning';

export interface PlanningModeState {
  mode: OperationMode;
  planFile: string | null;
}

export class PlanningModeService {
  private static instance: PlanningModeService;

  private _mode: OperationMode = 'normal';
  private _planFile: string | null = null;
  private listeners: Set<(state: PlanningModeState) => void> = new Set();

  private constructor() {}

  static getInstance(): PlanningModeService {
    if (!PlanningModeService.instance) {
      PlanningModeService.instance = new PlanningModeService();
    }
    return PlanningModeService.instance;
  }

  /**
   * Get current operation mode
   */
  getMode(): OperationMode {
    return this._mode;
  }

  /**
   * Check if currently in planning mode
   */
  isPlanningMode(): boolean {
    return this._mode === 'planning';
  }

  /**
   * Check if currently in auto-edit mode
   */
  isAutoEditMode(): boolean {
    return this._mode === 'auto-edit';
  }

  /**
   * Check if currently in normal mode
   */
  isNormalMode(): boolean {
    return this._mode === 'normal';
  }

  /**
   * Get current plan file path
   */
  getPlanFile(): string | null {
    return this._planFile;
  }

  /**
   * Set operation mode
   */
  setMode(mode: OperationMode, planFile?: string): void {
    const previousMode = this._mode;
    this._mode = mode;

    if (mode === 'planning' && planFile) {
      this._planFile = planFile;
    } else if (mode !== 'planning') {
      this._planFile = null;
    }

    if (previousMode !== mode) {
      this.notifyListeners();
    }
  }

  /**
   * Enter planning mode
   */
  enterPlanMode(planFile?: string): void {
    this.setMode('planning', planFile);
  }

  /**
   * Exit planning mode and return plan file info
   */
  exitPlanMode(): { planFile: string | null } {
    const planFile = this._planFile;
    this.setMode('normal');
    return { planFile };
  }

  /**
   * Enter auto-edit mode
   */
  enterAutoEditMode(): void {
    this.setMode('auto-edit');
  }

  /**
   * Cycle through modes: normal -> auto-edit -> planning -> normal
   */
  cycleMode(): OperationMode {
    switch (this._mode) {
      case 'normal':
        this.setMode('auto-edit');
        break;
      case 'auto-edit':
        this.setMode('planning');
        break;
      case 'planning':
        this.setMode('normal');
        break;
    }
    return this._mode;
  }

  /**
   * Get current state
   */
  getState(): PlanningModeState {
    return {
      mode: this._mode,
      planFile: this._planFile,
    };
  }

  /**
   * Subscribe to mode changes
   */
  onModeChange(listener: (state: PlanningModeState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this._mode = 'normal';
    this._planFile = null;
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach(listener => listener(state));
  }
}

// Export singleton getter for convenience
export function getPlanningModeService(): PlanningModeService {
  return PlanningModeService.getInstance();
}
