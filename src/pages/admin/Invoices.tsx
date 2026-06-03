import { useState, useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { ArrowRightLeft, Search, User, Printer, CreditCard, FileText, Table as TableIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function Invoices() {
  const { orders, storeSettings } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showReturnsOnly, setShowReturnsOnly] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  const handlePrint = (order: any) => {
    const printDate = new Date(order.date).toLocaleString('ar-SA');
    const isPayment = order.type === 'payment';
    const isPreviousDebt = order.type === 'previous_debt';
    const subtotal = order.items.reduce((sum: number, item: any) => sum + (item.sale_price * item.quantity), 0);
    const taxValue = order.total - subtotal;
    
    // Calculate debt before and after invoice
    let debtBeforeInvoice = 0;
    let debtAfterInvoice = 0;
    let hasDebt = false;

    if (order.customer) {
      const customerOrders = orders.filter(o => o.customer?.id === order.customer.id);
      // Sort by date to calculate historical balance correctly
      const sortedOrders = [...customerOrders].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const currentIndex = sortedOrders.findIndex(o => o.id === order.id);
      
      // All orders up to and including this one (Debt after)
      debtAfterInvoice = sortedOrders.slice(0, currentIndex + 1).reduce((sum, o) => {
        const effectiveTotal = o.type === 'payment' ? 0 : o.total;
        return sum + (effectiveTotal - o.paid_amount);
      }, 0);

      const currentInvoiceDebt = order.type === 'payment' ? -order.paid_amount : (order.total - order.paid_amount);
      
      // Total debt BEFORE this invoice
      debtBeforeInvoice = debtAfterInvoice - currentInvoiceDebt;

      if (debtBeforeInvoice > 0 || debtAfterInvoice > 0) {
        hasDebt = true;
      }
    }

    let itemsHtml = '';
    if (isPayment) {
      itemsHtml = `<tr>
        <td colspan="2" style="padding:12px 4px;border-bottom:1px dashed #ddd;font-size:14px;font-weight:bold;">سداد مديونية سابقة</td>
        <td style="padding:12px 4px;border-bottom:1px dashed #ddd;text-align:left;font-size:14px;font-weight:bold;">${order.paid_amount.toFixed(2)}</td>
      </tr>`;
    } else if (isPreviousDebt) {
      itemsHtml = `<tr>
        <td colspan="2" style="padding:12px 4px;border-bottom:1px dashed #ddd;font-size:14px;font-weight:bold;">مديونية سابقة مسجلة</td>
        <td style="padding:12px 4px;border-bottom:1px dashed #ddd;text-align:left;font-size:14px;font-weight:bold;">${order.total.toFixed(2)}</td>
      </tr>`;
    } else {
      itemsHtml = order.items.map((item: any) =>
        `<tr>
          <td style="padding:6px 4px;border-bottom:1px dashed #ddd;font-size:13px;">${item.name}${item.returned_quantity > 0 ? ` <span style="color:red;font-size:10px;">(مرتجع: ${item.returned_quantity})</span>` : ''}</td>
          <td style="padding:6px 4px;border-bottom:1px dashed #ddd;text-align:center;font-size:13px;">${item.quantity}</td>
          <td style="padding:6px 4px;border-bottom:1px dashed #ddd;text-align:center;font-size:13px;">${item.sale_price.toFixed(2)}</td>
          <td style="padding:6px 4px;border-bottom:1px dashed #ddd;text-align:left;font-size:13px;">${(item.sale_price * item.quantity).toFixed(2)}</td>
        </tr>`
      ).join('');
    }

    const customerBlock = order.customer
      ? `<div class="customer-box"><strong>العميل:</strong> ${order.customer.name} &nbsp;|&nbsp; <strong>هاتف:</strong> <span dir="ltr">${order.customer.phone}</span></div>`
      : '';

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8"/>
  <title>${isPayment ? 'وصل سداد' : 'فاتورة'} #${order.id}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#111;width:148mm;margin:0 auto;padding:20px;}
    .header{text-align:center;border-bottom:2px dashed #333;padding-bottom:12px;margin-bottom:12px;}
    .logo{width:64px;height:64px;object-fit:cover;border-radius:12px;margin-bottom:6px;}
    .store-name{font-size:18px;font-weight:900;margin-bottom:4px;}
    .store-info{font-size:11px;color:#555;line-height:1.7;}
    .invoice-meta{display:flex;justify-content:space-between;font-size:11px;color:#555;margin:8px 0;background:#f5f5f5;padding:6px 8px;border-radius:6px;}
    .customer-box{background:#f0f4ff;border-radius:6px;padding:6px 10px;font-size:12px;margin-bottom:8px;border-right:3px solid #6366f1;}
    table{width:100%;border-collapse:collapse;}
    thead th{font-size:12px;color:#888;padding:4px;border-bottom:2px solid #eee;text-align:right;}
    thead th:last-child{text-align:left;}
    .totals{margin-top:10px;border-top:2px dashed #333;padding-top:10px;}
    .total-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;}
    .grand-total{font-size:17px;font-weight:900;border-top:1px solid #ddd;margin-top:6px;padding-top:8px;}
    .debt-row{display:flex;justify-content:space-between;font-size:12px;padding:4px 8px;background:#f9fafb;border-radius:6px;margin-top:4px;border:1px solid #eee;}
    .footer{text-align:center;margin-top:16px;font-size:12px;color:#888;border-top:2px dashed #bbb;padding-top:10px;}
    @media print{@page{margin:10mm;size:A5;}}
  </style>
</head>
<body>
  <div class="header">
    <img class="logo" src="${storeSettings.logo}" onerror="this.style.display='none'" />
    <div class="store-name">${storeSettings.name}</div>
    <div class="store-info">
      ${storeSettings.address ? `${storeSettings.address}<br/>` : ''}
      ${storeSettings.phone ? `هاتف: ${storeSettings.phone}` : ''}
      ${storeSettings.phone2 ? ` | ${storeSettings.phone2}` : ''}
    </div>
  </div>
  <div class="invoice-meta">
    <span>${isPayment ? 'رقم الإيصال' : 'رقم الفاتورة'}: <strong>${order.id}</strong></span>
    <span>${printDate}</span>
  </div>
  ${customerBlock}
  ${isPayment ? `<h3 style="text-align:center;margin:10px 0;font-size:16px;color:#444;">إيصال سداد نقدي</h3>` : isPreviousDebt ? `<h3 style="text-align:center;margin:10px 0;font-size:16px;color:#444;">إثبات مديونية سابقة</h3>` : ''}
  <table>
    <thead><tr>
      <th>${isPayment ? 'البيان' : 'المنتج'}</th>
      <th style="text-align:center">${isPayment ? '' : 'كمية'}</th>
      <th style="text-align:center">${isPayment ? '' : 'سعر القطعة'}</th>
      <th style="text-align:left">إجمالي</th>
    </tr></thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="totals">
    ${isPayment ? `
      <div class="total-row grand-total" style="border-bottom:1px solid #eee; padding-bottom:8px; margin-bottom:8px;">
        <span>إجمالي المبلغ المسدد:</span>
        <span>${order.paid_amount.toFixed(2)} ${storeSettings.currency}</span>
      </div>
      <div class="debt-row" style="background:#fff7ed; border-color:#fed7aa; display:flex; flex-direction:column; gap:4px; padding:8px 12px; margin-top:8px; width:100%;">
        <div style="display:flex; justify-content:space-between; font-size:12px; color:#c2410c; width:100%;">
          <span>الآجل قبل السداد:</span>
          <span style="font-weight:700;">${Math.max(0, debtBeforeInvoice).toFixed(2)} ${storeSettings.currency}</span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:#c2410c; border-top:1px dashed #fed7aa; padding-top:4px; margin-top:2px; width:100%;">
          <span>الآجل بعد السداد:</span>
          <span style="font-weight:900;">${Math.max(0, debtAfterInvoice).toFixed(2)} ${storeSettings.currency}</span>
        </div>
      </div>
    ` : `
      <div class="total-row"><span>المجموع الفرعي:</span><span>${subtotal.toFixed(2)} ${storeSettings.currency}</span></div>
      <div class="total-row"><span>الضريبة (${storeSettings.taxRate}%):</span><span>${taxValue.toFixed(2)} ${storeSettings.currency}</span></div>
      <div class="total-row grand-total"><span>الإجمالي:</span><span>${order.total.toFixed(2)} ${storeSettings.currency}</span></div>
      <div class="total-row" style="margin-top:4px;color:#059669;font-weight:bold;">
        <span>المبلغ المدفوع:</span>
        <span>${order.paid_amount.toFixed(2)} ${storeSettings.currency}</span>
      </div>
      ${order.paid_amount > order.total ? `
        <div class="total-row" style="color:#0284c7;font-weight:bold;">
          <span>الباقي (كاش):</span>
          <span>${(order.paid_amount - order.total).toFixed(2)} ${storeSettings.currency}</span>
        </div>
      ` : ''}
      <div class="total-row" style="color:#dc2626;font-weight:900;font-size:14px;border-top:1px dashed #eee;margin-top:2px;padding-top:2px;">
        <span>المتبقي (آجل):</span>
        <span>${Math.max(0, order.total - order.paid_amount).toFixed(2)} ${storeSettings.currency}</span>
      </div>
      ${hasDebt ? `
        <div class="debt-row" style="background:#fef2f2; border-color:#fee2e2; margin-top:8px; display:flex; flex-direction:column; gap:4px; padding:8px 12px; width:100%;">
          <div style="display:flex; justify-content:space-between; font-size:12px; color:#555; width:100%;">
            <span>الآجل قبل الفاتورة:</span>
            <span style="font-weight:700;">${Math.max(0, debtBeforeInvoice).toFixed(2)} ${storeSettings.currency}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:#b91c1c; border-top:1px dashed #fee2e2; padding-top:4px; margin-top:2px; width:100%;">
            <span>الآجل بعد الفاتورة:</span>
            <span style="font-weight:900;">${Math.max(0, debtAfterInvoice).toFixed(2)} ${storeSettings.currency}</span>
          </div>
        </div>
      ` : ''}
      ${order.items.some((i:any) => i.returned_quantity > 0) ? `
        <div class="total-row" style="color:red;font-weight:bold;margin-top:5px;border-top:1px solid #eee;">
          <span>إجمالي المرتجع:</span>
          <span>-${order.items.reduce((sum:number, i:any) => sum + (i.returned_quantity * i.sale_price), 0).toFixed(2)} ${storeSettings.currency}</span>
        </div>
      ` : ''}
    `}
  </div>
  <div class="footer">شكراً لتعاملكم ♥</div>
  <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`;

    const pw = window.open('', '_blank', 'width=600,height=850');
    if (pw) { pw.document.write(html); pw.document.close(); }
  };

  // Extract unique years from orders
  const years = useMemo(() => {
    const y = new Set<string>();
    orders.forEach(o => y.add(new Date(o.date).getFullYear().toString()));
    return Array.from(y).sort((a, b) => parseInt(b) - parseInt(a));
  }, [orders]);

  const exportExcel = () => {
    const wsData = [
      ['تقرير الفواتير', '', '', '', '', '', '', ''],
      ['التاريخ', new Date().toLocaleDateString(), '', '', '', '', '', ''],
      [''],
      ['رقم الفاتورة', 'العميل', 'التاريخ', 'الإجمالي', 'المرتجع', 'المدفوع', 'الباقي', 'النوع'],
      ...filteredOrders.map(o => {
        const returnedValue = o.items.reduce((sum, i) => sum + (i.returned_quantity * i.sale_price), 0);
        return [
          o.id,
          o.customer?.name || 'عميل نقدي',
          new Date(o.date).toLocaleString('ar-SA'),
          o.total,
          returnedValue,
          o.paid_amount,
          o.type === 'payment' ? 0 : Math.max(0, o.total - o.paid_amount),
          o.type === 'payment' ? 'سداد' : 'بيع'
        ];
      })
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Invoices');
    XLSX.writeFile(wb, `invoices_report_${new Date().toLocaleDateString()}.xlsx`);
  };

  const exportPDF = async () => {
    const element = document.getElementById('invoices-table');
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`invoices_report_${new Date().toLocaleDateString()}.pdf`);
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const orderDate = new Date(o.date);
      const matchesMonth = selectedMonth === 'all' || (orderDate.getMonth() + 1).toString() === selectedMonth;
      const matchesYear = selectedYear === 'all' || orderDate.getFullYear().toString() === selectedYear;
      const matchesReturns = showReturnsOnly ? o.items.some(i => i.returned_quantity > 0) : true;
      
      const searchStr = searchQuery.toLowerCase();
      const matchesSearch = 
        o.id.toLowerCase().includes(searchStr) || 
        (o.customer?.name || '').toLowerCase().includes(searchStr) ||
        (o.customer?.phone || '').includes(searchStr);

      return matchesMonth && matchesYear && matchesReturns && matchesSearch;
    });
  }, [orders, searchQuery, showReturnsOnly, selectedMonth, selectedYear]);

  return (
    <div className="p-8">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-800">الفواتير والمرتجعات</h1>
          <p className="text-slate-500 mt-2">مراجعة الفواتير وعمليات الاسترجاع مع الفلاتر المتقدمة</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={exportExcel}
            className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg"
          >
            <TableIcon size={18} /> Excel
          </button>
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 transition shadow-lg"
          >
            <FileText size={18} /> PDF
          </button>
        </div>
      </div>

      <div id="invoices-table" className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col min-h-[500px]">
        {/* Advanced Filters */}
        <div className="p-5 border-b border-slate-100 bg-slate-50 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div className="relative md:col-span-2">
            <Search className="absolute right-4 top-3 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="ابحث برقم الفاتورة، اسم العميل، أو رقم الهاتف..."
              style={{ '--tw-ring-color': storeSettings.themeColor + '40' } as any}
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pr-12 pl-4 text-sm focus:outline-none focus:ring-2 shadow-sm transition"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div className="flex gap-4 md:col-span-2 justify-end items-center">
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(e.target.value)} 
              style={{ '--tw-ring-color': storeSettings.themeColor + '40' } as any}
              className="bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 outline-none"
            >
              <option value="all">كل الشهور</option>
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i+1} value={(i+1).toString()}>{`شهر ${i+1}`}</option>
              ))}
            </select>

            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(e.target.value)} 
              style={{ '--tw-ring-color': storeSettings.themeColor + '40' } as any}
              className="bg-white border border-slate-200 rounded-xl p-2.5 text-sm focus:ring-2 outline-none"
            >
              <option value="all">كل السنوات</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center">
           <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-slate-700 bg-slate-50 px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-100 transition">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                checked={showReturnsOnly}
                onChange={(e) => setShowReturnsOnly(e.target.checked)}
              />
              إظهار الفواتير المرتجعة فقط
            </label>
            <div 
              style={{ backgroundColor: storeSettings.themeColor + '15', color: storeSettings.themeColor, borderColor: storeSettings.themeColor + '30' }}
              className="text-sm font-bold px-5 py-2.5 border rounded-xl"
            >
              إجمالي النتائج: {filteredOrders.length}
            </div>
        </div>

        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-400 font-medium">
              <tr>
                <th className="p-4">رقم الفاتورة</th>
                <th className="p-4">بيانات العميل</th>
                <th className="p-4">التاريخ والوقت</th>
                <th className="p-4">تفاصيل المنتجات</th>
                <th className="p-4 text-center border-x border-slate-100 bg-slate-100/50">الإجمالي</th>
                <th className="p-4 text-center text-orange-600">قيمة المرتجع</th>
                <th className="p-4 text-center text-green-600">المدفوع</th>
                <th className="p-4 text-center text-red-500 font-black">الباقي عليه</th>
                <th className="p-4 text-center">الحالة</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-12 text-center text-slate-400 text-lg font-bold">
                    لا يوجد فواتير تطابق بحثك حالياً.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const hasReturns = order.items.some(i => i.returned_quantity > 0);
                  const returnedValue = order.items.reduce((sum, i) => sum + (i.returned_quantity * i.sale_price), 0);
                  const effectiveDebt = order.type === 'payment' ? 0 : Math.max(0, order.total - order.paid_amount);

                  return (
                    <tr key={order.id} className={`hover:bg-slate-50 transition ${hasReturns ? 'bg-red-50/20' : ''}`}>
                      <td className="p-4 font-mono font-bold" style={{ color: storeSettings.themeColor }}>{order.id}</td>
                      <td className="p-4">
                        {order.customer ? (
                          <div className="flex flex-col">
                            <span className="font-bold flex items-center gap-1"><User size={14} style={{ color: storeSettings.themeColor }} /> {order.customer.name}</span>
                            <span className="text-xs text-slate-500 font-mono mt-1" dir="ltr">{order.customer.phone}</span>
                            {(() => {
                              const cDebt = orders.filter(o => o.customer?.id === order.customer!.id)
                                .reduce((sum, o) => {
                                  const eTotal = o.type === 'payment' ? 0 : o.total;
                                  return sum + (eTotal - o.paid_amount);
                                }, 0);
                              return cDebt > 0 ? (
                                <span className="text-[10px] font-black text-red-500 mt-1 bg-red-50 px-2 py-0.5 rounded border border-red-100 w-fit">إجمالي الأجل: {cDebt.toFixed(2)}</span>
                              ) : null;
                            })()}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-bold bg-slate-100 px-2 py-1 rounded">عميل نقدي</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-500">{new Date(order.date).toLocaleString('ar-SA')}</td>
                      <td className="p-4 text-right">
                        {order.type === 'payment' ? (
                          <div className="flex items-center gap-2 text-indigo-600 font-bold">
                            <CreditCard size={14} /> سداد مديونية آجل
                          </div>
                        ) : order.type === 'previous_debt' ? (
                          <div className="flex items-center gap-2 text-amber-600 font-bold">
                            <FileText size={14} /> مديونية سابقة
                          </div>
                        ) : (
                          <ul className="space-y-1">
                            {order.items.map(i => (
                              <li key={i.id} className={`flex items-center gap-2 ${i.returned_quantity > 0 ? 'text-red-500' : ''}`}>
                                • {i.name} <span className="text-xs text-slate-400">(الكمية: {i.quantity})</span> 
                                {i.returned_quantity > 0 && <span className="font-bold text-[10px] bg-red-100 px-1.5 py-0.5 rounded text-red-600">مرتجع: {i.returned_quantity}</span>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                       <td className="p-4 text-center font-black border-x border-slate-100 bg-slate-50/50" style={order.type === 'payment' ? { color: storeSettings.themeColor } : {}}>
                        {order.type === 'payment' ? `+ ${order.paid_amount.toFixed(2)}` : order.total.toFixed(2)} {storeSettings.currency}
                      </td>
                      <td className="p-4 text-center font-bold text-orange-600">
                        {returnedValue.toFixed(2)} {storeSettings.currency}
                      </td>
                      <td className="p-4 text-center font-black text-green-600">
                        {order.paid_amount.toFixed(2)} {storeSettings.currency}
                      </td>
                      <td className="p-4 text-center font-black text-red-500">
                        {effectiveDebt.toFixed(2)} {storeSettings.currency}
                      </td>
                      <td className="p-4 text-center">
                        {order.type === 'payment' ? (
                          <span style={{ backgroundColor: storeSettings.themeColor + '15', color: storeSettings.themeColor }} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-bold">
                            سداد آجل
                          </span>
                        ) : order.type === 'previous_debt' ? (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold">
                            مديونية سابقة
                          </span>
                        ) : hasReturns ? (
                          <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-bold">
                            <ArrowRightLeft size={14} /> مرتجع جزئي/كلي
                          </span>
                        ) : order.total - order.paid_amount > 0 ? (
                          <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-3 py-1 rounded-lg text-xs font-bold">
                            فاتورة أجل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-600 px-3 py-1 rounded-lg text-xs font-bold">
                            فاتورة مكتملة
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => handlePrint(order)}
                          style={{ backgroundColor: storeSettings.themeColor + '10', color: storeSettings.themeColor }}
                          className="p-2 rounded-lg hover:bg-opacity-20 transition-all shadow-sm border border-transparent hover:border-current"
                          title="طباعة الفاتورة"
                        >
                          <Printer size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
