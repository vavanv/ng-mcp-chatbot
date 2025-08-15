import { Component, signal, ElementRef, ViewChild, AfterViewChecked, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OpenAIService, OpenAIMessage } from './openai.service';
import { ApiKeyConfigComponent } from './api-key-config.component';
import { ConfigService } from './config.service';

interface Message {
  content: string;
  isUser: boolean;
  timestamp: Date;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ApiKeyConfigComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewChecked, OnInit {
  protected configService = inject(ConfigService);
  
  constructor(private openaiService: OpenAIService) {
    // Initialize with current configuration state
    this.isApiKeyConfigured = this.configService.isApiKeyConfigured;
  }
  
  protected readonly title = signal('angular-app');
  
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  @ViewChild('messageInput') messageInput!: ElementRef;
  @ViewChild('apiKeyConfig') apiKeyConfig!: ApiKeyConfigComponent;
  
  messages = signal<Message[]>([
    {
      content: "Welcome! I'm your AI assistant powered by OpenAI's GPT models with MCP (Model Context Protocol) integration.\n\n🔧 **Current Configuration:**\n- MCP Server: " + this.configService.getMcpServerUrl() + "\n- OpenAI API: " + (this.configService.getApiKey() ? 'Configured' : 'Not configured') + "\n\n💡 **Try asking:** \"What AI companies are available?\" to access live data from the MCP server!\n\nHow can I help you today?",
      isUser: false,
      timestamp: new Date()
    }
  ]);
  
  isApiKeyConfigured = signal(false);
  mcpHealthStatus = signal<string>('Unknown');
  private shouldScrollToBottom = false;
  private conversationHistory: OpenAIMessage[] = [];
  
  ngOnInit() {
    // Always check MCP health on startup to show current status
    this.checkMCPHealth();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  sendMessage() {
    const input = this.messageInput.nativeElement;
    const message = input.value.trim();
    
    if (!message) return;
    
    // Add user message
    this.messages.update(messages => [
      ...messages,
      {
        content: message,
        isUser: true,
        timestamp: new Date()
      }
    ]);
    
    // Clear input
    input.value = '';
    this.adjustTextareaHeight({ target: input });
    this.shouldScrollToBottom = true;
    
    // Simulate AI response after a delay
    setTimeout(() => {
      this.addAIResponse(message);
    }, 1000);
  }

  private addAIResponse(userMessage: string) {
    if (!this.configService.isApiKeyConfigured()) {
      this.messages.update(messages => [
        ...messages,
        {
          content: "Please configure your OpenAI API key first by clicking the settings button.",
          isUser: false,
          timestamp: new Date()
        }
      ]);
      this.shouldScrollToBottom = true;
      return;
    }

    // Add user message to conversation history
    this.conversationHistory.push({
      role: 'user',
      content: userMessage
    });

    // Proceed with regular AI response (MCP tools integration will be handled in proceedWithRegularAIResponse)
    this.proceedWithRegularAIResponse();
  }

  private proceedWithRegularAIResponse() {
    // First, try to get MCP context/tools, then call OpenAI API
    this.openaiService.getMCPTools().subscribe({
      next: (mcpTools) => {
        console.log('MCP Tools available:', mcpTools);
        this.mcpHealthStatus.set('Healthy');
        // Use MCP context with OpenAI
        this.openaiService.sendMessageWithMCPContext(this.conversationHistory, mcpTools).subscribe({
          next: (response) => this.handleAIResponse(response),
          error: (error) => this.handleAIError(error)
        });
      },
      error: (mcpError) => {
        console.warn('MCP tools not available, using OpenAI without MCP context:', mcpError);
        this.mcpHealthStatus.set('Unavailable');
        // Fallback to regular OpenAI call
        this.openaiService.sendMessage(this.conversationHistory).subscribe({
          next: (response) => this.handleAIResponse(response),
          error: (error) => this.handleAIError(error)
        });
      }
    });
  }

  private handleAIResponse(response: string) {
    // Add AI response to conversation history
    this.conversationHistory.push({
      role: 'assistant',
      content: response
    });

    // Add response to messages
    this.messages.update(messages => [
      ...messages,
      {
        content: response,
        isUser: false,
        timestamp: new Date()
      }
    ]);
    
    this.shouldScrollToBottom = true;
  }

  private handleAIError(error: any) {
    console.error('OpenAI API error:', error);
    let errorMessage = 'Sorry, I encountered an error while processing your request.';
    
    if (error.status === 401) {
      errorMessage = 'Invalid API key. Please check your OpenAI API key configuration.';
    } else if (error.status === 429) {
      errorMessage = 'Rate limit exceeded. Please try again in a moment.';
    }
    
    this.messages.update(messages => [
      ...messages,
      {
        content: errorMessage,
        isUser: false,
        timestamp: new Date()
      }
    ]);
    
    this.shouldScrollToBottom = true;
  }
  
  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }
  
  adjustTextareaHeight(event: any) {
    const textarea = event.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 128) + 'px';
  }
  
