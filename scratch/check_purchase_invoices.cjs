
const { createClient } = require('@supabase/supabase-client');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: 'c:/Users/pc/Desktop/cashier-branch3/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase
    .from('purchase_invoices')
    .select('*')
    .limit(1);

  if (error) {
    console.error(error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    console.log('No data to determine columns');
  }
}

checkSchema();
