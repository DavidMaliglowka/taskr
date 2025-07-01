import React, { useState, useEffect, useReducer, useContext, createContext } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Import the shadcn Kanban components
import {
  KanbanProvider,
  KanbanBoard,
  KanbanHeader,
  KanbanCards,
  KanbanCard,
  type DragEndEvent,
  type Status,
  type Feature,
} from '@/components/ui/shadcn-io/kanban';

// TypeScript interfaces for Task Master integration
interface TaskMasterTask {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in-progress' | 'done' | 'blocked' | 'review';
  priority: 'high' | 'medium' | 'low';
  dependencies?: string[];
  details?: string;
  subtasks?: TaskMasterTask[];
}

interface MCPStatus {
  isRunning: boolean;
  pid?: number;
  error?: string;
}

interface WebviewMessage {
  type: string;
  requestId?: string;
  [key: string]: any;
}

// VS Code API declaration
declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (message: any) => void;
      setState: (state: any) => void;
      getState: () => any;
    };
  }
}

// State management types
interface AppState {
  tasks: TaskMasterTask[];
  mcpStatus: MCPStatus;
  loading: boolean;
  error?: string;
  requestId: number;
  retryCount: number;
}

type AppAction =
  | { type: 'SET_TASKS'; payload: TaskMasterTask[] }
  | { type: 'SET_MCP_STATUS'; payload: MCPStatus }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'INCREMENT_REQUEST_ID' }
  | { type: 'INCREMENT_RETRIES' }
  | { type: 'RESET_RETRIES' }
  | { type: 'UPDATE_TASK_STATUS'; payload: { taskId: string; newStatus: TaskMasterTask['status'] } };

// Sample Task Master data for demonstration
const sampleTasks: TaskMasterTask[] = [
  {
    id: '1',
    title: 'Set up VS Code Extension',
    description: 'Initialize the VS Code extension with proper manifest and entry point',
    status: 'done',
    priority: 'high',
    details: 'Extension manifest configured with webview capabilities and commands',
  },
  {
    id: '2',
    title: 'Create MCP Client',
    description: 'Implement MCP client for Task Master integration',
    status: 'done',
    priority: 'high',
    dependencies: ['1'],
  },
  {
    id: '3',
    title: 'Build React Webview',
    description: 'Set up React environment within VS Code webview context',
    status: 'done',
    priority: 'high',
    dependencies: ['1'],
  },
  {
    id: '4',
    title: 'Integrate shadcn/ui Components',
    description: 'Add shadcn/ui components and configure Tailwind CSS',
    status: 'in-progress',
    priority: 'high',
    dependencies: ['3'],
  },
  {
    id: '5',
    title: 'Implement Kanban Board',
    description: 'Create interactive Kanban board with drag-and-drop functionality',
    status: 'in-progress',
    priority: 'high',
    dependencies: ['4'],
  },
  {
    id: '6',
    title: 'Add Task Filtering',
    description: 'Implement filtering by status, priority, and tags',
    status: 'pending',
    priority: 'medium',
    dependencies: ['5'],
  },
  {
    id: '7',
    title: 'Create Task Details Panel',
    description: 'Build detailed task view with edit capabilities',
    status: 'pending',
    priority: 'medium',
    dependencies: ['5'],
  },
  {
    id: '8',
    title: 'Implement Task Analytics',
    description: 'Add progress tracking and performance metrics',
    status: 'pending',
    priority: 'low',
    dependencies: ['6', '7'],
  },
];

// Kanban column configuration
const kanbanStatuses: Status[] = [
  { id: 'pending', name: 'To Do', color: '#6B7280' },
  { id: 'in-progress', name: 'In Progress', color: '#F59E0B' },
  { id: 'review', name: 'Review', color: '#8B5CF6' },
  { id: 'done', name: 'Done', color: '#10B981' },
  { id: 'blocked', name: 'Blocked', color: '#EF4444' },
];

