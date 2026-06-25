import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Leaderboard } from './Leaderboard';

function mockScoresResponse(scores: unknown[]) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(
    JSON.stringify({ scores }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
    },
  )));
}

describe('Leaderboard completion flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('asks for a player name when the leaderboard is empty', async () => {
    mockScoresResponse([]);

    render(
      <Leaderboard
        completedScore={{ gridSize: 4, timeInSeconds: 12, moves: 48 }}
        gridSize={4}
        showSubmit
        title="Solved"
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Name')).toBeTruthy();
    });
  });

  it('shows the anti-cheat message for scores under 10 seconds', async () => {
    mockScoresResponse([]);

    render(
      <Leaderboard
        completedScore={{ gridSize: 4, timeInSeconds: 9, moves: 18 }}
        gridSize={4}
        showSubmit
        title="Solved"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Scores under 10 seconds are not submitted.')).toBeTruthy();
    });
  });

  it('switches between difficulty leaderboards with tabs', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ scores: [] }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    ));
    vi.stubGlobal('fetch', fetchMock);

    render(<Leaderboard gridSize={3} showDifficultyTabs />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('/api/scores?grid_size=3');
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Medium' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('/api/scores?grid_size=4');
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Hard' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith('/api/scores?grid_size=5');
    });
  });
});
