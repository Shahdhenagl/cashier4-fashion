import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChartNoAxesCombined, CreditCard, TrendingUp, Wallet } from 'lucide-react';
import { useStore } from '../../store/useStore';

type FilterType = 'daily' | 'monthly' | 'yearly';
type BudgetRow = {
  id: string;
  date: string;
  category: string;
  payment: string;
  amount: number;
  note?: string;
};

const paymentLabels: Record<string, string> = {
  cash: 'كاش',
  visa: 'فيزا',
  wallet: 'محفظة',
  instapay: 'InstaPay',
  mixed: 'متعدد'
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function monthISO() {
  return todayISO().slice(0, 7);
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

function matchesPeriod(date: string, filterType: FilterType, value: string) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const iso = d.toISOString();

  if (filterType === 'daily') return iso.slice(0, 10) === value;
  if (filterType === 'monthly') return iso.slice(0, 7) === value;
  return d.getFullYear().toString() === value;
}

function getPaymentLabel(entry: {
  payment_method?: string;
  paid_cash?: number;
  paid_visa?: number;
  paid_wallet?: number;
  paid_instapay?: number;
}) {
  const usedMethods = [
    entry.paid_cash ? 'cash' : '',
    entry.paid_visa ? 'visa' : '',
    entry.paid_wallet ? 'wallet' : '',
    entry.paid_instapay ? 'instapay' : ''
  ].filter(Boolean);

  if (usedMethods.length > 1) return paymentLabels.mixed;
  return paymentLabels[entry.payment_method || usedMethods[0] || 'cash'] || 'كاش';
}

export default function Budget() {
  const { orders, expenses, purchaseInvoices, storeSettings } = useStore();
  const [filterType, setFilterType] = useState<FilterType>('daily');
  const [filterValue, setFilterValue] = useState(todayISO());

  const handleFilterTypeChange = (next: FilterType) => {
    setFilterType(next);
    if (next === 'daily') setFilterValue(todayISO());
    if (next === 'monthly') setFilterValue(monthISO());
    if (next === 'yearly') setFilterValue(new Date().getFullYear().toString());
  };

  const budget = useMemo(() => {
    const periodOrders = orders.filter((order) => (
      order.type !== 'previous_debt' && matchesPeriod(order.date, filterType, filterValue)
    ));

    const incomeRows: BudgetRow[] = periodOrders
      .filter((order) => order.paid_amount > 0)
      .map((order) => ({
        id: `order-${order.id}`,
        date: order.date,
        category: order.type === 'payment' ? 'تحصيل مديونية' : 'مبيعات',
        payment: getPaymentLabel(order),
        amount: order.paid_amount,
        note: `فاتورة #${order.id}`
      }));

    const returnRows: BudgetRow[] = [];
    periodOrders.forEach((order) => {
      const cashReturn = order.items.reduce((sum, item) => {
        if (!item.returned_quantity) return sum;
        const fallback = item.returned_quantity * item.sale_price;
        return sum + (item.return_cash_amount && item.return_cash_amount > 0 ? item.return_cash_amount : fallback);
      }, 0);

      if (cashReturn > 0) {
        returnRows.push({
          id: `return-${order.id}`,
          date: order.date,
          category: 'مرتجعات',
          payment: 'كاش',
          amount: cashReturn,
          note: `مرتجع فاتورة #${order.id}`
        });
      }
    });

    const expenseRows: BudgetRow[] = expenses
      .filter((expense) => matchesPeriod(expense.date, filterType, filterValue))
      .map((expense) => ({
        id: `expense-${expense.id}`,
        date: expense.date,
        category: expense.category || 'مصروفات تشغيلية',
        payment: getPaymentLabel(expense),
        amount: expense.amount,
        note: expense.note
      }));

    const purchaseRows: BudgetRow[] = purchaseInvoices
      .filter((invoice) => matchesPeriod(invoice.created_at, filterType, filterValue) && invoice.paid_amount > 0)
      .map((invoice) => ({
        id: `purchase-${invoice.id}`,
        date: invoice.created_at,
        category: invoice.total === 0 ? 'سداد مورد' : 'مشتريات بضاعة',
        payment: getPaymentLabel(invoice),
        amount: invoice.paid_amount,
        note: `فاتورة مشتريات #${invoice.invoice_number || invoice.id}`
      }));

    const expensesAll = [...expenseRows, ...purchaseRows, ...returnRows]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const incomesAll = incomeRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const totalIncome = incomesAll.reduce((sum, row) => sum + row.amount, 0);
    const totalExpenses = expensesAll.reduce((sum, row) => sum + row.amount, 0);

    return {
      incomeRows: incomesAll,
      expenseRows: expensesAll,
      totalIncome,
      totalExpenses,
      net: totalIncome - totalExpenses
    };
  }, [orders, expenses, purchaseInvoices, filterType, filterValue]);

  const formatMoney = (value: number) => `${value.toFixed(2)} ${storeSettings.currency}`;
  const inputType = filterType === 'daily' ? 'date' : filterType === 'monthly' ? 'month' : 'number';

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6" dir="rtl">
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <ChartNoAxesCombined className="text-indigo-600" size={34} />
            الميزانية
          </h1>
          <p className="text-slate-500 mt-2 font-medium">ملخص إيرادات ومصروفات المعاملات حسب اليوم أو الشهر أو السنة</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-2 flex flex-col sm:flex-row gap-2 shadow-sm">
          <div className="grid grid-cols-3 gap-1 bg-slate-100 rounded-xl p-1">
            {[
              { id: 'daily', label: 'اليوم' },
              { id: 'monthly', label: 'الشهر' },
              { id: 'yearly', label: 'السنة' }
            ].map((option) => (
              <button
                key={option.id}
                onClick={() => handleFilterTypeChange(option.id as FilterType)}
                style={filterType === option.id ? { background: storeSettings.themeColor } : {}}
                className={`px-4 py-2 rounded-lg text-sm font-black transition ${
                  filterType === option.id ? 'text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type={inputType}
              min={filterType === 'yearly' ? '2000' : undefined}
              max={filterType === 'yearly' ? '2100' : undefined}
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="w-full sm:w-48 h-full min-h-11 rounded-xl border border-slate-200 bg-white pr-10 pl-3 font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SummaryCard title="الإيرادات" value={budget.totalIncome} tone="emerald" icon={<ArrowUpRight size={24} />} currency={storeSettings.currency} />
        <SummaryCard title="المصروفات" value={budget.totalExpenses} tone="red" icon={<ArrowDownLeft size={24} />} currency={storeSettings.currency} />
        <SummaryCard title="الصافي" value={budget.net} tone={budget.net >= 0 ? 'indigo' : 'red'} icon={<TrendingUp size={24} />} currency={storeSettings.currency} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BudgetTable
          title="الإيرادات"
          rows={budget.incomeRows}
          emptyText="لا توجد إيرادات"
          color="emerald"
          icon={<ArrowUpRight size={24} />}
          formatMoney={formatMoney}
        />
        <BudgetTable
          title="المصروفات"
          rows={budget.expenseRows}
          emptyText="لا توجد مصروفات"
          color="red"
          icon={<ArrowDownLeft size={24} />}
          formatMoney={formatMoney}
        />
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  tone,
  icon,
  currency
}: {
  title: string;
  value: number;
  tone: 'emerald' | 'red' | 'indigo';
  icon: ReactNode;
  currency: string;
}) {
  const toneClass = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-100'
  }[tone];

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <div className="flex items-center justify-between mb-4">
        <span className="font-black text-lg">{title}</span>
        {icon}
      </div>
      <div className="text-3xl font-black">
        {value.toFixed(2)}
        <span className="text-sm font-bold opacity-70 mr-2">{currency}</span>
      </div>
    </div>
  );
}

function BudgetTable({
  title,
  rows,
  emptyText,
  color,
  icon,
  formatMoney
}: {
  title: string;
  rows: BudgetRow[];
  emptyText: string;
  color: 'emerald' | 'red';
  icon: ReactNode;
  formatMoney: (value: number) => string;
}) {
  const colorClass = color === 'emerald'
    ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
    : 'text-red-700 bg-red-50 border-red-100';

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[320px]">
      <div className={`px-6 py-5 border-b flex items-center justify-between ${colorClass}`}>
        <h2 className="text-2xl font-black flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <span className="text-sm font-black bg-white/70 px-3 py-1 rounded-full border border-white">{rows.length} عملية</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="py-4 px-5 font-black whitespace-nowrap">التاريخ</th>
              <th className="py-4 px-5 font-black whitespace-nowrap">التصنيف</th>
              <th className="py-4 px-5 font-black whitespace-nowrap">الدفع</th>
              <th className="py-4 px-5 font-black whitespace-nowrap">القيمة</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-16 text-center text-slate-500 font-black text-lg">
                  {emptyText}
                </td>
              </tr>
            ) : rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70 transition">
                <td className="py-4 px-5 font-bold text-slate-600 whitespace-nowrap">{formatDate(row.date)}</td>
                <td className="py-4 px-5">
                  <div className="font-black text-slate-800">{row.category}</div>
                  {row.note && <div className="text-xs text-slate-400 mt-1">{row.note}</div>}
                </td>
                <td className="py-4 px-5">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-xs font-black">
                    <CreditCard size={13} />
                    {row.payment}
                  </span>
                </td>
                <td className="py-4 px-5 font-black text-slate-900 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <Wallet size={15} className="text-slate-400" />
                    {formatMoney(row.amount)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
