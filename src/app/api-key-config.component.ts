import { Component, signal, output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from './config.service';

@Component({
  selector: 'app-api-key-config',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="api-key-overlay" [class.hidden]="!isVisible()">
      <div class="api-key-modal">
        <h3>Configuration Settings</h3>
        <p>Configure your OpenAI API key and MCP server settings:</p>
        
        <div class="form-group">
          <label for="apiKey">OpenAI API Key:</label>
          <input 
            type="password" 
            id="apiKey" 
            [(ngModel)]="apiKey" 
            placeholder="sk-..."
            class="config-input"
          />
        </div>
        
        <div class="form-group">
          <label for="mcpUrl">MCP Server URL:</label>
          <input 
            type="url" 
            id="mcpUrl" 
            [(ngModel)]="mcpServerUrl" 
            placeholder="http://localhost:3100"
            class="config-input"
          />
        </div>
        
        <div class="form-actions">
          <button 
            (click)="saveConfig()" 
            [disabled]="!apiKey.trim() || !mcpServerUrl.trim()"
            class="btn btn-primary"
          >
            Save Configuration
          </button>
          <button 
            (click)="cancel()" 
            class="btn btn-secondary"
          >
            Cancel
          </button>
        </div>
        
        <div class="help-text">
          <small>
            Your settings are stored locally and securely.
            Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a>.
          </small>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .api-key-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    
    .api-key-overlay.hidden {
      display: none;
    }
    
    .api-key-modal {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 500px;
      width: 90%;
    }
    
    .api-key-modal h3 {
      margin: 0 0 1rem 0;
      color: #333;
    }
    
    .form-group {
      margin: 1rem 0;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: #555;
    }
    
    .config-input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;
      box-sizing: border-box;
    }
    
    .config-input:focus {
      outline: none;
      border-color: #007bff;
      box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
    }
    
    .form-actions {
      display: flex;
      gap: 1rem;
      margin: 1.5rem 0 1rem 0;
    }
    
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 1rem;
      transition: background-color 0.2s;
    }
    
    .btn-primary {
      background: #007bff;
      color: white;
    }
    
    .btn-primary:hover:not(:disabled) {
      background: #0056b3;
    }
    
    .btn-primary:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    
    .btn-secondary {
      background: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover {
      background: #545b62;
    }
    
    .help-text {
      color: #666;
      font-size: 0.875rem;
      line-height: 1.4;
    }
    
    .help-text a {
      color: #007bff;
      text-decoration: none;
    }
    
    .help-text a:hover {
      text-decoration: underline;
    }
  `]
})
export class ApiKeyConfigComponent {
  private configService = inject(ConfigService);
  
  isVisible = signal(false);
  apiKey = '';
  mcpServerUrl = '';
  
  configSaved = output<{apiKey: string, mcpServerUrl: string}>();
  cancelled = output<void>();
  
  show() {
    this.isVisible.set(true);
    // Load current values
    this.apiKey = this.configService.getApiKey();
    this.mcpServerUrl = this.configService.getMcpServerUrl();
  }
  
  hide() {
    this.isVisible.set(false);
  }
  
  saveConfig() {
    if (this.apiKey.trim() && this.mcpServerUrl.trim()) {
      const config = {
        apiKey: this.apiKey.trim(),
        mcpServerUrl: this.mcpServerUrl.trim()
      };
      
      // Save to config service
      this.configService.updateConfig({
        openaiApiKey: config.apiKey,
        mcpServerUrl: config.mcpServerUrl
      });
      
      this.configSaved.emit(config);
      this.hide();
    }
  }
  
  cancel() {
    this.cancelled.emit();
    this.hide();
  }
}