// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from '../../../src/shared/ui/Avatar';
import { Card } from '../../../src/shared/ui/Card';
import { EmptyState } from '../../../src/shared/ui/EmptyState';
import { ProgressBar } from '../../../src/shared/ui/ProgressBar';
import { RefBadges } from '../../../src/shared/ui/RefBadges';

describe('EmptyState', () => {
  it('shows its message', () => {
    render(<EmptyState>Nothing here</EmptyState>);
    expect(screen.getByText('Nothing here')).toBeTruthy();
  });
});

describe('Card', () => {
  it('passes through props and children', () => {
    render(<Card data-testid="card">body</Card>);
    expect(screen.getByTestId('card').textContent).toBe('body');
  });
});

describe('Avatar', () => {
  it('shows the image when there is one', () => {
    const { container } = render(<Avatar src="data:image/png;base64,x" size="sm" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe('data:image/png;base64,x');
  });

  it('falls back to an icon without one', () => {
    const { container } = render(<Avatar src={null} size="md" />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('ProgressBar', () => {
  it('fills to the given percent', () => {
    const { container } = render(<ProgressBar percent={40} />);
    expect((container.firstChild?.firstChild as HTMLElement).style.width).toBe('40%');
  });

  it('pulses when the total is unknown', () => {
    const { container } = render(<ProgressBar percent={null} />);
    expect((container.firstChild?.firstChild as HTMLElement).className).toContain('animate-pulse');
  });
});

describe('RefBadges', () => {
  it('shows at most three refs without the HEAD arrow', () => {
    render(
      <RefBadges refs={['HEAD -> main', 'origin/main', 'v1', 'v2']} maxWidth="max-w-[15ch]" />,
    );
    expect(screen.getByText('main')).toBeTruthy();
    expect(screen.getByText('v1')).toBeTruthy();
    expect(screen.queryByText('v2')).toBeNull();
  });
});
