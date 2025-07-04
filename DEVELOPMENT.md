# Task Master Kanban for VS Code

A visual Kanban board extension for VS Code that integrates with [Task Master AI](https://github.com/TaskMasterEYJ/task-master-ai) projects, providing an intuitive drag-and-drop interface for task management.

![Task Master Kanban](https://img.shields.io/badge/VS%20Code-Extension-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.1-38bdf8)

## Features

- **Visual Kanban Board**: Drag-and-drop task management with columns for different statuses (To Do, In Progress, Review, Done, Deferred)
- **Task Master Integration**: Seamlessly connects to Task Master AI projects via MCP (Model Context Protocol)
- **Real-time Updates**: Automatic polling for task changes with smart frequency adjustment
- **Detailed Task View**: View and edit task details, implementation notes, and test strategies
- **AI-Powered Features**: Regenerate and append task content using AI capabilities
- **Offline Support**: Graceful handling of network interruptions with cached data
- **Modern UI**: Built with ShadCN UI components and Tailwind CSS for a native VS Code experience
- **Performance Optimized**: Smart caching, lazy loading, and background refresh capabilities

## Prerequisites

Before running this project, ensure you have:

- **Node.js** (version 18 or higher)
- **pnpm** (recommended) or npm
- **VS Code** (version 1.74.0 or higher)
- **Task Master AI** package (`task-master-ai`) available globally or via npx

### Task Master AI Setup

This extension requires Task Master AI to function. Install it globally:

```bash
npm install -g task-master-ai
```

Or ensure it's available via npx (it will be installed automatically when needed).

## Installation

### For Development

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd taskr
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Build the extension:**
   ```bash
   pnpm run compile
   # or
   npm run compile
   ```

### For VS Code Extension Development

1. **Open in VS Code:**
   ```bash
   code .
   ```

2. **Install recommended extensions** when prompted (ESLint, TypeScript, etc.)

3. **Run the extension:**
   - Press `F5` to open a new VS Code window with the extension loaded
   - Or use the "Run Extension" debug configuration

## Usage

### Opening the Kanban Board

1. **Initialize a Task Master project** in your workspace (if not already done):
   ```bash
   npx task-master-ai init
   ```

2. **Open the Command Palette** (`Ctrl+Shift+P` / `Cmd+Shift+P`)

3. **Run the command:**
   ```
   Task Master Kanban: Show Board
   ```

4. The Kanban board will open in a new webview panel

### Managing Tasks

- **Drag and Drop**: Move tasks between columns to change their status
- **View Details**: Click on a task to see detailed information
- **Edit Tasks**: Double-click a task to edit its content
- **AI Features**: Use the AI panel in task details to regenerate or append content

### Configuration

The extension can be configured via VS Code settings. Access them through:
- Command Palette → "Preferences: Open Settings (UI)"
- Search for "Task Master Kanban"

Key settings include:
- **MCP Server Command**: Path to task-master-ai executable
- **Connection Timeout**: How long to wait for MCP server responses
- **Auto Refresh**: Enable/disable automatic task polling
- **Theme Preferences**: UI theme and display options

## Development

### Project Structure

```
taskr/
├── src/
│   ├── extension.ts              # VS Code extension entry point
│   ├── webview/
│   │   └── index.tsx            # React Kanban board UI
│   ├── components/
│   │   ├── TaskDetailsView.tsx   # Task detail view component
│   │   └── ui/                  # ShadCN UI components
│   └── utils/
│       ├── mcpClient.ts         # MCP client manager
│       ├── taskMasterApi.ts     # Task Master API wrapper
│       └── taskFileReader.ts    # Task file utilities
├── dist/                        # Built extension files
├── esbuild.js                   # Build configuration
└── package.json
```

### Available Scripts

```bash
# Development
pnpm run watch                   # Watch mode for development
pnpm run compile                 # Build extension and webview
pnpm run check-types            # TypeScript type checking
pnpm run lint                   # ESLint code linting

# Testing
pnpm run test                   # Run extension tests
pnpm run pretest               # Prepare for testing

# Production
pnpm run package               # Build for production
pnpm run vscode:prepublish     # Prepare for publishing
```

### Watch Mode Development

For active development, use watch mode:

```bash
pnpm run watch
```

This will:
- Watch for TypeScript changes in the extension
- Watch for React changes in the webview
- Automatically rebuild on file changes

Then press `F5` in VS Code to launch the extension development host.

### Adding New UI Components

This project uses [ShadCN UI](https://ui.shadcn.com/) components. To add new components:

```bash
# Example: Adding a new button variant
npx shadcn@latest add button
```

Components are automatically configured to work with the VS Code theme system.

## Architecture

### MCP Integration

The extension communicates with Task Master AI via the Model Context Protocol (MCP):

1. **Extension Host** (Node.js): Manages the MCP client connection
2. **Webview** (React): Displays the UI and sends commands via message passing
3. **MCP Server** (`task-master-ai`): Handles task operations and AI features

### State Management

- **Extension State**: Managed in `src/extension.ts` with connection handling and polling
- **Webview State**: React state with useReducer for complex state updates
- **Caching**: Intelligent caching system with background refresh and LRU eviction

### Error Handling

Comprehensive error handling with:
- Connection retry logic with exponential backoff
- Offline mode with cached data
- Toast notifications for user feedback
- Detailed error logging for debugging

## Troubleshooting

### Common Issues

1. **"Task Master not found" error:**
   - Ensure `task-master-ai` is installed: `npm install -g task-master-ai`
   - Check that Node.js is in your PATH
   - Restart VS Code after installing Node.js

2. **Connection timeout:**
   - Increase timeout in settings: `taskmaster.mcp.timeout`
   - Check if Task Master project is properly initialized
   - Verify workspace contains a `.taskmaster` directory

3. **Webview not loading:**
   - Check VS Code developer console for errors (`Help → Toggle Developer Tools`)
   - Try reloading the window (`Ctrl+R` / `Cmd+R`)
   - Rebuild the extension: `pnpm run compile`

4. **Tasks not updating:**
   - Verify MCP connection status in the status bar
   - Check network connectivity
   - Try manual refresh with "Task Master Kanban: Check Connection"

### Debug Mode

Enable debug logging by setting:
```json
{
  "taskmaster.debug.enableLogging": true,
  "taskmaster.debug.logLevel": "debug"
}
```

Logs will appear in:
- VS Code Output panel (Task Master channel)
- Browser developer console (for webview issues)

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and test thoroughly
4. Ensure all tests pass: `pnpm test`
5. Lint your code: `pnpm run lint`
6. Commit your changes: `git commit -m 'Add amazing feature'`
7. Push to the branch: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Style

This project follows:
- **TypeScript**: Strict mode enabled
- **ESLint**: Configured for TypeScript and React
- **Prettier**: Integrated with ESLint
- **Conventional Commits**: For clear commit messages

### Testing

Run tests before submitting:
```bash
pnpm run test
```

For manual testing:
1. Load the extension in development mode (`F5`)
2. Test with various Task Master project configurations
3. Verify functionality in both light and dark VS Code themes

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Related Projects

- [Task Master AI](https://github.com/TaskMasterEYJ/task-master-ai) - The core task management system
- [ShadCN UI](https://ui.shadcn.com/) - UI component library
- [Model Context Protocol](https://modelcontextprotocol.io/) - Communication protocol for AI tools

## Support

If you encounter issues or have questions:

1. Check the [troubleshooting section](#troubleshooting) above
2. Search existing [GitHub issues](../../issues)
3. Create a new issue with:
   - VS Code version
   - Extension version
   - Task Master AI version
   - Steps to reproduce
   - Error logs (if any)

---

**Enjoy using Task Master Kanban!** 🎯
