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

interface TaskDetailsViewProps {
  taskId: string;
  onNavigateBack: () => void;
  onNavigateToTask: (taskId: string) => void;
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
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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
        setEditedDescription(subtask.description || '');
      } else {
        setCurrentTask(null);
      }
    } else {
      // Find main task
      const task = tasks.find(task => task.id === parentId);
      setCurrentTask(task || null);
      setParentTask(null);
      setEditedDescription(task?.description || '');
    }
  }, [taskId, tasks]);

  // Handle description save
  const handleSaveDescription = async () => {
    if (!currentTask || isSaving) return;

    setIsSaving(true);
    try {
      if (isSubtask && parentTask) {
        // For subtasks, we need to update the parent task's subtask
        await sendMessage({
          type: 'updateTask',
          data: {
            taskId: parentTask.id,
            updates: {
              // Update the specific subtask's description
              // Note: This might need adjustment based on the MCP API structure
              description: editedDescription,
            },
            options: { append: false, research: false }
          }
        });
      } else {
        // For main tasks
        await sendMessage({
          type: 'updateTask',
          data: {
            taskId: currentTask.id,
            updates: { description: editedDescription },
            options: { append: false, research: false }
          }
        });
      }
    } catch (error) {
      console.error('Failed to save description:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle dependency navigation
  const handleDependencyClick = (depId: string) => {
    onNavigateToTask(depId);
  };

  // Get priority badge variant
  const getPriorityVariant = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'done': return 'default';
      case 'in-progress': return 'default';
      case 'pending': return 'secondary';
      case 'deferred': return 'secondary';
      case 'review': return 'default';
      default: return 'secondary';
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
                  className="cursor-pointer hover:text-vscode-foreground"
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

          {/* Description area */}
          <div className="grid w-full gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Add description..."
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              onBlur={handleSaveDescription}
              className="min-h-[120px] resize-y"
              disabled={isSaving}
            />
            {isSaving && (
              <p className="text-xs text-vscode-foreground/50">Saving...</p>
            )}
          </div>

          {/* Details section */}
          {currentTask.details && (
            <div className="grid w-full gap-1.5">
              <Label>Implementation Details</Label>
              <div className="p-3 bg-vscode-input/30 rounded-md border">
                <pre className="whitespace-pre-wrap text-sm text-vscode-foreground/80 font-mono">
                  {currentTask.details}
                </pre>
              </div>
            </div>
          )}

          {/* Test Strategy section */}
          {currentTask.testStrategy && (
            <div className="grid w-full gap-1.5">
              <Label>Test Strategy</Label>
              <div className="p-3 bg-vscode-input/30 rounded-md border">
                <pre className="whitespace-pre-wrap text-sm text-vscode-foreground/80 font-mono">
                  {currentTask.testStrategy}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Right column - Properties sidebar (1/3 width) */}
        <div className="md:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Properties</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={getStatusVariant(currentTask.status)}>
                  {currentTask.status}
                </Badge>
              </div>

              {/* Priority */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Priority</span>
                <Badge variant={getPriorityVariant(currentTask.priority)}>
                  {currentTask.priority}
                </Badge>
              </div>

              {/* Complexity Score */}
              {currentTask.complexityScore && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Complexity</span>
                  <Badge variant="secondary">
                    {currentTask.complexityScore}/10
                  </Badge>
                </div>
              )}

              {/* Dependencies */}
              {currentTask.dependencies && currentTask.dependencies.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Dependencies</h4>
                    <div className="space-y-1">
                      {currentTask.dependencies.map((depId) => {
                        const depTask = tasks.find(t => t.id === depId);
                        const fullTitle = `Task ${depId}: ${depTask?.title || 'Unknown Task'}`;
                        const truncatedTitle = fullTitle.length > 40 ? fullTitle.substring(0, 37) + '...' : fullTitle;
                        return (
                          <Button
                            key={depId}
                            variant="link"
                            asChild
                            className="p-0 h-auto justify-start text-left w-full"
                            onClick={() => handleDependencyClick(depId)}
                          >
                            <div className="cursor-pointer w-full">
                              <span 
                                className="text-sm block truncate w-full" 
                                title={fullTitle}
                              >
                                {truncatedTitle}
                              </span>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Subtasks count */}
              {currentTask.subtasks && currentTask.subtasks.length > 0 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Subtasks</span>
                    <Badge variant="secondary">
                      {currentTask.subtasks.filter(st => st.status === 'done').length} / {currentTask.subtasks.length}
                    </Badge>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TaskDetailsView; 