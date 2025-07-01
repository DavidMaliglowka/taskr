// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { MCPClientManager, createMCPConfigFromSettings } from './utils/mcpClient';
import { ConfigManager } from './utils/configManager';

// Global MCP client manager instance
let mcpClient: MCPClientManager | null = null;
let configManager: ConfigManager | null = null;
let activeWebviewPanels: vscode.WebviewPanel[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Task Master Kanban extension is now active!');

	// Initialize configuration manager
	configManager = ConfigManager.getInstance();

	// Initialize the MCP client
	initializeMCPClient();

	// Register the command to show the Kanban board
	const showKanbanCommand = vscode.commands.registerCommand('taskr.showKanbanBoard', async () => {
		try {
			// Ensure MCP client is connected before showing the board
			await ensureMCPConnection();

			// Create and show the webview panel
			const panel = vscode.window.createWebviewPanel(
				'taskMasterKanban',
				'Task Master Kanban Board',
				vscode.ViewColumn.One,
				{
					enableScripts: true,
					retainContextWhenHidden: true
				}
			);

			// Track active panels for configuration updates
			activeWebviewPanels.push(panel);

			// Set the HTML content for the webview
			panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

			// Handle messages from the webview
			panel.webview.onDidReceiveMessage(async (message) => {
				await handleWebviewMessage(message, panel.webview);
			});

			// Clean up when panel is disposed
			panel.onDidDispose(() => {
				const index = activeWebviewPanels.indexOf(panel);
				if (index > -1) {
					activeWebviewPanels.splice(index, 1);
				}
			});

		} catch (error) {
			console.error('Error showing Kanban board:', error);
			vscode.window.showErrorMessage(`Failed to show Kanban board: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// Register command to check MCP connection status
	const checkConnectionCommand = vscode.commands.registerCommand('taskr.checkConnection', async () => {
		try {
			if (!mcpClient) {
				vscode.window.showWarningMessage('MCP client is not initialized');
				return;
			}

			const status = mcpClient.getStatus();
			if (status.isRunning) {
				const testResult = await mcpClient.testConnection();
				if (testResult) {
					vscode.window.showInformationMessage(`Task Master connected successfully (PID: ${status.pid})`);
				} else {
					vscode.window.showWarningMessage('Task Master is running but connection test failed');
				}
			} else {
				vscode.window.showWarningMessage(`Task Master is not running. Error: ${status.error || 'Unknown'}`);
			}
		} catch (error) {
			console.error('Error checking connection:', error);
			vscode.window.showErrorMessage(`Connection check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// Register command to reconnect MCP client
	const reconnectCommand = vscode.commands.registerCommand('taskr.reconnect', async () => {
		try {
			await reconnectMCPClient();
			vscode.window.showInformationMessage('Reconnection attempt completed');
		} catch (error) {
			console.error('Error reconnecting:', error);
			vscode.window.showErrorMessage(`Reconnection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	});

	// Register command to open settings
	const openSettingsCommand = vscode.commands.registerCommand('taskr.openSettings', () => {
		vscode.commands.executeCommand('workbench.action.openSettings', '@ext:taskr taskmaster');
	});

	context.subscriptions.push(showKanbanCommand, checkConnectionCommand, reconnectCommand, openSettingsCommand);

	// Listen for configuration changes
	const configChangeListener = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('taskmaster')) {
			console.log('Task Master configuration changed, updating...');
			
			// Update all active webviews with new configuration
			const currentConfig = configManager?.getConfig();
			if (currentConfig) {
				activeWebviewPanels.forEach(panel => {
					panel.webview.postMessage({
						type: 'configUpdate',
						config: currentConfig
					});
				});
			}

			// Reconnect MCP client if MCP settings changed
			if (event.affectsConfiguration('taskmaster.mcp')) {
				console.log('MCP configuration changed, reconnecting...');
				reconnectMCPClient().catch(error => {
					console.error('Error reconnecting after config change:', error);
				});
			}
		}
	});

	// Listen for configuration manager changes
	if (configManager) {
		configManager.onConfigChange((newConfig) => {
			console.log('ConfigManager configuration updated:', newConfig);
			
			// Notify all active webviews
			activeWebviewPanels.forEach(panel => {
				panel.webview.postMessage({
					type: 'configUpdate',
					config: newConfig
				});
			});
		});
	}

	context.subscriptions.push(configChangeListener);
}

/**
 * Initialize the MCP client with current settings
 */
function initializeMCPClient(): void {
	try {
		const config = createMCPConfigFromSettings();
		mcpClient = new MCPClientManager(config);
		console.log('MCP client initialized with config:', config);
	} catch (error) {
		console.error('Failed to initialize MCP client:', error);
		vscode.window.showErrorMessage(`Failed to initialize Task Master client: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

/**
 * Ensure MCP client is connected, attempt to connect if not
 */
async function ensureMCPConnection(): Promise<void> {
	if (!mcpClient) {
		initializeMCPClient();
		if (!mcpClient) {
			throw new Error('Failed to initialize MCP client');
		}
	}

	const status = mcpClient.getStatus();
	if (!status.isRunning) {
		console.log('MCP client not running, attempting to connect...');
		vscode.window.showInformationMessage('Connecting to Task Master...');
		await mcpClient.connect();
	}
}

/**
 * Reconnect the MCP client with fresh settings
 */
async function reconnectMCPClient(): Promise<void> {
	if (mcpClient) {
		await mcpClient.disconnect();
	}
	
	initializeMCPClient();
	
	if (mcpClient) {
		await mcpClient.connect();
	} else {
		throw new Error('Failed to reinitialize MCP client');
	}
}

/**
 * Handle messages from the webview
 */
async function handleWebviewMessage(message: any, webview: vscode.Webview): Promise<void> {
	switch (message.type) {
		case 'mcpStatus':
			const status = mcpClient?.getStatus() || { isRunning: false, error: 'Client not initialized' };
			webview.postMessage({
				type: 'mcpStatusResponse',
				status
			});
			break;

		case 'getConfig':
			const currentConfig = configManager?.getConfig();
			webview.postMessage({
				type: 'configResponse',
				requestId: message.requestId,
				config: currentConfig
			});
			break;

		case 'updateConfig':
			try {
				if (!configManager) {
					throw new Error('Configuration manager not initialized');
				}

				await configManager.updateConfig(message.updates);
				
				webview.postMessage({
					type: 'configUpdateResponse',
					requestId: message.requestId,
					success: true,
					config: configManager.getConfig()
				});

				vscode.window.showInformationMessage('Configuration updated successfully');
			} catch (error) {
				webview.postMessage({
					type: 'configUpdateResponse',
					requestId: message.requestId,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});

				vscode.window.showErrorMessage(`Failed to update configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
			break;

		case 'openSettings':
			vscode.commands.executeCommand('workbench.action.openSettings', '@ext:taskr taskmaster');
			break;

		case 'mcpCall':
			try {
				if (!mcpClient) {
					throw new Error('MCP client not initialized');
				}

				await ensureMCPConnection();
				const result = await mcpClient.callTool(message.toolName, message.arguments);
				
				webview.postMessage({
					type: 'mcpCallResponse',
					requestId: message.requestId,
					success: true,
					result
				});
			} catch (error) {
				webview.postMessage({
					type: 'mcpCallResponse',
					requestId: message.requestId,
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
			break;

		default:
			console.log('Unknown message type:', message.type);
	}
}

function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	// Get the local path to main script run in the webview
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js'));

	// Use a nonce to whitelist which scripts can be run
	const nonce = getNonce();

	return `<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
			<title>Task Master Kanban Board</title>
		</head>
		<body>
			<div id="root"></div>
			<script nonce="${nonce}" type="module" src="${scriptUri}"></script>
		</body>
		</html>`;
}

function getNonce() {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (mcpClient) {
		mcpClient.disconnect().catch(error => {
			console.error('Error disconnecting MCP client during deactivation:', error);
		});
	}
}
