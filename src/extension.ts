// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// Restore full imports for MCP and utilities
// import { MCPClientManager, createMCPConfigFromSettings } from './utils/mcpClient';
// import { ConfigManager } from './utils/configManager';
// import { TaskMasterApi } from './utils/taskMasterApi';

// Global MCP client manager instance
let mcpClient: any = null;
let configManager: any = null;
let taskMasterApi: any = null;
let activeWebviewPanels: vscode.WebviewPanel[] = [];

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('🎉 Task Master Kanban extension is now active!');
	console.log('🎉 Extension context:', context);
	
	// Register command to show Kanban board with webview
	const showKanbanCommand = vscode.commands.registerCommand('taskr.showKanbanBoard', async () => {
		console.log('🎯 Show Kanban command executed!');
		
		// Check if panel already exists
		const existingPanel = activeWebviewPanels.find(panel => panel.title === 'Task Master Kanban');
		if (existingPanel) {
			existingPanel.reveal(vscode.ViewColumn.One);
			return;
		}

		// Create webview panel
		const panel = vscode.window.createWebviewPanel(
			'taskrKanban',
			'Task Master Kanban',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(context.extensionUri, 'dist')
				]
			}
		);

		// Add to active panels
		activeWebviewPanels.push(panel);

		// Handle panel disposal
		panel.onDidDispose(() => {
			const index = activeWebviewPanels.findIndex(p => p === panel);
			if (index !== -1) {
				activeWebviewPanels.splice(index, 1);
			}
		});

		// Set webview HTML content
		panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);

		// Handle messages from webview
		panel.webview.onDidReceiveMessage(
			async (message) => {
				console.log('📨 Received message from webview:', message);
				
				switch (message.type) {
					case 'ready':
						console.log('🚀 Webview is ready!');
						// Send initial configuration or data
						panel.webview.postMessage({
							type: 'init',
							data: { status: 'Extension connected!' }
						});
						break;
						
					case 'getTasks':
						console.log('📋 Getting tasks...');
						// TODO: Implement MCP get_tasks call
						panel.webview.postMessage({
							type: 'tasksData',
							requestId: message.requestId,
							data: getSampleTasks()
						});
						break;
						
					case 'updateTaskStatus':
						console.log('🔄 Updating task status:', message.data);
						// TODO: Implement MCP set_task_status call
						panel.webview.postMessage({
							type: 'taskStatusUpdated',
							requestId: message.requestId,
							success: true
						});
						break;
						
					default:
						console.log('❓ Unknown message type:', message.type);
				}
			}
		);

		vscode.window.showInformationMessage('Task Master Kanban Board opened!');
	});

	const checkConnectionCommand = vscode.commands.registerCommand('taskr.checkConnection', async () => {
		console.log('🔗 Check connection command executed!');
		vscode.window.showInformationMessage('Check connection command works!');
	});

	const reconnectCommand = vscode.commands.registerCommand('taskr.reconnect', async () => {
		console.log('🔄 Reconnect command executed!');
		vscode.window.showInformationMessage('Reconnect command works!');
	});

	const openSettingsCommand = vscode.commands.registerCommand('taskr.openSettings', () => {
		console.log('⚙️ Open settings command executed!');
		vscode.commands.executeCommand('workbench.action.openSettings', '@ext:taskr taskmaster');
	});

	context.subscriptions.push(showKanbanCommand, checkConnectionCommand, reconnectCommand, openSettingsCommand);
	
	console.log('✅ All commands registered successfully!');
}

// Generate webview HTML content
function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	// Get the local path to main script run in the webview
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'index.js'));
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'dist', 'index.css'));

	// Use a nonce to only allow specific scripts to be run
	const nonce = getNonce();

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
	<link href="${styleUri}" rel="stylesheet">
	<title>Task Master Kanban</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
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

// Sample data for testing
function getSampleTasks() {
	return [
		{
			id: '1',
			title: 'Set up project structure',
			description: 'Create the basic VS Code extension structure',
			status: 'done',
			priority: 'high',
			details: 'Initialize package.json, create src folder, set up TypeScript configuration',
			dependencies: []
		},
		{
			id: '2',
			title: 'Implement MCP Client',
			description: 'Create MCP client to communicate with task-master-ai',
			status: 'done',
			priority: 'high',
			details: 'Use @modelcontextprotocol/sdk to create a client that can connect to task-master-ai server',
			dependencies: ['1']
		},
		{
			id: '3',
			title: 'Create configuration system',
			description: 'Build configuration management for the extension',
			status: 'done',
			priority: 'medium',
			details: 'Create ConfigManager class to handle VS Code settings and configuration updates',
			dependencies: ['1']
		},
		{
			id: '4',
			title: 'Create basic Webview panel with React',
			description: 'Set up the webview infrastructure with React',
			status: 'done',
			priority: 'high',
			details: 'Create webview panel, integrate React, set up bundling with esbuild',
			dependencies: ['1', '2', '3']
		},
		{
			id: '5',
			title: 'Integrate shadcn/ui Kanban component',
			description: 'Add the Kanban board UI using shadcn/ui components',
			status: 'done',
			priority: 'medium',
			details: 'Install and customize shadcn/ui Kanban component for VS Code theming',
			dependencies: ['4']
		},
		{
			id: '6',
			title: 'Implement get_tasks MCP tool integration',
			description: 'Use the MCP client to call the get_tasks tool and retrieve task data',
			status: 'in-progress',
			priority: 'high',
			details: 'Connect to task-master-ai server and fetch real task data instead of using sample data',
			dependencies: ['2']
		},
		{
			id: '7',
			title: 'Add task status updates via MCP',
			description: 'Implement drag-and-drop task status updates through MCP',
			status: 'pending',
			priority: 'high',
			details: 'When tasks are moved between columns, update status via set_task_status MCP tool',
			dependencies: ['6']
		},
		{
			id: '8',
			title: 'Add real-time task synchronization',
			description: 'Keep the Kanban board in sync with task file changes',
			status: 'pending',
			priority: 'medium',
			details: 'Implement file watching and real-time updates when tasks.json changes',
			dependencies: ['6', '7']
		}
	];
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log('👋 Task Master Kanban extension deactivated');
	
	// Close all active webview panels
	activeWebviewPanels.forEach(panel => panel.dispose());
	activeWebviewPanels = [];
}
