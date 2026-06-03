import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ymaglrrlswpwatnqlglt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYWdscnJsc3dwd2F0bnFsZ2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzQxNTQsImV4cCI6MjA5Mjk1MDE1NH0.FlIJY15Kzu1clbncxH9CtmIWp-kBaiWzD06w8znMiXA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testColumn() {
  console.log("Testing 'total' column in purchase_invoices...");
  
  const { error } = await supabase.from('purchase_invoices').select('total').limit(1);
  
  if (error) {
    console.log("❌ Error selecting 'total':", error.message);
  } else {
    console.log("✅ 'total' column exists!");
  }
}

testColumn();
