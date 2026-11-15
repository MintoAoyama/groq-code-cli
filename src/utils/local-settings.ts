import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface Config {
  groqApiKey?: string;
  defaultModel?: string;
  groqProxy?: string;
  // Keyed by model, since each model accepts its own set of values.
  reasoningEfforts?: Record<string, string>;
  // Days to keep session transcripts in ~/.groq/projects; at least 1.
  cleanupPeriodDays?: number;
}

const CONFIG_DIR = '.groq'; // In home directory
const CONFIG_FILE = 'local-settings.json';

export class ConfigManager {
  private configPath: string;

  constructor(homeDir: string = os.homedir()) {
    this.configPath = path.join(homeDir, CONFIG_DIR, CONFIG_FILE);
  }

  private ensureConfigDir(): void {
    const configDir = path.dirname(this.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
  }

  private readConfig(): Config {
    try {
      if (!fs.existsSync(this.configPath)) {
        return {};
      }
      const configData = fs.readFileSync(this.configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn('Failed to read config file:', error);
      return {};
    }
  }

  private writeConfig(config: Config): void {
    this.ensureConfigDir();
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), {
      mode: 0o600 // Read/write for owner only
    });
    // Ensure restrictive perms even if file already existed
    try {
      fs.chmodSync(this.configPath, 0o600);
    } catch {
      // noop (esp. on Windows where chmod may not be supported)
    }
  }

  public getApiKey(): string | null {
    const config = this.readConfig();
    return config.groqApiKey || null;
  }

  public setApiKey(apiKey: string): void {
    try {
      const config = this.readConfig();
      config.groqApiKey = apiKey;
      this.writeConfig(config);
    } catch (error) {
      throw new Error(`Failed to save API key: ${error}`);
    }
  }

  public clearApiKey(): void {
    try {
      const config = this.readConfig();
      delete config.groqApiKey;

      if (Object.keys(config).length === 0) {
        if (fs.existsSync(this.configPath)) {
          fs.unlinkSync(this.configPath);
        }
      } else {
        this.writeConfig(config);
      }
    } catch (error) {
      console.warn('Failed to clear API key:', error);
    }
  }

  public getDefaultModel(): string | null {
    const config = this.readConfig();
    return config.defaultModel || null;
  }

  public setDefaultModel(model: string): void {
    try {
      const config = this.readConfig();
      config.defaultModel = model;
      this.writeConfig(config);
    } catch (error) {
      throw new Error(`Failed to save default model: ${error}`);
    }
  }

  public getReasoningEffort(model: string): string | null {
    return this.readConfig().reasoningEfforts?.[model] ?? null;
  }

  public setReasoningEffort(model: string, effort: string | null): void {
    try {
      const config = this.readConfig();
      const efforts = { ...config.reasoningEfforts };
      if (effort === null) {
        delete efforts[model];
      } else {
        efforts[model] = effort;
      }
      if (Object.keys(efforts).length === 0) {
        delete config.reasoningEfforts;
      } else {
        config.reasoningEfforts = efforts;
      }
      this.writeConfig(config);
    } catch (error) {
      throw new Error(`Failed to save reasoning effort: ${error}`);
    }
  }

  /**
   * @returns The configured retention period, the default when unset, or null when the value is invalid
   * or the config file cannot be read, so that a broken file never shortens the retention period.
   */
  public getCleanupPeriodDays(defaultDays: number): number | null {
    let config: Config;
    try {
      config = fs.existsSync(this.configPath) ? JSON.parse(fs.readFileSync(this.configPath, 'utf8')) : {};
    } catch {
      return null;
    }
    const value = config.cleanupPeriodDays;
    if (value === undefined) return defaultDays;
    return Number.isInteger(value) && value >= 1 ? value : null;
  }

  public getProxy(): string | null {
    const config = this.readConfig();
    return config.groqProxy || null;
  }

  public setProxy(proxy: string): void {
    try {
      // Validate proxy input
      const trimmed = proxy?.trim?.() ?? '';
      if (!trimmed) {
        throw new Error('Proxy must be a non-empty string');
      }
      
      // Validate URL format and protocol
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(trimmed);
      } catch {
        throw new Error(`Invalid proxy URL: ${trimmed}`);
      }
      
      const allowedProtocols = new Set(['http:', 'https:', 'socks:', 'socks5:']);
      if (!allowedProtocols.has(parsedUrl.protocol)) {
        throw new Error(`Unsupported proxy protocol: ${parsedUrl.protocol}`);
      }
      
      const config = this.readConfig();
      config.groqProxy = trimmed;
      this.writeConfig(config);
    } catch (error) {
      // Preserve original error via cause for better debugging
      throw new Error(`Failed to save proxy: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public clearProxy(): void {
    try {
      const config = this.readConfig();
      delete config.groqProxy;

      if (Object.keys(config).length === 0) {
        if (fs.existsSync(this.configPath)) {
          fs.unlinkSync(this.configPath);
        }
      } else {
        this.writeConfig(config);
      }
    } catch (error) {
      console.warn('Failed to clear proxy:', error);
    }
  }
}