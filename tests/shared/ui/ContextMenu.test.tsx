// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useRef } from 'react';
import { ContextMenu } from '../../../src/shared/ui/ContextMenu';

function Harness({ open, anchor }: { open: boolean; anchor?: 'button' | 'panel' }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <div data-dropdown-panel>
      <button ref={ref}>⋯</button>
      <ContextMenu open={open} anchorRef={ref} anchor={anchor} height={44}>
        <span>action</span>
      </ContextMenu>
    </div>
  );
}

describe('ContextMenu', () => {
  it('renders nothing while closed', () => {
    render(<Harness open={false} />);
    expect(screen.queryByText('action')).toBeNull();
  });

  it('portals the menu to document.body when open', () => {
    render(<Harness open />);
    const item = screen.getByText('action');
    // In a portal, not inside the harness wrapper.
    expect(item.closest('[data-dropdown-panel]')).toBeNull();
    expect(item.closest('div.fixed')).not.toBeNull();
  });

  it('positions with fixed top/left for both anchor modes', () => {
    for (const anchor of ['button', 'panel'] as const) {
      const { unmount } = render(<Harness open anchor={anchor} />);
      const menu = screen.getByText('action').closest('div.fixed') as HTMLElement;
      expect(menu.style.top).not.toBe('');
      expect(menu.style.left).not.toBe('');
      unmount();
    }
  });
});
