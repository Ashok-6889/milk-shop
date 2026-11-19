-- Smart Milk Shop: Phase 1 (schema, RLS, inventory ledger, reconciliation, day closing)
create extension if not exists pgcrypto;

create type user_role as enum ('admin','staff','delivery','customer');
create type inv_category as enum ('opening','purchase','return','online_delivery','offline_sale','wastage','leakage','adjustment');
create type delivery_status as enum ('pending','out_for_delivery','delivered','partially_delivered','failed','cancelled');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  role user_role not null default 'customer',
  full_name text, mobile text unique, email text, gender text,
  house_no text, street text, area text, city text, state text, pincode text,
  gps_lat numeric, gps_lng numeric, delivery_instructions text,
  created_at timestamptz default now()
);

create or replace function is_role(r user_role[]) returns boolean
language sql stable security definer set search_path=public as
$$ select exists(select 1 from profiles where id=auth.uid() and role = any(r)) $$;

create table milk_types (id serial primary key, name text unique not null, active boolean default true);

create table milk_prices (  -- history preserved; never update, only insert
  id serial primary key, milk_type_id int references milk_types not null,
  channel text not null check (channel in ('online','offline')),
  sell_price numeric(10,2) not null check (sell_price>=0),
  purchase_price numeric(10,2) check (purchase_price>=0),
  effective_from date not null default current_date,
  created_by uuid references profiles
);

create table suppliers (id serial primary key, name text not null, phone text);

-- Central inventory ledger (qty always positive; category decides direction)
create table inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text unique not null,
  txn_date date not null default current_date,
  txn_time timestamptz not null default now(),
  milk_type_id int references milk_types not null,
  category inv_category not null,
  qty numeric(10,3) not null check (qty>0),
  supplier_id int references suppliers, unit_cost numeric(10,2),
  ref_table text, ref_id uuid, notes text,
  recorded_by uuid references profiles default auth.uid()
);
create index on inventory_transactions(txn_date, milk_type_id);

create table daily_opening_stock (
  business_date date, milk_type_id int references milk_types, qty numeric(10,3) not null check (qty>=0),
  entered_by uuid references profiles default auth.uid(), entered_at timestamptz default now(),
  primary key (business_date, milk_type_id)
);

create table daily_closing_stock (
  business_date date primary key,
  closing_snapshot jsonb not null,           -- per milk type: expected/actual/diff
  total_sales numeric(12,2), total_received numeric(12,2), total_pending numeric(12,2), total_expenses numeric(12,2),
  status text not null check (status in ('balanced','mismatch_review')),
  closed_by uuid references profiles default auth.uid(), closed_at timestamptz default now()
);

create table offline_customers (id uuid primary key default gen_random_uuid(), name text not null, mobile text, linked_profile uuid references profiles);

create table subscription_plans (
  id uuid primary key default gen_random_uuid(), customer_id uuid references profiles not null,
  milk_type_id int references milk_types not null, daily_qty numeric(6,2) not null check (daily_qty>0),
  start_date date not null, duration_days int not null, delivery_days int[] default '{0,1,2,3,4,5,6}',
  delivery_time text, instructions text, status text not null default 'active' check (status in ('active','paused','cancelled','completed'))
);

create table delivery_records (
  id uuid primary key default gen_random_uuid(), subscription_id uuid references subscription_plans,
  customer_id uuid references profiles not null, milk_type_id int references milk_types not null,
  delivery_date date not null, scheduled_qty numeric(6,2) not null, actual_qty numeric(6,2) check (actual_qty>=0),
  unit_price numeric(10,2), status delivery_status not null default 'pending',
  delivery_staff uuid references profiles, notes text,
  unique (subscription_id, delivery_date)
);

create table offline_sales (
  id uuid primary key default gen_random_uuid(), idempotency_key text unique not null,
  sale_time timestamptz default now(), business_date date default current_date,
  customer_id uuid references offline_customers, milk_type_id int references milk_types not null,
  qty numeric(10,3) not null check (qty>0), unit_price numeric(10,2) not null, total numeric(12,2) not null,
  recorded_by uuid references profiles default auth.uid()
);

