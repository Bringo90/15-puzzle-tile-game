import { FormEvent, useEffect, useState } from 'react';
import { DIFFICULTIES, GridSize } from './puzzle';

export type Score = {
  id: number;
  player_name: string;
  time_in_seconds: number;
  moves: number;
  grid_size: GridSize;
  created_at: string;
};

type LeaderboardProps = {
  completedScore?: {
    gridSize: GridSize;
    timeInSeconds: number;
    moves: number;
  } | null;
  gridSize: GridSize;
  showSubmit?: boolean;
  title?: string;
};

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

async function readJsonResponse(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json')) {
    throw new Error('Could not load leaderboard');
  }

  return response.json();
}

function isTopTenScore(scores: Score[], completedScore: NonNullable<LeaderboardProps['completedScore']>) {
  if (completedScore.timeInSeconds < 10) {
    return false;
  }

  if (scores.length < 10) {
    return true;
  }

  const slowestTopScore = scores[scores.length - 1];

  return completedScore.timeInSeconds < slowestTopScore.time_in_seconds
    || (
      completedScore.timeInSeconds === slowestTopScore.time_in_seconds
      && completedScore.moves < slowestTopScore.moves
    );
}

export function Leaderboard({
  completedScore = null,
  gridSize,
  showSubmit = false,
  title = 'Leaderboard',
}: LeaderboardProps) {
  const [scores, setScores] = useState<Score[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedKey, setSubmittedKey] = useState('');
  const [showScoresAfterSubmit, setShowScoresAfterSubmit] = useState(!showSubmit);

  async function loadScores() {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch(`/api/scores?grid_size=${gridSize}`);
      const body = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(body.error ?? 'Could not load leaderboard');
      }

      setScores(body.scores ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadScores();
  }, [gridSize]);

  async function submitScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!completedScore || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_name: playerName,
          grid_size: completedScore.gridSize,
          time_in_seconds: completedScore.timeInSeconds,
          moves: completedScore.moves,
        }),
      });
      const body = await readJsonResponse(response);

      if (!response.ok) {
        throw new Error(body.error ?? 'Could not submit score');
      }

      setSubmittedKey(`${completedScore.gridSize}-${completedScore.timeInSeconds}-${completedScore.moves}`);
      setPlayerName('');
      setMessage('Score submitted');
      await loadScores();
      setShowScoresAfterSubmit(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not submit score');
    } finally {
      setIsSubmitting(false);
    }
  }

  const scoreKey = completedScore ? `${completedScore.gridSize}-${completedScore.timeInSeconds}-${completedScore.moves}` : '';
  const canAssessScore = completedScore !== null && !isLoading;
  const isTooFastForSubmission = completedScore !== null && completedScore.timeInSeconds < 10;
  const qualifiesForTopTen = canAssessScore && isTopTenScore(scores, completedScore);
  const canSubmit = showSubmit && qualifiesForTopTen && scoreKey !== submittedKey;
  const showScores = !showSubmit || showScoresAfterSubmit || (canAssessScore && !qualifiesForTopTen);

  return (
    <section className="leaderboard" aria-label="Leaderboard">
      <div className="leaderboard__header">
        <h2>{title}</h2>
        <button type="button" onClick={loadScores} disabled={isLoading}>
          Refresh
        </button>
      </div>

      <p className="leaderboard__difficulty">
        {DIFFICULTIES.find((difficulty) => difficulty.gridSize === gridSize)?.label} · {gridSize}x{gridSize}
      </p>

      {showSubmit && completedScore && (
        <div className="completion-summary">
          <span>Time {formatTime(completedScore.timeInSeconds)}</span>
          <span>{completedScore.moves} moves</span>
        </div>
      )}

      {canSubmit && (
        <form className="score-form" onSubmit={submitScore}>
          <label htmlFor="player-name">Name</label>
          <div className="score-form__row">
            <input
              id="player-name"
              maxLength={24}
              onChange={(event) => setPlayerName(event.target.value)}
              placeholder="Your name"
              required
              type="text"
              value={playerName}
            />
            <button type="submit" disabled={isSubmitting}>
              Submit
            </button>
          </div>
        </form>
      )}

      {showSubmit && completedScore && canAssessScore && !canSubmit && !showScoresAfterSubmit && (
        <p className="leaderboard__message">
          {isTooFastForSubmission
            ? 'Scores under 10 seconds are not submitted.'
            : 'Not quite top 10 this time.'}
        </p>
      )}

      {message && <p className="leaderboard__message">{message}</p>}

      {showScores && (
        <ol className="score-list">
          {scores.map((score, index) => (
            <li className="score-row" key={score.id}>
              <span className="score-row__rank">{index + 1}</span>
              <span className="score-row__name">{score.player_name}</span>
              <span className="score-row__difficulty">{score.grid_size}x{score.grid_size}</span>
              <span className="score-row__time">{formatTime(score.time_in_seconds)}</span>
              <span className="score-row__moves">{score.moves} moves</span>
            </li>
          ))}
        </ol>
      )}

      {showScores && !isLoading && scores.length === 0 && (
        <p className="leaderboard__empty">No scores yet</p>
      )}
    </section>
  );
}
