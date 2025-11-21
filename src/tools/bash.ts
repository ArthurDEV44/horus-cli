import { exec } from 'child_process';
import { promisify } from 'util';
import { ToolResult } from '../types/index.js';
import { ConfirmationService } from '../utils/confirmation-service.js';
import * as os from 'os';

const execAsync = promisify(exec);

/**
 * Platform detection and information
 */
export type Platform = 'windows' | 'linux' | 'darwin' | 'unknown';

class PlatformDetector {
  private static instance: PlatformDetector;
  private platform: Platform;
  private isWindows: boolean;
  private isLinux: boolean;
  private isDarwin: boolean;

  private constructor() {
    const osPlatform = os.platform();
    this.isWindows = osPlatform === 'win32';
    this.isLinux = osPlatform === 'linux';
    this.isDarwin = osPlatform === 'darwin';
    
    if (this.isWindows) {
      this.platform = 'windows';
    } else if (this.isLinux) {
      this.platform = 'linux';
    } else if (this.isDarwin) {
      this.platform = 'darwin';
    } else {
      this.platform = 'unknown';
    }
  }

  static getInstance(): PlatformDetector {
    if (!PlatformDetector.instance) {
      PlatformDetector.instance = new PlatformDetector();
    }
    return PlatformDetector.instance;
  }

  getPlatform(): Platform {
    return this.platform;
  }

  isWindowsPlatform(): boolean {
    return this.isWindows;
  }

  isLinuxPlatform(): boolean {
    return this.isLinux;
  }

  isDarwinPlatform(): boolean {
    return this.isDarwin;
  }

  isUnixLike(): boolean {
    return this.isLinux || this.isDarwin;
  }
}

export class BashTool {
  private currentDirectory: string = process.cwd();
  private confirmationService = ConfirmationService.getInstance();
  private platformDetector = PlatformDetector.getInstance();

  /**
   * Convert common Unix commands to Windows PowerShell equivalents
   */
  private convertCommandForWindows(command: string): string {
    const trimmed = command.trim();
    
    // Handle cd separately (already handled before this)
    if (trimmed.startsWith('cd ')) {
      return command;
    }

    // ls commands
    if (trimmed === 'ls' || trimmed.startsWith('ls ')) {
      const match = trimmed.match(/ls\s+(-[a-z]+)?\s*(.+)?/);
      if (match) {
        const flags = match[1] || '';
        const dir = match[2]?.trim() || '.';
        const showHidden = flags.includes('a') || flags.includes('la') || flags.includes('al');
        const longFormat = flags.includes('l') || flags.includes('la') || flags.includes('al');
        
        if (longFormat) {
          return showHidden 
            ? `Get-ChildItem -Force -Path "${dir}" | Format-Table -AutoSize`
            : `Get-ChildItem -Path "${dir}" | Format-Table -AutoSize`;
        }
        return showHidden
          ? `Get-ChildItem -Force -Path "${dir}"`
          : `Get-ChildItem -Path "${dir}"`;
      }
    }

    // cat command
    if (trimmed.startsWith('cat ')) {
      const file = trimmed.substring(4).trim();
      return `Get-Content -Path "${file}"`;
    }

    // echo command
    if (trimmed.startsWith('echo ')) {
      const text = trimmed.substring(5);
      return `Write-Output ${text}`;
    }

    // mkdir command
    if (trimmed.startsWith('mkdir ')) {
      const match = trimmed.match(/mkdir\s+(-p)?\s*(.+)/);
      if (match) {
        const dir = match[2]?.trim() || match[1]?.trim() || '';
        return match[1] === '-p' 
          ? `New-Item -ItemType Directory -Path "${dir}" -Force`
          : `New-Item -ItemType Directory -Path "${dir}"`;
      }
    }

    // rm command
    if (trimmed.startsWith('rm ')) {
      const match = trimmed.match(/rm\s+(-rf?\s+)?(.+)/);
      if (match) {
        const recursive = match[1]?.includes('r');
        const target = match[2]?.trim();
        return recursive
          ? `Remove-Item -Path "${target}" -Recurse -Force`
          : `Remove-Item -Path "${target}" -Force`;
      }
    }

    // cp command
    if (trimmed.startsWith('cp ')) {
      const match = trimmed.match(/cp\s+(-r\s+)?(.+?)\s+(.+)/);
      if (match) {
        const recursive = !!match[1];
        const source = match[2]?.trim();
        const dest = match[3]?.trim();
        return recursive
          ? `Copy-Item -Path "${source}" -Destination "${dest}" -Recurse`
          : `Copy-Item -Path "${source}" -Destination "${dest}"`;
      }
    }

    // mv command
    if (trimmed.startsWith('mv ')) {
      const parts = trimmed.substring(3).trim().split(/\s+/);
      if (parts.length >= 2) {
        const source = parts.slice(0, -1).join(' ');
        const dest = parts[parts.length - 1];
        return `Move-Item -Path "${source}" -Destination "${dest}"`;
      }
    }

    // pwd command
    if (trimmed === 'pwd') {
      return 'Get-Location';
    }

    // find command
    if (trimmed.startsWith('find ')) {
      const parts = trimmed.match(/find\s+(\S+)\s+-name\s+"([^"]+)"\s+(-type\s+([fd]))?/);
      if (parts) {
        const dir = parts[1] || '.';
        const pattern = parts[2];
        const type = parts[4] || 'f';
        if (type === 'f') {
          return `Get-ChildItem -Path "${dir}" -Recurse -Filter "${pattern}" -File | Select-Object -ExpandProperty FullName`;
        } else {
          return `Get-ChildItem -Path "${dir}" -Recurse -Filter "${pattern}" -Directory | Select-Object -ExpandProperty FullName`;
        }
      }
    }

