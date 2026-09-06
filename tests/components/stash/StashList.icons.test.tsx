// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StashList } from '../../../src/components/stash/StashList';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'en' } }),
}));

const stashes = [
  { index: 0, message: 'WIP on main', branch: 'main', date: '2024-01-01T00:00:00Z' },
];

describe('StashList row actions', () => {
  it('renders apply, pop and drop as icons, not emoji or text glyphs', () => {
    render(
      <StashList
        stashes={stashes}
        onApply={vi.fn()}
        onPop={vi.fn()}
        onDrop={vi.fn()}
        selectedIndex={null}
        onSelect={vi.fn()}
      />,
    );

    for (const action of ['actions.apply', 'actions.pop', 'actions.drop']) {
      const btn = screen.getByTitle(action);
      // The emoji these replaced (📋 ↩ ✕) rendered as text and ignored `tint`.
      expect(btn.querySelector('svg'), `${action} should render an svg icon`).not.toBeNull();
      expect(btn.textContent, `${action} should carry no glyph text`).toBe('');
    }

    expect(screen.getByTitle('actions.apply')).toHaveClass('text-blue');
    expect(screen.getByTitle('actions.pop')).toHaveClass('text-green');
    expect(screen.getByTitle('actions.drop')).toHaveClass('text-red');
  });
});
