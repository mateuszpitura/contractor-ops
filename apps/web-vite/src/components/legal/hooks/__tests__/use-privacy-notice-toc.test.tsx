/**
 * Spec for `usePrivacyNoticeToc` — DOM-driven hook that collects
 * `<main h2[id]>` headings on mount and tracks the active section via
 * `IntersectionObserver`. Covers:
 *   - empty/missing-id main → empty headings (caller renders nothing)
 *   - id + text extraction from `<main h2 id>` nodes
 *   - i18n label/heading wired from the `Legal.privacy.toc` namespace
 *   - IntersectionObserver wired + cleaned up on unmount
 */

import { describe, expect, it } from 'vitest';

import { renderHookWithProviders, waitFor } from '../../../../test-utils/render-hook.js';
import { usePrivacyNoticeToc } from '../use-privacy-notice-toc.js';

type IoCallback = (
  entries: { isIntersecting: boolean; target: Element }[],
  observer: IntersectionObserver,
) => void;

interface StubIO {
  cb: IoCallback;
  observed: Element[];
  disconnectCalls: number;
}

function withIntersectionObserver(): StubIO {
  const stub: StubIO = {
    cb: () => undefined,
    observed: [],
    disconnectCalls: 0,
  };
  class FakeIO {
    constructor(cb: IoCallback) {
      stub.cb = cb;
    }
    observe(el: Element) {
      stub.observed.push(el);
    }
    unobserve() {
      return;
    }
    disconnect() {
      stub.disconnectCalls += 1;
    }
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = '';
    thresholds: number[] = [];
  }
  globalThis.IntersectionObserver = FakeIO as unknown as typeof IntersectionObserver;
  return stub;
}

function mountMain(html: string): HTMLElement {
  const main = document.createElement('main');
  main.innerHTML = html;
  document.body.appendChild(main);
  return main;
}

function cleanupDom() {
  for (const el of Array.from(document.body.querySelectorAll('main'))) {
    el.remove();
  }
}

describe('usePrivacyNoticeToc', () => {
  it('returns empty headings when no <main h2[id]> exists', async () => {
    cleanupDom();
    withIntersectionObserver();
    mountMain('<p>no headings here</p>');

    const { result } = renderHookWithProviders(() => usePrivacyNoticeToc());

    await waitFor(() => expect(result.current.headings).toEqual([]));
    expect(result.current.activeId).toBeNull();
    cleanupDom();
  });

  it('skips h2 nodes without an id', async () => {
    cleanupDom();
    withIntersectionObserver();
    mountMain('<h2>missing id</h2><h2 id="ok">With id</h2>');

    const { result } = renderHookWithProviders(() => usePrivacyNoticeToc());

    await waitFor(() => expect(result.current.headings).toHaveLength(1));
    expect(result.current.headings[0]).toEqual({ id: 'ok', text: 'With id' });
    cleanupDom();
  });

  it('extracts ids + trimmed text and exposes i18n labels', async () => {
    cleanupDom();
    withIntersectionObserver();
    mountMain('<h2 id="one">  First section  </h2><h2 id="two">Second</h2>');

    const { result } = renderHookWithProviders(() => usePrivacyNoticeToc());

    await waitFor(() => expect(result.current.headings).toHaveLength(2));
    expect(result.current.headings.map(h => h.id)).toEqual(['one', 'two']);
    expect(result.current.headings[0].text).toBe('First section');
    expect(typeof result.current.label).toBe('string');
    expect(typeof result.current.heading).toBe('string');
    cleanupDom();
  });

  it('observes collected headings and updates activeId on intersection', async () => {
    cleanupDom();
    const io = withIntersectionObserver();
    mountMain('<h2 id="a">Alpha</h2><h2 id="b">Beta</h2>');

    const { result } = renderHookWithProviders(() => usePrivacyNoticeToc());

    await waitFor(() => expect(io.observed).toHaveLength(2));

    const alphaEl = document.getElementById('a');
    const betaEl = document.getElementById('b');
    if (!(alphaEl && betaEl)) throw new Error('expected mounted headings');
    alphaEl.getBoundingClientRect = (() => ({ top: 50 })) as unknown as () => DOMRect;
    betaEl.getBoundingClientRect = (() => ({ top: 200 })) as unknown as () => DOMRect;

    io.cb(
      [
        { isIntersecting: true, target: betaEl },
        { isIntersecting: true, target: alphaEl },
      ],
      {} as IntersectionObserver,
    );

    await waitFor(() => expect(result.current.activeId).toBe('a'));
    cleanupDom();
  });

  it('disconnects the observer on unmount', async () => {
    cleanupDom();
    const io = withIntersectionObserver();
    mountMain('<h2 id="x">X</h2>');

    const { result, unmount } = renderHookWithProviders(() => usePrivacyNoticeToc());
    await waitFor(() => expect(result.current.headings).toHaveLength(1));

    unmount();
    expect(io.disconnectCalls).toBeGreaterThan(0);
    cleanupDom();
  });
});
