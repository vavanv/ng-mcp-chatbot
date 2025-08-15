# Angular MCP Client Application

A modern Angular application that integrates with Model Context Protocol (MCP) servers to provide AI-powered functionality with live data access.

## Features

- **MCP Integration**: Connects to MCP servers using JSON-RPC 2.0 protocol
- **AI Chat Interface**: Interactive chat with OpenAI GPT models
- **Live Data Access**: Retrieves real-time information through MCP tools
- **Server-Sent Events**: Handles SSE responses from MCP servers
- **Proxy Configuration**: Secure CORS-free communication with external MCP servers
- **API Key Management**: Configurable OpenAI API key storage

## Architecture

### Core Components

- **App Component** (`app.ts`): Main application interface with chat functionality
- **OpenAI Service** (`openai.service.ts`): Handles OpenAI API and MCP server communication
- **Config Service** (`config.service.ts`): Manages application configuration
- **API Key Config** (`api-key-config.component.ts`): API key management interface

### MCP Integration

The application connects to MCP servers that provide specialized tools and data sources:

- **Current MCP Server**: AI Companies MCP Server (`https://mcp.bmcom.ca/mcp`)
- **Protocol**: JSON-RPC 2.0 over HTTPS
- **Response Format**: Server-Sent Events (SSE)
- **Capabilities**: Tools for querying AI company information

## Setup

### Prerequisites

- Node.js (v18 or higher)
- Angular CLI
- OpenAI API key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd angular-app
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   yarn install
   ```

3. Start the development server:
   ```bash
   ng serve --proxy-config proxy.conf.json
   ```

4. Open your browser and navigate to `http://localhost:4200`

## Configuration

### MCP Server Configuration

The MCP server connection is configured in `proxy.conf.json`:

```json
{
  "/api/mcp": {
    "target": "https://mcp.bmcom.ca",
    "secure": true,
    "changeOrigin": true,
    "pathRewrite": {
      "^/api/mcp": "/mcp"
    },
    "headers": {
      "Accept": "application/json, text/event-stream",
      "Content-Type": "application/json"
    }
  }
}
```

### OpenAI API Configuration

1. Click the "Configure API Key" button in the application
2. Enter your OpenAI API key
3. The key is stored locally in browser storage

## Usage

### Basic Chat

1. Configure your OpenAI API key
2. Type messages in the chat interface
3. The AI will respond using OpenAI's GPT models

### MCP-Enhanced Queries

Ask questions that can benefit from live data:

- "What AI companies are available?" - Uses MCP tools to fetch current company data
- General questions are enhanced with MCP tool context when available

### MCP Health Check

The application automatically:
- Initializes MCP connection on startup
- Displays connection status in the interface
- Shows MCP server information when connected

## Development

### Project Structure

```
src/
├── app/
│   ├── app.ts                    # Main application component
│   ├── openai.service.ts         # OpenAI and MCP service
│   ├── config.service.ts         # Configuration management
│   ├── api-key-config.component.ts # API key configuration
│   └── ...
├── index.html
├── main.ts
└── styles.css
```

### Key Services

#### OpenAI Service

- `initializeMCP()`: Establishes MCP server connection
- `callMCPMethod()`: Executes MCP tool methods
- `sendMessage()`: Sends messages to OpenAI API
- `sendMessageWithMCPContext()`: Enhanced messages with MCP tool context

#### MCP Protocol Implementation

- JSON-RPC 2.0 initialization handshake
- SSE response parsing
- Error handling and retry logic
- Tool discovery and execution

### Building for Production

```bash
ng build --prod
```

## Troubleshooting

### Common Issues

1. **MCP Connection Failed**
   - Check proxy configuration in `proxy.conf.json`
   - Verify MCP server is accessible
   - Check browser console for detailed errors

2. **OpenAI API Errors**
   - Verify API key is correctly configured
   - Check API key permissions and billing
   - Monitor rate limits

3. **CORS Issues**
   - Ensure proxy configuration is properly set up
   - Start development server with `--proxy-config proxy.conf.json`

### Debug Mode

Enable detailed logging by opening browser developer tools and checking the console for:
- MCP initialization messages
- Tool execution logs
- API request/response details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.1.6.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Karma](https://karma-runner.github.io) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
