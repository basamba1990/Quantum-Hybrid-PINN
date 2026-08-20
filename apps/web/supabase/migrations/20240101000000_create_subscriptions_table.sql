create table subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_email text,
  lemon_subscription_id text,
  status text,
  plan text,
  created_at timestamp default now()
);
