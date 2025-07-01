import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

interface Task {
  id: string;
  title: string;
  status: string;
  description?: string;
}

const KanbanBoard: React.FC = () => {
  const columns = ['pending', 'in-progress', 'review', 'done'];
  
  // Mock data for now
  const mockTasks: Task[] = [
    { id: '1', title: 'Set up project build system', status: 'in-progress', description: 'Configure build system' },
    { id: '2', title: 'Implement MCP server connection', status: 'pending', description: 'Connect to task-master' },
  ];

  const getTasksForColumn = (status: string) => 
    mockTasks.filter(task => task.status === status);

  return (
    <div className="h-full bg-vscode-background text-vscode-foreground p-4">
      <h1 className="text-xl font-bold mb-4">Task Master Kanban Board</h1>
      
      <div className="grid grid-cols-4 gap-4 h-full">
        {columns.map(column => (
          <div key={column} className="bg-vscode-input rounded-lg p-3">
            <h2 className="font-semibold mb-3 text-center capitalize">
              {column.replace('-', ' ')}
            </h2>
            
            <div className="space-y-2">
              {getTasksForColumn(column).map(task => (
                <div 
                  key={task.id} 
                  className="bg-vscode-background border border-vscode-border rounded p-2 cursor-pointer hover:bg-opacity-80"
                >
                  <div className="font-medium text-sm">{task.title}</div>
                  {task.description && (
                    <div className="text-xs opacity-70 mt-1">{task.description}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<KanbanBoard />);
} 