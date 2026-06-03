import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ymaglrrlswpwatnqlglt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYWdscnJsc3dwd2F0bnFsZ2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzQxNTQsImV4cCI6MjA5Mjk1MDE1NH0.FlIJY15Kzu1clbncxH9CtmIWp-kBaiWzD06w8znMiXA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking tables for:", supabaseUrl);
  
  const tables = ['store_settings', 'products', 'categories', 'customers', 'suppliers', 'purchase_invoices', 'purchase_items'];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) {
        console.log(`❌ Table ${table}: Error ${error.code} - ${error.message}`);
      } else {
        console.log(`✅ Table ${table}: Found (${count} rows)`);
      }
    } catch (e) {
      console.log(`❌ Table ${table}: Exception - ${e.message}`);
    }
  }
}

check();
