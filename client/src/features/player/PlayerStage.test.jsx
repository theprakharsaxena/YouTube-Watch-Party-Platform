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

    fireEvent.click(shield);
    expect(onShieldClick).not.toHaveBeenCalled();
    expect(onDoubleClick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(150);

    fireEvent.click(shield);
    expect(onDoubleClick).toHaveBeenCalledOnce();

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

    fireEvent.click(shield);

    vi.advanceTimersByTime(350);
    expect(onShieldClick).toHaveBeenCalledTimes(1);

    fireEvent.click(shield);
    expect(onDoubleClick).toHaveBeenCalledOnce();

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

    fireEvent.click(shield);
    vi.advanceTimersByTime(350);
    expect(onShieldClick).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(400);

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

    fireEvent.click(shield);
    vi.advanceTimersByTime(450);

    fireEvent.click(shield);
    expect(onDoubleClick).toHaveBeenCalledOnce();
    expect(onShieldClick).not.toHaveBeenCalled();
  });

  it('renders ambient lighting effect with YouTube video thumbnail and active playing state', () => {
    const hostRef = { current: null };
    const { container, rerender } = render(
      <PlayerStage
        hostRef={hostRef}
        hasVideo={true}
        videoId="dQw4w9WgXcQ"
        playing={true}
        ambientMode={true}
      />
    );

    const ambient = container.querySelector('.stage__ambient');
    expect(ambient).toBeInTheDocument();
    expect(ambient).toHaveClass('stage__ambient--playing');

    const ambientArt = container.querySelector('.stage__ambient-art');
    expect(ambientArt).toBeInTheDocument();
    expect(ambientArt.style.backgroundImage).toContain('dQw4w9WgXcQ');
    expect(container.querySelector('.stage__ambient-mesh')).toBeInTheDocument();
    expect(container.querySelector('.stage__ambient-video')).toBeInTheDocument();

    rerender(
      <PlayerStage
        hostRef={hostRef}
        hasVideo={true}
        videoId="dQw4w9WgXcQ"
        playing={false}
        ambientMode={true}
      />
    );
    expect(container.querySelector('.stage__ambient')).not.toHaveClass('stage__ambient--playing');

    rerender(
      <PlayerStage
        hostRef={hostRef}
        hasVideo={true}
        videoId="dQw4w9WgXcQ"
        playing={true}
        ambientMode={false}
      />
    );
    expect(container.querySelector('.stage__ambient')).toBeNull();

    rerender(
      <PlayerStage
        hostRef={hostRef}
        hasVideo={true}
        videoId="dQw4w9WgXcQ"
        playing={true}
        ambientMode={true}
        isFullscreen={true}
      />
    );
    expect(container.querySelector('.stage__ambient')).toBeNull();
  });
});

