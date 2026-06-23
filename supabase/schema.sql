create table if not exists public.scores (
  id bigint generated always as identity primary key,
  player_name text not null check (char_length(player_name) between 1 and 24),
  grid_size integer not null default 4 check (grid_size in (3, 4, 5)),
  time_in_seconds integer not null check (time_in_seconds >= 10),
  moves integer not null check (moves > 0),
  created_at timestamptz not null default now()
);

create index if not exists scores_leaderboard_idx
  on public.scores (time_in_seconds asc, moves asc, created_at asc);

create index if not exists scores_leaderboard_by_grid_idx
  on public.scores (grid_size, time_in_seconds asc, moves asc, created_at asc);

alter table public.scores enable row level security;
