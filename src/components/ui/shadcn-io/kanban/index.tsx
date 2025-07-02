'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  DndContext,
  rectIntersection,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import type { ReactNode } from 'react';

export type { DragEndEvent } from '@dnd-kit/core';

export type Status = {
  id: string;
  name: string;
  color: string;
};

export type Feature = {
  id: string;
  name: string;
  startAt: Date;
  endAt: Date;
  status: Status;
};

export type KanbanBoardProps = {
  id: Status['id'];
  children: ReactNode;
  className?: string;
};

export const KanbanBoard = ({ id, children, className }: KanbanBoardProps) => {
  const { isOver, setNodeRef } = useDroppable({ id });

  return (
    <div
      className={cn(
        'flex h-full min-h-40 flex-col gap-2 rounded-md border bg-secondary p-2 text-xs shadow-sm outline outline-2 transition-all',
        isOver ? 'outline-primary' : 'outline-transparent',
        className
      )}
      ref={setNodeRef}
    >
      {children}
    </div>
  );
};

export type KanbanCardProps = Pick<Feature, 'id' | 'name'> & {
  index: number;
  parent: string;
  children?: ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent) => void;
  onDoubleClick?: (event: React.MouseEvent) => void;
};

export const KanbanCard = ({
  id,
  name,
  index,
  parent,
  children,
  className,
  onClick,
  onDoubleClick,
}: KanbanCardProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id,
      data: { index, parent },
    });

  const [dragStartTime, setDragStartTime] = React.useState(0);
  const [dragStartPos, setDragStartPos] = React.useState<{x: number, y: number} | null>(null);
  const [isDragOperation, setIsDragOperation] = React.useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStartTime(Date.now());
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setIsDragOperation(false);
    
    // Call the original drag listener
    if (listeners?.onMouseDown) {
      listeners.onMouseDown(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStartPos) {
      const currentPos = { x: e.clientX, y: e.clientY };
      const distance = Math.sqrt(
        Math.pow(currentPos.x - dragStartPos.x, 2) + 
        Math.pow(currentPos.y - dragStartPos.y, 2)
      );
      
      // If significant movement detected, mark as drag operation
      if (distance > 8) {
        setIsDragOperation(true);
      }
    }
    
    // Call the original drag listener
    if (listeners?.onMouseMove) {
      listeners.onMouseMove(e);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const clickDuration = Date.now() - dragStartTime;
    
    // Only handle click if it's a quick action with minimal movement (not a drag)
    if (!isDragOperation && clickDuration < 500) {
      // Small delay to ensure drag operations are complete
      setTimeout(() => {
        if (!isDragging) {
          onClick?.(e);
        }
      }, 10);
    }
    
    // Reset state
    setDragStartTime(0);
    setDragStartPos(null);
    setIsDragOperation(false);
    
    // Call the original drag listener
    if (listeners?.onMouseUp) {
      listeners.onMouseUp(e);
    }
  };

  // Merge drag listeners with our custom handlers
  const mergedListeners = {
    ...listeners,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
  };

  return (
    <Card
      className={cn(
        'rounded-md p-3 shadow-sm',
        isDragging && 'cursor-grabbing',
        !isDragging && 'cursor-pointer',
        className
      )}
      style={{
        transform: transform
          ? `translateX(${transform.x}px) translateY(${transform.y}px)`
          : 'none',
      }}
      {...attributes}
      {...mergedListeners}
      onDoubleClick={onDoubleClick}
      ref={setNodeRef}
    >
      {children ?? <p className="m-0 font-medium text-sm">{name}</p>}
    </Card>
  );
};

export type KanbanCardsProps = {
  children: ReactNode;
  className?: string;
};

export const KanbanCards = ({ children, className }: KanbanCardsProps) => (
  <div className={cn('flex flex-1 flex-col gap-2', className)}>{children}</div>
);

export type KanbanHeaderProps =
  | {
      children: ReactNode;
    }
  | {
      name: Status['name'];
      color: Status['color'];
      className?: string;
    };

export const KanbanHeader = (props: KanbanHeaderProps) =>
  'children' in props ? (
    props.children
  ) : (
    <div className={cn('flex shrink-0 items-center gap-2', props.className)}>
      <div
        className="h-2 w-2 rounded-full"
        style={{ backgroundColor: props.color }}
      />
      <p className="m-0 font-semibold text-sm">{props.name}</p>
    </div>
  );

export type KanbanProviderProps = {
  children: ReactNode;
  onDragEnd: (event: DragEndEvent) => void;
  onDragStart?: (event: DragEndEvent) => void;
  className?: string;
};

export const KanbanProvider = ({
  children,
  onDragEnd,
  onDragStart,
  className,
}: KanbanProviderProps) => (
  <DndContext 
    collisionDetection={rectIntersection} 
    onDragEnd={onDragEnd}
    onDragStart={onDragStart}
  >
    <div
      className={cn('grid w-full auto-cols-fr grid-flow-col gap-4', className)}
    >
      {children}
    </div>
  </DndContext>
);
