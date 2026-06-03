import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { ShoppingCart, Search, Plus, Minus, Trash2, Banknote, RefreshCcw, Moon, Sun, ArrowRightLeft, X, Printer, User, CreditCard, Smartphone, Zap } from 'lucide-react';
import { normalizeArabic } from '../utils/textUtils';


export default function POS() {
  const { products, categories, cart, addToCart, removeFromCart, updateQuantity, updatePrice, clearCart, checkout, processReturn, storeSettings, orders, activeInvoiceId, customers, isOnline, offlineQueue, offlineReturnsQueue, isSyncing, syncOfflineQueue, syncOfflineReturnsQueue } = useStore();
  
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Customer details for checkout
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [discountStr, setDiscountStr] = useState('');
  const [customerDebt, setCustomerDebt] = useState<number>(0);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);

  
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [returnSearchQuery, setReturnSearchQuery] = useState('');
  const [activeReturnOrder, setActiveReturnOrder] = useState<any>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastInvoiceId, setLastInvoiceId] = useState('');
  const [lastCustomerInfo, setLastCustomerInfo] = useState<any>(null);
  const [lastOrderDetails, setLastOrderDetails] = useState<any>(null);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [checkoutShouldPrint, setCheckoutShouldPrint] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Online/Offline sync listener
  useEffect(() => {
    const handleOnline = () => {
      useStore.setState({ isOnline: true });
      syncOfflineQueue();
      syncOfflineReturnsQueue();
    };
    const handleOffline = () => {
      useStore.setState({ isOnline: false });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    useStore.setState({ isOnline: navigator.onLine });
    if (navigator.onLine) {
      syncOfflineQueue();
      syncOfflineReturnsQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearchOrder = () => {
    const order = orders.find(o => o.id.toLowerCase() === returnSearchQuery.toLowerCase());
    if (order) {
      setActiveReturnOrder(order);
    } else {
      alert("لم يتم العثور على فاتورة بهذا الرقم");
      setActiveReturnOrder(null);
    }
  };

  const handleReturnItem = async (productId: string) => {
    if (activeReturnOrder) {
      const qs = prompt("أدخل الكمية المراد استرجاعها:");
      const qty = parseInt(qs || '0', 10);
      if (!isNaN(qty) && qty > 0) {
        const success = await processReturn(activeReturnOrder.id, productId, qty);
        if (success) {
          alert('تم استرجاع المنتجات بنجاح وإعادتها للمخزون');
          const updatedOrder = useStore.getState().orders.find(o => o.id === activeReturnOrder.id);
          setActiveReturnOrder(updatedOrder);
        } else {
          alert("الكمية غير صحيحة أو تم استرجاعها مسبقاً بالكامل");
        }
      }
    }
  };

  const printInvoice = (invId: string, orderDetails: any) => {
    const currentSettings = { ...storeSettings };
    const printDate = new Date().toLocaleString('ar-SA');
    const itemsHtml = orderDetails.cart.map((item: any) =>
      `<tr>
        <td style="padding:6px 4px;border-bottom:1px dashed #ddd;font-size:13px;">${item.name}</td>
        <td style="padding:6px 4px;border-bottom:1px dashed #ddd;text-align:center;font-size:13px;">${item.quantity}</td>
        <td style="padding:6px 4px;border-bottom:1px dashed #ddd;text-align:center;font-size:13px;">${item.sale_price.toFixed(2)}</td>
        <td style="padding:6px 4px;border-bottom:1px dashed #ddd;text-align:left;font-size:13px;">${(item.sale_price * item.quantity).toFixed(2)}</td>
      </tr>`
    ).join('');

    const customerBlock = (orderDetails.customerName || orderDetails.customerPhone)
      ? `<div class="customer-box"><strong>العميل:</strong> ${orderDetails.customerName || '—'} &nbsp;|&nbsp; <strong>هاتف:</strong> <span dir="ltr">${orderDetails.customerPhone || '—'}</span></div>`
      : '';

    // Calculate debt before and after invoice
    let debtBeforeInvoice = 0;
    let debtAfterInvoice = 0;
    let hasDebt = false;
    if (orderDetails.customerPhone) {
      const existingCust = customers.find(c => c.phone === orderDetails.customerPhone);
      if (existingCust) {
        const cOrders = orders.filter(o => o.customer?.id === existingCust.id);
        debtBeforeInvoice = cOrders.reduce((sum, o) => {
          const effectiveTotal = o.type === 'payment' ? 0 : o.total;
          return sum + (effectiveTotal - o.paid_amount);
        }, 0);
        const currentInvoiceDebt = Math.max(0, orderDetails.total - orderDetails.paidAmount);
        debtAfterInvoice = debtBeforeInvoice + currentInvoiceDebt;
        if (debtBeforeInvoice > 0 || debtAfterInvoice > 0) {
          hasDebt = true;
        }
      }
    }

    const methodLabels: Record<string, string> = {
      cash: 'نقدي (كاش)',
      visa: 'فيزا (بطاقة)',
      wallet: 'محفظة إلكترونية',
      instapay: 'انستا باي (InstaPay)'
    };
    const methodLabel = methodLabels[orderDetails.paymentMethod] || 'نقدي (كاش)';

    const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8"/>
<title>فاتورة #${invId}</title>
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
  .discount-row{display:flex;justify-content:space-between;font-size:13px;padding:3px 0;color:#e53e3e;font-weight:700;}
  .grand-total{font-size:17px;font-weight:900;border-top:1px solid #ddd;margin-top:6px;padding-top:8px;}
  .debt-row{display:flex;justify-content:space-between;font-size:12px;padding:4px 8px;background:#f9fafb;border-radius:6px;margin-top:4px;border:1px solid #eee;}
  .footer{text-align:center;margin-top:16px;font-size:12px;color:#888;border-top:2px dashed #bbb;padding-top:10px;}
  @media print{@page{margin:10mm;size:A5;}}

</style>
</head>
<body>
<div class="header">
  <img class="logo" src="${currentSettings.logo}" onerror="this.style.display='none'" />
  <div class="store-name">${currentSettings.name}</div>
  <div class="store-info">
    ${currentSettings.address ? `${currentSettings.address}<br/>` : ''}
    ${currentSettings.phone ? `هاتف: ${currentSettings.phone}` : ''}
    ${currentSettings.phone2 ? ` | ${currentSettings.phone2}` : ''}
  </div>
</div>
<div class="invoice-meta">
  <span>رقم الفاتورة: <strong>${invId}</strong></span>
  <span>${printDate}</span>
</div>
${customerBlock}
<table>
  <thead><tr>
    <th>المنتج</th>
    <th style="text-align:center">كمية</th>
    <th style="text-align:center">سعر القطعة</th>
    <th style="text-align:left">إجمالي</th>
  </tr></thead>
  <tbody>${itemsHtml}</tbody>
</table>
<div class="totals">
  <div class="total-row"><span>المجموع الفرعي:</span><span>${orderDetails.subtotal.toFixed(2)} ${currentSettings.currency}</span></div>
  ${orderDetails.discount > 0 ? `<div class="discount-row"><span>🏷️ الخصم:</span><span>- ${orderDetails.discount.toFixed(2)} ${currentSettings.currency}</span></div>` : ''}
  <div class="total-row"><span>الضريبة (${currentSettings.taxRate}%):</span><span>${orderDetails.tax.toFixed(2)} ${currentSettings.currency}</span></div>
  <div class="total-row grand-total"><span>الإجمالي:</span><span>${orderDetails.total.toFixed(2)} ${currentSettings.currency}</span></div>
  <div class="total-row" style="margin-top:4px;color:#059669;font-weight:bold;">
    <span>طريقة الدفع:</span>
    <span>${methodLabel}</span>
  </div>
  <div class="total-row" style="color:#059669;font-weight:bold;">
    <span>المبلغ المدفوع:</span>
    <span>${orderDetails.paidAmount.toFixed(2)} ${currentSettings.currency}</span>
  </div>
  ${orderDetails.paidAmount > orderDetails.total ? `
    <div class="total-row" style="color:#0284c7;font-weight:bold;">
      <span>الباقي (كاش):</span>
      <span>${(orderDetails.paidAmount - orderDetails.total).toFixed(2)} ${currentSettings.currency}</span>
    </div>
  ` : ''}
  <div class="total-row" style="color:#dc2626;font-weight:900;font-size:14px;border-top:1px dashed #eee;margin-top:2px;padding-top:2px;">
    <span>المتبقي (آجل):</span>
    <span>${Math.max(0, orderDetails.total - orderDetails.paidAmount).toFixed(2)} ${currentSettings.currency}</span>
  </div>
  ${hasDebt ? `
    <div class="debt-row" style="background:#fef2f2; border-color:#fee2e2; margin-top:8px; display:flex; flex-direction:column; gap:4px; padding:8px 12px; width:100%;">
      <div style="display:flex; justify-content:space-between; font-size:12px; color:#555; width:100%;">
        <span>الآجل قبل الفاتورة:</span>
        <span style="font-weight:700;">${Math.max(0, debtBeforeInvoice).toFixed(2)} ${currentSettings.currency}</span>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:#b91c1c; border-top:1px dashed #fee2e2; padding-top:4px; margin-top:2px; width:100%;">
        <span>الآجل بعد الفاتورة:</span>
        <span style="font-weight:900;">${Math.max(0, debtAfterInvoice).toFixed(2)} ${currentSettings.currency}</span>
      </div>
    </div>
  ` : ''}
</div>
<div class="footer">شكراً لتعاملكم ♥</div>
<script>window.onload=()=>{window.print();window.onafterprint=()=>window.close();}<\/script>
</body></html>`;

    const pw = window.open('', '_blank', 'width=600,height=850');

    if (pw) { pw.document.write(html); pw.document.close(); }
  };

  const doCheckout = async (shouldPrint: boolean, paymentMethod: 'cash' | 'visa' | 'wallet' | 'instapay' = 'cash') => {
    const currentCart = [...cart];
    const currentSubtotal = subtotal;
    const currentDiscount = discount;
    const currentTax = tax;
    const currentTotal = total;
    const currentCustomerName = customerName;
    const currentCustomerPhone = customerPhone;

    const finalPaidAmount = paidAmountStr === '' ? currentTotal : parseFloat(paidAmountStr) || 0;

    if (finalPaidAmount < currentTotal && (!currentCustomerName.trim() || !currentCustomerPhone.trim())) {
      alert("عذراً، يجب تسجيل اسم ورقم هاتف العميل بالكامل (الاسم والموبايل) في حالة البيع بالآجل لحفظ المديونية.");
      return;
    }

    const invoiceId = await checkout(
      currentTotal, 
      { name: currentCustomerName, phone: currentCustomerPhone }, 
      finalPaidAmount, 
      'sale',
      paymentMethod
    );
    
    const details = {
      cart: currentCart,
      subtotal: currentSubtotal,
      discount: currentDiscount,
      tax: currentTax,
      total: currentTotal,
      paidAmount: finalPaidAmount,
      customerName: currentCustomerName,
      customerPhone: currentCustomerPhone,
      paymentMethod
    };

    setLastInvoiceId(invoiceId);
    setLastCustomerInfo({ name: currentCustomerName, phone: currentCustomerPhone });
    setLastOrderDetails(details);
    setShowSuccessModal(true);

    if (shouldPrint) {
      printInvoice(invoiceId, details);
    }

    setCustomerName('');
    setCustomerPhone('');
    setPaidAmountStr('');
    setDiscountStr('');
    setCustomerDebt(0);
  };

  const filteredProducts = products.filter(
    (p) =>
      (activeCategory === 'all' || p.category_id === activeCategory) &&
      p.name.includes(searchQuery)
  );

  const subtotal = cart.reduce((sum, item) => sum + item.sale_price * item.quantity, 0);
  const discount = Math.min(parseFloat(discountStr) || 0, subtotal);
  const discountedSubtotal = subtotal - discount;
  const tax = discountedSubtotal * (storeSettings.taxRate / 100);
  const total = discountedSubtotal + tax;

  const currentPaid = paidAmountStr === '' ? total : parseFloat(paidAmountStr) || 0;
  const remaining = total - currentPaid;

  // Sync customer info and debt calculation
  useEffect(() => {
    if (!customerPhone) {
      setCustomerDebt(0);
      return;
    }
    const existingCust = customers.find(c => c.phone === customerPhone);
    if (existingCust) {
      setCustomerName(existingCust.name);
      const cOrders = orders.filter(o => o.customer?.id === existingCust.id);
      const cDebt = cOrders.reduce((sum, o) => {
        return sum + (o.total - o.paid_amount);
      }, 0);
      setCustomerDebt(cDebt > 0 ? cDebt : 0);
    } else {
      setCustomerDebt(0);
    }
  }, [customerPhone, orders, customers]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomerPhone(e.target.value);
  };

  const handleCustomerNameChange = (val: string) => {
    setCustomerName(val);
    if (val.length > 0) {
      setShowCustomerSuggestions(true);
    } else {
      setShowCustomerSuggestions(false);
    }
  };

  const selectCustomer = (cust: any) => {
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
    setShowCustomerSuggestions(false);
  };

  const filteredCustomers = customers.filter(c => 
    normalizeArabic(c.name).includes(normalizeArabic(customerName)) ||
    c.phone.includes(customerName)
  ).slice(0, 5);


  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300 overflow-hidden font-sans text-gray-900 dark:text-gray-100">
      
      {/* SUCCESS MODAL */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Banknote size={40} />
              </div>
              <h2 className="text-3xl font-black text-gray-900 dark:text-white mb-2">تم الدفع بنجاح!</h2>
              <p className="text-slate-500 dark:text-slate-400 font-bold mb-6 font-mono text-lg">رقم الفاتورة: #{lastInvoiceId}</p>
              
              <div className="space-y-3">
                {lastCustomerInfo?.phone && (
                  <button 
                    onClick={() => {
                       const sendWhatsApp = (invId: string, customerPhone: string, orderDetails: any) => {
                          if (!customerPhone.trim()) return;
                          let itemsText = orderDetails.cart.map((item: any) => `• ${item.name} (عدد: ${item.quantity}) - ${(item.sale_price * item.quantity).toFixed(2)} ${storeSettings.currency}`).join('\n');
                          const message = `*فاتورة جديدة من ${storeSettings.name}* 🧾\n\n` +
                            `*رقم الفاتورة:* #${invId}\n` +
                            `*التاريخ:* ${new Date().toLocaleString('ar-SA')}\n` +
                            `*الإجمالي:* ${orderDetails.total.toFixed(2)} ${storeSettings.currency}\n\n` +
                            `*تفاصيل الطلب:*\n${itemsText}\n\n` +
                            `${storeSettings.address ? `📍 *العنوان:* ${storeSettings.address}\n` : ''}` +
                            `${storeSettings.phone ? `📞 *للتواصل:* ${storeSettings.phone}\n` : ''}` +
                            `\n*شكراً لتعاملكم معنا، في انتظاركم مرة أخرى!* ❤️\n` +
                            `*ما رأيك في خدمتنا؟ نسعد بتلقي ملاحظاتك.*`;
                          let cleanPhone = customerPhone.replace(/\D/g, '');
                          const code = storeSettings.whatsappCountryCode || '2';
                          
                          // Generic cleaning: if it starts with 0, remove and add code. 
                          // If it doesn't have the code yet, add it.
                          if (cleanPhone.startsWith('0')) {
                            cleanPhone = code + cleanPhone.substring(1);
                          } else if (!cleanPhone.startsWith(code)) {
                            cleanPhone = code + cleanPhone;
                          }

                          const encodedMsg = encodeURIComponent(message);
                          window.open(`https://wa.me/${cleanPhone}?text=${encodedMsg}`, '_blank');
                        };
                        sendWhatsApp(lastInvoiceId, lastCustomerInfo.phone, lastOrderDetails);
                    }}
                    className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all shadow-lg scale-105"
                  >
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    إرسال للفاتورة لواتساب
                  </button>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => printInvoice(lastInvoiceId, lastOrderDetails)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all border border-slate-200"
                  >
                    <Printer size={20} /> إعادة طباعة
                  </button>
                  <button 
                    onClick={() => {
                      setShowSuccessModal(false);
                      clearCart();
                    }}
                    className="flex-1 bg-slate-900 hover:bg-black text-white py-3.5 rounded-2xl font-bold transition-all"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* PAYMENT METHOD MODAL */}
      {isPaymentMethodModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white dark:bg-slate-800 rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-slate-700 animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-gradient-to-l from-indigo-600 to-purple-600 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Banknote size={24} /> اختر طريقة الدفع
              </h2>
              <button 
                onClick={() => setIsPaymentMethodModalOpen(false)} 
                className="hover:bg-white/20 p-2 rounded-full transition"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-8 flex flex-col gap-6">
              <p className="text-slate-500 dark:text-slate-400 text-center font-bold text-base">
                الرجاء اختيار طريقة استلام أو سداد قيمة الفاتورة:
              </p>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={async () => {
                    setIsPaymentMethodModalOpen(false);
                    await doCheckout(checkoutShouldPrint, 'cash');
                  }}
                  className="p-6 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 rounded-3xl border border-slate-200/60 dark:border-slate-600 flex flex-col items-center justify-center gap-3 transition group hover:shadow-lg"
                >
                  <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center transition group-hover:scale-110">
                    <Banknote size={32} />
                  </div>
                  <span className="font-black text-slate-800 dark:text-slate-200 text-lg">نقدي (كاش)</span>
                </button>

                <button
                  onClick={async () => {
                    setIsPaymentMethodModalOpen(false);
                    await doCheckout(checkoutShouldPrint, 'visa');
                  }}
                  className="p-6 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 rounded-3xl border border-slate-200/60 dark:border-slate-600 flex flex-col items-center justify-center gap-3 transition group hover:shadow-lg"
                >
                  <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center transition group-hover:scale-110">
                    <CreditCard size={32} />
                  </div>
                  <span className="font-black text-slate-800 dark:text-slate-200 text-lg">فيزا (بطاقة)</span>
                </button>

                <button
                  onClick={async () => {
                    setIsPaymentMethodModalOpen(false);
                    await doCheckout(checkoutShouldPrint, 'wallet');
                  }}
                  className="p-6 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 rounded-3xl border border-slate-200/60 dark:border-slate-600 flex flex-col items-center justify-center gap-3 transition group hover:shadow-lg"
                >
                  <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center transition group-hover:scale-110">
                    <Smartphone size={32} />
                  </div>
                  <span className="font-black text-slate-800 dark:text-slate-200 text-lg">محفظة إلكترونية</span>
                </button>

                <button
                  onClick={async () => {
                    setIsPaymentMethodModalOpen(false);
                    await doCheckout(checkoutShouldPrint, 'instapay');
                  }}
                  className="p-6 bg-slate-50 hover:bg-slate-100 dark:bg-slate-700/50 dark:hover:bg-slate-700 rounded-3xl border border-slate-200/60 dark:border-slate-600 flex flex-col items-center justify-center gap-3 transition group hover:shadow-lg"
                >
                  <div className="w-14 h-14 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-2xl flex items-center justify-center transition group-hover:scale-110">
                    <Zap size={32} />
                  </div>
                  <span className="font-black text-slate-800 dark:text-slate-200 text-lg">انستا باي (Insta)</span>
                </button>
              </div>

              <button 
                onClick={() => setIsPaymentMethodModalOpen(false)}
                className="w-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 py-3.5 rounded-2xl font-bold transition-all text-center"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showReturnsModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col border border-gray-200 dark:border-slate-700">
            <div className="p-6 bg-gradient-to-r from-red-500 to-orange-500 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <ArrowRightLeft size={24} /> نظام المرتجعات
              </h2>
              <button onClick={() => setShowReturnsModal(false)} className="hover:bg-white/20 p-2 rounded-full transition">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 flex-1 flex flex-col gap-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="أدخل رقم الفاتورة للبحث..." 
                  className="flex-1 bg-gray-100 dark:bg-slate-700 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono text-left"
                  dir="ltr"
                  value={returnSearchQuery}
                  onChange={(e) => setReturnSearchQuery(e.target.value)}
                />
                <button onClick={handleSearchOrder} className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg shrink-0">بحث برقم الفاتورة</button>
              </div>

              {activeReturnOrder && (() => {
                const initialDebt = Math.max(0, activeReturnOrder.total - activeReturnOrder.paid_amount);
                const totalReturnedValue = activeReturnOrder.items.reduce((sum: number, item: any) => sum + (item.returned_quantity * item.sale_price), 0);
                const cashRefund = totalReturnedValue;
                const debtReduction = 0;
                
                return (
                  <>
                    {/* Financial Summary Card */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">إجمالي الفاتورة</span>
                        <span className="text-sm font-black text-slate-800 dark:text-slate-200">{activeReturnOrder.total.toFixed(2)} {storeSettings.currency}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">المبلغ المدفوع</span>
                        <span className="text-sm font-black text-green-600 dark:text-green-400">{activeReturnOrder.paid_amount.toFixed(2)} {storeSettings.currency}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">مديونية الفاتورة</span>
                        <span className="text-sm font-black text-red-600 dark:text-red-400">{initialDebt.toFixed(2)} {storeSettings.currency}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">إجمالي المرتجع</span>
                        <span className="text-sm font-black text-orange-600 dark:text-orange-400">{totalReturnedValue.toFixed(2)} {storeSettings.currency}</span>
                      </div>
                    </div>

                    {/* Action/Result Status */}
                    <div className="flex flex-col gap-2 mb-4">
                      {debtReduction > 0 && (
                        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 p-3 rounded-xl border border-blue-100 dark:border-blue-800/50 flex justify-between items-center text-sm">
                          <span className="font-bold flex items-center gap-2 italic">✓ خصم من مديونية الفاتورة:</span>
                          <span className="font-black text-base">{debtReduction.toFixed(2)} {storeSettings.currency}</span>
                        </div>
                      )}
                      {cashRefund > 0 ? (
                        <div className="bg-emerald-500 text-white p-4 rounded-xl shadow-lg shadow-emerald-200 dark:shadow-none flex justify-between items-center animate-pulse">
                          <div className="flex items-center gap-3">
                            <div className="bg-white/20 p-2 rounded-lg"><Banknote size={24} /></div>
                            <span className="font-black text-lg">المبلغ المستحق رده (كاش):</span>
                          </div>
                          <span className="text-2xl font-black">{cashRefund.toFixed(2)} {storeSettings.currency}</span>
                        </div>
                      ) : initialDebt > 0 && (
                        <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 p-3 rounded-xl border border-orange-100 dark:border-orange-800/50 flex justify-between items-center text-sm italic">
                          <span>المتبقي من مديونية الفاتورة:</span>
                          <span className="font-black">{(initialDebt - totalReturnedValue).toFixed(2)} {storeSettings.currency}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 border border-gray-200 dark:border-slate-700 flex flex-col rounded-xl overflow-hidden">
                      <div className="bg-gray-100 dark:bg-slate-700 p-4 flex justify-between items-center border-b border-gray-200 dark:border-slate-600">
                        <span className="font-bold text-gray-700 dark:text-gray-200 font-mono tracking-wider">الأصناف المتاحة للإرجاع</span>
                        <span className="text-xs font-bold px-2 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600">رقم الفاتورة: #{activeReturnOrder.id}</span>
                      </div>
                      <div className="p-4 space-y-3 max-h-72 overflow-y-auto hide-scrollbar">
                        {activeReturnOrder.items.map((item: any) => (
                          <div key={item.id} className="flex justify-between items-center p-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-600 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex flex-col">
                              <span className="font-bold text-md text-gray-800 dark:text-gray-100">{item.name}</span>
                              <span className="text-sm text-gray-500 dark:text-gray-400 mt-1">الكمية المسجلة: {item.quantity} | المسترجع: <span className="text-red-500 font-bold">{item.returned_quantity}</span></span>
                            </div>
                            <button 
                              disabled={item.quantity === item.returned_quantity}
                              onClick={() => handleReturnItem(item.id)} 
                              className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition border border-red-100 dark:border-red-900/50"
                            >إرجاع</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-slate-900 shadow-2xl z-10 w-2/3">
        <header className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <img src={storeSettings.logo} alt="Logo" className="w-12 h-12 object-cover rounded-xl shadow-md border border-gray-100 dark:border-slate-700 bg-white p-1" />
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black bg-clip-text text-transparent bg-gradient-to-l from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                  {storeSettings.name}
                </h1>
                
                {/* Offline Status Badge */}
                {!isOnline ? (
                  <span className="bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse shadow-sm">
                    🔴 أوفلاين ({offlineQueue.length + offlineReturnsQueue.length} محلياً)
                  </span>
                ) : isSyncing ? (
                  <span className="bg-amber-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    ⏳ جاري الرفع...
                  </span>
                ) : (offlineQueue.length > 0 || offlineReturnsQueue.length > 0) ? (
                  <button 
                    onClick={() => { syncOfflineQueue(); syncOfflineReturnsQueue(); }}
                    className="bg-indigo-600 text-white hover:bg-indigo-700 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 transition shadow-sm"
                  >
                    🔁 مزامنة ({offlineQueue.length + offlineReturnsQueue.length} معاملات)
                  </button>
                ) : (
                  <span className="bg-emerald-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    🟢 متصل
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 flex-1 max-w-lg ml-6">
            <div className="relative w-full">
              <Search className="absolute right-4 top-3.5 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="ابحث باسم المنتج..."
                style={{ '--tw-ring-color': storeSettings.themeColor + '40' } as any}
                className="w-full bg-slate-100 dark:bg-slate-800 dark:text-white border-none rounded-2xl py-3.5 pr-12 pl-4 text-sm focus:outline-none focus:ring-2 shadow-inner transition"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button onClick={() => setShowReturnsModal(true)} className="flex items-center gap-2 px-5 py-3.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 rounded-2xl font-bold transition border border-red-100 dark:border-red-900/30 whitespace-nowrap shadow-sm">
              <RefreshCcw size={18} /> مرتجع
            </button>
            <button onClick={toggleTheme} className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 transition shadow-sm">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Categories Tabs */}
        <div className="flex gap-3 p-5 overflow-x-auto border-b border-gray-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hide-scrollbar items-center">
          <button
            onClick={() => setActiveCategory('all')}
            style={activeCategory === 'all' ? { background: storeSettings.themeColor } : {}}
            className={`px-6 py-2.5 rounded-2xl whitespace-nowrap font-bold transition shadow-sm border ${
              activeCategory === 'all' 
              ? 'text-white border-transparent' 
              : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            الكل
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              style={activeCategory === c.id ? { background: storeSettings.themeColor } : {}}
              className={`px-6 py-2.5 rounded-2xl whitespace-nowrap font-bold transition shadow-sm border ${
                activeCategory === c.id 
                ? 'text-white border-transparent' 
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Product Catalog Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900 border-l border-gray-100 dark:border-slate-800 relative">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.stock_quantity <= 0;
              const isLowStock = product.stock_quantity > 0 && product.stock_quantity < 5;
              
              return (
                <div
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className={`bg-white dark:bg-slate-800 p-5 rounded-3xl shadow-sm hover:shadow-xl cursor-pointer transition-all duration-300 transform hover:-translate-y-1 flex flex-col justify-between h-48 border border-gray-100 dark:border-slate-700 ring-1 ring-black/5 dark:ring-white/5 relative overflow-hidden group ${isOutOfStock ? 'opacity-60 cursor-not-allowed grayscale' : ''}`}
                >
                  <div className={`absolute top-0 right-0 rounded-bl-3xl rounded-tr-xl px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors ${isOutOfStock ? 'bg-slate-500' : isLowStock ? 'bg-red-500' : 'bg-green-500 dark:bg-green-600 group-hover:bg-green-600'}`}>
                    {isOutOfStock ? 'نفذت الكمية' : `المخزون: ${product.stock_quantity}`}
                  </div>

                  <div className="pt-3">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 line-clamp-2 leading-tight text-lg">{product.name}</h3>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 font-mono">{product.barcode}</p>
                  </div>
                  <div className="flex items-end justify-between mt-4">
                    <span style={{ color: storeSettings.themeColor }} className="text-xl font-black dark:opacity-90">{product.sale_price} <span className="text-sm text-gray-500 dark:text-gray-400">{storeSettings.currency}</span></span>
                    <div style={!isOutOfStock ? { backgroundColor: storeSettings.themeColor + '15', color: storeSettings.themeColor, borderColor: storeSettings.themeColor + '30' } : {}} className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all ${isOutOfStock ? 'bg-gray-100 text-gray-400 border-gray-200 dark:bg-slate-700 dark:border-slate-600' : ''}`}>
                      <Plus size={20} strokeWidth={3}/>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-1/3 min-w-[420px] bg-white dark:bg-slate-800 flex flex-col z-20 shadow-2xl relative border-r border-gray-100 dark:border-slate-800">
        <div
          style={{ 
            background: `linear-gradient(160deg, ${storeSettings.themeColor} 0%, ${storeSettings.themeColor}dd 100%)`,
            boxShadow: `0 8px 32px ${storeSettings.themeColor}66`
          }}
          className="p-4 text-white flex flex-col relative h-auto rounded-bl-[40px] gap-3"

        >
          <div className="absolute inset-0 bg-black/20"></div>
          <div className="relative flex justify-between items-center">
             <h2 className="text-xl font-black flex items-center gap-2 drop-shadow">
              <ShoppingCart size={24} />
              الفاتورة
            </h2>
            <div className="flex items-center gap-2">
              <div className="font-mono flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg border border-white/20 text-xs">
                <span className="opacity-80 font-sans">رقم:</span> <span className="font-bold tracking-widest">{activeInvoiceId}</span>
              </div>
              <div className="bg-black/20 px-3 py-1 rounded-lg text-xs font-bold border border-white/20">
                 {cart.length} الأصناف
              </div>
            </div>
          </div>
          <div className="relative flex gap-3 text-sm">
            <div className="flex-1">
              <input 
                type="text" 
                dir="ltr" 
                value={customerPhone} 
                onChange={handlePhoneChange} 
                className="w-full bg-white/95 text-slate-800 placeholder-slate-400 border-0 py-2.5 px-3 rounded-lg focus:ring-2 focus:ring-white focus:outline-none transition font-medium shadow-inner text-sm" 
                placeholder="رقم الموبايل (اختياري)" 
              />
            </div>
            <div className="flex-1 relative">
              <input 
                type="text" 
                value={customerName} 
                onChange={e => handleCustomerNameChange(e.target.value)} 
                onFocus={() => customerName.length > 0 && setShowCustomerSuggestions(true)}
                className="w-full bg-white/95 text-slate-800 placeholder-slate-400 border-0 py-2.5 px-3 rounded-lg focus:ring-2 focus:ring-white focus:outline-none transition font-medium shadow-inner text-sm" 
                placeholder="اسم العميل..." 
              />
              {showCustomerSuggestions && filteredCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden z-[110] animate-in slide-in-from-top-2 duration-200">

                  <div className="p-2 border-b border-gray-50 dark:border-slate-700 text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-gray-50/50 dark:bg-slate-900/50">نتائج البحث</div>
                  {filteredCustomers.map(c => (
                    <button
                      key={c.id}
                      onClick={() => selectCustomer(c)}
                      className="w-full p-3 text-right hover:bg-indigo-50 dark:hover:bg-indigo-900/20 flex items-center justify-between group transition-colors border-b border-gray-50 last:border-0 dark:border-slate-700/50"
                    >
                      <div className="flex flex-col items-start text-left order-2">
                        <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{c.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">{c.phone}</span>
                      </div>
                      <User size={16} className="text-slate-400 group-hover:text-indigo-600 transition-colors order-1" />
                    </button>
                  ))}
                </div>
              )}
              {showCustomerSuggestions && (
                <div className="fixed inset-0 z-[105]" onClick={() => setShowCustomerSuggestions(false)} />
              )}
            </div>

          </div>
          {customerDebt > 0 && (
            <div className="relative bg-black/20 border border-white/20 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-between">
              <span>⚠️ تنبيه: هذا العميل عليه مديونية سابقة</span>
              <span className="bg-white/20 text-white px-2 py-0.5 rounded-md font-mono border border-white/30">{customerDebt.toFixed(2)} {storeSettings.currency}</span>
            </div>
          )}
        </div>

        {/* Cart Listing */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50 dark:bg-slate-900/50" style={{ scrollbarWidth: 'thin' }}>
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 transition-opacity opacity-70">
              <ShoppingCart size={90} className="mb-6 opacity-30 drop-shadow-md" />
              <p className="text-2xl font-semibold">السلة فارغة</p>
              <p className="text-sm mt-2 opacity-70">أضف بعض المنتجات للبدء بحساب الفاتورة.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col gap-3 relative overflow-hidden group hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-gray-800 dark:text-gray-100 leading-tight w-4/5 text-base">{item.name}</h4>
                  <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600 dark:text-red-500 transition-colors bg-red-50 dark:bg-red-900/20 p-2.5 rounded-xl opacity-0 group-hover:opacity-100 absolute left-4 top-4 border border-transparent hover:border-red-100 dark:hover:border-red-900/50">
                    <Trash2 size={18} />
                  </button>
                </div>
                <div className="flex items-center justify-between pt-3 mt-1 border-t border-gray-50 dark:border-slate-700/50">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">سعر الوحدة:</label>
                      <input 
                        type="number"
                        dir="ltr"
                        value={item.sale_price}
                        onChange={(e) => updatePrice(item.id, parseFloat(e.target.value) || 0)}
                        className="w-20 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border-none rounded-lg px-2 py-1 text-sm font-black focus:ring-1 focus:ring-indigo-400 transition text-center"
                      />
                    </div>
                    <span className="font-black text-xl text-indigo-600 dark:text-indigo-400">
                      {(item.sale_price * item.quantity).toFixed(2)} <span className="text-xs text-gray-500">{storeSettings.currency}</span>
                    </span>
                  </div>
                  
                  <div className="flex items-center bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl p-1 shadow-inner">
                    <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-gray-600 dark:text-gray-300 transition-colors shadow-sm">
                      <Minus size={16} strokeWidth={3}/>
                    </button>
                    <span className="w-10 text-center text-base font-bold dark:text-white">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg text-gray-600 dark:text-gray-300 transition-colors shadow-sm">
                      <Plus size={16} strokeWidth={3}/>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>



        {/* Footer Checkout */}
        <div className="p-6 bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-700 z-10">
          <div className="space-y-3 mb-4 bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-gray-100 dark:border-slate-700">
            <div className="flex justify-between text-gray-500 dark:text-gray-400 font-semibold text-sm">
               <span>المجموع الفرعي</span>
              <span>{subtotal.toFixed(2)} {storeSettings.currency}</span>
            </div>

            {/* Discount Row */}
            <div className="flex gap-3 items-center pb-1">
              <label className="text-xs font-bold text-orange-500 whitespace-nowrap flex items-center gap-1">
                🏷️ خصم
              </label>
              <input
                type="number"
                dir="ltr"
                min="0"
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
                placeholder="0.00"
                className="flex-1 bg-white dark:bg-slate-800 border border-orange-200 dark:border-orange-700 py-1.5 px-3 rounded-lg focus:ring-2 focus:ring-orange-400 font-bold text-sm focus:outline-none transition text-left placeholder-gray-300"
              />
              {discount > 0 && (
                <span className="text-orange-500 font-black text-sm whitespace-nowrap">- {discount.toFixed(2)}</span>
              )}
            </div>

            {storeSettings.taxRate > 0 && (
              <div className="flex justify-between text-gray-500 dark:text-gray-400 font-semibold text-sm pb-4 border-b border-gray-200 dark:border-slate-700">
                <span>الضريبة ({storeSettings.taxRate}%)</span>
                <span>{tax.toFixed(2)} {storeSettings.currency}</span>
              </div>
            )}
            <div className="flex justify-between text-3xl font-black text-gray-800 dark:text-gray-100 pt-2 border-b border-gray-200 dark:border-slate-700 pb-4">
              <span>الإجمالي</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                {total.toFixed(2)} <span className="text-lg text-gray-500 dark:text-gray-400 font-bold">{storeSettings.currency}</span>
              </span>
            </div>
            
            <div className="flex gap-4 items-center justify-between pt-2">
              <div className="flex-1">
                <label className="text-xs text-slate-500 mb-1 block font-bold">المدفوع</label>
                <input 
                  type="number"
                  dir="ltr"
                  value={paidAmountStr}
                  onChange={(e) => setPaidAmountStr(e.target.value)}
                  placeholder={total.toFixed(2)}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 py-2 px-3 rounded-lg focus:ring-2 focus:ring-indigo-500 font-bold text-lg focus:outline-none transition text-left" 
                />
              </div>
              <div className="flex-1 text-left">
                <label className="text-xs text-slate-500 mb-1 block font-bold text-left">{remaining > 0 ? 'متبقي للعميل (آجل)' : 'الباقي للعميل'}</label>
                <div className={`text-xl font-bold ${remaining > 0 ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>
                  {Math.abs(remaining).toFixed(2)} <span className="text-sm font-normal">{storeSettings.currency}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCheckoutShouldPrint(false);
                  setIsPaymentMethodModalOpen(true);
                }}
                disabled={cart.length === 0}
                style={cart.length > 0 ? { background: storeSettings.themeColor } : {}}
                className="flex-1 disabled:bg-gray-300 dark:disabled:bg-slate-700 disabled:text-gray-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg disabled:shadow-none text-base"
              >
                <Banknote size={22} />
                تحصيل ودفع
              </button>
              <button
                onClick={() => {
                  setCheckoutShouldPrint(true);
                  setIsPaymentMethodModalOpen(true);
                }}
                disabled={cart.length === 0}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-slate-700 dark:disabled:to-slate-700 disabled:text-gray-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 disabled:shadow-none text-base border border-transparent"
              >
                <Printer size={22} />
                دفع وطباعة
              </button>
            </div>
            <button onClick={clearCart} disabled={cart.length === 0} className="w-full border-2 border-gray-100 dark:border-slate-700 text-gray-500 dark:text-gray-400 disabled:opacity-50 py-3 rounded-2xl font-bold hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 hover:border-red-100 dark:hover:border-red-900/30 transition-all">
              إلغاء الطلب والتفريغ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
