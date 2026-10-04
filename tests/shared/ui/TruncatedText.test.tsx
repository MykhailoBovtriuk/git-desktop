// @vitest-environment jsdom
import { act, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TruncatedText } from '../../../src/shared/ui/TruncatedText';

function setWidths(el: HTMLElement, scroll: number, client: number) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scroll });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: client });
}

function hover(el: HTMLElement) {
  fireEvent.mouseEnter(el);
  act(() => {
    vi.advanceTimersByTime(500);
  });
}

describe('TruncatedText', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('applies truncate and renders the requested tag', () => {
    render(<TruncatedText as="p">hello</TruncatedText>);
    const el = screen.getByText('hello');
    expect(el.tagName).toBe('P');
    expect(el).toHaveClass('truncate');
  });

  it('shows no tooltip when the text fits', () => {
    render(<TruncatedText>short</TruncatedText>);
    const el = screen.getByText('short');
    setWidths(el, 50, 100);
    hover(el);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('shows the full text after a delay when cut, hides on leave', () => {
    render(<TruncatedText>a very long message</TruncatedText>);
    const el = screen.getByText('a very long message');
    setWidths(el, 300, 100);
    fireEvent.mouseEnter(el);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByRole('tooltip')).toHaveTextContent('a very long message');
    expect(el).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id);
    fireEvent.mouseLeave(el);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('cancels a pending tooltip when the pointer leaves early', () => {
    render(<TruncatedText>a very long message</TruncatedText>);
    const el = screen.getByText('a very long message');
    setWidths(el, 300, 100);
    fireEvent.mouseEnter(el);
    fireEvent.mouseLeave(el);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('alwaysTooltip shows a differing tooltip even without overflow', () => {
    render(
      <TruncatedText tooltip="src/lib/file.ts" alwaysTooltip>
        file.ts
      </TruncatedText>,
    );
    const el = screen.getByText('file.ts');
    setWidths(el, 50, 100);
    hover(el);
    expect(screen.getByRole('tooltip')).toHaveTextContent('src/lib/file.ts');
  });

  it('alwaysTooltip stays quiet when the tooltip equals the shown text', () => {
    render(
      <TruncatedText tooltip="file.ts" alwaysTooltip>
        file.ts
      </TruncatedText>,
    );
    const el = screen.getByText('file.ts');
    setWidths(el, 50, 100);
    hover(el);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
