// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RawDiff } from '../../../src/components/stash/RawDiff';

const SAMPLE = `diff --git a/a.txt b/a.txt
@@ -1,3 +1,3 @@
-old line
+new line
 context`;

describe('RawDiff', () => {
  it('renders empty placeholder when raw is empty', () => {
    render(<RawDiff raw="" />);
    expect(screen.getByText(/no diff/i)).toBeInTheDocument();
  });

  it('renders each line of the diff', () => {
    render(<RawDiff raw={SAMPLE} />);
    expect(screen.getByText('-old line')).toBeInTheDocument();
    expect(screen.getByText('+new line')).toBeInTheDocument();
    expect(screen.getByText(/context/)).toBeInTheDocument();
  });

  it('addition lines have text-green class', () => {
    render(<RawDiff raw={SAMPLE} />);
    expect(screen.getByText('+new line')).toHaveClass('text-green');
  });

  it('deletion lines have text-red class', () => {
    render(<RawDiff raw={SAMPLE} />);
    expect(screen.getByText('-old line')).toHaveClass('text-red');
  });

  it('hunk headers have text-blue class', () => {
    render(<RawDiff raw={SAMPLE} />);
    expect(screen.getByText('@@ -1,3 +1,3 @@')).toHaveClass('text-blue');
  });
});
