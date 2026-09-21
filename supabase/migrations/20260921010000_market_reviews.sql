-- 앱마켓 리뷰·댓글 (앱 공통, app_code 기준 — 원맥스 'onemacs' 첫 적용) · 2026-09-21
-- 설계: 브릿지 2026_09_21__PC2안_마켓리뷰댓글_시안.md (PC3 검토 통과). 분류: A. 스키마 진화
-- 접근: Vercel 함수가 서비스 키로만 (RLS 켜고 정책 없음 → anon/authenticated 차단, hub_devices 와 같은 방식)
-- 이메일 원문은 저장하지 않는다(sha256 해시). 리뷰 수정은 pending_body/pending_stars 에 두었다가 확인 링크에서 교체(게시본 유지).

create extension if not exists pgcrypto;

create table if not exists public.market_reviews (
  id            uuid primary key default gen_random_uuid(),
  app_code      text not null,
  nick          text not null check (char_length(nick) between 2 and 20),
  email_hash    text not null,
  stars         smallint check (stars between 1 and 5),
  body          text not null check (char_length(body) between 10 and 1000),
  status        text not null default 'pending' check (status in ('pending','published','hidden','deleted')),
  pending_body  text check (pending_body is null or char_length(pending_body) between 10 and 1000),
  pending_stars smallint check (pending_stars is null or pending_stars between 1 and 5),
  pending_nick  text check (pending_nick is null or char_length(pending_nick) between 2 and 20),
  verified_buy  boolean not null default false,
  report_count  integer not null default 0,
  edit_count    integer not null default 0,
  ip_hash       text not null default '',
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  updated_at    timestamptz not null default now(),
  unique (app_code, email_hash)
);
create index if not exists market_reviews_app_idx on public.market_reviews (app_code, status, published_at desc);

create table if not exists public.market_comments (
  id            uuid primary key default gen_random_uuid(),
  review_id     uuid not null references public.market_reviews(id) on delete cascade,
  parent_id     uuid references public.market_comments(id) on delete cascade,
  nick          text not null check (char_length(nick) between 2 and 20),
  email_hash    text not null,
  is_seller     boolean not null default false,
  body          text not null check (char_length(body) between 2 and 500),
  status        text not null default 'pending' check (status in ('pending','published','hidden','deleted')),
  report_count  integer not null default 0,
  ip_hash       text not null default '',
  created_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists market_comments_review_idx on public.market_comments (review_id, status, created_at);

-- 이메일 확인 토큰 (리뷰 게시 · 리뷰 수정 · 리뷰 삭제 · 댓글 게시 · 내 리뷰 고치기 진입). 24시간, 1회용
create table if not exists public.market_verify_tokens (
  token         text primary key,
  kind          text not null check (kind in ('review','review_edit','review_delete','comment','review_manage')),
  target_id     uuid not null,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  used_at       timestamptz
);
create index if not exists market_verify_tokens_target_idx on public.market_verify_tokens (target_id);

create table if not exists public.market_reports (
  id            bigserial primary key,
  kind          text not null check (kind in ('review','comment')),
  target_id     uuid not null,
  reason        text not null check (reason in ('ad','abuse','privacy','offtopic','other')),
  ip_hash       text not null,
  created_at    timestamptz not null default now(),
  unique (kind, target_id, ip_hash)
);

-- 레이트리밋 정본 (같은 IP 1분 3건) — 인스턴스 메모리는 보조
create table if not exists public.market_rate_hits (
  id            bigserial primary key,
  ip_hash       text not null,
  action        text not null,
  created_at    timestamptz not null default now()
);
create index if not exists market_rate_hits_idx on public.market_rate_hits (ip_hash, action, created_at desc);

alter table public.market_reviews       enable row level security;
alter table public.market_comments      enable row level security;
alter table public.market_verify_tokens enable row level security;
alter table public.market_reports       enable row level security;
alter table public.market_rate_hits     enable row level security;

-- 앱별 요약 (홈 카드·평점 카드): published 만, stars null 은 평균에서 제외
create or replace view public.market_review_summary as
select app_code,
       count(*)::int                                   as review_count,
       round(avg(stars)::numeric, 1)                   as avg_stars,
       count(*) filter (where stars = 5)::int          as s5,
       count(*) filter (where stars = 4)::int          as s4,
       count(*) filter (where stars = 3)::int          as s3,
       count(*) filter (where stars = 2)::int          as s2,
       count(*) filter (where stars = 1)::int          as s1
from public.market_reviews where status = 'published' group by app_code;
