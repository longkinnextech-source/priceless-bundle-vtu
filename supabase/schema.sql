-- ============================================================
-- Priceless Bundle — Supabase / Postgres schema
-- LongKinnex Tech and Data
-- ============================================================
-- Run this in the Supabase SQL editor (or via scripts/apply-schema.mjs).
-- It is idempotent: safe to re-run.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- SETTINGS
-- ------------------------------------------------------------
create table if not exists app_settings (
  key         text primary key,
  value       text not null,
  description text,
  updated_at  timestamptz not null default now()
);

insert into app_settings (key, value, description) values
  ('commission_rate_percent',      '3',   'Commission % of order value paid to the attributed Super Agent'),
  ('reinvest_bonus_customer',      '2',   'Reinvest bonus % for customers'),
  ('reinvest_bonus_sub_agent',     '3.5', 'Reinvest bonus % for sub-agents'),
  ('reinvest_bonus_super_agent',   '5',   'Reinvest bonus % for super agents'),
  ('withdrawal_fee_percent',       '1.5', 'Instant withdrawal fee % (sub-agents)'),
  ('withdrawal_fee_min_ghs',       '0.50','Minimum instant withdrawal fee in GHS'),
  ('super_agent_commitment_ghs',   '500', 'Wallet deposit commitment to unlock Super Agent tier'),
  ('deposit_match_window_minutes', '30',  'Fallback amount+time matching window for deposits'),
  ('min_withdrawal_ghs',           '5',   'Minimum withdrawal amount'),
  ('min_deposit_ghs',              '1',   'Minimum top-up amount')
