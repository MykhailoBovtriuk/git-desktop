import { describe, it, expect, beforeEach } from 'vitest';
import { useUiStore } from '../../src/stores/ui-store';
import { useLogStore } from '../../src/stores/log-store';
import { openLogEntry } from '../../src/stores/error-toast';

describe('openLogEntry', () => {
  beforeEach(() => {
    useUiStore.setState({
      activeView: 'changes',
      previousView: 'changes',
      rightPanel: null,
      connectionOpen: false,
    });
    useLogStore.setState({ focusId: null });
  });

  it('leaves Settings, where the logs panel would stay hidden', () => {
    useUiStore.getState().openSettings();
    openLogEntry('e1');

    const ui = useUiStore.getState();
    expect(ui.activeView).toBe('changes');
    expect(ui.rightPanel).toBe('logs');
    expect(useLogStore.getState().focusId).toBe('e1');
  });

  it('closes the connection dialog in front of the panel', () => {
    useUiStore.getState().openConnection();
    openLogEntry('e2');

    expect(useUiStore.getState().connectionOpen).toBe(false);
    expect(useUiStore.getState().rightPanel).toBe('logs');
    expect(useLogStore.getState().focusId).toBe('e2');
  });

  it('keeps the current view when no overlay is open', () => {
    useUiStore.setState({ activeView: 'history' });
    openLogEntry('e3');
    expect(useUiStore.getState().activeView).toBe('history');
  });
});
