
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, Product, Order } from '../types';
import { generateProductDescription, suggestPrice } from '../services/geminiService';
import { db } from '../services/db';
import MessagesView from './MessagesView';
import FarmerResourcesView from './FarmerResourcesView';
import FarmerWalletView from './FarmerWalletView';

const categories = ['Vegetables', 'Fruits', 'Grains', 'Spices', 'Dairy', 'Others'];
const inputClasses = "w-full px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl border-2 border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:border-emerald-600 outline-none transition-all font-bold";

interface Props {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

const FarmerDashboard: React.FC<Props> = ({ user, onUpdateUser }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'add-product' | 'orders' | 'messages' | 'settings' | 'resources' | 'wallet' | 'logistics'>('overview');
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null); // State for custom delete modal
  const [cancelOrderData, setCancelOrderData] = useState<Order | null>(null); // State for cancelling order
  const [reverseLogisticsItem, setReverseLogisticsItem] = useState({ name: '', quantity: '' }); // State for reverse logistics

  const [newProduct, setNewProduct] = useState({ 
    name: '', price: '', category: 'Vegetables', unit: 'kg', stock: '', description: '', imageUrl: ''
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPricing, setIsPricing] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    const userProducts = await db.products.find({ farmerId: user.id });
    setProducts([...userProducts].sort((a, b) => a.name.localeCompare(b.name)));
    const userOrders = await db.orders.find({ farmerId: user.id });
    setOrders([...userOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
  }, [user.id]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);

    // Handle hash-based navigation from mobile menu
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#farmer-')) {
        const tab = hash.replace('#farmer-', '') as any;
        setActiveTab(tab);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      clearInterval(interval);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [loadData]);

  const handleResetBatch = async () => {
    await db.users.updateOne(user.id, { currentQuantity: 0 });
    onUpdateUser({ currentQuantity: 0 });
    showToast("Batch progress reset for new harvest.");
  };

  const confirmCancelOrder = async () => {
    if (!cancelOrderData) return;
    
    await db.orders.updateOne(cancelOrderData.id, { status: 'cancelled' });

    // Restore stock logic:
    // 1. Restore product stock
    const product = await db.products.findOne({ id: cancelOrderData.productId });
    if (product) {
      await db.products.updateOne(cancelOrderData.productId, { stock: product.stock + cancelOrderData.quantity });
    }
    
    // 2. Reduce batch progress (if it hasn't been reset yet)
    const currentQty = user.currentQuantity || 0;
    const newQty = Math.max(0, currentQty - cancelOrderData.quantity);
    await db.users.updateOne(user.id, { currentQuantity: newQty });
    onUpdateUser({ currentQuantity: newQty });

    showToast("Order cancelled & stock restored.", "error");
    setCancelOrderData(null);
    await loadData();
  };

  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status'] | 'request_driver') => {
    if (newStatus === 'cancelled') {
      const order = await db.orders.findOne({ id: orderId });
      if (order) setCancelOrderData(order);
      return;
    }

    if (newStatus === 'request_driver') {
      await db.orders.updateOne(orderId, { driverRequested: true });
      showToast("Driver requested successfully!");
      await loadData();
      return;
    }

    const order = await db.orders.findOne({ id: orderId });
    if (!order) return;

    await db.orders.updateOne(orderId, { status: newStatus });
    
    if (newStatus === 'confirmed') {
      showToast("Order confirmed successfully!", "success");
    } else if (newStatus === 'delivered') {
      showToast("Order delivered! Batch goal reset.");
      // Auto reset goal after delivery as requested
      await db.users.updateOne(user.id, { currentQuantity: 0 });
      onUpdateUser({ currentQuantity: 0 });
    } else {
      showToast(`Order marked as ${newStatus}`);
    }

