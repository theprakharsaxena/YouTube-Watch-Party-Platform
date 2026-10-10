import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PlayerStage from './PlayerStage.jsx';

describe('PlayerStage double-click & single-click handling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers onDoubleClick and cancels single click when clicked twice quickly', () => {
    const onShieldClick = vi.fn();
    const onDoubleClick = vi.fn();
    const hostRef = { current: null };

    const { container } = render(
      <PlayerStage
        hostRef={hostRef}
        hasVideo={true}
        ready={true}
        canControl={true}
        onShieldClick={onShieldClick}
        onDoubleClick={onDoubleClick}
      />
    );

    const shield = container.querySelector('.stage__shield');
    expect(shield).toBeInTheDocument();

    // Click 1
    fireEvent.click(shield);
    expect(onShieldClick).not.toHaveBeenCalled();
    expect(onDoubleClick).not.toHaveBeenCalled();

    // Advance 150ms (quick second click)
    vi.advanceTimersByTime(150);

    // Click 2
    fireEvent.click(shield);
    expect(onDoubleClick).toHaveBeenCalledOnce();

    // Advance past single click delay to ensure single click does not fire
    vi.advanceTimersByTime(500);
    expect(onShieldClick).not.toHaveBeenCalled();
  });

  it('triggers onDoubleClick even when clicks have a relaxed time gap (e.g. 400ms)', () => {
    const onShieldClick = vi.fn();
    const onDoubleClick = vi.fn();
    const hostRef = { current: null };

    const { container } = render(
      <PlayerStage
        hostRef={hostRef}
        hasVideo={true}
        ready={true}
        canControl={true}
        onShieldClick={onShieldClick}
        onDoubleClick={onDoubleClick}
      />
    );

    const shield = container.querySelector('.stage__shield');

    // Click 1 at t=0
    fireEvent.click(shield);

    // Advance 350ms (past 320ms single-click threshold, so single click fires once)
    vi.advanceTimersByTime(350);
    expect(onShieldClick).toHaveBeenCalledTimes(1);

    // Click 2 at t=400ms (within 600ms double click window)
    fireEvent.click(shield);
    expect(onDoubleClick).toHaveBeenCalledOnce();
    // Reverts accidental play/pause toggle from single click
    expect(onShieldClick).toHaveBeenCalledTimes(2);
  });

  it('does NOT trigger double-click when clicks exceed the 600ms gap window', () => {
    const onShieldClick = vi.fn();
    const onDoubleClick = vi.fn();
    const hostRef = { current: null };

    const { container } = render(
      <PlayerStage
        hostRef={hostRef}
        hasVideo={true}
        ready={true}
        canControl={true}
        onShieldClick={onShieldClick}
        onDoubleClick={onDoubleClick}
      />
    );

    const shield = container.querySelector('.stage__shield');

    // Click 1
    fireEvent.click(shield);
    vi.advanceTimersByTime(350);
    expect(onShieldClick).toHaveBeenCalledTimes(1);

    // Wait past 650ms
    vi.advanceTimersByTime(400);

    // Click 2 after 750ms total
    fireEvent.click(shield);
    expect(onDoubleClick).not.toHaveBeenCalled();
    vi.advanceTimersByTime(350);
    expect(onShieldClick).toHaveBeenCalledTimes(2);
  });

  it('allows participants (canControl=false) to double-click with a time gap to enter fullscreen', () => {
    const onShieldClick = vi.fn();
    const onDoubleClick = vi.fn();
    const hostRef = { current: null };

    const { container } = render(
      <PlayerStage
        hostRef={hostRef}
        hasVideo={true}
        ready={true}
        canControl={false}
        onShieldClick={onShieldClick}
        onDoubleClick={onDoubleClick}
      />
    );

    const shield = container.querySelector('.stage__shield');

    // Click 1
    fireEvent.click(shield);
    vi.advanceTimersByTime(450);

    // Click 2 with 450ms gap
    fireEvent.click(shield);
    expect(onDoubleClick).toHaveBeenCalledOnce();
    expect(onShieldClick).not.toHaveBeenCalled();
  });
});
