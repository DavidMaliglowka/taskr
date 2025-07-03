import React, { useState, useEffect, useContext } from 'react';
import { VSCodeContext, TaskMasterTask } from '../webview/index';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronRight, ChevronDown, Plus, Wand2, PlusCircle, Loader2 } from 'lucide-react';

interface TaskDetailsViewProps {
  taskId: string;
  onNavigateBack: () => void;
  onNavigateToTask: (taskId: string) => void;
}

// Custom Priority Badge Component (matching Kanban board styling)
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

// Custom Status Badge Component with dropdown styling
const StatusBadge: React.FC<{ status: TaskMasterTask['status'] }> = ({ status }) => {
  const colorMap = {
    pending: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    'in-progress': 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    review: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    done: 'bg-green-500/20 text-green-400 border-green-500/30',
    deferred: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span 
      className={`
        inline-flex items-center justify-center
        px-2 py-0.5
        rounded text-xs font-medium border 
        min-w-[60px]
        ${colorMap[status]}
      `}
      title={status}
    >
      {status === 'pending' ? 'todo' : status}
    </span>
  );
};

// Define the TaskFileData interface here since we're no longer importing it
interface TaskFileData {
  details?: string;
  testStrategy?: string;
}

export const TaskDetailsView: React.FC<TaskDetailsViewProps> = ({
  taskId,
  onNavigateBack,
  onNavigateToTask,
}) => {
  const context = useContext(VSCodeContext);
  if (!context) throw new Error('TaskDetailsView must be used within VSCodeContext');

  const { state, sendMessage } = context;
  const { tasks } = state;

  const [currentTask, setCurrentTask] = useState<TaskMasterTask | null>(null);
  const [isSubtask, setIsSubtask] = useState(false);
  const [parentTask, setParentTask] = useState<TaskMasterTask | null>(null);
  
  // Collapsible section states
  const [isAiActionsExpanded, setIsAiActionsExpanded] = useState(false);
  const [isImplementationExpanded, setIsImplementationExpanded] = useState(false);
  const [isTestStrategyExpanded, setIsTestStrategyExpanded] = useState(false);
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(true);
  
  // AI Actions states
  const [prompt, setPrompt] = useState('');
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  
  // Task file data states (for implementation details and test strategy)
  const [taskFileData, setTaskFileData] = useState<TaskFileData>({ details: undefined, testStrategy: undefined });
  const [isLoadingTaskFileData, setIsLoadingTaskFileData] = useState(false);
  const [taskFileDataError, setTaskFileDataError] = useState<string | null>(null);

  // Parse task ID to determine if it's a subtask (e.g., "13.2")
  const parseTaskId = (id: string) => {
    const parts = id.split('.');
    if (parts.length === 2) {
      return {
        isSubtask: true,
        parentId: parts[0],
        subtaskIndex: parseInt(parts[1]) - 1, // Convert to 0-based index
      };
    }
    return {
      isSubtask: false,
      parentId: id,
      subtaskIndex: -1,
    };
  };

  // Fetch task file data (implementation details and test strategy)
  const fetchTaskFileData = async (targetTaskId: string) => {
    if (!targetTaskId) return;
    
    console.log('📄 TaskDetailsView: Fetching task file data for:', targetTaskId);
    setIsLoadingTaskFileData(true);
    setTaskFileDataError(null);
    
    try {
      // Send message to extension to read task file data
      console.log('📤 TaskDetailsView: Sending readTaskFileData message');
      const response = await sendMessage({
        type: 'readTaskFileData',
        data: {
          taskId: targetTaskId,
          tag: 'master' // Default to master tag
        }
      });
      
      console.log('📨 TaskDetailsView: Received response:', response);
      
      // The response IS the data object with details and testStrategy
      if (response && (response.details !== undefined || response.testStrategy !== undefined)) {
        console.log('✅ TaskDetailsView: Setting task file data:', response);
        setTaskFileData(response);
      } else {
        throw new Error('No task file data found in response');
      }
    } catch (error) {
      console.error('❌ TaskDetailsView: Failed to fetch task file data:', error);
      setTaskFileDataError(error instanceof Error ? error.message : 'Failed to load task details');
      setTaskFileData({ details: undefined, testStrategy: undefined });
    } finally {
      setIsLoadingTaskFileData(false);
    }
  };

  // Find task or subtask by ID
  useEffect(() => {
    const { isSubtask: isSubtaskId, parentId, subtaskIndex } = parseTaskId(taskId);
    setIsSubtask(isSubtaskId);

    if (isSubtaskId) {
      // Find parent task
      const parent = tasks.find(task => task.id === parentId);
      setParentTask(parent || null);
      
      // Find subtask
      if (parent && parent.subtasks && subtaskIndex >= 0 && subtaskIndex < parent.subtasks.length) {
        const subtask = parent.subtasks[subtaskIndex];
        setCurrentTask(subtask);
        // Fetch file data for subtask
        fetchTaskFileData(taskId);
      } else {
        setCurrentTask(null);
      }
    } else {
      // Find main task
      const task = tasks.find(task => task.id === parentId);
      setCurrentTask(task || null);
      setParentTask(null);
      // Fetch file data for main task
      if (task) {
        fetchTaskFileData(taskId);
      }
    }
  }, [taskId, tasks]);

  // Refresh task file data when tasks are updated from polling
  useEffect(() => {
    if (currentTask) {
      // Small delay to ensure the tasks.json file has been updated
      const timeoutId = setTimeout(() => {
        fetchTaskFileData(taskId);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  }, [currentTask?.status, currentTask?.description, tasks.length]); // Re-fetch when task status or description changes

  // Handle AI Actions
  const handleRegenerate = async () => {
    if (!currentTask || !prompt.trim()) return;

    setIsRegenerating(true);
    try {
      if (isSubtask && parentTask) {
        await sendMessage({
          type: 'updateSubtask',
          data: {
            taskId: `${parentTask.id}.${currentTask.id}`,
            prompt: prompt,
            options: { research: false }
          }
        });
      } else {
        await sendMessage({
          type: 'updateTask',
          data: {
            taskId: currentTask.id,
            updates: { description: prompt },
            options: { append: false, research: false }
          }
        });
      }
      
      // Refresh task file data after update
      setTimeout(() => {
        fetchTaskFileData(taskId);
      }, 1000); // Wait 1 second for AI to finish processing
      
    } catch (error) {
      console.error('❌ TaskDetailsView: Failed to regenerate task:', error);
    } finally {
      setIsRegenerating(false);
      setPrompt('');
    }
  };

  const handleAppend = async () => {
    if (!currentTask || !prompt.trim()) return;

    setIsAppending(true);
    try {
      if (isSubtask && parentTask) {
        await sendMessage({
          type: 'updateSubtask',
          data: {
            taskId: `${parentTask.id}.${currentTask.id}`,
            prompt: prompt,
            options: { research: false }
          }
        });
      } else {
        await sendMessage({
          type: 'updateTask',
          data: {
            taskId: currentTask.id,
            updates: { description: prompt },
            options: { append: true, research: false }
          }
        });
      }
      
      // Refresh task file data after update
      setTimeout(() => {
        fetchTaskFileData(taskId);
      }, 1000); // Wait 1 second for AI to finish processing
      
    } catch (error) {
      console.error('❌ TaskDetailsView: Failed to append to task:', error);
    } finally {
      setIsAppending(false);
      setPrompt('');
    }
  };

  // Handle dependency navigation
  const handleDependencyClick = (depId: string) => {
    onNavigateToTask(depId);
  };

  // Handle status change
  const handleStatusChange = async (newStatus: TaskMasterTask['status']) => {
    if (!currentTask) return;

    try {
      await sendMessage({
        type: 'updateTaskStatus',
        data: {
          taskId: isSubtask && parentTask ? `${parentTask.id}.${currentTask.id}` : currentTask.id,
          newStatus: newStatus
        }
      });
    } catch (error) {
      console.error('❌ TaskDetailsView: Failed to update task status:', error);
    }
  };

  if (!currentTask) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg text-vscode-foreground/70 mb-4">Task not found</p>
          <Button onClick={onNavigateBack} variant="outline">
            Back to Kanban Board
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Main content area with two-column layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 p-6 overflow-auto">
        {/* Left column - Main content (2/3 width) */}
        <div className="md:col-span-2 space-y-6">
          {/* Breadcrumb navigation */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink 
                  onClick={onNavigateBack}
                  className="cursor-pointer hover:text-vscode-foreground text-link"
                >
                  Kanban Board
                </BreadcrumbLink>
              </BreadcrumbItem>
              {isSubtask && parentTask && (
                <>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbLink 
                      onClick={() => onNavigateToTask(parentTask.id)}
                      className="cursor-pointer hover:text-vscode-foreground"
                    >
                      {parentTask.title}
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                </>
              )}
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <span className="text-vscode-foreground">{currentTask.title}</span>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Task title */}
          <h1 className="text-2xl font-bold tracking-tight text-vscode-foreground">
            {currentTask.title}
          </h1>

          {/* Description (non-editable) */}
          <div className="mb-8">
            <p className="text-vscode-foreground/80 leading-relaxed">
              {currentTask.description || 'No description available.'}
            </p>
          </div>

          {/* AI Actions */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto text-purple-400 hover:text-purple-300"
                onClick={() => setIsAiActionsExpanded(!isAiActionsExpanded)}
              >
                {isAiActionsExpanded ? (
                  <ChevronDown className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-1" />
                )}
                <Wand2 className="w-4 h-4 mr-1" />
                AI Actions
              </Button>
            </div>

            {isAiActionsExpanded && (
              <div className="bg-purple-950/20 rounded-lg p-4 border border-purple-800/30">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="ai-prompt" className="block text-sm font-medium text-vscode-foreground/80 mb-2">
                      Enter your prompt
                    </Label>
                    <Textarea
                      id="ai-prompt"
                      placeholder="Describe what you want to change or add to this task..."
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      className="min-h-[100px] bg-vscode-input-background border-vscode-input-border text-vscode-input-foreground placeholder-vscode-input-foreground/50 focus:border-purple-500 focus:ring-purple-500"
                      disabled={isRegenerating || isAppending}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleRegenerate}
                      disabled={!prompt.trim() || isRegenerating || isAppending}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      {isRegenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Regenerating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-4 h-4 mr-2" />
                          Regenerate Task
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={handleAppend}
                      disabled={!prompt.trim() || isRegenerating || isAppending}
                      variant="outline"
                      className="border-purple-600 text-purple-400 hover:bg-purple-600 hover:text-white bg-transparent"
                    >
                      {isAppending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Appending...
                        </>
                      ) : (
                        <>
                          <PlusCircle className="w-4 h-4 mr-2" />
                          Append to Task
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="text-xs text-vscode-foreground/60 space-y-1">
                    <p>
                      <strong>Regenerate:</strong> Completely rewrites the task description and subtasks based on your prompt
                    </p>
                    <p>
                      <strong>Append:</strong> Adds new content to the existing task description based on your prompt
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Implementation Details */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto text-vscode-foreground/70 hover:text-vscode-foreground"
                onClick={() => setIsImplementationExpanded(!isImplementationExpanded)}
              >
                {isImplementationExpanded ? (
                  <ChevronDown className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-1" />
                )}
                Implementation Details
              </Button>
              {isLoadingTaskFileData && (
                <Loader2 className="w-4 h-4 animate-spin text-vscode-foreground/50" />
              )}
            </div>

            {isImplementationExpanded && (
              <div className="bg-vscode-input-background/30 rounded-lg p-4 border border-vscode-border">
                {isLoadingTaskFileData ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-vscode-foreground/50" />
                    <span className="ml-2 text-sm text-vscode-foreground/70">Loading details...</span>
                  </div>
                ) : taskFileDataError ? (
                  <div className="text-sm text-red-400 py-2">
                    Error loading details: {taskFileDataError}
                  </div>
                ) : taskFileData.details ? (
                  <pre className="whitespace-pre-wrap text-sm text-vscode-foreground/80 font-mono">
                    {taskFileData.details}
                  </pre>
                ) : (
                  <div className="text-sm text-vscode-foreground/50 py-2">
                    No implementation details available
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Test Strategy */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                className="p-0 h-auto text-vscode-foreground/70 hover:text-vscode-foreground"
                onClick={() => setIsTestStrategyExpanded(!isTestStrategyExpanded)}
              >
                {isTestStrategyExpanded ? (
                  <ChevronDown className="w-4 h-4 mr-1" />
                ) : (
                  <ChevronRight className="w-4 h-4 mr-1" />
                )}
                Test Strategy
              </Button>
              {isLoadingTaskFileData && (
                <Loader2 className="w-4 h-4 animate-spin text-vscode-foreground/50" />
              )}
            </div>

            {isTestStrategyExpanded && (
              <div className="bg-vscode-input-background/30 rounded-lg p-4 border border-vscode-border">
                {isLoadingTaskFileData ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-vscode-foreground/50" />
                    <span className="ml-2 text-sm text-vscode-foreground/70">Loading strategy...</span>
                  </div>
                ) : taskFileDataError ? (
                  <div className="text-sm text-red-400 py-2">
                    Error loading strategy: {taskFileDataError}
                  </div>
                ) : taskFileData.testStrategy ? (
                  <pre className="whitespace-pre-wrap text-sm text-vscode-foreground/80 font-mono">
                    {taskFileData.testStrategy}
                  </pre>
                ) : (
                  <div className="text-sm text-vscode-foreground/50 py-2">
                    No test strategy available
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtasks section */}
          {currentTask.subtasks && currentTask.subtasks.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-0 h-auto text-vscode-foreground/70 hover:text-vscode-foreground"
                  onClick={() => setIsSubtasksExpanded(!isSubtasksExpanded)}
                >
                  {isSubtasksExpanded ? (
                    <ChevronDown className="w-4 h-4 mr-1" />
                  ) : (
                    <ChevronRight className="w-4 h-4 mr-1" />
                  )}
                  Sub-issues
                </Button>
                <span className="text-sm text-vscode-foreground/50">
                  {currentTask.subtasks.filter(st => st.status === 'done').length}/{currentTask.subtasks.length}
                </span>
                <Button variant="ghost" size="sm" className="ml-auto p-1 h-6 w-6">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {isSubtasksExpanded && (
                <div className="space-y-3">
                  {currentTask.subtasks.map((subtask, index) => {
                    const subtaskId = `${currentTask.id}.${index + 1}`;
                    const statusColorMap = {
                      pending: 'bg-gray-600',
                      'in-progress': 'bg-yellow-500',
                      review: 'bg-blue-500',
                      done: 'bg-green-500',
                      deferred: 'bg-red-500',
                    };
                    const statusBadgeMap = {
                      pending: 'bg-gray-800 text-gray-400',
                      'in-progress': 'bg-yellow-900/30 text-yellow-400 border-yellow-800',
                      review: 'bg-blue-900/30 text-blue-400 border-blue-800',
                      done: 'bg-green-900/30 text-green-400 border-green-800',
                      deferred: 'bg-red-900/30 text-red-400 border-red-800',
                    };

                    return (
                      <div 
                        key={subtask.id}
                        className="flex items-center gap-3 p-3 rounded-md border border-textSeparator-foreground hover:border-vscode-border/70 transition-colors cursor-pointer"
                        onClick={() => onNavigateToTask(subtaskId)}
                      >
                        <div className={`w-4 h-4 rounded-full ${statusColorMap[subtask.status]} flex items-center justify-center`}>
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                        <span className="flex-1 text-vscode-foreground">{subtask.title}</span>
                        <Badge variant="secondary" className={`${statusBadgeMap[subtask.status]} border`}>
                          {subtask.status === 'pending' ? 'todo' : subtask.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column - Properties sidebar (1/3 width) */}
        <div className="md:col-span-1 border-l border-textSeparator-foreground">
          <div className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-vscode-foreground/70 mb-3">Properties</h3>
              </div>

              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-vscode-foreground/70">Status</span>
                  <select
                    value={currentTask.status}
                    onChange={(e) => handleStatusChange(e.target.value as TaskMasterTask['status'])}
                    className={`border rounded-md px-3 py-1 text-sm font-medium focus:ring-1 bg-vscode-input-background border-vscode-input-border text-vscode-input-foreground focus:border-vscode-focusBorder focus:ring-vscode-focusBorder ${
                      currentTask.status === 'pending'
                        ? 'text-gray-400'
                        : currentTask.status === 'in-progress'
                          ? 'text-yellow-400'
                          : currentTask.status === 'review'
                            ? 'text-blue-400'
                            : currentTask.status === 'done'
                              ? 'text-green-400'
                              : currentTask.status === 'deferred'
                                ? 'text-red-400'
                                : 'text-vscode-foreground'
                    }`}
                  >
                    <option value="pending">To do</option>
                    <option value="in-progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="done">Done</option>
                    <option value="deferred">Deferred</option>
                  </select>
                </div>


              {/* Priority */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Priority</span>
                <PriorityBadge priority={currentTask.priority} />
              </div>

                {/* Complexity Score */}
                {currentTask.complexityScore && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-vscode-foreground/70">Complexity</span>
                      <div className="bg-vscode-input-background border border-vscode-input-border rounded-md px-3 py-1 text-sm text-vscode-foreground">
                        {currentTask.complexityScore}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="border-b border-textSeparator-foreground"></div>

              {/* Dependencies */}
              {currentTask.dependencies && currentTask.dependencies.length > 0 && (
                <>
                
                  <div>
                    <h4 className="text-sm font-medium text-vscode-foreground/70 mb-3">Dependencies</h4>
                    <div className="space-y-2">
                      {currentTask.dependencies.map((depId) => {
                        const depTask = tasks.find(t => t.id === depId);
                        const fullTitle = `Task ${depId}: ${depTask?.title || 'Unknown Task'}`;
                        const truncatedTitle = fullTitle.length > 40 ? fullTitle.substring(0, 37) + '...' : fullTitle;
                        return (
                          <div
                            key={depId}
                            className="text-sm text-link cursor-pointer hover:text-link-hover"
                            onClick={() => handleDependencyClick(depId)}
                            title={fullTitle}
                          >
                            {truncatedTitle}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Divider after Dependencies */}
              {currentTask.dependencies && currentTask.dependencies.length > 0 && (
                <div className="border-b border-textSeparator-foreground"></div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsView; 