    // grep command
    if (trimmed.startsWith('grep ')) {
      const match = trimmed.match(/grep\s+(-r\s+)?(-i\s+)?("?)(.+?)\3\s+(.+)/);
      if (match) {
        const recursive = !!match[1];
        const caseInsensitive = !!match[2];
        const pattern = match[4];
        const path = match[5]?.trim() || '.';
        const caseFlag = caseInsensitive ? '-CaseSensitive:$false' : '';
        return recursive
          ? `Select-String -Path "${path}\\*" -Pattern "${pattern}" -Recurse ${caseFlag} | Format-List`
          : `Select-String -Path "${path}" -Pattern "${pattern}" ${caseFlag} | Format-List`;
      }
      // Simple grep pattern
      const simpleMatch = trimmed.match(/grep\s+(-r\s+)?("?)(.+?)\2\s+(.+)/);
      if (simpleMatch) {
        const recursive = !!simpleMatch[1];
        const pattern = simpleMatch[3];
        const path = simpleMatch[4]?.trim() || '.';
        return recursive
          ? `Select-String -Path "${path}\\*" -Pattern "${pattern}" -Recurse | Format-List`
          : `Select-String -Path "${path}" -Pattern "${pattern}" | Format-List`;
      }
    }

    // which/where command
    if (trimmed.startsWith('which ') || trimmed.startsWith('where ')) {
      const cmd = trimmed.split(/\s+/)[1];
      return `Get-Command "${cmd}" | Select-Object -ExpandProperty Source`;
    }

    // If command looks like PowerShell or cmd, use it as-is
    if (trimmed.startsWith('Get-') || trimmed.startsWith('Set-') || 
        trimmed.startsWith('Remove-') || trimmed.startsWith('New-') ||
        trimmed.startsWith('Select-') || trimmed.startsWith('Format-') ||
        trimmed.startsWith('Move-') || trimmed.startsWith('Copy-') ||
        trimmed.startsWith('Write-') || trimmed.includes('$') || 
        trimmed.startsWith('dir ') || trimmed.startsWith('cd ') || 
        trimmed.startsWith('cd\\') || trimmed.startsWith('powershell')) {
      return command;
    }

    // Unknown command - try to execute as-is (might work in PowerShell)
    return command;
  }

  /**
   * Get the appropriate shell command for the platform
   */
  private getShellCommand(command: string): string {
    if (this.platformDetector.isWindowsPlatform()) {
      return this.convertCommandForWindows(command);
    }
    // On Unix-like systems (Linux, macOS), return command as-is
    return command;
  }

  async execute(command: string, timeout: number = 30000): Promise<ToolResult> {
    try {
      // Check if user has already accepted bash commands for this session
      const sessionFlags = this.confirmationService.getSessionFlags();
      if (!sessionFlags.bashCommands && !sessionFlags.allOperations) {
        // Request confirmation showing the command
        const platformName = this.platformDetector.getPlatform();
        const operationName = platformName === 'windows' 
          ? 'Run command (PowerShell)' 
          : platformName === 'darwin' 
            ? 'Run command (macOS)'
            : 'Run command (Linux)';
        
        const confirmationResult = await this.confirmationService.requestConfirmation({
          operation: operationName,
          filename: command,
          showVSCodeOpen: false,
          content: `Platform: ${platformName}\nCommand: ${command}\nWorking directory: ${this.currentDirectory}`
        }, 'bash');

        if (!confirmationResult.confirmed) {
          return {
            success: false,
            error: confirmationResult.feedback || 'Command execution cancelled by user'
          };
        }
      }

      if (command.startsWith('cd ')) {
        const newDir = command.substring(3).trim();
        try {
          process.chdir(newDir);
          this.currentDirectory = process.cwd();
          return {
            success: true,
            output: `Changed directory to: ${this.currentDirectory}`
          };
        } catch (error: any) {
          return {
            success: false,
            error: `Cannot change directory: ${error.message}`
          };
        }
      }

      // Get platform-appropriate command
      const shellCommand = this.getShellCommand(command);
      
      // Determine execution method based on platform
      let execCommand = shellCommand;
      let shellOption: string | undefined = undefined;
      
      if (this.platformDetector.isWindowsPlatform()) {
        // Check if it's a PowerShell command
        const isPowerShellCmd = shellCommand.startsWith('Get-') || 
                               shellCommand.startsWith('Set-') || 
                               shellCommand.startsWith('Remove-') || 
                               shellCommand.startsWith('New-') ||
                               shellCommand.startsWith('Select-') || 
                               shellCommand.startsWith('Format-') ||
                               shellCommand.startsWith('Move-') ||
                               shellCommand.startsWith('Copy-') ||
                               shellCommand.startsWith('Write-');
        
        if (isPowerShellCmd && !shellCommand.startsWith('powershell.exe')) {
          // Escape special characters for PowerShell
          // Important: escape existing backticks first, before adding new ones
          const escaped = shellCommand
            .replace(/`/g, '``')
            .replace(/"/g, '`"')
            .replace(/\$/g, '`$');
          execCommand = `powershell.exe -NoProfile -Command "${escaped}"`;
          shellOption = undefined; // exec will use default shell
        } else if (!shellCommand.startsWith('powershell.exe') && !isPowerShellCmd) {
          // Simple command that might work in cmd.exe
          shellOption = 'cmd.exe';
        }
      } else {
        // Unix-like: use default shell (bash on Linux, zsh/bash on macOS)
        shellOption = this.platformDetector.isDarwinPlatform() ? '/bin/zsh' : '/bin/bash';
      }

      const { stdout, stderr } = await execAsync(execCommand, {
        cwd: this.currentDirectory,
        timeout,
        maxBuffer: 1024 * 1024,
        shell: shellOption
      });

      const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
      
      return {
        success: true,
        output: output.trim() || 'Command executed successfully (no output)'
      };
    } catch (error: any) {
      return {
        success: false,
        error: `Command failed: ${error.message}`
      };
    }
  }

  getCurrentDirectory(): string {
    return this.currentDirectory;
  }

  async listFiles(directory: string = '.'): Promise<ToolResult> {
    if (this.platformDetector.isWindowsPlatform()) {
      return this.execute(`Get-ChildItem -Force -Path "${directory}" | Format-Table -AutoSize`);
    }
    return this.execute(`ls -la ${directory}`);
  }

  async findFiles(pattern: string, directory: string = '.'): Promise<ToolResult> {
    if (this.platformDetector.isWindowsPlatform()) {
      return this.execute(`Get-ChildItem -Path "${directory}" -Recurse -Filter "${pattern}" -File | Select-Object -ExpandProperty FullName`);
    }
    return this.execute(`find ${directory} -name "${pattern}" -type f`);
  }

  async grep(pattern: string, files: string = '.'): Promise<ToolResult> {
    if (this.platformDetector.isWindowsPlatform()) {
      return this.execute(`Select-String -Path "${files}\\*" -Pattern "${pattern}" -Recurse | Format-List`);
    }
    return this.execute(`grep -r "${pattern}" ${files}`);
  }

  /**
   * Get current platform information
   */
  getPlatform(): Platform {
    return this.platformDetector.getPlatform();
  }

  /**
   * Check if running on Windows
   */
  isWindows(): boolean {
    return this.platformDetector.isWindowsPlatform();
  }

  /**
   * Check if running on Unix-like system (Linux or macOS)
   */
  isUnixLike(): boolean {
    return this.platformDetector.isUnixLike();
  }
}