// State reducer
const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload, loading: false, error: undefined };
    case 'SET_MCP_STATUS':
      return { ...state, mcpStatus: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'INCREMENT_REQUEST_ID':
      return { ...state, requestId: state.requestId + 1 };
    case 'INCREMENT_RETRIES':
      return { ...state, retryCount: state.retryCount + 1 };
    case 'RESET_RETRIES':
      return { ...state, retryCount: 0 };
    case 'UPDATE_TASK_STATUS':
      const updatedTasks = state.tasks.map(task =>
        task.id === action.payload.taskId
          ? { ...task, status: action.payload.newStatus }
          : task
      );
      return { ...state, tasks: updatedTasks };
    default:
      return state;
  }
};

// Context for VS Code API
const VSCodeContext = createContext<{
  vscode?: ReturnType<NonNullable<typeof window.acquireVsCodeApi>>;
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-vscode-background text-vscode-foreground p-6">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong!</h1>
            <div className="bg-vscode-input rounded-lg p-4 border border-red-400">
              <p className="text-sm">Error: {this.state.error?.message}</p>
              <p className="text-xs opacity-70 mt-2">
                Check the developer console for more details.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Priority Badge Component
const PriorityBadge: React.FC<{ priority: TaskMasterTask['priority'] }> = ({ priority }) => {
  const colorMap = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30',
  };

  const priorityShort = {
    high: 'H',
    medium: 'M', 
    low: 'L'
  };

  return (
    <span 
      className={`
        inline-flex items-center justify-center
        px-1.5 py-0.5 sm:px-2 
        rounded text-xs font-medium border 
        min-w-[20px] sm:min-w-[24px]
        ${colorMap[priority]}
      `}
      title={priority}
    >
      <span className="block sm:hidden">{priorityShort[priority]}</span>
      <span className="hidden sm:block">{priority}</span>
    </span>
  );
};

