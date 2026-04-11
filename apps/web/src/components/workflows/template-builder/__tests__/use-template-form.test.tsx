import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTemplateForm } from "../use-template-form";

describe("useTemplateForm", () => {
  it("starts with empty tasks array", () => {
    const { result } = renderHook(() => useTemplateForm());
    expect(result.current.fields).toHaveLength(0);
    expect(result.current.form.getValues("name")).toBe("");
  });

  it("addTask appends a task row with defaults", () => {
    const { result } = renderHook(() => useTemplateForm());
    act(() => result.current.addTask());
    expect(result.current.fields).toHaveLength(1);
    const tasks = result.current.form.getValues("tasks");
    expect(tasks[0]?.taskType).toBe("MANUAL");
    expect(tasks[0]?.assigneeMode).toBe("ROLE_BASED");
    expect(tasks[0]?.sortOrder).toBe(0);
  });

  it("removeTask drops the row at index", () => {
    const { result } = renderHook(() => useTemplateForm());
    act(() => {
      result.current.addTask();
      result.current.addTask();
    });
    act(() => result.current.removeTask(0));
    expect(result.current.fields).toHaveLength(1);
  });
});
