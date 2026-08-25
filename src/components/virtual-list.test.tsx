// @ts-nocheck
// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VirtualList } from './virtual-list';

afterEach(cleanup);

const ITEM_H = 40;

const makeItems = (n: number) => Array.from({ length: n }, (_, i) => `ITEM-${i}`);
const renderRow = (item: string) => <div data-testid="row">{item}</div>;

describe('VirtualList', () => {
  it('renders every item below the virtualisation threshold', () => {
    const { container } = render(
      <VirtualList items={makeItems(49)} itemHeight={ITEM_H} renderItem={renderRow} />,
    );

    expect(container.querySelectorAll('[data-testid="row"]').length).toBe(49);
    expect(screen.getByText('ITEM-0')).toBeTruthy();
    expect(screen.getByText('ITEM-48')).toBeTruthy();
    // The unwindowed path has no spacer — it is plain rendering.
    expect(container.querySelector('[data-vlist-spacer]')).toBeNull();
  });

  it('mounts only a fraction of the rows for a long list', () => {
    const { container } = render(
      <VirtualList items={makeItems(1000)} itemHeight={ITEM_H} renderItem={renderRow} />,
    );

    // jsdom reports clientHeight 0, so exactly the overscan buffer stays mounted.
    const mounted = container.querySelectorAll('[data-testid="row"]').length;
    expect(mounted).toBeGreaterThan(0);
    expect(mounted).toBeLessThan(60);
    expect(screen.getByText('ITEM-0')).toBeTruthy();
    expect(screen.queryByText('ITEM-999')).toBeNull();
  });

  it('honours a custom overscan when picking the window', () => {
    const { container } = render(
      <VirtualList items={makeItems(1000)} itemHeight={ITEM_H} overscan={3} renderItem={renderRow} />,
    );

    expect(container.querySelectorAll('[data-testid="row"]').length).toBe(3);
  });

  it('sizes the spacer to the full list height', () => {
    const { container } = render(
      <VirtualList items={makeItems(500)} itemHeight={ITEM_H} renderItem={renderRow} />,
    );

    const spacer = container.querySelector('[data-vlist-spacer]') as HTMLElement | null;
    expect(spacer).toBeTruthy();
    expect(spacer?.style.height).toBe(`${500 * ITEM_H}px`);
  });

  it('shows the empty state for an empty list', () => {
    const { container } = render(
      <VirtualList
        items={[]}
        itemHeight={ITEM_H}
        renderItem={renderRow}
        emptyState={<div>NO RESULTS</div>}
      />,
    );

    expect(screen.getByText('NO RESULTS')).toBeTruthy();
    expect(container.querySelectorAll('[data-testid="row"]').length).toBe(0);
  });

  it('keeps the HUD scrollbar class and merges the caller class + style', () => {
    const { container } = render(
      <VirtualList
        items={makeItems(200)}
        itemHeight={ITEM_H}
        renderItem={renderRow}
        className="catalog-list"
        style={{ flex: 1 }}
      />,
    );

    const scroller = container.firstElementChild as HTMLElement;
    expect(scroller.className).toBe('nx-scroll catalog-list');
    expect(scroller.style.overflowY).toBe('auto');
    // Assert the longhand: jsdom expands the `flex` shorthand to `1 1 0%`, and
    // that expansion is a CSSOM implementation detail we should not pin a test to.
    expect(scroller.style.flexGrow).toBe('1');
  });
});
