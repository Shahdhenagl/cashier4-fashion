-- ============================================================
-- Cashier System - Supabase Schema
-- Run this entire script in Supabase SQL Editor once
-- ============================================================

-- جدول الإعدادات
create table if not exists store_settings (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'محلي',
  currency text default 'ج.م',
  logo text default 'https://cdn-icons-png.flaticon.com/512/3143/3143641.png',
  tax_rate numeric default 0,
  theme_color text default '#4f46e5',
  address text default '',
  phone text default '',
  phone2 text default ''
);

-- إدخال صف الإعدادات الافتراضي
insert into store_settings (name, currency, tax_rate, theme_color)
values ('محل اللحوم الطازجة', 'ج.م', 0, '#4f46e5')
on conflict do nothing;

-- جدول الفئات
create table if not exists categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  created_at timestamptz default now()
);

-- إدخال بيانات افتراضية للفئات
insert into categories (name) values ('لحوم حمراء'), ('دواجن'), ('أسماك')
on conflict do nothing;

-- جدول المنتجات
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  barcode text unique,
  purchase_price numeric default 0,
  sale_price numeric default 0,
  stock_quantity integer default 0,
  category_id uuid references categories(id) on delete set null,
  created_at timestamptz default now()
);

-- جدول العملاء
create table if not exists customers (
  id uuid default gen_random_uuid() primary key,
  name text not null default 'بدون اسم',
  phone text unique not null,
  created_at timestamptz default now()
);

-- جدول الفواتير
create table if not exists orders (
  id text primary key,
  total numeric not null default 0,
  customer_id uuid references customers(id) on delete set null,
  created_at timestamptz default now()
);

-- Counter للفواتير
create table if not exists invoice_counter (
  id int primary key default 1,
  current_value integer default 1,
  check (id = 1)  -- صف واحد فقط
);
insert into invoice_counter (id, current_value) values (1, 1)
on conflict (id) do nothing;

-- جدول بنود الفاتورة
create table if not exists order_items (
  id uuid default gen_random_uuid() primary key,
  order_id text references orders(id) on delete cascade,
  product_id uuid references products(id) on delete set null,
  product_name text not null,
  barcode text,
  quantity integer default 1,
  returned_quantity integer default 0,
  sale_price numeric default 0
);

-- ============================================================
-- تفعيل RLS (Row Level Security)
-- ============================================================
alter table store_settings enable row level security;
alter table products enable row level security;
alter table categories enable row level security;
alter table customers enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table invoice_counter enable row level security;

-- سياسة مفتوحة مؤقتاً (عدّلها لاحقاً عند إضافة Auth)
create policy "allow all" on store_settings for all using (true) with check (true);
create policy "allow all" on products for all using (true) with check (true);
create policy "allow all" on categories for all using (true) with check (true);
create policy "allow all" on customers for all using (true) with check (true);
create policy "allow all" on orders for all using (true) with check (true);
create policy "allow all" on order_items for all using (true) with check (true);
create policy "allow all" on invoice_counter for all using (true) with check (true);
