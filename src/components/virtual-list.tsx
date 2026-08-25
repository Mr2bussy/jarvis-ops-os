// @ts-nocheck
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/* ── VirtualList ─────────────────────────────────────────────
 * Fixed-row-height windowing for the long catalogue screens.
 * Hand-rolled instead of pulling in react-window: the app only ever needs a
 * constant row pitch, so ~120 dependency-free lines keep the bundle and the
 * supply-chain audit surface unchanged.
 */

/*
 * Under this many items the windowing machinery costs more than it saves — an
 * extra wrapper per row, a scroll listener, a ResizeObserver and a row height
 * that can no longer follow its content. ~50 HUD cards mount in well under a
 * frame, so short lists render straight through instead.
 */
const VIRTUALIZE_THRESHOLD = 50;

export interface VirtualListProps<T> {
  items: T[];
  /** Row pitch in px — row height *including* `gap`. Must be constant. */
  itemHeight: number;
  renderItem: (item: T, index: number) => ReactNode;
  /** Rows kept mounted above/below the viewport so fast scrolling stays filled. */
  overscan?: number;
  className?: string;
  style?: CSSProperties;
  emptyState?: ReactNode;
  /**
   * Opt-in card-grid mode. Mirrors `repeat(auto-fill, minmax(<columnMinWidth>px, 1fr))`
   * by deriving the column count from the measured width, so the catalogue grids
   * keep their responsive multi-column layout while still only mounting the
   * visible rows. Omit it for a plain single-column list.
   */
  columnMinWidth?: number;
  /** Gap between rows and columns in px. */
  gap?: number;
}

export function VirtualList<T>({
  items,
  itemHeight,
  renderItem,
  overscan = 6,
  className = '',
  style,
  emptyState,
  columnMinWidth,
  gap = 0,
}: VirtualListProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Panels in this app are draggable and resizable, so the visible window has to
  // follow layout changes — a window `resize` listener alone would miss them.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    if (typeof ResizeObserver === 'undefined') return; // jsdom + older runtimes
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const count = items.length;

  // A new filter result is a new list: keeping the old offset would show an
  // apparently empty panel, so snap back to the top whenever the length changes.
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [count]);

  // Same arithmetic the CSS `auto-fill` track sizing uses, so the windowed grid
  // breaks into columns at exactly the same widths as the unwindowed one.
  const columns =
    columnMinWidth && size.w > 0 ? Math.max(1, Math.floor((size.w + gap) / (columnMinWidth + gap))) : 1;

  const cls = className ? `nx-scroll ${className}` : 'nx-scroll';

  if (count === 0) {
    return (
      <div ref={scrollRef} className={cls} style={{ position: 'relative', overflowY: 'auto', ...style }}>
        {emptyState}
      </div>
    );
  }

  if (count < VIRTUALIZE_THRESHOLD) {
    return (
      <div
        ref={scrollRef}
        className={cls}
        style={{
          position: 'relative',
          overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: columnMinWidth ? `repeat(auto-fill, minmax(${columnMinWidth}px, 1fr))` : '1fr',
          // Rows stay the same height as in the windowed path so crossing the
          // threshold never changes the layout the operator sees.
          gridAutoRows: itemHeight - gap,
          gap,
          alignContent: 'start',
          ...style,
        }}
      >
        {items.map((item, i) => (
          <Fragment key={i}>{renderItem(item, i)}</Fragment>
        ))}
      </div>
    );
  }

  const rowCount = Math.ceil(count / columns);
  const firstRow = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const lastRow = Math.min(rowCount, Math.ceil((scrollTop + size.h) / itemHeight) + overscan);

  const rows: ReactNode[] = [];
  for (let r = firstRow; r < lastRow; r++) {
    const from = r * columns;
    rows.push(
      <div
        key={r}
        style={{
          position: 'absolute',
          top: r * itemHeight,
          left: 0,
          right: 0,
          height: itemHeight - gap,
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap,
        }}
      >
        {items.slice(from, from + columns).map((item, k) => (
          <Fragment key={from + k}>{renderItem(item, from + k)}</Fragment>
        ))}
      </div>,
    );
  }

  return (
    <div
      ref={scrollRef}
      className={cls}
      style={{ position: 'relative', overflowY: 'auto', ...style }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      {/* Spacer carries the full scroll height; only `rows` are actually mounted. */}
      <div data-vlist-spacer="" style={{ position: 'relative', height: rowCount * itemHeight }}>
        {rows}
      </div>
    </div>
  );
}
