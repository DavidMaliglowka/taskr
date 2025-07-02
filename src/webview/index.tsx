import React, { useState, useEffect, useReducer, useContext, createContext, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

// Import shadcn Kanban components
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

interface WebviewMessage {
  type: string;
  requestId?: string;
  data?: any;
  success?: boolean;
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
  loading: boolean;
  error?: string;
  requestId: number;
  isConnected: boolean;
  connectionStatus: string;
}

type AppAction =
  | { type: 'SET_TASKS'; payload: TaskMasterTask[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'INCREMENT_REQUEST_ID' }
  | { type: 'UPDATE_TASK_STATUS'; payload: { taskId: string; newStatus: TaskMasterTask['status'] } }
  | { type: 'SET_CONNECTION_STATUS'; payload: { isConnected: boolean; status: string } };

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
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: undefined };
    case 'INCREMENT_REQUEST_ID':
      return { ...state, requestId: state.requestId + 1 };
    case 'UPDATE_TASK_STATUS':
      const updatedTasks = state.tasks.map(task =>
        task.id === action.payload.taskId
          ? { ...task, status: action.payload.newStatus }
          : task
      );
      return { ...state, tasks: updatedTasks };
    case 'SET_CONNECTION_STATUS':
      return { 
        ...state, 
        isConnected: action.payload.isConnected,
        connectionStatus: action.payload.status
      };
    default:
      return state;
  }
};