// Task Card Component
const TaskCard: React.FC<{
  task: TaskMasterTask;
  index: number;
  status: string;
}> = ({ task, index, status }) => {
  return (
    <KanbanCard 
      id={task.id} 
      name={task.title} 
      index={index} 
      parent={status}
      className="
        p-2 sm:p-3 
        min-h-[80px] sm:min-h-[100px]
        touch-manipulation
        hover:shadow-lg transition-shadow duration-200
        cursor-grab active:cursor-grabbing
        select-none
      "
    >
      <div className="space-y-1 sm:space-y-2">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-medium text-xs sm:text-sm leading-tight flex-1 min-w-0">
            {task.title}
          </h3>
          <div className="flex-shrink-0">
            <PriorityBadge priority={task.priority} />
          </div>
        </div>
        
        {task.description && (
          <p className="text-xs text-vscode-foreground/70 line-clamp-2 leading-relaxed">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-vscode-foreground/50 truncate">
            #{task.id}
          </span>
          {task.dependencies && task.dependencies.length > 0 && (
            <span className="text-vscode-foreground/50 flex-shrink-0 ml-1">
              Deps: {task.dependencies.length}
            </span>
          )}
        </div>
      </div>
    </KanbanCard>
  );
};

// Main Kanban Board Component
const TaskMasterKanban: React.FC = () => {
  const context = useContext(VSCodeContext);
  if (!context) throw new Error('TaskMasterKanban must be used within VSCodeContext');

  const { state, dispatch } = context;
  const { tasks, loading, error } = state;

  // Group tasks by status
  const tasksByStatus = kanbanStatuses.reduce((acc, status) => {
    acc[status.id] = tasks.filter(task => task.status === status.id);
    return acc;
  }, {} as Record<string, TaskMasterTask[]>);

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const taskId = active.id as string;
    const newStatus = over.id as TaskMasterTask['status'];
    
    // Update task status locally
    dispatch({
      type: 'UPDATE_TASK_STATUS',
      payload: { taskId, newStatus }
    });

    // TODO: Send update to MCP server
    console.log(`Moving task ${taskId} to ${newStatus}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vscode-foreground mx-auto mb-4"></div>
          <p className="text-sm text-vscode-foreground/70">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-400 text-sm">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      <KanbanProvider 
        onDragEnd={handleDragEnd} 
        className="
          h-full 
          grid w-full gap-2 overflow-x-auto
          grid-cols-5
          lg:grid-cols-5
          md:grid-cols-3
          sm:grid-cols-2
          xs:grid-cols-1
        "
      >
        {kanbanStatuses.map(status => (
          <KanbanBoard 
            key={status.id} 
            id={status.id} 
            className="
              min-h-[50vh] min-w-[250px] max-w-[400px]
              lg:min-h-[60vh] lg:min-w-[280px]
              md:min-h-[55vh] md:min-w-[260px]
              sm:min-h-[50vh] sm:min-w-[240px]
              xs:min-h-[40vh] xs:min-w-[220px]
            "
          >
            <KanbanHeader name={status.name} color={status.color} className="px-2 py-1 text-xs sm:text-sm" />
            <KanbanCards className="gap-1 sm:gap-2">
              {tasksByStatus[status.id]?.map((task, index) => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  index={index} 
                  status={status.id}
                />
              ))}
            </KanbanCards>
          </KanbanBoard>
        ))}
      </KanbanProvider>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, {
    tasks: sampleTasks,
    mcpStatus: { isRunning: false },
    loading: false,
    requestId: 0,
    retryCount: 0,
  });

  const [vscode] = useState(() => {
    try {
      return window.acquireVsCodeApi?.();
    } catch (error) {
      console.warn('VS Code API not available:', error);
      return undefined;
    }
  });

  useEffect(() => {
    if (!vscode) return;

    const handleMessage = (event: MessageEvent<WebviewMessage>) => {
      const message = event.data;
      console.log('Received message from extension:', message);

      switch (message.type) {
        case 'mcpStatusResponse':
          dispatch({ type: 'SET_MCP_STATUS', payload: message.status });
          break;
        case 'mcpCallResponse':
          if (message.result?.tasks) {
            dispatch({ type: 'SET_TASKS', payload: message.result.tasks });
          }
          break;
        case 'error':
          dispatch({ type: 'SET_ERROR', payload: message.error });
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Request initial MCP status
    vscode.postMessage({ type: 'getMcpStatus' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [vscode]);

  return (
    <VSCodeContext.Provider value={{ vscode, state, dispatch }}>
      <div className="min-h-screen bg-vscode-background text-vscode-foreground">
        <div className="h-screen flex flex-col">
          {/* Header */}
          <div className="border-b border-vscode-border p-2 sm:p-3 lg:p-4 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <h1 className="text-lg sm:text-xl font-bold truncate">
                  🎯 Task Master Kanban
                </h1>
                <p className="text-xs sm:text-sm text-vscode-foreground/70 hidden sm:block">
                  Visual task management for your projects
                </p>
              </div>
              <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
                <div className={`h-2 w-2 rounded-full ${state.mcpStatus.isRunning ? 'bg-green-400' : 'bg-red-400'}`}></div>
                <span className="text-xs text-vscode-foreground/70 hidden sm:inline">
                  MCP {state.mcpStatus.isRunning ? 'Connected' : 'Disconnected'}
                </span>
                <span className="text-xs text-vscode-foreground/70 sm:hidden">
                  {state.mcpStatus.isRunning ? '●' : '○'}
                </span>
              </div>
            </div>
          </div>

          {/* Kanban Board */}
          <div className="flex-1 p-1 sm:p-2 lg:p-4 overflow-hidden">
            <TaskMasterKanban />
          </div>

          {/* Footer */}
          <div className="border-t border-vscode-border p-1 sm:p-2 text-center flex-shrink-0">
            <p className="text-xs text-vscode-foreground/50">
              <span className="hidden sm:inline">
                Total Tasks: {state.tasks.length} | 
                Completed: {state.tasks.filter(t => t.status === 'done').length} |
                In Progress: {state.tasks.filter(t => t.status === 'in-progress').length}
              </span>
              <span className="sm:hidden">
                {state.tasks.length} tasks ({state.tasks.filter(t => t.status === 'done').length} done)
              </span>
            </p>
          </div>
        </div>
      </div>
    </VSCodeContext.Provider>
  );
};

// Bootstrap the React application
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} else {
  console.error('Root container not found');
} 