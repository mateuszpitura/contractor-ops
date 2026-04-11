"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { TaskCard } from "./task-card";
import type { TemplateFormValues, TaskFormValues } from "./use-template-form";

// ---------------------------------------------------------------------------
// Sortable wrapper
// ---------------------------------------------------------------------------

interface SortableItemProps {
  id: string;
  index: number;
  allTasks: TaskFormValues[];
  form: UseFormReturn<TemplateFormValues>;
  onRemove: (index: number) => void;
}

function SortableItem({ id, index, allTasks, form, onRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <TaskCard
        index={index}
        allTasks={allTasks}
        form={form}
        onRemove={onRemove}
        dragHandleProps={{ attributes: attributes as unknown as Record<string, unknown>, listeners: (listeners ?? {}) as Record<string, unknown> }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SortableTaskListProps {
  fields: Array<{ id: string }>;
  tasks: TaskFormValues[];
  form: UseFormReturn<TemplateFormValues>;
  onReorder: (oldIndex: number, newIndex: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

export function SortableTaskList({
  fields,
  tasks,
  form,
  onReorder,
  onRemove,
  onAdd,
}: SortableTaskListProps) {
  const t = useTranslations("Workflows");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const taskIds = fields.map((f) => f.id);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = taskIds.indexOf(active.id as string);
        const newIndex = taskIds.indexOf(over.id as string);
        if (oldIndex !== -1 && newIndex !== -1) {
          onReorder(oldIndex, newIndex);
        }
      }
    },
    [taskIds, onReorder],
  );

  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm text-muted-foreground">{t("noTasksYet")}</p>
        <Button type="button" variant="secondary" onClick={onAdd}>
          <Plus className="me-1.5 size-4" />
          {t("addTask")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {fields.map((field, index) => (
            <SortableItem
              key={field.id}
              id={field.id}
              index={index}
              allTasks={tasks}
              form={form}
              onRemove={onRemove}
            />
          ))}
        </SortableContext>
      </DndContext>

      <Button type="button" variant="secondary" onClick={onAdd}>
        <Plus className="me-1.5 size-4" />
        {t("addTask")}
      </Button>
    </div>
  );
}
