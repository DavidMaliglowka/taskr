import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import * as vscode from 'vscode';

export interface MCPConfig {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface MCPServerStatus {
  isRunning: boolean;
  pid?: number;
  error?: string;
}

export class MCPClientManager {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private config: MCPConfig;
  private status: MCPServerStatus = { isRunning: false };
  private connectionPromise: Promise<void> | null = null;

  constructor(config: MCPConfig) {
    this.config = config;
  }

  /**
   * Get the current server status
   */
  getStatus(): MCPServerStatus {
    return { ...this.status };
  }

  /**
   * Start the MCP server process and establish client connection
   */
  async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this._doConnect();
    return this.connectionPromise;
  }

  private async _doConnect(): Promise<void> {
    try {
      // Clean up any existing connections
      await this.disconnect();

      // Create the transport - it will handle spawning the server process internally
      console.log(`Starting MCP server: ${this.config.command} ${this.config.args?.join(' ') || ''}`);
      
      this.transport = new StdioClientTransport({
        command: this.config.command,
        args: this.config.args || [],
        cwd: this.config.cwd,
        env: this.config.env,
      });

      // Set up transport event handlers
      this.transport.onerror = (error: Error) => {
        console.error('MCP transport error:', error);
        this.status = { isRunning: false, error: error.message };
        vscode.window.showErrorMessage(`Task Master MCP transport error: ${error.message}`);
      };

      this.transport.onclose = () => {
        console.log('MCP transport closed');
        this.status = { isRunning: false };
        this.client = null;
        this.transport = null;
      };

      // Create the client
      this.client = new Client(
        {
          name: 'taskr-vscode-extension',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      // Start the transport (this spawns the server process)
      await this.transport.start();

      // Connect the client to the transport
      await this.client.connect(this.transport);

      // Update status
      this.status = {
        isRunning: true,
        pid: this.transport.pid || undefined,
      };

      console.log('MCP client connected successfully');
      vscode.window.showInformationMessage('Task Master connected successfully');

    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      this.status = {
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      // Clean up on error
      await this.disconnect();
      
      throw error;
    } finally {
      this.connectionPromise = null;
    }
  }

  /**
   * Disconnect from the MCP server and clean up resources
   */
  async disconnect(): Promise<void> {
    console.log('Disconnecting from MCP server');

    if (this.client) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('Error closing MCP client:', error);
      }
      this.client = null;
    }

    if (this.transport) {
      try {
        await this.transport.close();
      } catch (error) {
        console.error('Error closing MCP transport:', error);
      }
      this.transport = null;
    }

    this.status = { isRunning: false };
  }

  /**
   * Get the MCP client instance (if connected)
   */
  getClient(): Client | null {
    return this.client;
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName: string, arguments_: Record<string, unknown>): Promise<any> {
    if (!this.client) {
      throw new Error('MCP client is not connected');
    }

    try {
      const result = await this.client.callTool({
        name: toolName,
        arguments: arguments_,
      });

      return result;
    } catch (error) {
      console.error(`Error calling MCP tool "${toolName}":`, error);
      throw error;
    }
  }

  /**
   * Test the connection by calling a simple MCP tool
   */
  async testConnection(): Promise<boolean> {
    try {
      // Try to list available tools as a connection test
      if (!this.client) {
        return false;
      }
      
      const result = await this.client.listTools();
      console.log('Available MCP tools:', result.tools?.map(t => t.name) || []);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get stderr stream from the transport (if available)
   */
  getStderr(): NodeJS.ReadableStream | null {
    const stderr = this.transport?.stderr;
    return stderr ? (stderr as unknown as NodeJS.ReadableStream) : null;
  }

  /**
   * Get the process ID of the spawned server
   */
  getPid(): number | null {
    return this.transport?.pid || null;
  }
}

/**
 * Create MCP configuration from VS Code settings
 */
export function createMCPConfigFromSettings(): MCPConfig {
  const config = vscode.workspace.getConfiguration('taskmaster');
  
  const command = config.get<string>('mcp.command', 'npx');
  const args = config.get<string[]>('mcp.args', ['-y', '--package=task-master-ai', 'task-master-ai']);
  const cwd = config.get<string>('mcp.cwd', vscode.workspace.rootPath || '');
  const env = config.get<Record<string, string>>('mcp.env');

  return { 
    command, 
    args, 
    cwd: cwd || vscode.workspace.rootPath || '',
    env 
  };
} 