import { TaskMasterTask } from '../webview/index';

export interface TaskFileData {
  details?: string;
  testStrategy?: string;
}

export interface TasksJsonStructure {
  [tagName: string]: {
    tasks: TaskWithDetails[];
    metadata: {
      createdAt: string;
      description?: string;
    };
  };
}

export interface TaskWithDetails extends TaskMasterTask {
  details?: string;
  testStrategy?: string;
  subtasks?: TaskWithDetails[];
}

/**
 * Reads tasks.json file directly and extracts implementation details and test strategy
 * @param taskId - The ID of the task to read (e.g., "1" or "1.2" for subtasks)
 * @param tagName - The tag/context name (defaults to "master")
 * @returns TaskFileData with details and testStrategy fields
 */
export async function readTaskFileData(taskId: string, tagName: string = 'master'): Promise<TaskFileData> {
  try {
    // Check if we're in a VS Code webview context
    if (typeof window !== 'undefined' && (window as any).vscode) {
      // Use VS Code API to read the file
      const vscode = (window as any).vscode;
      
      // Request file content from the extension
      return new Promise((resolve, reject) => {
        const messageId = Date.now().toString();
        
        // Listen for response
        const messageHandler = (event: MessageEvent) => {
          const message = event.data;
          if (message.type === 'taskFileData' && message.messageId === messageId) {
            window.removeEventListener('message', messageHandler);
            if (message.error) {
              reject(new Error(message.error));
            } else {
              resolve(message.data);
            }
          }
        };
        
        window.addEventListener('message', messageHandler);
        
        // Send request to extension
        vscode.postMessage({
          type: 'readTaskFileData',
          messageId,
          taskId,
          tagName
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          window.removeEventListener('message', messageHandler);
          reject(new Error('Timeout reading task file data'));
        }, 5000);
      });
    } else {
      // Fallback for non-VS Code environments
      return { details: undefined, testStrategy: undefined };
    }
  } catch (error) {
    console.error('Error reading task file data:', error);
    return { details: undefined, testStrategy: undefined };
  }
}

/**
 * Finds a task by ID within a tasks array, supporting subtask notation (e.g., "1.2")
 * @param tasks - Array of tasks to search
 * @param taskId - ID to search for
 * @returns The task object if found, undefined otherwise
 */
export function findTaskById(tasks: TaskWithDetails[], taskId: string): TaskWithDetails | undefined {
  for (const task of tasks) {
    // Handle both string and number task IDs
    if (String(task.id) === taskId) {
      return task;
    }
    
    // Check subtasks if they exist
    if (task.subtasks) {
      const subtask = findTaskById(task.subtasks, taskId);
      if (subtask) {
        return subtask;
      }
    }
  }
  
  return undefined;
}

/**
 * Parses tasks.json content and extracts task file data
 * @param content - Raw tasks.json content
 * @param taskId - Task ID to find
 * @param tagName - Tag name to use
 * @returns TaskFileData with details and testStrategy
 */
export function parseTaskFileData(content: string, taskId: string, tagName: string): TaskFileData {
  try {
    const tasksJson: TasksJsonStructure = JSON.parse(content);
    console.log('🔍 Parsed tasks.json structure, available tags:', Object.keys(tasksJson));
    
    // Get the tag data
    const tagData = tasksJson[tagName];
    if (!tagData || !tagData.tasks) {
      console.log(`❌ No tag data found for tag: ${tagName}`);
      return { details: undefined, testStrategy: undefined };
    }
    
    console.log(`🔍 Found ${tagData.tasks.length} tasks in tag '${tagName}', looking for task ID: ${taskId}`);
    
    // Find the task
    const task = findTaskById(tagData.tasks, taskId);
    if (!task) {
      console.log(`❌ Task with ID '${taskId}' not found in tag '${tagName}'`);
      // Log available task IDs for debugging
      const availableIds = tagData.tasks.map(t => String(t.id));
      console.log(`Available task IDs: ${availableIds.join(', ')}`);
      return { details: undefined, testStrategy: undefined };
    }
    
    console.log(`✅ Found task ${taskId}:`, {
      title: task.title,
      hasDetails: !!task.details,
      hasTestStrategy: !!task.testStrategy,
      detailsLength: task.details?.length || 0,
      testStrategyLength: task.testStrategy?.length || 0
    });
    
    return {
      details: task.details,
      testStrategy: task.testStrategy
    };
  } catch (error) {
    console.error('Error parsing tasks.json:', error);
    return { details: undefined, testStrategy: undefined };
  }
} 