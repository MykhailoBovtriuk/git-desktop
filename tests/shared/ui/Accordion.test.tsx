// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Accordion } from '../../../src/shared/ui/Accordion';

describe('Accordion', () => {
  it('title text is visible', () => {
    render(
      <Accordion title="My Section" open={false} onToggle={vi.fn()}>
        <span>content</span>
      </Accordion>,
    );
    expect(screen.getByText('My Section')).toBeInTheDocument();
  });

  it('when open=false: children NOT in the DOM', () => {
    render(
      <Accordion title="Section" open={false} onToggle={vi.fn()}>
        <span>hidden content</span>
      </Accordion>,
    );
    expect(screen.queryByText('hidden content')).not.toBeInTheDocument();
  });

  it('when open=true: children ARE in the DOM', () => {
    render(
      <Accordion title="Section" open={true} onToggle={vi.fn()}>
        <span>visible content</span>
      </Accordion>,
    );
    expect(screen.getByText('visible content')).toBeInTheDocument();
  });

  it('onToggle called when header button clicked', () => {
    const onToggle = vi.fn();
    render(
      <Accordion title="Section" open={false} onToggle={onToggle}>
        <span>content</span>
      </Accordion>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('badge > 0: badge number visible', () => {
    render(
      <Accordion title="Section" badge={3} open={false} onToggle={vi.fn()}>
        <span>content</span>
      </Accordion>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('badge = 0: badge NOT rendered', () => {
    render(
      <Accordion title="Section" badge={0} open={false} onToggle={vi.fn()}>
        <span>content</span>
      </Accordion>,
    );
    expect(screen.queryByText('0')).not.toBeInTheDocument();
  });

  it('badge = undefined: badge NOT rendered', () => {
    const { container } = render(
      <Accordion title="Section" open={false} onToggle={vi.fn()}>
        <span>content</span>
      </Accordion>,
    );
    // When badge is undefined, the header should only contain the title span and
    // the arrow indicator span — no extra badge span. (children are not rendered
    // while closed.)
    const spans = container.querySelectorAll('span');
    // title span + arrow span = 2; no extra badge span
    expect(spans).toHaveLength(2);
  });

  it('header has bg-surface0 when open=true', () => {
    render(
      <Accordion title="Section" open={true} onToggle={vi.fn()}>
        <span>content</span>
      </Accordion>,
    );
    // The header styling lives on the container div; the toggle button is a
    // transparent overlay inside it.
    expect(screen.getByRole('button').parentElement).toHaveClass('bg-surface0');
  });

  it('header does NOT have bg-surface0 when open=false', () => {
    render(
      <Accordion title="Section" open={false} onToggle={vi.fn()}>
        <span>content</span>
      </Accordion>,
    );
    expect(screen.getByRole('button').parentElement).not.toHaveClass('bg-surface0');
  });
});
