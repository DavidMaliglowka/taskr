// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Task Master Kanban extension is now active!');

	// Register the command to show the Kanban board
	const disposable = vscode.commands.registerCommand('taskr.showKanbanBoard', () => {
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

		// Set the HTML content for the webview
		panel.webview.html = getWebviewContent(panel.webview, context.extensionUri);
	});

	context.subscriptions.push(disposable);
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
export function deactivate() {}