create table payments (  -- separate from sales
  id uuid primary key default gen_random_uuid(), idempotency_key text unique not null,
  paid_at timestamptz default now(), business_date date default current_date,
  online_customer uuid references profiles, offline_customer uuid references offline_customers,
  offline_sale_id uuid references offline_sales,
  amount numeric(12,2) not null check (amount>0), method text not null check (method in ('cash','upi','other')),
  note text, recorded_by uuid references profiles default auth.uid()
);

create table expenses (
  id uuid primary key default gen_random_uuid(), expense_date date not null default current_date,
  category text not null, description text, amount numeric(12,2) not null check (amount>0),
  method text, recorded_by uuid references profiles default auth.uid()
);

create table audit_logs (
  id bigserial primary key, at timestamptz default now(), user_id uuid, table_name text, row_id text,
  action text, old_data jsonb, new_data jsonb
);

create table notifications (
  id uuid primary key default gen_random_uuid(), user_id uuid references profiles, audience_role user_role,
  title text, body text, read boolean default false, created_at timestamptz default now()
);

-- Audit trigger
create or replace function audit_row() returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into audit_logs(user_id,table_name,row_id,action,old_data,new_data)
  values (auth.uid(), tg_table_name, coalesce((to_jsonb(new)->>'id'),(to_jsonb(old)->>'id')), tg_op,
          case when tg_op<>'INSERT' then to_jsonb(old) end, case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new,old);
end $$;
do $$ declare t text; begin
  foreach t in array array['milk_prices','inventory_transactions','daily_opening_stock','offline_sales','payments','expenses','delivery_records','subscription_plans','daily_closing_stock','profiles'] loop
    execute format('create trigger audit_%1$s after insert or update or delete on %1$s for each row execute function audit_row()', t);
  end loop; end $$;

-- Closed-day protection
create or replace function block_closed_day() returns trigger language plpgsql as $$
declare d date := coalesce(new.txn_date, new.business_date, new.expense_date);
begin
  if d is not null and exists(select 1 from daily_closing_stock where business_date=d) and not is_role(array['admin']::user_role[]) then
    raise exception 'Day % is closed; admin authorization required', d; end if;
  return new;
end $$;
create trigger lock_inv before insert or update on inventory_transactions for each row execute function block_closed_day();
create trigger lock_sales before insert or update on offline_sales for each row execute function block_closed_day();
create trigger lock_pay before insert or update on payments for each row execute function block_closed_day();
create trigger lock_exp before insert or update on expenses for each row execute function block_closed_day();

-- Current stock per milk type for a date (opening + movements)
create or replace function stock_position(d date) returns table(milk_type_id int, opening numeric, purchased numeric, returns numeric,
  online numeric, offline numeric, wastage numeric, expected_closing numeric)
language sql stable security definer set search_path=public as $$
  select m.id,
    coalesce(o.qty,0),
    coalesce(sum(t.qty) filter (where t.category='purchase'),0),
    coalesce(sum(t.qty) filter (where t.category='return'),0),
    coalesce(sum(t.qty) filter (where t.category='online_delivery'),0),
    coalesce(sum(t.qty) filter (where t.category='offline_sale'),0),
    coalesce(sum(t.qty) filter (where t.category in ('wastage','leakage')),0),
    coalesce(o.qty,0)
      + coalesce(sum(t.qty) filter (where t.category in ('purchase','return')),0)
      + coalesce(sum(case when t.category='adjustment' then t.qty end),0)
      - coalesce(sum(t.qty) filter (where t.category in ('online_delivery','offline_sale','wastage','leakage')),0)
  from milk_types m
  left join daily_opening_stock o on o.milk_type_id=m.id and o.business_date=d
  left join inventory_transactions t on t.milk_type_id=m.id and t.txn_date=d
  where is_role(array['admin']::user_role[])
  group by m.id, o.qty
