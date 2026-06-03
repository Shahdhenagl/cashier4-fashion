import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ymaglrrlswpwatnqlglt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYWdscnJsc3dwd2F0bnFsZ2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzQxNTQsImV4cCI6MjA5Mjk1MDE1NH0.FlIJY15Kzu1clbncxH9CtmIWp-kBaiWzD06w8znMiXA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkColumns() {
  console.log("Checking columns for purchase_invoices in:", supabaseUrl);
  
  // Attempt to select one row to see columns or use RPC if available
  const { data, error } = await supabase.from('purchase_invoices').select('*').limit(1);
  
  if (error) {
    console.log("❌ Error fetching purchase_invoices:", error.message);
  } else {
    if (data && data.length > 0) {
        console.log("✅ Columns found in data:", Object.keys(data[0]));
    } else {
        console.log("✅ Table is empty, but query succeeded.");
        // Try to insert a dummy row and rollback or just check error for a missing column
        const { error: insError } = await supabase.from('purchase_invoices').insert({ dummy_column: 1 });
        console.log("Check error for non-existent column:", insError?.message);
    }
  }
}

checkColumns();
