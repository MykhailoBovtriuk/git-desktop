// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BareTitlebar } from '../../../src/components/layout/BareTitlebar';

const setPlatform = (platform: string) => {
  window.electronAPI = { platform } as typeof window.electronAPI;
};

afterEach(() => {
  delete (window as { electronAPI?: unknown }).electronAPI;
});

describe('BareTitlebar', () => {
  it('on macOS leaves room for the traffic lights on the left', () => {
    setPlatform('darwin');
    const { container } = render(<BareTitlebar />);
    expect(screen.getByText('Git Desktop')).toBeInTheDocument();
    expect(container.querySelector('.w-20')).not.toBeNull();
    expect(container.querySelector('.w-36')).toBeNull();
  });

  it('on Windows and Linux leaves room for the window buttons on the right', () => {
    setPlatform('win32');
    const { container } = render(<BareTitlebar />);
    expect(container.querySelector('.w-3')).not.toBeNull();
    expect(container.querySelector('.w-36')).not.toBeNull();
  });
});