$$;

-- Opening stock suggestion = previous confirmed closing
create or replace function suggest_opening(d date) returns table(milk_type_id int, suggested numeric)
language sql stable security definer set search_path=public as $$
  select (e->>'milk_type_id')::int, (e->>'actual')::numeric
  from daily_closing_stock c, jsonb_array_elements(c.closing_snapshot) e
  where is_role(array['admin']::user_role[]) and c.business_date = (select max(business_date) from daily_closing_stock where business_date<d)
$$;

-- POS sale: stock check + ledger deduction + optional payment, atomic and idempotent
create or replace function record_offline_sale(p_key text, p_milk int, p_qty numeric, p_customer uuid, p_received numeric, p_method text)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_price numeric; v_id uuid; v_avail numeric;
begin
  if not is_role(array['admin','staff']::user_role[]) then raise exception 'not allowed'; end if;
  select id into v_id from offline_sales where idempotency_key=p_key;
  if found then return v_id; end if;                       -- duplicate protection
  select sell_price into v_price from milk_prices where milk_type_id=p_milk and channel='offline' and effective_from<=current_date
    order by effective_from desc, id desc limit 1;
  if v_price is null then raise exception 'No offline price set'; end if;
  select expected_closing into v_avail from stock_position(current_date) where milk_type_id=p_milk;
  if coalesce(v_avail,0) < p_qty and not is_role(array['admin']::user_role[]) then raise exception 'Insufficient stock (% L)', coalesce(v_avail,0); end if;
  insert into offline_sales(idempotency_key,customer_id,milk_type_id,qty,unit_price,total)
    values (p_key,p_customer,p_milk,p_qty,v_price,round(p_qty*v_price,2)) returning id into v_id;
  insert into inventory_transactions(idempotency_key,milk_type_id,category,qty,ref_table,ref_id)
    values ('sale:'||v_id,p_milk,'offline_sale',p_qty,'offline_sales',v_id);
  if coalesce(p_received,0)>0 then
    insert into payments(idempotency_key,offline_customer,offline_sale_id,amount,method)
    values ('pay:'||v_id,p_customer,v_id,p_received,p_method); end if;
  return v_id;
end $$;

-- Delivery deduction uses ACTUAL qty, once per delivery
create or replace function deduct_delivery() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.status in ('delivered','partially_delivered') and coalesce(new.actual_qty,0)>0 then
    insert into inventory_transactions(idempotency_key,milk_type_id,category,qty,ref_table,ref_id,notes)
    values ('delivery:'||new.id,new.milk_type_id,'online_delivery',new.actual_qty,'delivery_records',new.id,new.notes)
    on conflict (idempotency_key) do nothing;
  end if; return new;
end $$;
create trigger trg_deduct after insert or update on delivery_records for each row execute function deduct_delivery();

-- Money reconciliation for a date (sales vs cash received kept separate)
create or replace function money_position(d date) returns jsonb
language sql stable security definer set search_path=public as $$
  select case when not is_role(array['admin']::user_role[]) then null else jsonb_build_object(
    'online_sales',(select coalesce(sum(actual_qty*unit_price),0) from delivery_records where delivery_date=d and status in ('delivered','partially_delivered')),
    'offline_sales',(select coalesce(sum(total),0) from offline_sales where business_date=d),
    'received',(select coalesce(sum(amount),0) from payments where business_date=d),
    'expenses',(select coalesce(sum(amount),0) from expenses where expense_date=d)) end
$$;