  private scrollToBottom() {
    if (this.messagesContainer) {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }

  showApiKeyConfig() {
    this.apiKeyConfig.show();
  }

  onConfigSaved(config: {apiKey: string, mcpServerUrl: string}) {
    // Configuration is already saved by the ConfigService in the component
    
    // Update welcome message
    this.messages.update(messages => [
      ...messages,
      {
        content: `Great! Your configuration has been saved. API key configured and MCP server set to ${config.mcpServerUrl}. I'm now ready to assist you with AI-powered responses. How can I help you today?`,
        isUser: false,
        timestamp: new Date()
      }
    ]);
    
    this.shouldScrollToBottom = true;
    
    // Check MCP server health
    this.checkMCPHealth();
  }

  onConfigCancelled() {
    // Handle cancellation if needed
  }

  checkMCPHealth() {
    const mcpUrl = this.configService.getMcpServerUrl();
    console.log('Starting MCP initialization for URL:', mcpUrl);
    
    this.mcpHealthStatus.set('Checking...');
    
    this.openaiService.initializeMCP().subscribe({
      next: (response) => {
        this.mcpHealthStatus.set('Healthy');
        console.log('MCP Initialization Response:', response);
        
        this.messages.update(messages => [
          ...messages,
          {
            content: `✅ MCP Server initialized successfully! Server at ${mcpUrl} is ready for use.`,
            isUser: false,
            timestamp: new Date()
          }
        ]);
        this.shouldScrollToBottom = true;
      },
      error: (error) => {
        this.mcpHealthStatus.set('Unavailable');
        console.error('MCP Initialization Error:', error);
        
        let errorMsg = `❌ MCP Server initialization failed for ${mcpUrl}.`;
        if (error.status === 404) {
          errorMsg += ' Please check the proxy configuration and ensure the MCP server is running.';
        } else if (error.status === 406) {
          errorMsg += ' Server returned 406 Not Acceptable. Please check the MCP server configuration.';
        } else if (error.status === 0) {
          errorMsg += ' This might be due to CORS issues or the server being unavailable.';
        } else {
          errorMsg += ` Error: ${error.status} ${error.statusText}`;
        }
        
        this.messages.update(messages => [
          ...messages,
          {
            content: errorMsg,
            isUser: false,
            timestamp: new Date()
          }
        ]);
        this.shouldScrollToBottom = true;
      }
    });
  }

  getMCPHealthStatus(): string {
    return this.mcpHealthStatus();
  }

  clearConversation() {
    this.messages.set([
      {
        content: this.configService.isApiKeyConfigured() 
          ? "Conversation cleared. How can I help you today?"
          : "Hello! I'm your AI assistant powered by OpenAI. Please configure your API key to start chatting. Click the settings button to get started!",
        isUser: false,
        timestamp: new Date()
      }
    ]);
    this.conversationHistory = [];
    this.shouldScrollToBottom = true;
  }
}
