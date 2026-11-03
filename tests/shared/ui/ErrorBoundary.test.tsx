// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary } from '../../../src/shared/ui/ErrorBoundary';

function Boom(): never {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders its children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>safe content</div>
      </ErrorBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('renders a fallback with an alert role when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('offers a reload action in the fallback', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument();
  });

  it('hands the failure to onError and renders the given fallback', () => {
    const onError = vi.fn();
    render(
      <ErrorBoundary onError={onError} fallback={error => <p>panel down: {error.message}</p>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText('panel down: kaboom')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'kaboom' }),
      expect.any(String),
    );
  });
});