-- Day closing: admin-only, once per day, snapshot + mismatch status
create or replace function close_day(d date, actual jsonb)  -- actual: [{"milk_type_id":1,"qty":17}]
returns jsonb language plpgsql security definer set search_path=public as $$
declare snap jsonb; mp jsonb; mismatch boolean; st text;
begin
  if not is_role(array['admin']::user_role[]) then raise exception 'admin only'; end if;
  if exists(select 1 from daily_closing_stock where business_date=d) then raise exception 'Day % already closed', d; end if;
  select jsonb_agg(jsonb_build_object('milk_type_id',s.milk_type_id,'opening',s.opening,'purchased',s.purchased,'online',s.online,
      'offline',s.offline,'wastage',s.wastage,'expected',s.expected_closing,
      'actual',coalesce((a->>'qty')::numeric,0),'diff',coalesce((a->>'qty')::numeric,0)-s.expected_closing))
    into snap from stock_position(d) s left join jsonb_array_elements(actual) a on (a->>'milk_type_id')::int=s.milk_type_id;
  mismatch := exists(select 1 from jsonb_array_elements(snap) e where (e->>'diff')::numeric<>0);
  st := case when mismatch then 'mismatch_review' else 'balanced' end;
  mp := money_position(d);
  insert into daily_closing_stock(business_date,closing_snapshot,total_sales,total_received,total_pending,total_expenses,status)
  values (d,snap,(mp->>'online_sales')::numeric+(mp->>'offline_sales')::numeric,(mp->>'received')::numeric,
          (mp->>'online_sales')::numeric+(mp->>'offline_sales')::numeric-(mp->>'received')::numeric,(mp->>'expenses')::numeric,st);
  return jsonb_build_object('status',st,'stock',snap,'money',mp);
end $$;

-- Row Level Security
do $$ declare t text; begin
  foreach t in array array['profiles','milk_types','milk_prices','suppliers','inventory_transactions','daily_opening_stock','daily_closing_stock',
   'offline_customers','subscription_plans','delivery_records','offline_sales','payments','expenses','audit_logs','notifications'] loop
    execute format('alter table %I enable row level security', t); end loop; end $$;

create policy prof_self on profiles for select using (id=auth.uid() or is_role('{admin}'));
create policy prof_upd on profiles for update using (id=auth.uid() or is_role('{admin}')) with check (is_role('{admin}') or role='customer');
create policy mt_read on milk_types for select using (auth.uid() is not null);
create policy mt_admin on milk_types for all using (is_role('{admin}'));
create policy mp_read on milk_prices for select using (auth.uid() is not null);
create policy mp_ins on milk_prices for insert with check (is_role('{admin}'));   -- no update/delete: history preserved
create policy admin_sup on suppliers for all using (is_role('{admin}'));
create policy admin_inv on inventory_transactions for all using (is_role('{admin}'));
create policy admin_open on daily_opening_stock for all using (is_role('{admin}'));
create policy admin_close on daily_closing_stock for all using (is_role('{admin}'));
create policy admin_exp on expenses for all using (is_role('{admin}'));
create policy admin_audit on audit_logs for select using (is_role('{admin}'));
create policy pos_cust on offline_customers for all using (is_role('{admin,staff}'));
create policy pos_sales on offline_sales for select using (is_role('{admin,staff}'));  -- writes via record_offline_sale()
create policy pay_staff on payments for select using (is_role('{admin,staff}') or online_customer=auth.uid());
create policy pay_ins on payments for insert with check (is_role('{admin,staff}'));
create policy sub_own on subscription_plans for all using (customer_id=auth.uid() or is_role('{admin}')) with check (customer_id=auth.uid() or is_role('{admin}'));
create policy del_read on delivery_records for select using (customer_id=auth.uid() or is_role('{admin}') or (is_role('{delivery}') and delivery_staff=auth.uid()));
create policy del_upd on delivery_records for update using (is_role('{admin}') or (is_role('{delivery}') and delivery_staff=auth.uid()));
create policy del_ins on delivery_records for insert with check (is_role('{admin}'));
create policy notif_own on notifications for select using (user_id=auth.uid() or is_role('{admin}'));

-- Auto-create profile on signup (mobile OTP)
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$
begin insert into profiles(id,mobile,role) values (new.id,new.phone,'customer'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
