import { describe, expect, it } from 'vitest';

import { a, b, doc, h1, h2, ol, p, ul } from '../lexical.js';

describe('lexical builder', () => {
  it('wraps blocks in a Lexical root', () => {
    const result = doc(h1('Title'));
    expect(result.root.type).toBe('root');
    expect(result.root.children).toHaveLength(1);
  });

  it('renders headings with the correct tag', () => {
    const heading = h2('Section');
    expect(heading.type).toBe('heading');
    expect(heading.tag).toBe('h2');
    expect(heading.children[0]).toMatchObject({ type: 'text', text: 'Section', format: 0 });
  });

  it('applies bold formatting via the b helper', () => {
    const para = p('Plain ', b('Strong'));
    const second = para.children[1];
    expect(second).toMatchObject({ type: 'text', text: 'Strong', format: 1 });
  });

  it('renders links with newTab default true', () => {
    const para = p(a('Click', 'https://example.com'));
    const link = para.children[0];
    expect(link).toMatchObject({
      type: 'link',
      fields: { url: 'https://example.com', newTab: true, linkType: 'custom' },
    });
  });

  it('emits bullet and number lists with listitem children', () => {
    const bullet = ul(['Alpha'], ['Beta']);
    expect(bullet.listType).toBe('bullet');
    expect(bullet.children).toHaveLength(2);

    const numbered = ol(['Step 1'], ['Step 2']);
    expect(numbered.listType).toBe('number');
  });
});
