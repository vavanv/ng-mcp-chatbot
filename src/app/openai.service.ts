import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { ConfigService } from './config.service';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenAIResponse {
  choices: {
    message: {
      content: string;
      role: string;
    };
  }[];
}

export interface MCPHealthResponse {
  status: string;
  timestamp: string;
  data?: any;
  serverType?: string;
  [key: string]: any;
}

@Injectable({
  providedIn: 'root',
})
export class OpenAIService {
  private readonly openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
  private configService = inject(ConfigService);

  constructor(private http: HttpClient) {}

  checkMCPHealth(): Observable<MCPHealthResponse> {
    const mcpServerUrl = this.configService.getMcpServerUrl();

    // Make a direct GET request to the /health endpoint via proxy
    return this.http.get('/api/mcp/health').pipe(
      map((response: any) => {
        return {
          status: response.status === 'ok' ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          data: response,
          serverType: 'real',
        };
      }),
      catchError((error) => {
        console.error('MCP Health check failed:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: mcpServerUrl,
        });
        return throwError(() => error);
      })
    );
  }

  sendMessage(messages: OpenAIMessage[]): Observable<string> {
    const apiKey = this.configService.getApiKey();
    if (!apiKey) {
      return throwError(() => new Error('OpenAI API key not set'));
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${apiKey}`,
    });

    const body = {
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7,
    };

    return this.http.post<OpenAIResponse>(this.openaiApiUrl, body, { headers }).pipe(
      map((response) => {
        if (response.choices && response.choices.length > 0) {
          return response.choices[0].message.content;
        }
        throw new Error('No response from OpenAI');
      }),
      catchError((error) => {
        console.error('OpenAI API error:', error);
        return throwError(() => error);
      })
    );
  }

  // Initialize MCP connection
  initializeMCP(): Observable<any> {
    const headers = new HttpHeaders({
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    });

    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'angular-mcp-client',
          version: '1.0.0',
        },
      },
    };

    return this.http.post('/api/mcp', initRequest, { headers, responseType: 'text' }).pipe(
      map((response: string) => {
        // Parse SSE format: "event: message\ndata: {json}"
        const lines = response.split('\n');
        const dataLine = lines.find((line) => line.startsWith('data: '));
        if (dataLine) {
          const jsonData = dataLine.substring(6); // Remove "data: " prefix
          const parsedData = JSON.parse(jsonData);
          if (parsedData.error) {
            throw new Error(`MCP Initialization Error: ${parsedData.error.message}`);
          }
          return parsedData.result;
        }
        throw new Error('Invalid SSE response format');
      }),
      catchError((error) => {
        console.error('MCP initialization error:', error);
        return throwError(() => error);
      })
    );
  }

  // Method to interact with MCP server using JSON-RPC
  callMCPMethod(method: string, params?: any): Observable<any> {
    const mcpServerUrl = this.configService.getMcpServerUrl();

    const headers = new HttpHeaders({
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    });

    // MCP uses JSON-RPC 2.0 protocol
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params || {},
    };

    // Use proxy endpoint to avoid CORS issues
    return this.http.post('/api/mcp', jsonRpcRequest, { headers, responseType: 'text' }).pipe(
      map((response: string) => {
        // Parse SSE format: "event: message\ndata: {json}"
        const lines = response.split('\n');
        const dataLine = lines.find((line) => line.startsWith('data: '));
        if (dataLine) {
          const jsonData = dataLine.substring(6); // Remove "data: " prefix
          const parsedData = JSON.parse(jsonData);
          if (parsedData.error) {
            throw new Error(`MCP Error: ${parsedData.error.message}`);
          }
          return parsedData.result;
        }
        throw new Error('Invalid SSE response format');
      }),
      catchError((error) => {
        console.error(`MCP ${method} method error:`, error);
        return throwError(() => error);
      })
    );
  }

  // Get available MCP tools
  getMCPTools(): Observable<any> {
    return this.callMCPMethod('tools/list');
  }

  // Call a specific MCP tool
  callMCPTool(toolName: string, params?: any): Observable<any> {
    return this.callMCPMethod('tools/call', {
      name: toolName,
      arguments: params || {},
    }).pipe(
      catchError((error) => {
        console.error(`MCP tool ${toolName} error:`, error);
        throw error;
      })
    );
  }

  // Get diagnostic information from MCP server
  getMCPDiagnostic(): Observable<any> {
    return this.callMCPTool('diagnostic');
  }

  // Get all companies with their chats and LLMs
  getCompanies(): Observable<any> {
    return this.callMCPTool('getCompanies');
  }

  // Get chatbots for a specific company
  getChats(companyName: string): Observable<any> {
    return this.callMCPTool('getChats', { companyName });
  }

  // Get LLM models for a specific company
  getLLMs(companyName: string): Observable<any> {
    return this.callMCPTool('getLLMs', { companyName });
  }

  // Enhanced message sending that can utilize MCP server context
  sendMessageWithMCPContext(messages: OpenAIMessage[], mcpTools?: any): Observable<string> {
    // First try to get actual company data for rich context
    return this.getCompanies().pipe(
      map((companies: any[]): OpenAIMessage[] => {
        const context = this.createContext(companies);
        const systemPrompt = `You are an AI assistant that helps users find information about AI companies and their products.

You have access to the following data about AI companies:
${context}

When users ask questions, use this data to provide accurate and helpful responses. If the question is about a specific company, you can also suggest using the MCP tools to get more detailed information about their chatbots or LLM models.

Available MCP tools:
- getCompanies: Get all companies with their chats and LLMs
- getChats(companyName): Get chatbots for a specific company
- getLLMs(companyName): Get LLM models for a specific company

Be helpful, accurate, and suggest relevant companies or products based on the user's question.`;

        const systemMessage: OpenAIMessage = {
          role: 'system',
          content: systemPrompt,
        };
        const enhancedMessages = [systemMessage, ...messages.filter((m) => m.role !== 'system')];
        return enhancedMessages;
      }),
      catchError((error): Observable<OpenAIMessage[]> => {
        console.warn('Could not fetch company data, falling back to basic tool description:', error);
        // Fallback to basic tool description if company data fetch fails
        if (mcpTools && mcpTools.tools && mcpTools.tools.length > 0) {
          const toolsDescription = mcpTools.tools
            .map((tool: any) => `- ${tool.name}: ${tool.description || 'No description available'}`)
            .join('\n');

          const systemMessage: OpenAIMessage = {
            role: 'system',
            content: `You are an AI assistant with access to the following MCP (Model Context Protocol) tools:\n\n${toolsDescription}\n\nWhen a user asks about topics that could be answered using these tools, explain what information you could provide if you had access to call these tools. For example, if asked about "AI companies", mention that you have access to tools that could provide that information.`,
          };
          return of([systemMessage, ...messages.filter((m) => m.role !== 'system')]);
        }
        // Ensure we always return an array wrapped in observable
        const messagesArray = Array.isArray(messages) ? messages : [messages];
        return of(messagesArray);
      }),
      switchMap((enhancedMessages) => this.sendMessage(enhancedMessages))
    );
  }

  // Create context from company data (similar to React version)
  private createContext(companies: any): string {
    // Handle different response formats from MCP
    let companiesArray: any[] = [];
    
    // Handle MCP response format with content array
    if (companies && companies.content && Array.isArray(companies.content)) {
      // Extract the actual data from the content array
      const contentData = companies.content[0];
      if (contentData && contentData.text) {
        try {
          // Try to parse JSON if it's a string
          const parsedData = JSON.parse(contentData.text);
          if (Array.isArray(parsedData)) {
            companiesArray = parsedData;
          } else if (parsedData.companies && Array.isArray(parsedData.companies)) {
            companiesArray = parsedData.companies;
          } else {
            companiesArray = [parsedData];
          }
        } catch (e) {
          console.error('Failed to parse MCP content:', e);
          return 'Error parsing company data.';
        }
      } else if (Array.isArray(contentData)) {
        companiesArray = contentData;
      } else {
        companiesArray = [contentData];
      }
    } else if (Array.isArray(companies)) {
      companiesArray = companies;
    } else if (companies && companies.companies && Array.isArray(companies.companies)) {
      companiesArray = companies.companies;
    } else if (companies && typeof companies === 'object') {
      // If it's a single company object, wrap it in an array
      companiesArray = [companies];
    }
    
    if (!companiesArray || companiesArray.length === 0) {
      return 'No company data available.';
    }

    return companiesArray
      .map((company) => {
        const chats = company.chats?.map((chat: any) => chat.chatbot).join(', ') || 'None';
        const llms =
          company.llms?.map((llm: any) => `${llm.llm} (${llm.specialization})`).join(', ') ||
          'None';

        return `Company: ${company.company}
Description: ${company.description}
Chatbots: ${chats}
LLM Models: ${llms}`;
      })
      .join('\n\n');
  }

  // Process user question with MCP context (similar to React version)
  processUserQuestion(question: string): Observable<string> {
    const apiKey = this.configService.getApiKey();
    if (!apiKey) {
      return throwError(() => new Error('OpenAI API key not configured. Please set your API key in the configuration.'));
    }

    const userMessage: OpenAIMessage = {
      role: 'user',
      content: question
    };

    // Use the enhanced context method
    return this.sendMessageWithMCPContext([userMessage]);
  }
}
