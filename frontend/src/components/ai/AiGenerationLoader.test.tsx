import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AiGenerationLoader from './AiGenerationLoader';

describe('AI generation modal', () => {
  it('matches the prototype structure without reporting fake progress and updates the active status', () => {
    const view = render(<AiGenerationLoader status="queued" reportCount={60} />);
    const dialog = screen.getByRole('dialog', { name: 'ה-AI כותב דיווחים חדשים' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText(/60 דיווחים/)).toHaveTextContent('כמה דקות');
    const progress = within(dialog).getByRole('progressbar');
    expect(progress).not.toHaveAttribute('aria-valuenow');
    expect(progress).toHaveAttribute('aria-valuetext', 'ממתין לשירות ה-AI');
    expect(dialog.querySelectorAll('.ai-generation-steps li')).toHaveLength(4);
    expect(dialog.querySelectorAll('.complete')).toHaveLength(1);
    expect(dialog.querySelectorAll('.active')).toHaveLength(1);
    view.rerender(<AiGenerationLoader status="running" reportCount={60} />);
    expect(dialog.querySelector('.active')).toHaveTextContent('ה-AI כותב ובודק את הדיווחים');
    expect(dialog.querySelectorAll('.complete')).toHaveLength(1);
    expect(progress).toHaveAttribute('aria-valuetext', expect.stringContaining('אחוז ההתקדמות אינו זמין'));
    view.unmount();
  });

  it('locks scrolling, keeps keyboard focus inside, and restores focus and scrolling on removal', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    const overflow = document.body.style.overflow;
    const view = render(<AiGenerationLoader status="running" reportCount={10} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog).toBeInTheDocument();
    view.unmount();
    expect(document.body.style.overflow).toBe(overflow);
    expect(button).toHaveFocus();
    button.remove();
  });
});
