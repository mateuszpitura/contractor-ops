/**
 * TemplatePicker takes the full `useTemplatePicker` return value spread as
 * props. We pass shaped stubs to exercise the loading, empty, and populated
 * branches.
 */

import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  TemplatePicker,
  TemplatePickerList,
  TemplatePickerListEmpty,
  TemplatePickerListSkeleton,
} from '../template-picker-dialog.js';
import { click, findButton, findByText, mount } from './_render.js';

afterEach(() => {
  document.body.innerHTML = '';
});

type Props = ComponentProps<typeof TemplatePicker>;
type Template = Props['templates'][number];

function makeTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 't1',
    name: 'Standard Onboarding',
    description: 'Standard contractor onboarding flow',
    type: 'ONBOARDING',
    _count: { tasks: 5 },
    ...overrides,
  } as Template;
}

function baseProps(overrides: Partial<Props> = {}): Props {
  const merged = {
    open: true,
    search: '',
    setSearch: vi.fn(),
    selectedId: null,
    setSelectedId: vi.fn(),
    typeFilter: null,
    setTypeFilter: vi.fn(),
    templates: [],
    isLoading: false,
    isBulk: false,
    contractorIds: undefined,
    suggestionEnabled: false,
    suggestedTemplate: undefined,
    startRunMutation: { isPending: false } as Props['startRunMutation'],
    handleStart: vi.fn(),
    handleOpenChange: vi.fn(),
    canStart: false,
    ...overrides,
  } as Omit<Props, 'listContent'> & { listContent?: Props['listContent'] };

  const listContent =
    merged.listContent === undefined ? (
      merged.isLoading ? (
        <TemplatePickerListSkeleton />
      ) : merged.templates.length === 0 ? (
        <TemplatePickerListEmpty />
      ) : (
        <TemplatePickerList
          templates={merged.templates}
          selectedId={merged.selectedId}
          setSelectedId={merged.setSelectedId}
        />
      )
    ) : (
      merged.listContent
    );

  return { ...merged, listContent } as Props;
}

describe('TemplatePicker (web-vite)', () => {
  it('renders the dialog title', async () => {
    await mount(<TemplatePicker {...baseProps()} />);
    // Workflows.templatePicker.title — assert dialog heading exists.
    expect(document.body.querySelectorAll('h2,h3').length).toBeGreaterThan(0);
  });

  it('renders skeleton placeholders when loading', async () => {
    await mount(<TemplatePicker {...baseProps({ isLoading: true })} />);
    expect(document.body.querySelectorAll("[data-slot='skeleton']").length).toBeGreaterThan(0);
  });

  it('renders the no-templates copy when the list is empty', async () => {
    await mount(<TemplatePicker {...baseProps()} />);
    // Workflows.templatePicker.noTemplates — i18n key falls back gracefully.
    expect(document.body.textContent).toMatch(/template/i);
  });

  it('renders one option per template name', async () => {
    await mount(
      <TemplatePicker
        {...baseProps({
          templates: [
            makeTemplate({ id: 't1', name: 'Onboarding A' }),
            makeTemplate({ id: 't2', name: 'Onboarding B' }),
          ],
        })}
      />,
    );
    expect(findByText(document.body, 'Onboarding A')).not.toBeNull();
    expect(findByText(document.body, 'Onboarding B')).not.toBeNull();
  });

  it('calls setSelectedId when a template option is clicked', async () => {
    const setSelectedId = vi.fn();
    await mount(
      <TemplatePicker
        {...baseProps({
          setSelectedId,
          templates: [makeTemplate({ id: 't-picked', name: 'Pick Me' })],
        })}
      />,
    );
    const target = findByText(document.body, 'Pick Me');
    expect(target).not.toBeNull();
    await click(target as HTMLElement);
    expect(setSelectedId).toHaveBeenCalledWith('t-picked');
  });

  it('renders the suggestion banner when a suggested template is provided', async () => {
    await mount(
      <TemplatePicker
        {...baseProps({
          suggestionEnabled: true,
          suggestedTemplate: makeTemplate({ id: 's1', name: 'AI Pick' }),
        })}
      />,
    );
    // Suggestion body interpolates the template name.
    expect(document.body.textContent).toMatch(/AI Pick/);
  });

  it('disables the start button when canStart is false', async () => {
    await mount(<TemplatePicker {...baseProps({ canStart: false })} />);
    const startBtn = findButton(document.body, /start/i);
    expect(startBtn?.disabled).toBe(true);
  });

  it('calls handleOpenChange(false) when Close is clicked', async () => {
    const handleOpenChange = vi.fn();
    await mount(<TemplatePicker {...baseProps({ handleOpenChange })} />);
    const closeBtn = findButton(document.body, /close/i);
    expect(closeBtn).not.toBeNull();
    await click(closeBtn as HTMLButtonElement);
    expect(handleOpenChange).toHaveBeenCalledWith(false);
  });
});
