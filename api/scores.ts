import { createClient } from '@supabase/supabase-js';

type ScorePayload = {
  player_name?: unknown;
  time_in_seconds?: unknown;
  moves?: unknown;
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function sendJson(response: any, status: number, body: unknown) {
  response.status(status).json(body);
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function cleanPlayerName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, 24) : '';
}

function parsePositiveInteger(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : Number.NaN;
}

export default async function handler(request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store');

  try {
    const supabase = getSupabase();

    if (request.method === 'GET') {
      const { data, error } = await supabase
        .from('scores')
        .select('id, player_name, time_in_seconds, moves, created_at')
        .order('time_in_seconds', { ascending: true })
        .order('moves', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        sendJson(response, 500, { error: 'Could not load leaderboard' });
        return;
      }

      sendJson(response, 200, { scores: data ?? [] });
      return;
    }

    if (request.method === 'POST') {
      const payload = request.body as ScorePayload;
      const playerName = cleanPlayerName(payload.player_name);
      const timeInSeconds = parsePositiveInteger(payload.time_in_seconds);
      const moves = parsePositiveInteger(payload.moves);

      if (!playerName) {
        sendJson(response, 400, { error: 'Player name is required' });
        return;
      }

      if (!Number.isFinite(timeInSeconds) || timeInSeconds < 10) {
        sendJson(response, 400, { error: 'Score time is not valid' });
        return;
      }

      if (!Number.isFinite(moves) || moves < 1) {
        sendJson(response, 400, { error: 'Move count is not valid' });
        return;
      }

      const { data, error } = await supabase
        .from('scores')
        .insert({
          player_name: playerName,
          time_in_seconds: timeInSeconds,
          moves,
        })
        .select('id, player_name, time_in_seconds, moves, created_at')
        .single();

      if (error) {
        sendJson(response, 500, { error: 'Could not save score' });
        return;
      }

      sendJson(response, 201, { score: data });
      return;
    }

    response.setHeader('Allow', 'GET, POST');
    sendJson(response, 405, { error: 'Method not allowed' });
  } catch {
    sendJson(response, 500, { error: 'Leaderboard service is not configured' });
  }
}
