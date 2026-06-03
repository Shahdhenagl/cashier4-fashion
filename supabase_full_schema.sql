create extension if not exists pgcrypto;

create table if not exists store_settings (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'محلي',
  currency text default 'ج.م',
  logo text default 'https://cdn-icons-png.flaticon.com/512/3143/3143641.png',
  tax_rate numeric default 0,
  theme_color text default '#4f46e5',
  address text default '',
  phone text default '',
  phone2 text default '',
  created_at timestamptz default now()
);

alter table store_settings add column if not exists whatsapp_country_code text default '2';
alter table store_settings add column if not exists initial_balance numeric default 0;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  barcode text unique,
  purchase_price numeric default 0,
  sale_price numeric default 0,
  stock_quantity integer default 0,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'بدون اسم',
  phone text unique not null,
  created_at timestamptz default now()
);

create table if not exists orders (
  id text primary key,
  total numeric not null default 0,
  customer_id uuid references customers(id) on delete set null,
  created_at timestamptz default now()
);

alter table orders add column if not exists paid_amount numeric default 0;
alter table orders add column if not exists paid_cash numeric default 0;
alter table orders add column if not exists paid_visa numeric default 0;
alter table orders add column if not exists paid_wallet numeric default 0;
alter table orders add column if not exists paid_instapay numeric default 0;
alter table orders add column if not exists payment_method text default 'cash';
alter table orders add column if not exists type text default 'sale';
alter table orders add column if not exists cashier_name text;
alter table orders drop constraint if exists orders_type_check;
alter table orders add constraint orders_type_check check (type in ('sale', 'payment', 'previous_debt'));

create table if not exists invoice_counter (
  id int primary key default 1,
  current_value integer default 1,
  check (id = 1)
);

insert into invoice_counter (id, current_value)
values (1, 1)
on conflict (id) do nothing;

create table if not exists order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  barcode text,
  quantity integer default 1,
  returned_quantity integer default 0,
  sale_price numeric default 0
);

alter table order_items add column if not exists purchase_price numeric default 0;
alter table order_items add column if not exists return_cash_amount numeric default 0;

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'عام',
  amount numeric not null default 0,
  note text default '',
  created_at timestamptz default now()
);

alter table expenses add column if not exists paid_cash numeric default 0;
alter table expenses add column if not exists paid_visa numeric default 0;
alter table expenses add column if not exists paid_wallet numeric default 0;
alter table expenses add column if not exists paid_instapay numeric default 0;
alter table expenses add column if not exists payment_method text default 'cash';

create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  address text,
  created_at timestamptz default now()
);

create table if not exists purchase_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null,
  supplier_id uuid references suppliers(id) on delete set null,
  total numeric not null default 0,
  paid_amount numeric default 0,
  paid_cash numeric default 0,
  paid_visa numeric default 0,
  paid_wallet numeric default 0,
  paid_instapay numeric default 0,
  payment_method text default 'cash',
  created_at timestamptz default now()
);

create table if not exists purchase_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references purchase_invoices(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  quantity integer not null default 1,
  purchase_price numeric not null default 0
);

insert into store_settings (name, currency, tax_rate, theme_color, whatsapp_country_code, initial_balance)
select 'محلي', 'ج.م', 0, '#4f46e5', '2', 0
where not exists (select 1 from store_settings);

alter table store_settings enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table invoice_counter enable row level security;
alter table expenses enable row level security;
alter table suppliers enable row level security;
alter table purchase_invoices enable row level security;
alter table purchase_items enable row level security;

drop policy if exists "allow all" on store_settings;
drop policy if exists "allow all" on categories;
drop policy if exists "allow all" on products;
drop policy if exists "allow all" on customers;
drop policy if exists "allow all" on orders;
drop policy if exists "allow all" on order_items;
drop policy if exists "allow all" on invoice_counter;
drop policy if exists "allow all" on expenses;
drop policy if exists "allow all" on suppliers;
drop policy if exists "allow all" on purchase_invoices;
drop policy if exists "allow all" on purchase_items;

create policy "allow all" on store_settings for all using (true) with check (true);
create policy "allow all" on categories for all using (true) with check (true);
create policy "allow all" on products for all using (true) with check (true);
create policy "allow all" on customers for all using (true) with check (true);
create policy "allow all" on orders for all using (true) with check (true);
create policy "allow all" on order_items for all using (true) with check (true);
create policy "allow all" on invoice_counter for all using (true) with check (true);
create policy "allow all" on expenses for all using (true) with check (true);
create policy "allow all" on suppliers for all using (true) with check (true);
create policy "allow all" on purchase_invoices for all using (true) with check (true);
create policy "allow all" on purchase_items for all using (true) with check (true);
