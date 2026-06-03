-- ============================================================
-- تحديث نظام الخزينة والميزانية اليومية (الفرع الثاني)
-- قم بتشغيل هذا السكريبت بالكامل في محرر SQL في Supabase للفرع الثاني
-- ============================================================

-- 1. إضافة أعمدة طرق الدفع المقسمة لجدول المصروفات
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_cash numeric DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_visa numeric DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_wallet numeric DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS paid_instapay numeric DEFAULT 0;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash';

-- 2. إضافة رصيد الافتتاح لجدول الإعدادات
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS initial_balance numeric DEFAULT 0;

-- 3. إنشاء جداول الموردين والمشتريات لدعم سجل التدفقات المالية
CREATE TABLE IF NOT EXISTS suppliers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text,
  address text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  total numeric NOT NULL DEFAULT 0,
  paid_amount numeric DEFAULT 0,
  paid_cash numeric DEFAULT 0,
  paid_visa numeric DEFAULT 0,
  paid_wallet numeric DEFAULT 0,
  paid_instapay numeric DEFAULT 0,
  payment_method text DEFAULT 'cash',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id uuid REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  quantity integer NOT NULL DEFAULT 1,
  purchase_price numeric not null default 0
);

-- تفعيل الحماية RLS وإضافة السياسات
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON purchase_invoices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow all" ON purchase_items FOR ALL USING (true) WITH CHECK (true);

-- 4. تحديث قيود جدول الطلبات للسماح بنوع "مديونية سابقة" (previous_debt)
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_type_check;
ALTER TABLE orders ADD CONSTRAINT orders_type_check CHECK (type IN ('sale', 'payment', 'previous_debt'));

-- 5. إضافة أعمدة طرق الدفع لجدول المبيعات (orders)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_cash numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_visa numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_wallet numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_instapay numeric DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'cash';