// Context for VS Code API
const VSCodeContext = createContext<{
  vscode?: ReturnType<NonNullable<typeof window.acquireVsCodeApi>>;
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  sendMessage: (message: WebviewMessage) => Promise<any>;
  availableHeight: number;
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

  return (
    <span 
      className={`
        inline-flex items-center justify-center
        px-2 py-0.5
        rounded text-xs font-medium border 
        min-w-[50px]
        ${colorMap[priority]}
      `}
      title={priority}
    >
      {priority}
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
        kanban-card
        p-3 w-full
        min-h-[120px]
        touch-manipulation
        cursor-grab active:cursor-grabbing
        select-none
        border border-vscode-border/50
        bg-vscode-input/80 hover:bg-vscode-input
        rounded-md
        flex-shrink-0
      "
    >
      <div className="space-y-3 h-full flex flex-col">
        <div className="flex items-start justify-between gap-2 flex-shrink-0">
          <h3 className="font-medium text-sm leading-tight flex-1 min-w-0 text-vscode-foreground">
            {task.title}
          </h3>
          <div className="flex-shrink-0">
            <PriorityBadge priority={task.priority} />
          </div>
        </div>
        
        {task.description && (
          <p className="text-xs text-vscode-foreground/70 line-clamp-3 leading-relaxed flex-1 min-h-0">
            {task.description}
          </p>
        )}
        
        <div className="flex items-center justify-between text-xs mt-auto pt-2 flex-shrink-0 border-t border-vscode-border/20">
          <span className="font-mono text-vscode-foreground/50 flex-shrink-0">
            #{task.id}
          </span>
          {task.dependencies && task.dependencies.length > 0 && (
            <span className="text-vscode-foreground/50 flex-shrink-0 ml-2">
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

  const { state, dispatch, sendMessage, availableHeight } = context;
  const { tasks, loading, error } = state;

  // Calculate header height for proper kanban board sizing
  const headerHeight = 73; // Header with padding and border
  const kanbanHeight = availableHeight - headerHeight;

  // Group tasks by status
  const tasksByStatus = kanbanStatuses.reduce((acc, status) => {
    acc[status.id] = tasks.filter(task => task.status === status.id);
    return acc;
  }, {} as Record<string, TaskMasterTask[]>);

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const taskId = active.id as string;
    const newStatus = over.id as TaskMasterTask['status'];
    
    // Find the task that was moved
    const task = tasks.find(t => t.id === taskId);
    if (!task || task.status === newStatus) return;

    console.log(`🔄 Moving task ${taskId} from ${task.status} to ${newStatus}`);
    
    // Update task status locally (optimistic update)
    dispatch({
      type: 'UPDATE_TASK_STATUS',
      payload: { taskId, newStatus }
    });

    try {
      // Send update to extension
      await sendMessage({
        type: 'updateTaskStatus',
        data: { taskId, newStatus, oldStatus: task.status }
      });
      
      console.log(`✅ Task ${taskId} status updated successfully`);
    } catch (error) {
      console.error(`❌ Failed to update task ${taskId}:`, error);
      
      // Revert the optimistic update on error
      dispatch({
        type: 'UPDATE_TASK_STATUS',
        payload: { taskId, newStatus: task.status }
      });
      
      dispatch({
        type: 'SET_ERROR',
        payload: `Failed to update task status: ${error}`
      });
    }
  };

  if (loading) {
    return (
      <div 
        className="flex items-center justify-center" 
        style={{ height: `${kanbanHeight}px` }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vscode-foreground mx-auto mb-4"></div>
          <p className="text-sm text-vscode-foreground/70">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 m-4">
        <p className="text-red-400 text-sm">Error: {error}</p>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col"
      style={{ height: `${availableHeight}px` }}
    >
      <div className="flex-shrink-0 p-4 bg-vscode-sidebar-background border-b border-vscode-border">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-vscode-foreground">Task Master Kanban</h1>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${state.isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className="text-xs text-vscode-foreground/70">
              {state.connectionStatus}
            </span>
          </div>
        </div>
      </div>
      
      <div 
        className="flex-1 px-4 py-4 overflow-hidden"
        style={{ height: `${kanbanHeight}px` }}
      >
        <KanbanProvider 
          onDragEnd={handleDragEnd} 
          className="
            kanban-container
            w-full h-full
            overflow-x-auto overflow-y-hidden
          "
        >
          <div className="
            flex gap-4 
            min-w-max
            h-full
            pb-2
          ">
            {kanbanStatuses.map(status => {
              const columnHeaderHeight = 49; // Header with padding and border
              const columnPadding = 16; // p-2 = 8px top + 8px bottom
              const availableColumnHeight = kanbanHeight - columnHeaderHeight - columnPadding;
              
              return (
                <KanbanBoard 
                  key={status.id} 
                  id={status.id} 
                  className="
                    kanban-column
                    flex-shrink-0
                    min-w-[280px] max-w-[320px] w-[280px]
                    h-full
                    flex flex-col
                    border border-vscode-border/30
                    rounded-lg
                    bg-vscode-sidebar-background/50
                  "
                >
                  <KanbanHeader 
                    name={`${status.name} (${tasksByStatus[status.id]?.length || 0})`} 
                    color={status.color} 
                    className="px-3 py-3 text-sm font-medium flex-shrink-0 border-b border-vscode-border/30" 
                  />
                  <div
                    className="
                      flex flex-col gap-2 
                      overflow-y-auto overflow-x-hidden
                      p-2
                      scrollbar-thin scrollbar-track-transparent
                    "
                    style={{ 
                      height: `${availableColumnHeight}px`,
                      maxHeight: `${availableColumnHeight}px`
                    }}
                  >
                    <KanbanCards className="flex flex-col gap-2">
                      {tasksByStatus[status.id]?.map((task, index) => (
                        <TaskCard 
                          key={task.id} 
                          task={task} 
                          index={index} 
                          status={status.id}
                        />
                      ))}
                    </KanbanCards>
                  </div>
                </KanbanBoard>
              );
            })}
          </div>
        </KanbanProvider>
      </div>
    </div>
  );
};

// Main App Component
const App: React.FC = () => {
  const [state, dispatch] = useReducer(appReducer, {
    tasks: [],
    loading: true,
    requestId: 0,
    isConnected: false,
    connectionStatus: 'Connecting...'
  });

  const [vscode] = useState(() => {
    return window.acquireVsCodeApi?.();
  });

  const [pendingRequests] = useState(new Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }>());

  // Dynamic height calculation state
  const [availableHeight, setAvailableHeight] = useState<number>(window.innerHeight);

  // Calculate available height for kanban board
  const updateAvailableHeight = useCallback(() => {
    // Use window.innerHeight to get the actual available space
    // This automatically accounts for VS Code panels like terminal, problems, etc.
    const height = window.innerHeight;
    console.log('📏 Available height updated:', height);
    setAvailableHeight(height);
  }, []);

  // Listen to resize events to handle VS Code panel changes
  useEffect(() => {
    updateAvailableHeight();
    
    const handleResize = () => {
      updateAvailableHeight();
    };

    window.addEventListener('resize', handleResize);
    
    // Also listen for VS Code specific events if available
    const handleVisibilityChange = () => {
      // Small delay to ensure VS Code has finished resizing
      setTimeout(updateAvailableHeight, 100);
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [updateAvailableHeight]);

  // Send message to extension with promise-based response handling
  const sendMessage = useCallback(async (message: WebviewMessage): Promise<any> => {
    if (!vscode) {
      throw new Error('VS Code API not available');
    }

    return new Promise((resolve, reject) => {
      const requestId = `${Date.now()}-${Math.random()}`;
      const messageWithId = { ...message, requestId };

      // Set up timeout
      const timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error('Request timeout'));
      }, 10000); // 10 second timeout

      // Store the promise resolvers
      pendingRequests.set(requestId, { resolve, reject, timeout });

      // Send the message
      vscode.postMessage(messageWithId);
    });
  }, [vscode, pendingRequests]);

  // Handle messages from extension
  useEffect(() => {
    if (!vscode) return;

    const handleMessage = (event: MessageEvent) => {
      const message: WebviewMessage = event.data;
      console.log('📨 Received message from extension:', message);

      // Handle response to a pending request
      if (message.requestId && pendingRequests.has(message.requestId)) {
        const { resolve, reject, timeout } = pendingRequests.get(message.requestId)!;
        clearTimeout(timeout);
        pendingRequests.delete(message.requestId);

        if (message.type === 'error') {
          reject(new Error(message.error || 'Unknown error'));
        } else {
          resolve(message.data || message);
        }
        return;
      }

      // Handle different message types
      switch (message.type) {
        case 'init':
          console.log('🚀 Extension initialized:', message.data);
          dispatch({
            type: 'SET_CONNECTION_STATUS',
            payload: { isConnected: true, status: 'Connected' }
          });
          break;

        case 'tasksData':
          console.log('📋 Received tasks data:', message.data);
          dispatch({ type: 'SET_TASKS', payload: message.data });
          break;

        case 'taskStatusUpdated':
          console.log('✅ Task status updated:', message);
          // Status is already updated optimistically, no need to update again
          break;

        default:
          console.log('❓ Unknown message type:', message.type);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [vscode, pendingRequests]);

  // Initialize the webview
  useEffect(() => {
    if (!vscode) {
      console.warn('⚠️ VS Code API not available - running in standalone mode');
      dispatch({
        type: 'SET_CONNECTION_STATUS',
        payload: { isConnected: false, status: 'Standalone Mode' }
      });
      return;
    }

    console.log('🔄 Initializing webview...');
    
    // Notify extension that webview is ready
    vscode.postMessage({ type: 'ready' });

    // Request initial tasks data
    sendMessage({ type: 'getTasks' })
      .then((tasksData) => {
        console.log('📋 Initial tasks loaded:', tasksData);
        dispatch({ type: 'SET_TASKS', payload: tasksData });
      })
      .catch((error) => {
        console.error('❌ Failed to load initial tasks:', error);
        dispatch({ type: 'SET_ERROR', payload: `Failed to load tasks: ${error.message}` });
      });

  }, [vscode, sendMessage]);

  const contextValue = {
    vscode,
    state,
    dispatch,
    sendMessage,
    availableHeight
  };

  return (
    <ErrorBoundary>
      <VSCodeContext.Provider value={contextValue}>
        <div className="h-full w-full bg-vscode-background text-vscode-foreground flex flex-col">
          <TaskMasterKanban />
        </div>
      </VSCodeContext.Provider>
    </ErrorBoundary>
  );
};

// Initialize React app
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
} else {
  console.error('❌ Root container not found');
} 