    await loadData();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isEditing = false) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        if (isEditing && editingProduct) setEditingProduct({ ...editingProduct, imageUrl: base64String });
        else setNewProduct({ ...newProduct, imageUrl: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProduct.imageUrl) { showToast("Upload a photo.", "error"); return; }
    const product: Product = {
      id: Math.random().toString(36).substr(2, 9),
      farmerId: user.id,
      name: newProduct.name,
      price: parseFloat(newProduct.price),
      category: newProduct.category,
      unit: newProduct.unit,
      stock: parseInt(newProduct.stock) || 0,
      description: newProduct.description || "Fresh harvest.",
      imageUrl: newProduct.imageUrl
    };
    await db.products.insertOne(product);
    setNewProduct({ name: '', price: '', category: 'Vegetables', unit: 'kg', stock: '', description: '', imageUrl: '' });
    setActiveTab('products');
    showToast("Product listed!");
    await loadData();
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProduct) {
      await db.products.updateOne(editingProduct.id, {
        name: editingProduct.name,
        price: editingProduct.price,
        description: editingProduct.description,
        imageUrl: editingProduct.imageUrl,
        stock: editingProduct.stock,
        category: editingProduct.category
      });
      setEditingProduct(null);
      showToast("Updated successfully!");
      await loadData();
    }
  };

  // Replaced native confirm with custom modal trigger
  const requestDelete = (productId: string) => {
    setDeleteId(productId);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await db.products.deleteOne(deleteId);
      setProducts(prev => prev.filter(p => p.id !== deleteId));
      showToast("Product removed permanently", "error");
      await loadData();
    } catch (err) {
      console.error("Delete failed:", err);
      showToast("Error removing product", "error");
    } finally {
      setDeleteId(null);
    }
  };

  const handleMagicDescription = async () => {
    if (!newProduct.name) return;
    setIsGenerating(true);
    const desc = await generateProductDescription(newProduct.name, newProduct.category);
    setNewProduct({ ...newProduct, description: desc });
    setIsGenerating(false);
  };

  const handleAISuggestPrice = async () => {
    if (!newProduct.name) return;
    setIsPricing(true);
    const price = await suggestPrice(newProduct.name);
    setNewProduct({ ...newProduct, price });
    setIsPricing(false);
  };

  const handleReverseLogistics = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseLogisticsItem.name || !reverseLogisticsItem.quantity) return;

    const order: Order = {
      id: Math.random().toString(36).substr(2, 9),
      productId: 'reverse_' + Math.random().toString(36).substr(2, 5),
      productName: reverseLogisticsItem.name,
      farmerId: user.id,
      farmName: user.name,
      buyerId: 'warehouse',
      buyerName: 'Central Warehouse (Return)',
      buyerLocation: 'Warehouse',
      quantity: parseInt(reverseLogisticsItem.quantity),
      totalPrice: 0,
      status: 'confirmed',
      date: new Date().toISOString(),
      driverRequested: true,
      paymentSplit: { farmer: 0, admin: 0, driver: 100, platform: 0 }
    };

    await db.orders.insertOne(order);
    setReverseLogisticsItem({ name: '', quantity: '' });
    showToast("Reverse logistics request sent!");
    await loadData();
  };

  const currentProgress = (user.currentQuantity || 0);
  const threshold = (user.thresholdQuantity || 100);
  const progressPercent = Math.min(100, (currentProgress / threshold) * 100);
  const pendingRequests = orders.filter(o => o.status === 'pending').length;

  const averageRating = orders.filter(o => o.rating).length > 0
    ? (orders.reduce((acc, o) => acc + (o.rating || 0), 0) / orders.filter(o => o.rating).length).toFixed(1)
    : (user.rating?.toFixed(1) || '0.0');

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-65px)] bg-transparent relative">
      {toast && (
        <div className={`fixed top-24 right-4 md:right-10 z-[1000] px-8 py-5 rounded-2xl shadow-2xl animate-in slide-in-from-right-10 border-2 ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'} font-black text-[10px] md:text-xs uppercase tracking-widest`}>
           {toast.message}
        </div>
      )}

      {/* Sidebar Navigation - Desktop Only (Mobile is handled in App.tsx) */}
      <nav className="hidden md:flex flex-col w-72 lg:w-80 bg-white/50 backdrop-blur-sm border-r border-slate-200 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto no-scrollbar p-6">
        <div className="pb-6 px-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">CONTROL ROOM</h3>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { id: 'overview', label: 'Dashboard', icon: 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6z' },
            { id: 'resources', label: 'Resources', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
            { id: 'wallet', label: 'Wallet', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
            { id: 'products', label: 'Inventory', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
            { id: 'add-product', label: 'Add Harvest', icon: 'M12 4v16m8-8H4' },
            { id: 'orders', label: 'Orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2' },
            { id: 'logistics', label: 'Logistics', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
            { id: 'messages', label: 'Chats', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72' },
            { id: 'settings', label: 'Rules', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066' }
          ].map(item => (
            <button 
              key={item.id} 
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-5 px-7 py-5 rounded-[1.8rem] transition-all font-black text-xs uppercase tracking-widest border-2 ${activeTab === item.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-200' : 'bg-white border-transparent text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon}></path></svg>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 w-full overflow-y-auto">
        
        {activeTab === 'overview' && (
          <div className="space-y-6 md:space-y-8 animate-in fade-in duration-500">
             <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] shadow-xl border border-slate-100 flex flex-col lg:flex-row items-center justify-between gap-6 md:gap-8 relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 md:p-8 opacity-5 hidden sm:block"><svg className="w-32 h-32 md:w-48 md:h-48" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></div>
               <div className="space-y-4 md:space-y-6 flex-1 text-center lg:text-left z-10">
                  <h2 className="text-3xl md:text-5xl font-serif text-slate-900 tracking-tight leading-tight">Batch Readiness</h2>
                  <p className="text-slate-500 text-sm md:text-lg font-medium max-w-lg leading-relaxed">Reach your fulfillment goal to trigger direct delivery.</p>
                  <div className="flex flex-wrap gap-3 md:gap-4 justify-center lg:justify-start">
                    <div className="bg-emerald-600 text-white px-6 md:px-10 py-3 md:py-5 rounded-2xl md:rounded-[2rem] font-black shadow-2xl shadow-emerald-200 text-lg md:text-2xl tracking-tighter">
                      {currentProgress} / {threshold} KG
                    </div>
                    {progressPercent >= 100 && (
                      <button onClick={handleResetBatch} className="bg-slate-900 text-white px-6 py-3 rounded-2xl md:rounded-[2rem] font-black text-[10px] md:text-xs uppercase tracking-widest shadow-xl hover:bg-emerald-700 transition-all">Reset Batch</button>
                    )}
                  </div>
               </div>
               <div className="relative w-48 h-48 md:w-80 md:h-80 flex items-center justify-center flex-shrink-0 bg-white rounded-full p-4 md:p-10 shadow-2xl border-4 border-slate-50">
                  <svg className="w-full h-full -rotate-90 overflow-visible" viewBox="0 0 320 320">
                    <circle cx="160" cy="160" r="130" className="stroke-slate-100 fill-none" strokeWidth="28" />
                    <circle cx="160" cy="160" r="130" className="stroke-emerald-500 fill-none transition-all duration-1000" strokeWidth="28" strokeDasharray={`${progressPercent * 8.16} 816`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl md:text-6xl font-black tracking-tighter text-slate-800">{Math.round(progressPercent)}%</span>
                    <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 md:mt-2">GOAL</span>
                  </div>
               </div>
             </div>

             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
               {[
                 { label: 'Rating', val: averageRating, color: 'text-amber-500' },
                 { label: 'Requests', val: pendingRequests, color: 'text-blue-600' },
                 { label: 'Listings', val: products.length, color: 'text-slate-900' },
                 { label: 'Sales', val: orders.filter(o => o.status === 'delivered').length, color: 'text-emerald-600' }
               ].map((stat, i) => (
                 <div key={i} className="bg-white p-6 md:p-10 rounded-2xl md:rounded-[3rem] border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                    <p className="text-slate-400 font-black uppercase text-[8px] md:text-[10px] tracking-widest mb-4 md:mb-6">{stat.label}</p>
                    <p className={`text-2xl md:text-5xl font-black ${stat.color} tracking-tighter`}>{stat.val}</p>
                 </div>
               ))}
             </div>
          </div>
        )}

        {activeTab === 'products' && (
          <div className="space-y-8 md:space-y-12 animate-in fade-in duration-500">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 px-2">
                <div><h2 className="text-3xl md:text-4xl font-serif text-slate-900 tracking-tight leading-tight">Farm Inventory</h2><p className="text-slate-400 font-black text-[9px] md:text-[10px] uppercase tracking-widest mt-2">Active Listings</p></div>
                <button onClick={() => setActiveTab('add-product')} className="w-full sm:w-auto bg-slate-900 text-white font-black px-8 md:px-10 py-4 md:py-5 rounded-2xl md:rounded-[2rem] hover:bg-emerald-600 transition-all text-[10px] md:text-xs uppercase tracking-widest shadow-xl">Add New Harvest</button>
             </div>
             
             {/* REWORKED INVENTORY VIEW */}
             <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 md:gap-8">
                {products.length === 0 ? (
                  <div className="col-span-full py-20 text-center opacity-40 italic font-serif text-xl">No products listed yet. Start adding your harvest.</div>
                ) : (
                  products.map(p => (
                    <div key={p.id} className="bg-[#f1f3f5] rounded-[2.5rem] md:rounded-[4rem] p-4 md:p-6 shadow-sm border border-slate-100 flex flex-col gap-6 md:gap-8 hover:shadow-xl transition-all group overflow-hidden">
                       <div className="flex flex-row items-center gap-6 md:gap-10">
                          {/* Image Thumbnail */}
                          <div className="w-32 h-32 md:w-52 md:h-52 rounded-[2.5rem] md:rounded-[3rem] overflow-hidden bg-white flex-shrink-0 shadow-sm border-2 border-white relative z-10">
                            <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={p.name} />
                          </div>
                          
                          {/* Details */}
                          <div className="flex-1 flex flex-col justify-center min-w-0 py-2">
                             <div className="flex justify-between items-center mb-2">
                                <h3 className="text-2xl md:text-5xl font-serif text-[#2d3748] tracking-tight leading-tight lowercase truncate mr-4">{p.name}</h3>
                                <div className="text-emerald-600 font-black text-2xl md:text-4xl tracking-tighter flex items-start gap-1">
                                  <span className="text-base mt-2">₹</span>{p.price}
                                </div>
                             </div>
                             <p className="text-slate-400 font-medium text-xs md:text-lg italic opacity-80 leading-relaxed mb-1 truncate">"{p.description}"</p>
                             <div className="mt-2 text-xs md:text-sm font-bold text-slate-500">Stock: {p.stock} kg</div>
                          </div>
                       </div>
                       
                       {/* Action Bar - Capsule Style */}
                       <div className="flex items-center gap-4 bg-white/60 backdrop-blur-sm p-2 md:p-3 rounded-[2rem] md:rounded-[3.5rem] border border-white shadow-sm z-0">
                          <button 
                            onClick={() => setEditingProduct(p)} 
                            className="flex-1 bg-white border border-slate-100 text-[#1a202c] font-black text-[10px] md:text-[13px] uppercase tracking-[0.3em] py-4 md:py-6 rounded-[1.8rem] md:rounded-[3rem] transition-all hover:bg-slate-50 active:scale-[0.97] shadow-sm"
                          >
                            Edit Details
                          </button>
                          <button 
                            onClick={() => requestDelete(p.id)} 
                            className="px-8 md:px-14 bg-white border border-red-50 text-[#e53e3e] font-black text-[10px] md:text-[13px] uppercase tracking-[0.3em] py-4 md:py-6 rounded-[1.8rem] md:rounded-[3rem] transition-all hover:bg-red-50 hover:border-red-100 active:scale-[0.97] shadow-sm"
                          >
                            Remove
                          </button>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteId && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[600] flex items-center justify-center p-4">
            <div className="bg-white max-w-sm w-full rounded-[2.5rem] p-8 shadow-2xl border-2 border-white animate-in zoom-in-95 duration-200 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </div>
              <h3 className="text-2xl font-serif text-slate-900 mb-2">Delete Harvest?</h3>
              <p className="text-slate-500 text-sm mb-8">This action cannot be undone. The item will be removed from your inventory.</p>
              <div className="flex gap-4">
                <button onClick={() => setDeleteId(null)} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-colors">Cancel</button>
                <button onClick={confirmDelete} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 transition-colors shadow-lg shadow-red-200">Delete</button>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Order Warning Modal */}
        {cancelOrderData && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[600] flex items-center justify-center p-4">
            <div className="bg-white max-w-sm w-full rounded-[2.5rem] p-8 shadow-2xl border-2 border-white animate-in zoom-in-95 duration-200 text-center">
              <h3 className="text-2xl font-serif text-slate-900 mb-2">Cancel This Order?</h3>
              <p className="text-slate-500 text-sm mb-6">You are about to cancel the order for <strong>{cancelOrderData.buyerName}</strong>. This will restore your stock count.</p>
              <div className="flex gap-4">
                <button onClick={() => setCancelOrderData(null)} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200">Go Back</button>
                <button onClick={confirmCancelOrder} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200">Confirm Cancel</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="animate-in fade-in duration-500">
             <div className="bg-white rounded-2xl md:rounded-[4rem] shadow-2xl border border-slate-100 overflow-hidden">
                <div className="p-6 md:p-10 border-b border-slate-100 bg-emerald-50/20 flex flex-col sm:flex-row justify-between items-center gap-4">
                  <h2 className="text-2xl md:text-3xl font-serif text-slate-900">Orders List</h2>
                  <div className="bg-emerald-600 text-white px-5 py-2 rounded-full font-black text-[9px] md:text-[10px] uppercase tracking-widest">{pendingRequests} Pending</div>
                </div>
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr className="border-b border-slate-100"><th className="px-6 md:px-10 py-4 md:py-6">Buyer Details</th><th className="px-6 md:px-10 py-4 md:py-6">Status</th><th className="px-6 md:px-10 py-4 md:py-6">Action</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                         {orders.length === 0 ? (
                           <tr><td colSpan={3} className="p-10 text-center text-slate-400 italic">No orders received yet.</td></tr>
                         ) : (
                           orders.map(o => (
                             <tr key={o.id} className="hover:bg-slate-50/50 transition-all text-xs md:text-sm">
                                <td className="px-6 md:px-10 py-6 md:py-8">
                                  <p className="font-black text-slate-900 text-base">{o.buyerName}</p>
                                  <p className="text-slate-500 text-xs mt-1 mb-2 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                                    {o.buyerLocation || 'Unknown Location'}
                                  </p>
                                  <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 inline-block px-2 py-1 rounded-md">{o.productName} ({o.quantity}kg)</p>
                                </td>
                                <td className="px-6 md:px-10 py-6 md:py-8"><div className={`inline-flex px-3 py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest ${o.status === 'pending' ? 'bg-amber-100 text-amber-600' : (o.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600')}`}>{o.status}</div></td>
                                <td className="px-6 md:px-10 py-6 md:py-8">
                                   <div className="flex gap-2 flex-wrap">
                                      {o.status === 'pending' && (
                                        <>
                                          <button onClick={() => handleUpdateOrderStatus(o.id, 'confirmed')} className="bg-emerald-600 text-white p-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95">Confirm</button>
                                          <button onClick={() => handleUpdateOrderStatus(o.id, 'cancelled')} className="bg-red-600 text-white p-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-lg active:scale-95">Cancel</button>
                                        </>
                                      )}
                                      {o.status === 'confirmed' && (
                                        <>
                                           <button onClick={() => handleUpdateOrderStatus(o.id, 'delivered')} className="bg-blue-600 text-white p-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-lg">Ship</button>
                                           {!o.driverRequested && (
                                             <button onClick={() => handleUpdateOrderStatus(o.id, 'request_driver')} className="bg-amber-500 text-white p-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-amber-600">Request Driver</button>
                                           )}
                                           {!!o.driverRequested && (
                                             <span className="bg-amber-100 text-amber-700 p-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest">Driver Requested</span>
                                           )}
                                           <button onClick={() => handleUpdateOrderStatus(o.id, 'cancelled')} className="bg-slate-200 text-slate-500 p-2 rounded-lg md:rounded-xl text-[8px] md:text-[9px] font-black uppercase tracking-widest hover:bg-red-100 hover:text-red-500">Cancel</button>
                                        </>
                                      )}
                                      <button onClick={() => setActiveTab('messages')} className="bg-slate-900 text-white p-2 rounded-lg md:rounded-xl"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72"></path></svg></button>
                                   </div>
                                </td>
                             </tr>
                           ))
                         )}
                      </tbody>
                   </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-100">
                  {orders.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 italic">No orders received yet.</div>
                  ) : (
                    orders.map(o => (
                      <div key={o.id} className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-black text-slate-900 text-base">{o.buyerName}</p>
                            <p className="text-slate-500 text-[10px] mt-1 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                              {o.buyerLocation || 'Unknown Location'}
                            </p>
                          </div>
                          <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${o.status === 'pending' ? 'bg-amber-100 text-amber-600' : (o.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600')}`}>
                            {o.status}
                          </div>
                        </div>
                        <p className="text-[10px] text-emerald-600 font-bold bg-emerald-50 inline-block px-2 py-1 rounded-md">{o.productName} ({o.quantity}kg)</p>
                        <div className="flex gap-2 flex-wrap pt-2">
                          {o.status === 'pending' && (
                            <>
                              <button onClick={() => handleUpdateOrderStatus(o.id, 'confirmed')} className="bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg">Confirm</button>
                              <button onClick={() => handleUpdateOrderStatus(o.id, 'cancelled')} className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg">Cancel</button>
                            </>
                          )}
                          {o.status === 'confirmed' && (
                            <>
                               <button onClick={() => handleUpdateOrderStatus(o.id, 'delivered')} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg">Ship</button>
                               {!o.driverRequested && (
                                 <button onClick={() => handleUpdateOrderStatus(o.id, 'request_driver')} className="bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest shadow-lg">Request Driver</button>
                               )}
                               <button onClick={() => handleUpdateOrderStatus(o.id, 'cancelled')} className="bg-slate-200 text-slate-500 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest">Cancel</button>
                            </>
                          )}
                          <button onClick={() => setActiveTab('messages')} className="bg-slate-900 text-white p-2 rounded-lg"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72"></path></svg></button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'add-product' && (
           <div className="bg-white p-6 md:p-12 lg:p-16 rounded-3xl md:rounded-[4rem] shadow-2xl border border-slate-100 animate-in slide-in-from-bottom-10 duration-700 max-w-4xl mx-auto">
              <h2 className="text-3xl md:text-5xl font-serif text-slate-900 tracking-tight mb-8">Harvest Studio</h2>
              <form onSubmit={handleAddProduct} className="space-y-6 md:space-y-8">
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Name</label><input type="text" required className={inputClasses} placeholder="Organic Kashmiri Apple" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} /></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Category</label><select className={inputClasses} value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})}>{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Price (₹)</label><div className="relative"><input type="number" required className={inputClasses} value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} /><button type="button" onClick={handleAISuggestPrice} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-[10px] uppercase">✨ AI</button></div></div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Stock (KG)</label><input type="number" required className={inputClasses} value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} /></div>
                 </div>
                 <div className="space-y-2"><div className="flex justify-between items-center ml-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</label><button type="button" onClick={handleMagicDescription} className="text-emerald-600 font-black text-[10px] uppercase">✨ Magic Write</button></div><textarea className={`${inputClasses} min-h-[100px] md:min-h-[120px]`} value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Photo</label><div onClick={() => fileInputRef.current?.click()} className="h-48 md:h-64 bg-slate-50 border-4 border-dashed border-slate-200 rounded-[2rem] md:rounded-[3rem] overflow-hidden cursor-pointer flex items-center justify-center hover:border-emerald-400 transition-all">{newProduct.imageUrl ? <img src={newProduct.imageUrl} className="w-full h-full object-cover" /> : <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Click to upload</p>}</div><input type="file" hidden ref={fileInputRef} accept="image/*" onChange={(e) => handleImageUpload(e)} /></div>
                 <button type="submit" className="w-full bg-slate-900 text-white font-black py-6 md:py-8 rounded-2xl md:rounded-[2.5rem] hover:bg-emerald-600 transition-all text-lg md:text-xl uppercase tracking-widest shadow-2xl">Publish Harvest</button>
              </form>
           </div>
        )}

        {activeTab === 'logistics' && (
          <div className="space-y-8 animate-in fade-in">
             <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-xl border border-slate-100">
               <h2 className="text-3xl font-serif text-slate-900 mb-6">Reverse Logistics</h2>
               <p className="text-slate-500 mb-8">Request a driver to pick up items from your farm (e.g., empty crates, returns, or waste).</p>
               
               <form onSubmit={handleReverseLogistics} className="bg-slate-50 p-8 rounded-[2rem] border border-slate-200 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Item Description</label>
                       <input type="text" placeholder="e.g. 50 Empty Crates" className={inputClasses} value={reverseLogisticsItem.name} onChange={e => setReverseLogisticsItem({...reverseLogisticsItem, name: e.target.value})} required />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Quantity / Units</label>
                       <input type="number" placeholder="50" className={inputClasses} value={reverseLogisticsItem.quantity} onChange={e => setReverseLogisticsItem({...reverseLogisticsItem, quantity: e.target.value})} required />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className={`w-full font-black py-4 rounded-2xl uppercase tracking-widest transition-all shadow-lg ${
                      orders.some(o => o.buyerId === 'warehouse' && o.status === 'confirmed' && o.driverRequested)
                        ? 'bg-slate-400 text-white cursor-default'
                        : 'bg-slate-900 text-white hover:bg-emerald-600'
                    }`}
                  >
                    {orders.some(o => o.buyerId === 'warehouse' && o.status === 'confirmed' && o.driverRequested) ? 'Requested' : 'Request Driver Pickup'}
                  </button>
               </form>
             </div>

             <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100">
               <h2 className="text-2xl font-serif text-slate-900 mb-6">Active Requests</h2>
               <div className="space-y-4">
                 {orders.filter(o => o.buyerId === 'warehouse').length === 0 ? (
                   <p className="text-slate-400 italic text-center py-8">No active reverse logistics requests.</p>
                 ) : (
                   orders.filter(o => o.buyerId === 'warehouse').map(o => (
                     <div key={o.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <div>
                           <p className="font-bold text-slate-900 text-lg">{o.productName}</p>
                           <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{o.quantity} Units • {new Date(o.date).toLocaleDateString()}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                           <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${o.status === 'confirmed' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                             {o.status === 'confirmed' ? 'Waiting for Driver' : o.status}
                           </span>
                           {!!o.driverRequested && o.status === 'confirmed' && <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Driver Requested</span>}
                        </div>
                     </div>
                   ))
                 )}
               </div>
             </div>
          </div>
        )}

        {activeTab === 'messages' && <MessagesView currentUser={user} />}

        {activeTab === 'resources' && <FarmerResourcesView user={user} />}
        
        {activeTab === 'wallet' && <FarmerWalletView user={user} orders={orders} />}

        {activeTab === 'settings' && (
           <div className="max-w-4xl mx-auto bg-white p-8 md:p-14 rounded-3xl md:rounded-[4rem] shadow-xl border border-slate-200 animate-in fade-in"><h2 className="text-3xl md:text-4xl font-serif text-slate-900 mb-8">Settings</h2><form className="space-y-8" onSubmit={(e) => { e.preventDefault(); onUpdateUser({ deliveryDistance: user.deliveryDistance, thresholdQuantity: user.thresholdQuantity }); showToast("Settings Updated!"); }}><div className="space-y-2 md:space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Radius (KM)</label><input type="number" className={inputClasses} value={user.deliveryDistance} onChange={e => onUpdateUser({ deliveryDistance: parseInt(e.target.value) })} /></div><div className="space-y-2 md:space-y-4"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Goal (KG)</label><input type="number" className={inputClasses} value={user.thresholdQuantity} onChange={e => onUpdateUser({ thresholdQuantity: parseInt(e.target.value) })} /></div><button type="submit" className="w-full bg-slate-900 text-white font-black py-4 md:py-6 rounded-2xl md:rounded-[2rem] hover:bg-emerald-600 transition-all uppercase tracking-widest">Save Rules</button></form></div>
        )}
      </div>

      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[500] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-2xl rounded-3xl md:rounded-[4.5rem] p-8 md:p-14 shadow-2xl border-2 border-slate-100 overflow-y-auto max-h-[90vh]"><div className="flex justify-between items-center mb-8"><h2 className="text-3xl md:text-4xl font-serif text-slate-900">Edit Product</h2><button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-red-500 font-black uppercase text-[10px] tracking-widest">Close</button></div><form onSubmit={handleUpdateProduct} className="space-y-6"><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Name</label><input type="text" className={inputClasses} value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Category</label><select className={inputClasses} value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}>{categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Price (₹)</label><input type="number" className={inputClasses} value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Stock (KG)</label><input type="number" className={inputClasses} value={editingProduct.stock} onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})} /></div><div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Description</label><textarea className={inputClasses} value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} /></div><div onClick={() => editFileInputRef.current?.click()} className="h-48 md:h-64 bg-slate-50 rounded-2xl md:rounded-[3rem] border-2 border-slate-100 overflow-hidden cursor-pointer"><img src={editingProduct.imageUrl} className="w-full h-full object-cover" /></div><input type="file" hidden ref={editFileInputRef} accept="image/*" onChange={(e) => handleImageUpload(e, true)} /><button type="submit" className="w-full bg-emerald-600 text-white font-black py-5 md:py-7 rounded-2xl md:rounded-[2rem] shadow-xl">Save Changes</button></form></div>
        </div>
      )}
    </div>
  );
};

export default FarmerDashboard;
