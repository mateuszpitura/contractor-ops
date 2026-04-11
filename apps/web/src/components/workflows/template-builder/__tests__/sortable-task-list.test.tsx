import { render, screen } from "@/test/test-utils";
import { SortableTaskList } from "../sortable-task-list";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: vi.fn(),
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock("@dnd-kit/sortable", () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: {},
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
  sortableKeyboardCoordinates: vi.fn(),
}));

vi.mock("@dnd-kit/utilities", () => ({
  CSS: { Transform: { toString: () => null } },
}));

vi.mock("../task-card", () => ({
  TaskCard: ({ index }: any) => <div data-testid={`task-card-${index}`}>Task {index}</div>,
}));

describe("SortableTaskList", () => {
  const mockForm = { watch: vi.fn(), register: vi.fn(), setValue: vi.fn() } as any;

  it("renders empty state with add button when no fields", () => {
    render(
      <SortableTaskList
        fields={[]}
        tasks={[]}
        form={mockForm}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText(/Add your first task/)).toBeInTheDocument();
    expect(screen.getByText("Add task")).toBeInTheDocument();
  });

  it("renders task cards for each field", () => {
    render(
      <SortableTaskList
        fields={[{ id: "f1" }, { id: "f2" }]}
        tasks={[{ title: "Task 1" } as any, { title: "Task 2" } as any]}
        form={mockForm}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByTestId("task-card-0")).toBeInTheDocument();
    expect(screen.getByTestId("task-card-1")).toBeInTheDocument();
  });

  it("shows add task button below the list", () => {
    render(
      <SortableTaskList
        fields={[{ id: "f1" }]}
        tasks={[{ title: "Task 1" } as any]}
        form={mockForm}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByText("Add task")).toBeInTheDocument();
  });

  it("calls onAdd when add button is clicked", async () => {
    const onAdd = vi.fn();
    render(
      <SortableTaskList
        fields={[]}
        tasks={[]}
        form={mockForm}
        onReorder={vi.fn()}
        onRemove={vi.fn()}
        onAdd={onAdd}
      />,
    );
    screen.getByText("Add task").click();
    expect(onAdd).toHaveBeenCalled();
  });
});
