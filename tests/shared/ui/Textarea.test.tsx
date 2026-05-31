// @vitest-environment jsdom
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Textarea } from '../../../src/shared/ui/Textarea';

describe('Textarea', () => {
  it('renders a <textarea> element', () => {
    render(<Textarea />);
    expect(document.querySelector('textarea')).toBeInTheDocument();
  });

  it('has class bg-surface0', () => {
    render(<Textarea />);
    expect(document.querySelector('textarea')).toHaveClass('bg-surface0');
  });

  it('has class resize-none', () => {
    render(<Textarea />);
    expect(document.querySelector('textarea')).toHaveClass('resize-none');
  });

  it('has class outline-none', () => {
    render(<Textarea />);
    expect(document.querySelector('textarea')).toHaveClass('outline-none');
  });

  it('placeholder renders correctly', () => {
    render(<Textarea placeholder="Enter a message" />);
    expect(screen.getByPlaceholderText('Enter a message')).toBeInTheDocument();
  });

  it('rows prop is forwarded as HTML attribute', () => {
    render(<Textarea rows={5} />);
    expect(document.querySelector('textarea')).toHaveAttribute('rows', '5');
  });

  it('onChange callback fires when value changes', () => {
    const onChange = vi.fn();
    render(<Textarea onChange={onChange} />);
    fireEvent.change(document.querySelector('textarea')!, { target: { value: 'hello' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('extra className merges with base classes', () => {
    render(<Textarea className="extra-class" />);
    const el = document.querySelector('textarea')!;
    expect(el).toHaveClass('bg-surface0');
    expect(el).toHaveClass('extra-class');
  });
});
