import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: 'c:/Users/pc/Desktop/cashier-branch3/.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  console.log("Checking tables for:", supabaseUrl);
  
  const tables = ['store_settings', 'products', 'categories', 'customers', 'suppliers', 'purchase_invoices', 'purchase_items'];
  
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`❌ Table ${table}: Error ${error.code} - ${error.message}`);
    } else {
      console.log(`✅ Table ${table}: Found (${count} rows)`);
    }
  }
}

check();
