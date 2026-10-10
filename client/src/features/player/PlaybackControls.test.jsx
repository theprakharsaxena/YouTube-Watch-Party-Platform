import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlaybackControls from './PlaybackControls.jsx';

const props = {
  status: 'paused',
  position: 30,
  duration: 120,
  hasVideo: true,
  muted: false,
  onToggle: vi.fn(),
  onSeek: vi.fn(),
  onSkip: vi.fn(),
  onToggleMute: vi.fn(),
};

describe('PlaybackControls', () => {
  it('gives controllers working transport buttons', async () => {
    const onToggle = vi.fn();
    render(<PlaybackControls {...props} canControl onToggle={onToggle} />);
    await userEvent.click(screen.getByRole('button', { name: /play for everyone/i }));
    expect(onToggle).toHaveBeenCalledOnce();
    expect(screen.getByRole('slider', { name: /seek/i })).toBeEnabled();
  });

  it('shows participants a read-only progress bar and no play control', () => {
    render(<PlaybackControls {...props} canControl={false} />);
    expect(screen.queryByRole('button', { name: /play for everyone/i })).toBeNull();
    expect(screen.queryByRole('slider')).toBeNull();
    expect(screen.getByRole('progressbar', { name: /playback position/i })).toBeInTheDocument();
    expect(screen.getByText(/host controls playback/i)).toBeInTheDocument();
  });

  it('labels the button by what it will do', () => {
    render(<PlaybackControls {...props} status="playing" canControl />);
    expect(screen.getByRole('button', { name: /pause for everyone/i })).toBeInTheDocument();
  });

  it('triggers onToggleFullscreen when fullscreen button is clicked', async () => {
    const onToggleFullscreen = vi.fn();
    render(<PlaybackControls {...props} onToggleFullscreen={onToggleFullscreen} isFullscreen={false} />);
    const btn = screen.getByRole('button', { name: /full screen/i });
    expect(btn).toBeInTheDocument();
    await userEvent.click(btn);
    expect(onToggleFullscreen).toHaveBeenCalledOnce();
  });

  it('calls onSeek and holds value optimistically when user scrubs and releases the slider', () => {
    const onSeek = vi.fn();
    const { rerender } = render(<PlaybackControls {...props} canControl onSeek={onSeek} position={60} />);
    const slider = screen.getByRole('slider', { name: /seek/i });
    expect(slider).toHaveValue('60');

    // Simulate drag down to 0
    userEvent.pointer([{ target: slider, keys: '[MouseLeft>]' }]);
    slider.value = '0';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
    slider.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    expect(onSeek).toHaveBeenCalledWith(0);
    // Value remains 0 optimistically even if parent position is still 60
    expect(slider).toHaveValue('0');

    // Now parent updates position close to 0 -> clears pending optimistic hold
    rerender(<PlaybackControls {...props} canControl onSeek={onSeek} position={0.2} />);
    expect(slider).toHaveValue('0.2');
  });
});
