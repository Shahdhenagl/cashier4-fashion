import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { BookUser, CreditCard, Search, Banknote, X, FileText, Table as TableIcon, Plus, User, UserPlus } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function DeferredAccounts() {
  const { customers, orders, storeSettings, checkout } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'visa' | 'wallet' | 'instapay'>('cash');

  // Add previous debt state
  const [isAddDebtOpen, setIsAddDebtOpen] = useState(false);
  const [addDebtCustSearch, setAddDebtCustSearch] = useState('');
  const [selectedAddDebtCust, setSelectedAddDebtCust] = useState<any>(null);
  const [addDebtAmount, setAddDebtAmount] = useState<string>('');
  const [showCustSuggestions, setShowCustSuggestions] = useState(false);

  const filteredSearchCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(addDebtCustSearch.toLowerCase()) || 
    c.phone.includes(addDebtCustSearch)
  ).slice(0, 5);

  const handleOpenAddDebtModal = () => {
    setSelectedAddDebtCust(null);
    setAddDebtAmount('');
    setAddDebtCustSearch('');
    setIsAddDebtOpen(true);
  };

  const handleProcessAddDebt = async () => {
    const amount = parseFloat(addDebtAmount);
    if (!selectedAddDebtCust) {
      alert('الرجاء اختيار العميل أولاً');
      return;
    }
    if (!amount || amount <= 0) {
      alert('الرجاء إدخال مبلغ صحيح أكبر من الصفر');
      return;
    }

    try {
      // Pass total=amount, paidAmount=0, type='previous_debt'
      const invoiceId = await checkout(
        amount, 
        { name: selectedAddDebtCust.name, phone: selectedAddDebtCust.phone }, 
        0, 
        'previous_debt'
      );
      
      alert(`تم إضافة المديونية السابقة بنجاح!\nرقم الفاتورة: ${invoiceId}`);
      setIsAddDebtOpen(false);
      setSelectedAddDebtCust(null);
      setAddDebtAmount('');
      setAddDebtCustSearch('');
    } catch (e: any) {
      alert('حدث خطأ أثناء إضافة المديونية السابقة');
    }
  };

  // Calculate debts
  const customersWithDebt = customers.map(c => {
    const customerOrders = orders.filter(o => o.customer?.id === c.id);
    const totalDebt = Math.max(0, customerOrders.reduce((sum, o) => {
      // Debt = Original Total - Paid Amount
      // Returns do not affect the debt because they are refunded in cash.
      return sum + (o.total - o.paid_amount);
    }, 0));
    
    return { 
      ...c, 
      totalDebt, 
      orders: customerOrders.filter(o => o.total - o.paid_amount > 0) // optional: keep only unpaid invoices for reference
    };
  }).filter(c => c.totalDebt > 0)
    .sort((a, b) => b.totalDebt - a.totalDebt);

  const filteredCustomers = customersWithDebt.filter(c => 
    c.name.includes(searchQuery) || c.phone.includes(searchQuery)
  );

  const exportExcel = () => {
    const wsData = [
      ['تقرير حسابات الآجل', '', '', ''],
      ['التاريخ', new Date().toLocaleDateString(), '', ''],
      [''],
      ['الاسم', 'رقم الهاتف', 'المديونية', 'عدد الفواتير'],
      ...filteredCustomers.map(c => [
        c.name,
        c.phone,
        c.totalDebt,
        c.orders.length
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Debts');
    XLSX.writeFile(wb, `deferred_accounts_report_${new Date().toLocaleDateString()}.xlsx`);
  };

  const exportPDF = async () => {
    const element = document.getElementById('deferred-table');
    if (!element) return;
    const canvas = await html2canvas(element, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`deferred_accounts_report_${new Date().toLocaleDateString()}.pdf`);
  };

  const handleOpenModal = (customer: any) => {
    setSelectedCustomer(customer);
    setPaymentAmount(customer.totalDebt.toString());
    setIsModalOpen(true);
  };

  const handleProcessPayment = async () => {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0 || !selectedCustomer) {
      alert('الرجاء إدخال مبلغ صحيح');
      return;
    }
    
    if (amount > selectedCustomer.totalDebt) {
      alert('المبلغ المدفوع أكبر من إجمالي الدين');
      return;
    }

    try {
      // Pass total=0, paidAmount=amount, type='payment', paymentMethod
      const invoiceId = await checkout(
        0, 
        { name: selectedCustomer.name, phone: selectedCustomer.phone }, 
        amount, 
        'payment',
        paymentMethod
      );
      
      alert(`تم تسجيل الدفعة بنجاح!\nرقم الإيصال: ${invoiceId}`);
      setIsModalOpen(false);
      setSelectedCustomer(null);
      setPaymentAmount('');
      setPaymentMethod('cash'); // Reset to cash
    } catch (e: any) {
      console.error(e);
      alert('حدث خطأ أثناء معالجة الدفعة');
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <BookUser style={{ color: storeSettings.themeColor }} size={32} />
            حسابات الآجل (الديون)
          </h1>
          <p className="text-slate-500 mt-2">إدارة العملاء المتعثرين وتسجيل الدفعات للفواتير الآجلة</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleOpenAddDebtModal}
            style={{ backgroundColor: storeSettings.themeColor }}
            className="flex items-center gap-2 text-white px-5 py-2.5 rounded-xl font-bold hover:opacity-90 transition shadow-lg shrink-0"
          >
            <Plus size={18} /> إضافة مديونية سابقة
          </button>
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
          <div className="relative w-full md:w-96">
            <Search className="absolute right-4 top-3.5 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="ابحث برقم الهاتف أو اسم العميل..."
              className="w-full bg-white border border-slate-200 rounded-2xl py-3 pr-12 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div id="deferred-table" className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right" dir="rtl">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-sm">
              <tr>
                <th className="py-4 px-6 font-bold">اسم العميل</th>
                <th className="py-4 px-6 font-bold">رقم الهاتف</th>
                <th className="py-4 px-6 font-bold">الفواتير المعلقة</th>
                <th className="py-4 px-6 font-bold">إجمالي المديونية</th>
                <th className="py-4 px-6 font-bold text-left">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-800">{customer.name}</td>
                    <td className="py-4 px-6 font-mono text-slate-600" dir="ltr">{customer.phone}</td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-2">
                        {customer.orders.slice(0, 3).map((o: any) => (
                          <span key={o.id} className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md font-mono">
                            #{o.id}
                          </span>
                        ))}
                        {customer.orders.length > 3 && (
                          <span className="text-xs text-slate-400">+{customer.orders.length - 3} فواتير أخرى</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-red-600 font-black text-lg bg-red-50 px-3 py-1 rounded-xl block w-max">
                        {customer.totalDebt.toFixed(2)} <span className="text-xs">{storeSettings.currency}</span>
                      </span>
                    </td>
                    <td className="py-4 px-6 text-left">
                      <button 
                        onClick={() => handleOpenModal(customer)}
                        style={{ backgroundColor: storeSettings.themeColor + '15', color: storeSettings.themeColor }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all hover:bg-opacity-25"
                      >
                        <CreditCard size={18} /> سداد
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <BookUser size={48} className="mx-auto mb-4 opacity-50" />
                    لا يوجد عملاء لديهم التزامات مالية حالياً
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div 
              style={{ background: `linear-gradient(160deg, ${storeSettings.themeColor} 0%, ${storeSettings.themeColor}dd 100%)` }}
              className="p-6 text-white flex justify-between items-center"
            >
              <h2 className="text-xl font-black flex items-center gap-2 drop-shadow">
                <Banknote /> تسجيل دفعة سداد
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="flex flex-col items-center bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="text-sm font-bold text-slate-500 mb-1">إجمالي المديونية</div>
                <div className="text-3xl font-black text-red-600">{selectedCustomer.totalDebt.toFixed(2)} <span className="text-lg">{storeSettings.currency}</span></div>
                <div className="mt-2 text-sm font-semibold">{selectedCustomer.name} - <span dir="ltr">{selectedCustomer.phone}</span></div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">المبلغ المراد سداده</label>
                <div className="relative">
                  <input
                    type="number"
                    dir="ltr"
                    className="w-full border border-slate-200 rounded-xl py-4 px-4 text-xl font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    max={selectedCustomer.totalDebt}
                    min={1}
                  />
                  <div className="absolute left-4 top-4 text-slate-400 font-bold">{storeSettings.currency}</div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">طريقة الدفع</label>
                <select
                  value={paymentMethod}
                  onChange={(e: any) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="cash">نقدي (كاش)</option>
                  <option value="visa">فيزا (بطاقة)</option>
                  <option value="wallet">محفظة إلكترونية</option>
                  <option value="instapay">انستا باي (InstaPay)</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleProcessPayment}
                  style={{ backgroundColor: storeSettings.themeColor, boxShadow: `0 4px 12px ${storeSettings.themeColor}40` }}
                  className="flex-1 text-white py-4 rounded-xl font-bold transition-all hover:bg-opacity-90"
                >
                  إتمام عملية الدفع
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 border border-slate-200 hover:bg-slate-50 text-slate-600 py-3.5 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddDebtOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div 
              style={{ background: `linear-gradient(160deg, ${storeSettings.themeColor} 0%, ${storeSettings.themeColor}dd 100%)` }}
              className="p-6 text-white flex justify-between items-center"
            >
              <h2 className="text-xl font-black flex items-center gap-2 drop-shadow">
                <UserPlus /> إضافة مديونية سابقة لعميل
              </h2>
              <button onClick={() => setIsAddDebtOpen(false)} className="hover:bg-white/20 p-2 rounded-xl transition">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              {/* Customer selection */}
              <div className="relative">
                <label className="block text-sm font-bold text-slate-700 mb-2">اختر العميل</label>
                {selectedAddDebtCust ? (
                  <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-inner">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-800">{selectedAddDebtCust.name}</span>
                      <span className="text-xs text-slate-500 font-mono" dir="ltr">{selectedAddDebtCust.phone}</span>
                    </div>
                    <button 
                      onClick={() => setSelectedAddDebtCust(null)}
                      className="text-red-500 hover:text-red-700 font-bold text-sm bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition"
                    >
                      تغيير
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="ابحث باسم العميل أو رقم الموبايل..."
                        className="w-full bg-white border border-slate-200 rounded-xl py-3.5 pr-4 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                        value={addDebtCustSearch}
                        onChange={e => {
                          setAddDebtCustSearch(e.target.value);
                          setShowCustSuggestions(true);
                        }}
                        onFocus={() => setShowCustSuggestions(true)}
                      />
                    </div>
                    {showCustSuggestions && addDebtCustSearch.trim() && (
                      <div className="absolute right-0 left-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden z-[60] animate-in slide-in-from-top-2 duration-150 max-h-56 overflow-y-auto">
                        {filteredSearchCustomers.length > 0 ? (
                          filteredSearchCustomers.map(c => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setSelectedAddDebtCust(c);
                                setShowCustSuggestions(false);
                              }}
                              className="w-full p-3 text-right hover:bg-indigo-50 flex items-center justify-between border-b border-slate-100 last:border-0"
                            >
                              <div className="flex flex-col items-start text-right">
                                <span className="font-bold text-slate-800 text-sm">{c.name}</span>
                                <span className="text-xs text-slate-500 font-mono">{c.phone}</span>
                              </div>
                              <User size={16} className="text-slate-400" />
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-slate-400 text-xs">لا يوجد نتائج تطابق بحثك</div>
                        )}
                      </div>
                    )}
                    {showCustSuggestions && (
                      <div className="fixed inset-0 z-[55]" onClick={() => setShowCustSuggestions(false)} />
                    )}
                  </>
                )}
              </div>

              {/* Debt amount */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">رصيد المديونية القديم</label>
                <div className="relative">
                  <input
                    type="number"
                    dir="ltr"
                    className="w-full border border-slate-200 rounded-xl py-4 px-4 text-xl font-black text-center focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
                    value={addDebtAmount}
                    onChange={(e) => setAddDebtAmount(e.target.value)}
                    placeholder="0.00"
                    min={1}
                  />
                  <div className="absolute left-4 top-4 text-slate-400 font-bold">{storeSettings.currency}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleProcessAddDebt}
                  style={{ backgroundColor: storeSettings.themeColor, boxShadow: `0 4px 12px ${storeSettings.themeColor}40` }}
                  className="flex-1 text-white py-4 rounded-xl font-bold transition-all hover:bg-opacity-90"
                >
                  إضافة المديونية
                </button>
                <button
                  onClick={() => setIsAddDebtOpen(false)}
                  className="px-6 border border-slate-200 hover:bg-slate-50 text-slate-600 py-3.5 rounded-xl font-bold transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
