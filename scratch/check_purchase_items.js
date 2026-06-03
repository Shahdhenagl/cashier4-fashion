import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ymaglrrlswpwatnqlglt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltYWdscnJsc3dwd2F0bnFsZ2x0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNzQxNTQsImV4cCI6MjA5Mjk1MDE1NH0.FlIJY15Kzu1clbncxH9CtmIWp-kBaiWzD06w8znMiXA';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkPurchaseItems() {
  console.log("Checking columns for purchase_items...");
  const { data, error } = await supabase.from('purchase_items').select('*').limit(1);
  if (error) {
    console.log("❌ Error:", error.message);
  } else {
    console.log("✅ Query success. Checking 'purchase_price' vs 'purchasePrice'...");
    const { error: err1 } = await supabase.from('purchase_items').select('purchase_price').limit(1);
    console.log("Result for 'purchase_price':", err1 ? "❌ " + err1.message : "✅ OK");
  }
}

checkPurchaseItems();
