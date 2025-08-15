import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
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
  providedIn: 'root'
})
export class OpenAIService {
  private readonly openaiApiUrl = 'https://api.openai.com/v1/chat/completions';
  private configService = inject(ConfigService);

  constructor(private http: HttpClient) {}

  checkMCPHealth(): Observable<MCPHealthResponse> {
    const mcpServerUrl = this.configService.getMcpServerUrl();
    console.log('Checking MCP health at:', mcpServerUrl);
    
    // Make a direct GET request to the /health endpoint via proxy
    return this.http.get('/api/mcp/health').pipe(
      map((response: any) => {
        console.log('MCP Health response:', response);
        return {
          status: response.status === 'ok' ? 'healthy' : 'unhealthy',
          timestamp: new Date().toISOString(),
          data: response,
          serverType: 'real'
        };
      }),
      catchError(error => {
        console.error('MCP Health check failed:', error);
        console.error('Error details:', {
          status: error.status,
          statusText: error.statusText,
          message: error.message,
          url: mcpServerUrl
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
      'Authorization': `Bearer ${apiKey}`
    });

    const body = {
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    };

    return this.http.post<OpenAIResponse>(this.openaiApiUrl, body, { headers })
      .pipe(
        map(response => {
          if (response.choices && response.choices.length > 0) {
            return response.choices[0].message.content;
          }
          throw new Error('No response from OpenAI');
        }),
        catchError(error => {
          console.error('OpenAI API error:', error);
          return throwError(() => error);
        })
      );
  }

  // Initialize MCP connection
  initializeMCP(): Observable<any> {
    const headers = new HttpHeaders({
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json'
    });
    
    const initRequest = {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {
          "name": "angular-mcp-client",
          "version": "1.0.0"
        }
      }
    };
    
    return this.http.post('/api/mcp', initRequest, { headers, responseType: 'text' })
      .pipe(
        map((response: string) => {
          // Parse SSE format: "event: message\ndata: {json}"
          const lines = response.split('\n');
          const dataLine = lines.find(line => line.startsWith('data: '));
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
        catchError(error => {
          console.error('MCP initialization error:', error);
          return throwError(() => error);
        })
      );
  }

  // Method to interact with MCP server using JSON-RPC
  callMCPMethod(method: string, params?: any): Observable<any> {
    const mcpServerUrl = this.configService.getMcpServerUrl();
    console.log('Calling MCP method:', method, 'via proxy');
    
    const headers = new HttpHeaders({
      'Accept': 'application/json, text/event-stream',
      'Content-Type': 'application/json'
    });
    
    // MCP uses JSON-RPC 2.0 protocol
    const jsonRpcRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: method,
      params: params || {}
    };
    
    // Use proxy endpoint to avoid CORS issues
    return this.http.post('/api/mcp', jsonRpcRequest, { headers, responseType: 'text' })
      .pipe(
        map((response: string) => {
          // Parse SSE format: "event: message\ndata: {json}"
          const lines = response.split('\n');
          const dataLine = lines.find(line => line.startsWith('data: '));
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
        catchError(error => {
          console.error(`MCP ${method} method error:`, error);
          return throwError(() => error);
        })
      );
  }

  // Get available MCP tools
  getMCPTools(): Observable<any> {
    console.log('Fetching MCP tools from server');
    return this.callMCPMethod('tools/list');
  }

  // Call a specific MCP tool
  callMCPTool(toolName: string, params?: any): Observable<any> {
    console.log('Calling MCP tool:', toolName, 'with params:', params);
    return this.callMCPMethod('tools/call', {
      name: toolName,
      arguments: params || {}
    });
  }

  // Get diagnostic information from MCP server
  getMCPDiagnostic(): Observable<any> {
    return this.callMCPTool('diagnostic');
  }



  // Enhanced message sending that can utilize MCP server context
  sendMessageWithMCPContext(messages: OpenAIMessage[], mcpTools?: any): Observable<string> {
    // Add MCP tools context to the system message if provided
    if (mcpTools && mcpTools.tools && mcpTools.tools.length > 0) {
      const toolsDescription = mcpTools.tools.map((tool: any) => 
        `- ${tool.name}: ${tool.description || 'No description available'}`
      ).join('\n');
      
      const systemMessage: OpenAIMessage = {
        role: 'system',
        content: `You are an AI assistant with access to the following MCP (Model Context Protocol) tools:\n\n${toolsDescription}\n\nWhen a user asks about topics that could be answered using these tools, explain what information you could provide if you had access to call these tools. For example, if asked about "AI companies", mention that you have access to tools that could provide that information.`
      };
      messages = [systemMessage, ...messages.filter(m => m.role !== 'system')];
    }

    return this.sendMessage(messages);
  }
}