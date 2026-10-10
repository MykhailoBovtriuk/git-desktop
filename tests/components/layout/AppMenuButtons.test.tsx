// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const { AppMenuButtons } = await import('../../../src/components/layout/AppMenuButtons');
const { useUiStore } = await import('../../../src/stores/ui-store');

beforeEach(() => {
  useUiStore.setState({ activeView: 'graph', previousView: 'changes' });
});

describe('AppMenuButtons', () => {
  it('marks the open page and closes it on a second click', () => {
    render(<AppMenuButtons />);
    const settings = screen.getByRole('button', { name: 'settings' });
    expect(settings).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(settings);
    expect(useUiStore.getState().activeView).toBe('settings');
    expect(settings).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'about' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(settings);
    expect(useUiStore.getState().activeView).toBe('graph');
  });

  it('switches from one page to the other instead of closing', () => {
    render(<AppMenuButtons />);
    fireEvent.click(screen.getByRole('button', { name: 'settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'about' }));
    expect(useUiStore.getState().activeView).toBe('about');
    expect(screen.getByRole('button', { name: 'about' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switching pages and then closing lands on the work view, not the other page', () => {
    render(<AppMenuButtons />);
    fireEvent.click(screen.getByRole('button', { name: 'about' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'settings' }));
    expect(useUiStore.getState().activeView).toBe('graph');
  });
});