on conflict (key) do nothing;

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------
create table if not exists users (
  id                          uuid primary key default gen_random_uuid(),
  phone                       text not null unique,
  name                        text,
  tier                        text not null default 'customer'
                                check (tier in ('customer','sub_agent','super_agent')),
  squad_id                    uuid,
  telegram_bot_token          text,
  whatsapp_business_endpoint  text,
  is_active                   boolean not null default true,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists idx_users_squad on users(squad_id);
create index if not exists idx_users_tier  on users(tier);

-- ------------------------------------------------------------
-- SQUADS
-- ------------------------------------------------------------
create table if not exists squads (
  id                   uuid primary key default gen_random_uuid(),
  super_agent_id       uuid not null references users(id) on delete cascade,
  name                 text not null,
  volume_target_ghs    numeric(12,2) not null default 0 check (volume_target_ghs >= 0),
  current_period_start timestamptz not null default date_trunc('month', now()),
  current_volume_ghs   numeric(12,2) not null default 0 check (current_volume_ghs >= 0),
  tier_retained        boolean not null default false,
  created_at           timestamptz not null default now()
);
create index if not exists idx_squads_super on squads(super_agent_id);

alter table users
  drop constraint if exists users_squad_fk;
alter table users
  add constraint users_squad_fk foreign key (squad_id) references squads(id) on delete set null;

-- ------------------------------------------------------------
-- WALLETS
-- ------------------------------------------------------------
create table if not exists wallets (
  user_id                uuid primary key references users(id) on delete cascade,
  balance_ghs            numeric(12,2) not null default 0 check (balance_ghs >= 0),
  commission_balance_ghs numeric(12,2) not null default 0 check (commission_balance_ghs >= 0),
  updated_at             timestamptz not null default now()
);

-- ------------------------------------------------------------
-- WALLET LEDGER (immutable)
-- ------------------------------------------------------------
create table if not exists wallet_ledger (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  type          text not null check (type in (
                  'deposit','purchase','commission','reinvest_bonus',
                  'p2p_send','p2p_receive','withdrawal','withdrawal_fee',
                  'refund','adjustment')),
  bucket        text not null default 'main' check (bucket in ('main','commission')),
  amount_ghs    numeric(12,2) not null,
  balance_after numeric(12,2) not null,
  reference     text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists idx_ledger_user on wallet_ledger(user_id, created_at desc);
create index if not exists idx_ledger_ref  on wallet_ledger(reference);

create or replace function fn_ledger_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'wallet_ledger is append-only: % is not permitted', tg_op;
end $$;

drop trigger if exists trg_ledger_immutable on wallet_ledger;
create trigger trg_ledger_immutable
  before update or delete on wallet_ledger
  for each row execute function fn_ledger_immutable();

-- ------------------------------------------------------------
-- PLANS
-- ------------------------------------------------------------
create table if not exists plans (
  id                  uuid primary key default gen_random_uuid(),
  network             text not null check (network in ('mtn','telecel','airteltigo')),
  size_label          text not null,
  capacity_gb         numeric(6,2) not null check (capacity_gb > 0),
  cost_price_ghs      numeric(10,2) not null check (cost_price_ghs >= 0),
  retail_price_ghs    numeric(10,2) not null check (retail_price_ghs >= 0),
  sub_agent_price_ghs numeric(10,2) not null check (sub_agent_price_ghs >= 0),
  super_agent_price_ghs numeric(10,2) not null check (super_agent_price_ghs >= 0),
  active              boolean not null default true,
  sort_order          int not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (network, capacity_gb)
);
create index if not exists idx_plans_network on plans(network, active, sort_order);

-- ------------------------------------------------------------
-- ORDERS
-- ------------------------------------------------------------
create table if not exists orders (
  id                        uuid primary key default gen_random_uuid(),
  buyer_id                  uuid not null references users(id) on delete restrict,
  plan_id                   uuid not null references plans(id) on delete restrict,
  recipient_phone           text not null,
  price_charged_ghs         numeric(10,2) not null check (price_charged_ghs >= 0),
  buyer_tier_at_purchase    text not null check (buyer_tier_at_purchase in ('customer','sub_agent','super_agent')),
  status                    text not null default 'processing'
                              check (status in ('pending','processing','delivered','failed','refunded')),
  supplier_reference        text,
  failure_reason            text,
  attributed_super_agent_id uuid references users(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);
create index if not exists idx_orders_buyer  on orders(buyer_id, created_at desc);
create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_super  on orders(attributed_super_agent_id);

-- ------------------------------------------------------------
-- DEPOSITS + DEPOSIT INTENTS
-- ------------------------------------------------------------
create table if not exists deposit_intents (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references users(id) on delete cascade,
  reference_code      text not null unique,
  expected_amount_ghs numeric(10,2) not null check (expected_amount_ghs > 0),
  status              text not null default 'pending_match'
                        check (status in ('pending_match','matched','credited','expired','cancelled')),
  matched_deposit_id  uuid,
  expires_at          timestamptz not null default (now() + interval '2 hours'),
  created_at          timestamptz not null default now()
);
create index if not exists idx_intents_status on deposit_intents(status, created_at desc);
create index if not exists idx_intents_user   on deposit_intents(user_id, created_at desc);

create table if not exists deposits (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references users(id) on delete set null,
  amount_ghs       numeric(10,2) not null check (amount_ghs > 0),
  reference_code   text,
  sender_phone     text,
  raw_sms          text not null,
  status           text not null default 'pending_match'
                     check (status in ('pending_match','matched','credited','unmatched_review')),
  matched_intent_id uuid references deposit_intents(id) on delete set null,
  created_at       timestamptz not null default now()
);
create index if not exists idx_deposits_status on deposits(status, created_at desc);
create index if not exists idx_deposits_ref    on deposits(reference_code);

-- ------------------------------------------------------------
-- WITHDRAWALS
-- ------------------------------------------------------------
create table if not exists withdrawals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  amount_ghs  numeric(10,2) not null check (amount_ghs > 0),
  fee_ghs     numeric(10,2) not null default 0 check (fee_ghs >= 0),
  net_ghs     numeric(10,2) not null check (net_ghs >= 0),
  mode        text not null check (mode in ('instant','free_friday_batch')),
  status      text not null default 'pending'
                check (status in ('pending','processing','paid','rejected')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_withdrawals_user on withdrawals(user_id, created_at desc);

-- ------------------------------------------------------------
-- BOT ORDERS
-- ------------------------------------------------------------
create table if not exists bot_orders (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  super_agent_id      uuid not null references users(id) on delete cascade,
  channel             text not null check (channel in ('telegram','whatsapp')),
  end_customer_phone  text not null,
  created_at          timestamptz not null default now()
);
create index if not exists idx_bot_orders_super on bot_orders(super_agent_id, created_at desc);

-- ============================================================
-- FUNCTIONS
-- ============================================================

create or replace function fn_set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_users_updated on users;
create trigger trg_users_updated before update on users
  for each row execute function fn_set_updated_at();

drop trigger if exists trg_plans_updated on plans;
create trigger trg_plans_updated before update on plans
  for each row execute function fn_set_updated_at();

drop trigger if exists trg_orders_updated on orders;
create trigger trg_orders_updated before update on orders
  for each row execute function fn_set_updated_at();

drop trigger if exists trg_withdrawals_updated on withdrawals;
create trigger trg_withdrawals_updated before update on withdrawals
  for each row execute function fn_set_updated_at();

-- ---------- settings helper ----------
create or replace function fn_setting_num(p_key text, p_default numeric)
returns numeric language sql stable as $$
  select coalesce((select value::numeric from app_settings where key = p_key), p_default);
$$;

-- ---------- wallet bootstrap ----------
create or replace function fn_ensure_wallet(p_user_id uuid)
returns void language plpgsql as $$
begin
  insert into wallets (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
end $$;

-- ---------- credit ----------
create or replace function fn_wallet_credit(
  p_user_id   uuid,
  p_amount    numeric,
  p_type      text,
  p_reference text default null,
  p_metadata  jsonb default '{}'::jsonb,
  p_bucket    text default 'main'
) returns uuid
language plpgsql as $$
declare v_bal numeric(12,2); v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'AMOUNT_MUST_BE_POSITIVE' using errcode = '22023';
  end if;
  perform fn_ensure_wallet(p_user_id);

  if p_bucket = 'commission' then
    update wallets set commission_balance_ghs = commission_balance_ghs + p_amount,
                       updated_at = now()
      where user_id = p_user_id
      returning commission_balance_ghs into v_bal;
  else
    update wallets set balance_ghs = balance_ghs + p_amount,
                       updated_at = now()
      where user_id = p_user_id
      returning balance_ghs into v_bal;
  end if;

  insert into wallet_ledger (user_id, type, bucket, amount_ghs, balance_after, reference, metadata)
  values (p_user_id, p_type, p_bucket, p_amount, v_bal, p_reference, p_metadata)
  returning id into v_id;

  return v_id;
end $$;

-- ---------- debit ----------
create or replace function fn_wallet_debit(
  p_user_id   uuid,
  p_amount    numeric,
  p_type      text,
  p_reference text default null,
  p_metadata  jsonb default '{}'::jsonb,
  p_bucket    text default 'main'
) returns uuid
language plpgsql as $$
declare v_bal numeric(12,2); v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'AMOUNT_MUST_BE_POSITIVE' using errcode = '22023';
  end if;
  perform fn_ensure_wallet(p_user_id);

  if p_bucket = 'commission' then
    update wallets set commission_balance_ghs = commission_balance_ghs - p_amount,
                       updated_at = now()
      where user_id = p_user_id and commission_balance_ghs >= p_amount
      returning commission_balance_ghs into v_bal;
  else
    update wallets set balance_ghs = balance_ghs - p_amount,
                       updated_at = now()
      where user_id = p_user_id and balance_ghs >= p_amount
      returning balance_ghs into v_bal;
  end if;

  if v_bal is null then
    raise exception 'INSUFFICIENT_BALANCE' using errcode = 'P0001';
  end if;

  insert into wallet_ledger (user_id, type, bucket, amount_ghs, balance_after, reference, metadata)
  values (p_user_id, p_type, p_bucket, -p_amount, v_bal, p_reference, p_metadata)
  returning id into v_id;

  return v_id;
end $$;

-- ---------- register user ----------
create or replace function fn_register_user(
  p_phone text,
  p_name  text default null,
  p_tier  text default 'customer'
) returns users
language plpgsql as $$
declare v_user users;
begin
  if p_phone !~ '^0[0-9]{9}$' then
    raise exception 'INVALID_PHONE' using errcode = '22023';
  end if;
  if p_tier not in ('customer','sub_agent','super_agent') then
    raise exception 'INVALID_TIER' using errcode = '22023';
  end if;

  insert into users (phone, name, tier)
  values (p_phone, p_name, p_tier)
  on conflict (phone) do update set name = coalesce(excluded.name, users.name)
  returning * into v_user;

  perform fn_ensure_wallet(v_user.id);
  return v_user;
end $$;

-- ---------- price resolver ----------
create or replace function fn_price_for_tier(p_plan_id uuid, p_tier text)
returns numeric language sql stable as $$
  select case p_tier
           when 'super_agent' then super_agent_price_ghs
           when 'sub_agent'   then sub_agent_price_ghs
           else retail_price_ghs
         end
  from plans where id = p_plan_id and active = true;
$$;

-- ---------- create order + debit (atomic) ----------
create or replace function fn_create_order_and_debit(
  p_user_id         uuid,
  p_plan_id         uuid,
  p_recipient_phone text
) returns orders
language plpgsql as $$
declare
  v_user  users;
  v_plan  plans;
  v_price numeric(10,2);
  v_super uuid;
  v_order orders;
begin
  select * into v_user from users where id = p_user_id and is_active = true;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;

  select * into v_plan from plans where id = p_plan_id and active = true;
  if not found then raise exception 'PLAN_NOT_AVAILABLE' using errcode = 'P0002'; end if;

  if p_recipient_phone !~ '^0[0-9]{9}$' then
    raise exception 'INVALID_RECIPIENT_PHONE' using errcode = '22023';
  end if;

  v_price := case v_user.tier
               when 'super_agent' then v_plan.super_agent_price_ghs
               when 'sub_agent'   then v_plan.sub_agent_price_ghs
               else v_plan.retail_price_ghs
             end;

  if v_user.squad_id is not null then
    select super_agent_id into v_super from squads where id = v_user.squad_id;
  end if;

  -- debit first: raises INSUFFICIENT_BALANCE and aborts the whole transaction
  perform fn_wallet_debit(
    p_user_id, v_price, 'purchase',
    'order:' || gen_random_uuid()::text,
    jsonb_build_object('plan_id', p_plan_id, 'network', v_plan.network,
                       'capacity_gb', v_plan.capacity_gb, 'recipient', p_recipient_phone)
  );

  insert into orders (buyer_id, plan_id, recipient_phone, price_charged_ghs,
                      buyer_tier_at_purchase, status, attributed_super_agent_id)
  values (p_user_id, p_plan_id, p_recipient_phone, v_price,
          v_user.tier, 'processing', v_super)
  returning * into v_order;

  return v_order;
end $$;

-- ---------- finalize order (success -> delivered + commission; fail -> refund) ----------
create or replace function fn_finalize_order(
  p_order_id            uuid,
  p_success             boolean,
  p_supplier_reference  text default null,
  p_failure_reason      text default null
) returns orders
language plpgsql as $$
declare
  v_order orders;
  v_rate  numeric;
  v_comm  numeric(10,2);
begin
  select * into v_order from orders where id = p_order_id for update;
  if not found then raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002'; end if;

  -- idempotent: already final
  if v_order.status in ('delivered','failed','refunded') then
    return v_order;
  end if;

  if p_success then
    update orders
       set status = 'delivered',
           supplier_reference = coalesce(p_supplier_reference, supplier_reference),
           failure_reason = null
     where id = p_order_id
     returning * into v_order;

    -- commission to attributed super agent (not self)
    if v_order.attributed_super_agent_id is not null
       and v_order.attributed_super_agent_id <> v_order.buyer_id then
      v_rate := fn_setting_num('commission_rate_percent', 3);
      v_comm := round(v_order.price_charged_ghs * v_rate / 100.0, 2);
      if v_comm > 0 then
        perform fn_wallet_credit(
          v_order.attributed_super_agent_id, v_comm, 'commission',
          'order:' || v_order.id::text,
          jsonb_build_object('order_id', v_order.id, 'rate_percent', v_rate),
          'commission'
        );
      end if;
    end if;

    -- squad volume
    if v_order.attributed_super_agent_id is not null then
      perform fn_recompute_squad_volume_for_super(v_order.attributed_super_agent_id);
    end if;

  else
    -- refund the buyer in full
    perform fn_wallet_credit(
      v_order.buyer_id, v_order.price_charged_ghs, 'refund',
      'order:' || v_order.id::text,
      jsonb_build_object('order_id', v_order.id, 'reason', p_failure_reason)
    );
    update orders
       set status = 'refunded',
           failure_reason = coalesce(p_failure_reason, 'Supplier rejected the order'),
           supplier_reference = coalesce(p_supplier_reference, supplier_reference)
     where id = p_order_id
     returning * into v_order;
  end if;

  return v_order;
end $$;

-- ---------- squad volume ----------
create or replace function fn_recompute_squad_volume(p_squad_id uuid)
returns squads language plpgsql as $$
declare v_squad squads; v_vol numeric(12,2);
begin
  select * into v_squad from squads where id = p_squad_id for update;
  if not found then raise exception 'SQUAD_NOT_FOUND' using errcode = 'P0002'; end if;

  select coalesce(sum(o.price_charged_ghs), 0) into v_vol
    from orders o
    join users u on u.id = o.buyer_id
   where u.squad_id = p_squad_id
     and o.status = 'delivered'
     and o.created_at >= v_squad.current_period_start;

  update squads
     set current_volume_ghs = v_vol,
         tier_retained = (v_vol >= volume_target_ghs)
   where id = p_squad_id
   returning * into v_squad;

  return v_squad;
end $$;

create or replace function fn_recompute_squad_volume_for_super(p_super_id uuid)
returns void language plpgsql as $$
declare v_id uuid;
begin
  for v_id in select id from squads where super_agent_id = p_super_id loop
    perform fn_recompute_squad_volume(v_id);
  end loop;
end $$;

-- ---------- deposit credit (atomic) ----------
create or replace function fn_credit_deposit(
  p_deposit_id uuid,
  p_user_id    uuid
) returns deposits
language plpgsql as $$
declare v_dep deposits; v_intent deposit_intents;
begin
  select * into v_dep from deposits where id = p_deposit_id for update;
  if not found then raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_dep.status = 'credited' then return v_dep; end if;

  perform fn_wallet_credit(
    p_user_id, v_dep.amount_ghs, 'deposit',
    coalesce(v_dep.reference_code, 'deposit:' || v_dep.id::text),
    jsonb_build_object('deposit_id', v_dep.id, 'sender_phone', v_dep.sender_phone)
  );

  update deposits
     set status = 'credited', user_id = p_user_id
   where id = p_deposit_id
   returning * into v_dep;

  if v_dep.matched_intent_id is not null then
    update deposit_intents
       set status = 'credited', matched_deposit_id = p_deposit_id
     where id = v_dep.matched_intent_id
     returning * into v_intent;
  end if;

  return v_dep;
end $$;

-- ---------- p2p ----------
create or replace function fn_p2p_transfer(
  p_from uuid, p_to uuid, p_amount numeric
) returns void language plpgsql as $$
declare v_ref text;
begin
  if p_from = p_to then raise exception 'CANNOT_SEND_TO_SELF' using errcode = '22023'; end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'AMOUNT_MUST_BE_POSITIVE' using errcode = '22023';
  end if;
  if not exists (select 1 from users where id = p_to and is_active = true) then
    raise exception 'RECIPIENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_ref := 'p2p:' || gen_random_uuid()::text;

  perform fn_wallet_debit(p_from, p_amount, 'p2p_send', v_ref,
                          jsonb_build_object('to', p_to));
  perform fn_wallet_credit(p_to, p_amount, 'p2p_receive', v_ref,
                           jsonb_build_object('from', p_from));
end $$;

-- ---------- reinvest commission ----------
create or replace function fn_reinvest_commission(
  p_user_id uuid, p_amount numeric
) returns numeric language plpgsql as $$
declare v_tier text; v_pct numeric; v_bonus numeric(10,2); v_ref text;
begin
  select tier into v_tier from users where id = p_user_id;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;

  v_pct := case v_tier
             when 'super_agent' then fn_setting_num('reinvest_bonus_super_agent', 5)
             when 'sub_agent'   then fn_setting_num('reinvest_bonus_sub_agent', 3.5)
             else fn_setting_num('reinvest_bonus_customer', 2)
           end;

  v_ref := 'reinvest:' || gen_random_uuid()::text;

  -- move out of commission bucket
  perform fn_wallet_debit(p_user_id, p_amount, 'commission', v_ref,
                          jsonb_build_object('action','reinvest_out'), 'commission');

  v_bonus := round(p_amount * v_pct / 100.0, 2);

  -- into main bucket, plus bonus
  perform fn_wallet_credit(p_user_id, p_amount, 'adjustment', v_ref,
                           jsonb_build_object('action','reinvest_in'), 'main');
  if v_bonus > 0 then
    perform fn_wallet_credit(p_user_id, v_bonus, 'reinvest_bonus', v_ref,
                             jsonb_build_object('percent', v_pct), 'main');
  end if;

  return v_bonus;
end $$;

-- ---------- withdrawal ----------
create or replace function fn_request_withdrawal(
  p_user_id uuid, p_amount numeric, p_mode text
) returns withdrawals
language plpgsql as $$
declare
  v_user users; v_fee numeric(10,2) := 0; v_net numeric(10,2);
  v_min numeric; v_pct numeric; v_min_fee numeric; v_ref text; v_w withdrawals;
begin
  select * into v_user from users where id = p_user_id and is_active = true;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if p_mode not in ('instant','free_friday_batch') then
    raise exception 'INVALID_MODE' using errcode = '22023';
  end if;

  v_min := fn_setting_num('min_withdrawal_ghs', 5);
  if p_amount is null or p_amount < v_min then
    raise exception 'BELOW_MIN_WITHDRAWAL' using errcode = '22023';
  end if;

  if p_mode = 'instant' and v_user.tier <> 'super_agent' then
    v_pct := fn_setting_num('withdrawal_fee_percent', 1.5);
    v_min_fee := fn_setting_num('withdrawal_fee_min_ghs', 0.5);
    v_fee := greatest(round(p_amount * v_pct / 100.0, 2), v_min_fee);
  end if;

  v_net := p_amount - v_fee;
  if v_net <= 0 then raise exception 'FEE_EXCEEDS_AMOUNT' using errcode = '22023'; end if;

  v_ref := 'wd:' || gen_random_uuid()::text;

  -- debit net + fee separately so the ledger shows both
  perform fn_wallet_debit(p_user_id, v_net, 'withdrawal', v_ref,
                          jsonb_build_object('mode', p_mode));
  if v_fee > 0 then
    perform fn_wallet_debit(p_user_id, v_fee, 'withdrawal_fee', v_ref,
                            jsonb_build_object('mode', p_mode));
  end if;

  insert into withdrawals (user_id, amount_ghs, fee_ghs, net_ghs, mode, status)
  values (p_user_id, p_amount, v_fee, v_net, p_mode, 'pending')
  returning * into v_w;

  return v_w;
end $$;

-- ---------- super agent upgrade ----------
create or replace function fn_upgrade_to_super_agent(p_user_id uuid)
returns users language plpgsql as $$
declare v_user users; v_commit numeric; v_bal numeric;
begin
  select * into v_user from users where id = p_user_id for update;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_user.tier = 'super_agent' then return v_user; end if;

  v_commit := fn_setting_num('super_agent_commitment_ghs', 500);
  select balance_ghs into v_bal from wallets where user_id = p_user_id;

  if coalesce(v_bal, 0) < v_commit then
    raise exception 'COMMITMENT_NOT_MET' using errcode = 'P0001';
  end if;

  update users set tier = 'super_agent' where id = p_user_id returning * into v_user;
  return v_user;
end $$;

-- ============================================================
-- SEED PLANS
-- ============================================================
insert into plans (network, size_label, capacity_gb, cost_price_ghs, retail_price_ghs,
                   sub_agent_price_ghs, super_agent_price_ghs, sort_order)
values
  ('mtn','1GB',1,3.60,4.20,3.90,3.75,1),
  ('mtn','2GB',2,7.00,8.00,7.50,7.20,2),
  ('mtn','3GB',3,10.20,11.50,10.80,10.40,3),
  ('mtn','5GB',5,16.50,18.50,17.40,16.80,4),
  ('mtn','10GB',10,32.00,36.00,34.00,32.80,5),
  ('mtn','15GB',15,47.00,53.00,50.00,48.20,6),
  ('mtn','20GB',20,62.00,70.00,66.00,63.50,7),
  ('mtn','25GB',25,77.00,87.00,82.00,79.00,8),
  ('mtn','30GB',30,92.00,104.00,98.00,94.50,9),
  ('mtn','50GB',50,150.00,170.00,160.00,154.00,10),
  ('mtn','100GB',100,290.00,330.00,310.00,298.00,11),

  ('telecel','1GB',1,3.50,4.10,3.80,3.65,1),
  ('telecel','2GB',2,6.80,7.80,7.30,7.00,2),
  ('telecel','3GB',3,9.90,11.20,10.50,10.10,3),
  ('telecel','5GB',5,16.00,18.00,16.90,16.30,4),
  ('telecel','10GB',10,31.00,35.00,33.00,31.80,5),
  ('telecel','15GB',15,45.50,51.50,48.50,46.80,6),
  ('telecel','20GB',20,60.00,68.00,64.00,61.50,7),
  ('telecel','25GB',25,74.50,84.00,79.00,76.50,8),
  ('telecel','30GB',30,89.00,100.00,94.50,91.00,9),
  ('telecel','50GB',50,145.00,164.00,154.00,148.00,10),
  ('telecel','100GB',100,280.00,318.00,299.00,287.00,11),

  ('airteltigo','1GB',1,3.45,4.15,3.75,3.60,1),
  ('airteltigo','2GB',2,6.70,7.70,7.20,6.90,2),
  ('airteltigo','3GB',3,9.70,11.00,10.30,9.90,3),
  ('airteltigo','5GB',5,15.70,17.70,16.60,16.00,4),
  ('airteltigo','10GB',10,30.50,34.50,32.50,31.30,5),
  ('airteltigo','15GB',15,44.50,50.50,47.50,45.80,6),
  ('airteltigo','20GB',20,58.50,66.50,62.50,60.00,7),
  ('airteltigo','25GB',25,73.00,82.50,77.50,75.00,8),
  ('airteltigo','30GB',30,87.00,98.00,92.50,89.00,9),
  ('airteltigo','50GB',50,142.00,160.00,150.00,144.50,10),
  ('airteltigo','100GB',100,275.00,312.00,293.00,281.00,11)
on conflict (network, capacity_gb) do nothing;

-- ============================================================
-- AUTH — phone + PIN (bcrypt via pgcrypto)
-- ============================================================
alter table users add column if not exists pin_hash text;
alter table users add column if not exists is_admin boolean not null default false;

-- Login by phone + PIN. Returns the user row on success, raises otherwise.
create or replace function fn_login(p_phone text, p_pin text)
returns table (id uuid, phone text, name text, tier text, is_admin boolean)
language plpgsql as $$
declare v_user users;
begin
  if p_phone is null or p_pin is null or length(p_pin) < 4 then
    raise exception 'INVALID_CREDENTIALS' using errcode = 'P0001';
  end if;
  select u.* into v_user from users u where u.phone = p_phone and u.is_active = true;
  if not found then
    raise exception 'INVALID_CREDENTIALS' using errcode = 'P0001';
  end if;
  if v_user.pin_hash is null or v_user.pin_hash <> crypt(p_pin, v_user.pin_hash) then
    raise exception 'INVALID_CREDENTIALS' using errcode = 'P0001';
  end if;
  return query select v_user.id, v_user.phone, v_user.name, v_user.tier, v_user.is_admin;
end $$;

-- Register (or claim) a phone with a PIN. Refuses to overwrite an existing account.
create or replace function fn_register_user_with_pin(
  p_phone text,
  p_name  text default null,
  p_pin   text default null,
  p_tier  text default 'customer'
) returns users
language plpgsql as $$
declare v_user users;
begin
  if p_pin is null or length(p_pin) < 4 then
    raise exception 'PIN_TOO_SHORT' using errcode = '22023';
  end if;
  if p_tier not in ('customer','sub_agent') then
    -- super_agent is earned via fn_upgrade_to_super_agent, never self-declared
    raise exception 'INVALID_TIER' using errcode = '22023';
  end if;
  if exists (select 1 from users where phone = p_phone and pin_hash is not null) then
    raise exception 'PHONE_ALREADY_REGISTERED' using errcode = 'P0001';
  end if;

  v_user := fn_register_user(p_phone, p_name, p_tier);
  update users set pin_hash = crypt(p_pin, gen_salt('bf')) where id = v_user.id
  returning * into v_user;
  return v_user;
end $$;

create or replace function fn_set_pin(p_user_id uuid, p_pin text)
returns void language plpgsql as $$
begin
  if p_pin is null or length(p_pin) < 4 then
    raise exception 'PIN_TOO_SHORT' using errcode = '22023';
  end if;
  update users set pin_hash = crypt(p_pin, gen_salt('bf')) where id = p_user_id;
end $$;

-- Make a user an admin (run from SQL editor).
create or replace function fn_make_admin(p_phone text)
returns void language sql as $$
  update users set is_admin = true where phone = p_phone;
$$;

-- ============================================================
-- DEPOSIT MATCHING ENGINE (atomic)
-- ============================================================
create or replace function fn_process_deposit(p_deposit_id uuid)
returns deposits
language plpgsql as $$
declare
  v_dep      deposits;
  v_intent   deposit_intents;
  v_window   numeric;
  v_count    int;
  v_match_id uuid;
begin
  select * into v_dep from deposits where id = p_deposit_id for update;
  if not found then raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_dep.status = 'credited' then return v_dep; end if;

  v_window := fn_setting_num('deposit_match_window_minutes', 30);

  -- 1) best match: reference code (with a 1h grace past expiry)
  if v_dep.reference_code is not null then
    select * into v_intent from deposit_intents
     where reference_code = v_dep.reference_code
       and status = 'pending_match'
       and expires_at > now() - interval '1 hour'
     order by created_at desc limit 1;
    if found then
      update deposits
         set matched_intent_id = v_intent.id, status = 'matched', user_id = v_intent.user_id
       where id = p_deposit_id;
      return fn_credit_deposit(p_deposit_id, v_intent.user_id);
    end if;
  end if;

  -- 2) fallback: exact amount + time window (+ sender phone if it maps to a user)
  select count(*) into v_count
    from deposit_intents i
   where i.status = 'pending_match'
     and i.expected_amount_ghs = v_dep.amount_ghs
     and i.created_at >= now() - make_interval(mins => v_window::int)
     and (v_dep.sender_phone is null
          or exists (select 1 from users u where u.id = i.user_id and u.phone = v_dep.sender_phone));

  if v_count = 1 then
    select i.id into v_match_id
      from deposit_intents i
     where i.status = 'pending_match'
       and i.expected_amount_ghs = v_dep.amount_ghs
       and i.created_at >= now() - make_interval(mins => v_window::int)
       and (v_dep.sender_phone is null
            or exists (select 1 from users u where u.id = i.user_id and u.phone = v_dep.sender_phone))
     limit 1;
    select * into v_intent from deposit_intents where id = v_match_id;
    update deposits
       set matched_intent_id = v_intent.id, status = 'matched', user_id = v_intent.user_id
     where id = p_deposit_id;
    return fn_credit_deposit(p_deposit_id, v_intent.user_id);
  end if;

  -- 3) ambiguous or nothing -> human review, never guess
  update deposits set status = 'unmatched_review' where id = p_deposit_id
  returning * into v_dep;
  return v_dep;
end $$;

-- Admin manual resolution of an unmatched deposit
create or replace function fn_admin_resolve_deposit(p_deposit_id uuid, p_user_id uuid)
returns deposits language plpgsql as $$
declare v_dep deposits;
begin
  select * into v_dep from deposits where id = p_deposit_id for update;
  if not found then raise exception 'DEPOSIT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_dep.status = 'credited' then return v_dep; end if;
  return fn_credit_deposit(p_deposit_id, p_user_id);
end $$;

-- ============================================================
-- ADMIN STATS
-- ============================================================
create or replace function fn_admin_stats()
returns json language sql stable as $$
  select json_build_object(
    'total_users',           (select count(*) from users),
    'customers',             (select count(*) from users where tier = 'customer'),
    'sub_agents',            (select count(*) from users where tier = 'sub_agent'),
    'super_agents',          (select count(*) from users where tier = 'super_agent'),
    'orders_total',          (select count(*) from orders),
    'orders_delivered',      (select count(*) from orders where status = 'delivered'),
    'orders_failed',         (select count(*) from orders where status in ('failed','refunded')),
    'gross_revenue_ghs',     (select coalesce(sum(price_charged_ghs),0) from orders where status = 'delivered'),
    'deposits_credited_ghs', (select coalesce(sum(amount_ghs),0) from deposits where status = 'credited'),
    'unmatched_deposits',    (select count(*) from deposits where status = 'unmatched_review'),
    'wallets_float_ghs',     (select coalesce(sum(balance_ghs + commission_balance_ghs),0) from wallets)
  );
$$;

-- ============================================================
-- SQUAD MANAGEMENT
-- ============================================================
create or replace function fn_create_squad(p_super_id uuid, p_name text, p_target numeric default 0)
returns squads language plpgsql as $$
declare v_user users; v_squad squads;
begin
  select * into v_user from users where id = p_super_id;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_user.tier <> 'super_agent' then
    raise exception 'INVALID_TIER' using errcode = '22023';
  end if;

  select * into v_squad from squads where super_agent_id = p_super_id limit 1;
  if found then
    update squads set name = coalesce(nullif(p_name,''), name),
                      volume_target_ghs = greatest(coalesce(p_target,0), 0)
     where id = v_squad.id
     returning * into v_squad;
    return v_squad;
  end if;

  insert into squads (super_agent_id, name, volume_target_ghs)
  values (p_super_id, coalesce(nullif(p_name,''), 'My Squad'), greatest(coalesce(p_target,0),0))
  returning * into v_squad;

  return v_squad;
end $$;

-- A sub-agent (or customer) joins a Super Agent's squad.
create or replace function fn_join_squad(p_user_id uuid, p_super_id uuid)
returns users language plpgsql as $$
declare v_squad squads; v_user users; v_super users;
begin
  if p_user_id = p_super_id then
    raise exception 'CANNOT_SEND_TO_SELF' using errcode = '22023';
  end if;
  select * into v_super from users where id = p_super_id and is_active = true;
  if not found then raise exception 'USER_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_super.tier <> 'super_agent' then
    raise exception 'INVALID_TIER' using errcode = '22023';
  end if;

  select * into v_squad from squads where super_agent_id = p_super_id limit 1;
  if not found then
    v_squad := fn_create_squad(p_super_id, coalesce(v_super.name, 'Squad') || '''s Squad', 0);
  end if;

  update users
     set squad_id = v_squad.id,
         tier = case when tier = 'customer' then 'sub_agent' else tier end
   where id = p_user_id
   returning * into v_user;

  return v_user;
end $$;

-- Super agent's squad overview (members + combined delivered volume this period).
create or replace function fn_squad_overview(p_super_id uuid)
returns json language plpgsql stable as $$
declare v_squad squads; v_members json;
begin
  select * into v_squad from squads where super_agent_id = p_super_id limit 1;
  if not found then return json_build_object('squad', null, 'members', '[]'::json); end if;

  select coalesce(json_agg(json_build_object(
           'id', u.id, 'name', u.name, 'phone', u.phone, 'tier', u.tier
         ) order by u.created_at), '[]'::json)
    into v_members
    from users u
   where u.squad_id = v_squad.id;

  return json_build_object('squad', row_to_json(v_squad), 'members', v_members);
end $$;
