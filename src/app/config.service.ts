import { Injectable, signal, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface AppConfig {
  openaiApiKey: string;
  mcpServerUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private readonly STORAGE_KEY = 'chatbot-config';
  private readonly DEFAULT_MCP_URL = 'http://localhost:3100';
  
  // Reactive signals for configuration
  private _config = signal<AppConfig>({
    openaiApiKey: '',
    mcpServerUrl: this.DEFAULT_MCP_URL
  });
  
  // Public readonly signals
  readonly config = this._config.asReadonly();
  readonly isApiKeyConfigured = signal(false);
  
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {
    this.loadConfig();
  }
  
  /**
   * Load configuration from localStorage
   */
  private loadConfig(): void {
    if (!isPlatformBrowser(this.platformId)) {
      // Skip localStorage access during SSR
      return;
    }
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const config = JSON.parse(stored) as AppConfig;
        this._config.set({
          openaiApiKey: config.openaiApiKey || '',
          mcpServerUrl: config.mcpServerUrl || this.DEFAULT_MCP_URL
        });
        this.isApiKeyConfigured.set(!!config.openaiApiKey);
      }
    } catch (error) {
      console.warn('Failed to load config from localStorage:', error);
      this.resetToDefaults();
    }
  }
  
  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    if (!isPlatformBrowser(this.platformId)) {
      // Skip localStorage access during SSR
      return;
    }
    
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this._config()));
    } catch (error) {
      console.error('Failed to save config to localStorage:', error);
    }
  }
  
  /**
   * Update OpenAI API key
   */
  setApiKey(apiKey: string): void {
    const currentConfig = this._config();
    this._config.set({
      ...currentConfig,
      openaiApiKey: apiKey
    });
    this.isApiKeyConfigured.set(!!apiKey);
    this.saveConfig();
  }
  
  /**
   * Update MCP server URL
   */
  setMcpServerUrl(url: string): void {
    const currentConfig = this._config();
    this._config.set({
      ...currentConfig,
      mcpServerUrl: url || this.DEFAULT_MCP_URL
    });
    this.saveConfig();
  }
  
  /**
   * Update both API key and MCP server URL
   */
  updateConfig(config: Partial<AppConfig>): void {
    const currentConfig = this._config();
    const newConfig = {
      ...currentConfig,
      ...config
    };
    
    this._config.set(newConfig);
    this.isApiKeyConfigured.set(!!newConfig.openaiApiKey);
    this.saveConfig();
  }
  
  /**
   * Get current API key
   */
  getApiKey(): string {
    return this._config().openaiApiKey;
  }
  
  /**
   * Get current MCP server URL
   */
  getMcpServerUrl(): string {
    return this._config().mcpServerUrl;
  }
  
  /**
   * Clear all configuration
   */
  clearConfig(): void {
    if (!isPlatformBrowser(this.platformId)) {
      // Skip localStorage access during SSR
      this.resetToDefaults();
      return;
    }
    
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.resetToDefaults();
    } catch (error) {
      console.error('Failed to clear config from localStorage:', error);
    }
  }
  
  /**
   * Reset to default values
   */
  private resetToDefaults(): void {
    this._config.set({
      openaiApiKey: '',
      mcpServerUrl: this.DEFAULT_MCP_URL
    });
    this.isApiKeyConfigured.set(false);
  }
  
  /**
   * Check if configuration is valid
   */
  isConfigValid(): boolean {
    const config = this._config();
    return !!config.openaiApiKey && !!config.mcpServerUrl;
  }
  
  /**
   * Export configuration (without sensitive data for sharing)
   */
  exportConfig(): Partial<AppConfig> {
    const config = this._config();
    return {
      mcpServerUrl: config.mcpServerUrl
      // Note: API key is intentionally excluded for security
    };
  }
}