
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { User, Product, Order, FarmerResource } from '../types';
import { calculateDistance } from '../utils/geo';
import { db } from '../services/db';
import MessagesView from './MessagesView';
import HotelDashboard from './HotelDashboard';

const StarRating: React.FC<{ initialValue?: number, onRate?: (val: number) => void, interactive?: boolean }> = ({ initialValue = 0, onRate, interactive = false }) => {
  const [hover, setHover] = useState(0);
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1">
      {stars.map((star) => (
        <button key={star} type="button" disabled={!interactive} className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-all`} onClick={() => interactive && onRate && onRate(star)} onMouseEnter={() => interactive && setHover(star)} onMouseLeave={() => interactive && setHover(0)}>
          <svg className={`w-5 h-5 ${star <= (hover || initialValue) ? 'text-amber-400 fill-current' : 'text-slate-200 fill-current'}`} viewBox="0 0 24 24">
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
          </svg>
        </button>
      ))}
    </div>
  );
};

interface Props {
  user: User;
  onUpdateUser: (updates: Partial<User>) => void;
}

const BuyerDashboard: React.FC<Props> = ({ user, onUpdateUser }) => {
  const [view, setView] = useState<'marketplace' | 'store' | 'orders' | 'messages' | 'b2b'>('marketplace');
  const [farmers, setFarmers] = useState<User[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [selectedFarmer, setSelectedFarmer] = useState<User | null>(null);
  const [storeProducts, setStoreProducts] = useState<Product[]>([]);
  const [buyerOrders, setBuyerOrders] = useState<Order[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  const [allFarmerResources, setAllFarmerResources] = useState<FarmerResource[]>([]);
  
  // Filters & Sorting
  const [marketFilter, setMarketFilter] = useState<'all' | 'favorites'>('all');
  const [browseMode, setBrowseMode] = useState<'farmers' | 'products'>('farmers');
  const [sortOrder, setSortOrder] = useState<'none' | 'price-asc' | 'price-desc'>('none');
  
  // Modals state
  const [cancelData, setCancelData] = useState<{orderId: string, productId: string, farmerId: string, quantity: number} | null>(null);
  const [ratingData, setRatingData] = useState<{farmerId: string, orderId: string, farmerName: string} | null>(null);
  const [ratingValue, setRatingValue] = useState(5);

  const selectedFarmerIdRef = useRef<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    const allFarmers = await db.users.find({ role: 'farmer' });
    setFarmers(allFarmers);
    
    // Fetch all products for marketplace browse mode
    const marketProducts = await db.products.find({});
    setAllProducts(marketProducts);

    const orders = await db.orders.find({ buyerId: user.id });
    setBuyerOrders(orders.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    
    const fr = await db.farmerResources.find({});
    setAllFarmerResources(fr);

    if (selectedFarmerIdRef.current) {
      const prods = await db.products.find({ farmerId: selectedFarmerIdRef.current });
      setStoreProducts(prods);
    }
  }, [user.id]);

  useEffect(() => {
    loadData();
    const intv = setInterval(loadData, 5000);

    // Handle hash-based navigation from mobile menu
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#buyer-')) {
        const tab = hash.replace('#buyer-', '') as any;
        setView(tab);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    handleHashChange();

    return () => {
      clearInterval(intv);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [loadData]);

  const getLoc = (loc: any) => {
    if (!loc) return null;
    let parsed = loc;
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (e) {}
    }
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed); } catch (e) {}
    }
    return parsed;
  };

  const nearbyFarmers = farmers.filter(f => {
    const hasProducts = allProducts.some(p => p.farmerId === f.id);
    if (!hasProducts) return false;

    const uLoc = getLoc(user.location);
    const fLoc = getLoc(f.location);
    if (!uLoc || !fLoc) return true;
    const dist = calculateDistance(uLoc.lat, uLoc.lng, fLoc.lat, fLoc.lng);
    return dist <= (f.deliveryDistance || 20);
  });

  // Update store products when selected farmer changes
  useEffect(() => {
    if (selectedFarmer) {
      setStoreProducts(allProducts.filter(p => p.farmerId === selectedFarmer.id));
    }
  }, [selectedFarmer, allProducts]);

  // Filter farmers based on tabs
  const displayedFarmers = marketFilter === 'all' 
    ? nearbyFarmers 
    : nearbyFarmers.filter(f => (user.favorites || []).includes(f.id));

  // Filter products based on nearby farmers
  const nearbyProducts = allProducts.filter(p => nearbyFarmers.some(f => f.id === p.farmerId));
  const sortedProducts = [...nearbyProducts].sort((a, b) => {
    // Primary sort: In stock first
    const aInStock = a.stock > 0;
    const bInStock = b.stock > 0;
    if (aInStock && !bInStock) return -1;
    if (!aInStock && bInStock) return 1;

    // Secondary sort: Price
    if (sortOrder === 'price-asc') return a.price - b.price;
    if (sortOrder === 'price-desc') return b.price - a.price;
    return 0;
  });

  const toggleFavorite = async (e: React.MouseEvent, farmerId: string) => {
    e.stopPropagation();
    const currentFavs = user.favorites || [];
    let newFavs: string[];
    
    if (currentFavs.includes(farmerId)) {
      newFavs = currentFavs.filter(id => id !== farmerId);
      showToast("Removed from favorites");
    } else {
      newFavs = [...currentFavs, farmerId];
      showToast("Added to favorites");
    }
    
    onUpdateUser({ favorites: newFavs });
    await db.users.updateOne(user.id, { favorites: newFavs });
  };

  const handleUpdateQty = (product: Product, delta: number) => {
    const currentQty = quantities[product.id] || 1;
    const newQty = currentQty + delta;
    
    if (newQty < 1) return;
    
    if (newQty > product.stock) {
      showToast(`Only ${product.stock}kg available`, 'error');
      return;
    }

    setQuantities(prev => ({
      ...prev,
      [product.id]: newQty
    }));
  };

  const handleBuy = async (p: Product) => {
    // Find the farmer associated with this product
    const productFarmer = farmers.find(f => f.id === p.farmerId);
    
    if (!productFarmer) {
        showToast("Error: Seller information not found.", "error");
        return;
    }

    const qty = quantities[p.id] || 1;
    
    // Double check stock
    const freshProduct = await db.products.findOne({ id: p.id });
    if (!freshProduct || freshProduct.stock < qty) {
      showToast("Not enough stock available", "error");
      await loadData();
      return;
    }

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      productId: p.id,
      productName: p.name,
      farmerId: productFarmer.id,
      farmName: productFarmer.name,
      buyerId: user.id,
      buyerName: user.name,
      buyerLocation: getLoc(user.location)?.address || 'Unknown Location',
      quantity: qty,
      totalPrice: p.price * qty,
      status: 'pending',
      date: new Date().toISOString()
    };
    
    await db.orders.insertOne(newOrder);
    
    // Update farmer's batch readiness progress
    const currentFarmer = await db.users.findOne({ id: productFarmer.id });
    if (currentFarmer) {
      await db.users.updateOne(productFarmer.id, { currentQuantity: (currentFarmer.currentQuantity || 0) + qty });
    }
    
    // Deduct stock
    await db.products.updateOne(p.id, { stock: freshProduct.stock - qty });

    showToast(`Order Placed! Total: ₹${p.price * qty}`);
    setQuantities(prev => ({ ...prev, [p.id]: 1 }));
    setView('orders');
    await loadData();
  };

  const initiateCancel = (order: Order) => {
    setCancelData({
      orderId: order.id,
      productId: order.productId,
      farmerId: order.farmerId,
      quantity: order.quantity
    });
  };

  const confirmCancelOrder = async () => {
    if (!cancelData) return;

    await db.orders.updateOne(cancelData.orderId, { status: 'cancelled' });
    
    // Deduct from farmer's batch progress
    const farmer = await db.users.findOne({ id: cancelData.farmerId });
    if (farmer) {
      const newQty = Math.max(0, (farmer.currentQuantity || 0) - cancelData.quantity);
      await db.users.updateOne(cancelData.farmerId, { currentQuantity: newQty });
    }

    // Restore product stock
    const product = await db.products.findOne({ id: cancelData.productId });
    if (product) {
      await db.products.updateOne(cancelData.productId, { stock: product.stock + cancelData.quantity });
    }

    showToast("Order cancelled", "error");
    setCancelData(null);
    await loadData();
  };

  const initiateRating = (order: Order) => {
    setRatingData({
      farmerId: order.farmerId,
      orderId: order.id,
      farmerName: order.farmName
    });
    setRatingValue(5);
  };

  const submitRating = async () => {
    if (!ratingData) return;
    
    const farmer = await db.users.findOne({ id: ratingData.farmerId });
    if (farmer) {
      const currentRating = farmer.rating || 0;
      const newRating = currentRating === 0 ? ratingValue : (currentRating + ratingValue) / 2;
      
      await db.users.updateOne(ratingData.farmerId, { rating: newRating });
      showToast(`Rated ${ratingData.farmerName} successfully!`);
    }
    
    setRatingData(null);
    await loadData();
  };

  const ProductCard = ({ p, showFarmer = false }: { p: Product, showFarmer?: boolean }) => {
    const qty = quantities[p.id] || 1;
    const totalCost = p.price * qty;
    const isOutOfStock = p.stock <= 0;
    const farmerName = showFarmer ? farmers.find(f => f.id === p.farmerId)?.name : null;

    return (
      <div className={`bg-white rounded-3xl md:rounded-[4rem] overflow-hidden border border-slate-100 shadow-lg group flex flex-col h-full ${isOutOfStock ? 'opacity-70 grayscale' : ''}`}>
        <div className="h-48 md:h-64 overflow-hidden relative">
          <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" alt={p.name} />
          <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-4 py-2 rounded-xl font-black text-emerald-600 shadow-lg">₹{p.price}/kg</div>
          {isOutOfStock ? (
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                <div className="bg-white text-slate-900 px-6 py-3 rounded-full font-black uppercase text-sm tracking-widest shadow-xl transform -rotate-6">Out of Stock</div>
              </div>
          ) : (
              <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-lg font-bold text-white text-xs">{p.stock} kg available</div>
          )}
          {farmerName && (
              <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg font-bold text-white text-[10px] uppercase tracking-wider flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                {farmerName}
              </div>
          )}
        </div>
        <div className="p-6 md:p-10 flex flex-col flex-1">
          <h3 className="text-xl md:text-2xl font-serif text-slate-900 mb-1 md:mb-2">{p.name}</h3>
          <p className="text-slate-500 text-xs md:text-sm mb-4 md:mb-6 line-clamp-2 italic">"{p.description}"</p>
          
          <div className="mt-auto space-y-3 md:space-y-4">
            <div className="bg-slate-50 p-3 md:p-4 rounded-2xl md:rounded-3xl border border-slate-100">
              <div className="flex items-center justify-between mb-2 md:mb-4">
                <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 md:ml-2">Quantity</span>
                <div className="flex items-center gap-2 md:gap-4">
                  <button disabled={isOutOfStock} onClick={() => handleUpdateQty(p, -1)} className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors shadow-sm active:scale-90 font-black disabled:opacity-50">-</button>
                  <span className="text-base md:text-xl font-black text-slate-800 w-6 md:w-8 text-center">{qty}</span>
                  <button disabled={isOutOfStock} onClick={() => handleUpdateQty(p, 1)} className="w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:bg-emerald-50 hover:text-emerald-500 transition-colors shadow-sm active:scale-90 font-black disabled:opacity-50">+</button>
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2 md:pt-3">
                  <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 md:ml-2">Total Cost</span>
                  <span className="text-xl md:text-2xl font-black text-emerald-600">₹{totalCost}</span>
              </div>
            </div>
            
            <button disabled={isOutOfStock} onClick={() => handleBuy(p)} className="w-full bg-slate-900 text-white font-black py-3.5 md:py-6 rounded-xl md:rounded-2xl hover:bg-emerald-600 transition-all uppercase tracking-widest shadow-xl flex items-center justify-center gap-2 md:gap-3 text-xs md:text-base disabled:bg-slate-300 disabled:cursor-not-allowed">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              Place Order
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100vh-65px)] bg-slate-50 relative">
      {toast && (
        <div className={`fixed top-24 right-4 md:right-10 z-[1000] px-8 py-5 rounded-2xl shadow-2xl animate-in slide-in-from-right-10 border-2 ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-red-600 border-red-500 text-white'} font-black text-[10px] md:text-xs uppercase tracking-widest`}>
           {toast.message}
        </div>
      )}

      {/* Desktop Sidebar - Hidden on Mobile */}
      <nav className="hidden md:flex flex-col w-72 lg:w-80 bg-white border-r border-slate-200 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto no-scrollbar p-6">
        <div className="pb-6 px-4">
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">MARKETPLACE</h3>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { id: 'marketplace', label: 'Marketplace', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
            { id: 'orders', label: 'Track Orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2' },
            { id: 'messages', label: 'Messages', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72' },
            { id: 'b2b', label: 'B2B Portal', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
          ].map(item => (
            <button 
              key={item.id} 
              onClick={() => setView(item.id as any)}
              className={`flex items-center gap-5 px-7 py-5 rounded-[1.8rem] transition-all font-black text-xs uppercase tracking-widest border-2 ${view === item.id ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl shadow-emerald-200' : 'bg-white border-transparent text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d={item.icon}></path></svg>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 p-4 md:p-8 lg:p-12 w-full overflow-y-auto">
        {view === 'b2b' && <HotelDashboard user={user} />}

        {view === 'marketplace' && (
          <div className="animate-in fade-in duration-700">
            <div className="flex flex-col xl:flex-row gap-6 mb-8 justify-between items-center bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100">
             <div className="flex bg-slate-100 p-1.5 rounded-2xl self-stretch xl:self-auto">
                <button onClick={() => setBrowseMode('farmers')} className={`flex-1 xl:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${browseMode === 'farmers' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Farms</button>
                <button onClick={() => setBrowseMode('products')} className={`flex-1 xl:flex-none px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${browseMode === 'products' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>Products</button>
             </div>
             
             {browseMode === 'farmers' ? (
                <div className="flex gap-2 w-full xl:w-auto overflow-x-auto no-scrollbar">
                   <button onClick={() => setMarketFilter('all')} className={`flex-shrink-0 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${marketFilter === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-400 border-slate-200'}`}>All Farms</button>
                   <button onClick={() => setMarketFilter('favorites')} className={`flex-shrink-0 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${marketFilter === 'favorites' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-slate-400 border-slate-200'}`}>Favorites</button>
                </div>
             ) : (
                <div className="flex gap-2 w-full xl:w-auto overflow-x-auto no-scrollbar">
                   <button onClick={() => setSortOrder('none')} className={`flex-shrink-0 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${sortOrder === 'none' ? 'bg-slate-200 text-slate-600 border-slate-200' : 'bg-white text-slate-400 border-slate-200'}`}>Newest</button>
                   <button onClick={() => setSortOrder('price-asc')} className={`flex-shrink-0 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${sortOrder === 'price-asc' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200'}`}>Price ↑</button>
                   <button onClick={() => setSortOrder('price-desc')} className={`flex-shrink-0 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${sortOrder === 'price-desc' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-400 border-slate-200'}`}>Price ↓</button>
                </div>
             )}
          </div>

          {browseMode === 'farmers' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-14">
              {displayedFarmers.length === 0 ? (
                <div className="col-span-full py-20 text-center opacity-40 italic font-serif text-xl">{marketFilter === 'favorites' ? 'No favorite farmers yet.' : 'No nearby farmers found. Try updating your location.'}</div>
              ) : (
                displayedFarmers.map(f => {
                  const uLoc = getLoc(user.location);
                  const fLoc = getLoc(f.location);
                  const dist = uLoc && fLoc ? calculateDistance(uLoc.lat, uLoc.lng, fLoc.lat, fLoc.lng) : 0;
                  const progress = ((f.currentQuantity || 0) / (f.thresholdQuantity || 100)) * 100;
                  const isFav = (user.favorites || []).includes(f.id);
                  const hasOrganic = allFarmerResources.some(r => r.farmerId === f.id && r.resourceName?.toLowerCase().includes('organic'));

                  return (
                    <div key={f.id} className="bg-white rounded-3xl md:rounded-[4rem] p-8 md:p-12 shadow-sm border border-slate-100 hover:shadow-2xl transition-all group relative overflow-hidden">
                      <div className="flex justify-between items-start mb-6 md:mb-10 relative z-10">
                        <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-50 rounded-2xl md:rounded-[2.5rem] flex items-center justify-center text-emerald-600 shadow-inner">
                          <svg className="w-8 h-8 md:w-10 md:h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3"></path></svg>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                           <button onClick={(e) => toggleFavorite(e, f.id)} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${isFav ? 'bg-red-50 text-red-500' : 'bg-slate-50 text-slate-300 hover:text-red-400'}`}>
                             <svg className={`w-5 h-5 ${isFav ? 'fill-current' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                           </button>
                           <div className={`px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest ${dist < 10 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{dist < 10 ? 'SAME AREA' : `${dist} KM`}</div>
                           {hasOrganic && (
                             <div className="group relative">
                               <div className="px-4 md:px-5 py-1.5 md:py-2 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest bg-emerald-600 text-white shadow-md cursor-help">100% ORGANIC</div>
                               <div className="absolute right-0 top-full mt-2 w-48 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Transparency Feed</p>
                                 <ul className="space-y-2">
                                   {allFarmerResources.filter(r => r.farmerId === f.id).map(r => (
                                     <li key={r.id} className="text-xs text-slate-600 flex justify-between">
                                       <span>{r.resourceName}</span>
                                       <span className="text-emerald-600 font-bold">✓</span>
                                     </li>
                                   ))}
                                 </ul>
                               </div>
                             </div>
                           )}
                        </div>
                      </div>
                      <h3 className="text-2xl md:text-3xl font-serif text-slate-900 mb-2 truncate">{f.name}</h3>
                      <div className="mb-6 md:mb-8"><StarRating initialValue={Math.round(f.rating || 0)} /></div>
                      <div className="bg-slate-50 p-4 md:p-6 rounded-2xl md:rounded-[2.5rem] mb-8 md:mb-10 border border-slate-100">
                         <div className="flex justify-between text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3"><span>Batch Readiness</span><span>{Math.round(progress)}%</span></div>
                         <div className="w-full bg-slate-200 h-2.5 md:h-3 rounded-full overflow-hidden"><div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${Math.min(100, progress)}%` }}></div></div>
                      </div>
                      <button onClick={() => { setSelectedFarmer(f); selectedFarmerIdRef.current = f.id; setView('store'); }} className="w-full bg-slate-900 text-white font-black py-5 md:py-7 rounded-2xl md:rounded-[2rem] hover:bg-emerald-600 transition-all text-base md:text-lg uppercase tracking-widest shadow-xl">Browse Store</button>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
              {sortedProducts.length === 0 ? (
                <div className="col-span-full py-20 text-center opacity-40 italic font-serif text-xl">No products available in your area.</div>
              ) : (
                sortedProducts.map(p => (
                  <ProductCard key={p.id} p={p} showFarmer={true} />
                ))
              )}
            </div>
          )}
        </div>
      )}

      {view === 'store' && selectedFarmer && (
        <div className="space-y-8 md:space-y-12 animate-in slide-in-from-bottom-20 duration-700">
           <button onClick={() => setView('marketplace')} className="glass px-6 md:px-8 py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-[10px] md:text-xs uppercase text-slate-400 hover:text-emerald-600 flex items-center gap-2">
             <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
             Back to Market
           </button>
           <h2 className="text-4xl md:text-6xl font-serif text-slate-900 tracking-tight">{selectedFarmer.name}</h2>
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
              {storeProducts.length === 0 ? (
                <div className="col-span-full py-20 text-center text-slate-400 italic font-serif text-2xl">No items listed by this farmer yet.</div>
              ) : (
                storeProducts.map(p => (
                   <ProductCard key={p.id} p={p} />
                ))
              )}
           </div>
        </div>
      )}

      {view === 'orders' && (
        <div className="bg-white rounded-2xl md:rounded-[4rem] shadow-2xl border border-slate-100 overflow-hidden">
           <div className="p-8 md:p-16 bg-emerald-50/20 text-center"><h2 className="text-3xl md:text-5xl font-serif text-slate-900">Track Harvest</h2><p className="text-slate-400 font-black uppercase text-[9px] md:text-[10px] tracking-widest mt-3 md:mt-5">Direct Supply Chain</p></div>
           
           {/* Desktop Table */}
           <div className="hidden md:block overflow-x-auto">
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest"><tr><th className="px-6 md:px-16 py-4 md:py-8">Produce</th><th className="px-6 md:px-16 py-4 md:py-8">Status</th><th className="px-6 md:px-16 py-4 md:py-8 text-right">Settlement</th><th className="px-6 md:px-16 py-4 md:py-8">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {buyerOrders.length === 0 ? (
                    <tr><td colSpan={4} className="p-10 text-center text-slate-400 italic">No orders tracked yet.</td></tr>
                  ) : (
                    buyerOrders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50/50">
                        <td className="px-6 md:px-16 py-8 md:py-12"><div><p className="font-serif text-slate-900 text-2xl md:text-3xl">{o.productName}</p><p className="text-emerald-600 font-black text-[8px] md:text-[9px] uppercase tracking-widest mt-1 md:mt-2">{o.farmName} • {o.quantity}kg</p></div></td>
                        <td className="px-6 md:px-16 py-8 md:py-12"><div className={`inline-flex px-3 md:px-4 py-1.5 rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest ${o.status === 'pending' ? 'bg-amber-100 text-amber-600' : (o.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600')}`}>{o.status}</div></td>
                        <td className="px-6 md:px-16 py-8 md:py-12 text-right font-black text-xl md:text-2xl text-slate-900">₹{o.totalPrice}</td>
                        <td className="px-6 md:px-16 py-8 md:py-12">
                          {(o.status === 'pending' || o.status === 'confirmed') && (
                            <button onClick={() => initiateCancel(o)} className="bg-red-50 text-red-500 font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all shadow-sm">Cancel</button>
                          )}
                          {o.status === 'delivered' && (
                            <button onClick={() => initiateRating(o)} className="ml-2 bg-amber-50 text-amber-500 font-black px-4 py-2 rounded-xl text-[9px] uppercase tracking-widest border border-amber-100 hover:bg-amber-500 hover:text-white transition-all shadow-sm">Rate</button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
             </table>
           </div>

           {/* Mobile Cards */}
           <div className="md:hidden divide-y divide-slate-100">
             {buyerOrders.length === 0 ? (
               <div className="p-10 text-center text-slate-400 italic">No orders tracked yet.</div>
             ) : (
               buyerOrders.map(o => (
                 <div key={o.id} className="p-6 space-y-4">
                   <div className="flex justify-between items-start">
                     <div>
                       <p className="font-serif text-slate-900 text-xl">{o.productName}</p>
                       <p className="text-emerald-600 font-black text-[8px] uppercase tracking-widest mt-1">{o.farmName} • {o.quantity}kg</p>
                     </div>
                     <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${o.status === 'pending' ? 'bg-amber-100 text-amber-600' : (o.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600')}`}>
                       {o.status}
                     </div>
                   </div>
                   <div className="flex justify-between items-center">
                     <p className="font-black text-lg text-slate-900">₹{o.totalPrice}</p>
                     <div className="flex gap-2">
                       {(o.status === 'pending' || o.status === 'confirmed') && (
                         <button onClick={() => initiateCancel(o)} className="bg-red-50 text-red-500 font-black px-3 py-1.5 rounded-lg text-[8px] uppercase tracking-widest border border-red-100">Cancel</button>
                       )}
                       {o.status === 'delivered' && (
                         <button onClick={() => initiateRating(o)} className="bg-amber-50 text-amber-500 font-black px-3 py-1.5 rounded-lg text-[8px] uppercase tracking-widest border border-amber-100">Rate</button>
                       )}
                     </div>
                   </div>
                 </div>
               ))
             )}
           </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[600] flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white max-w-sm w-full rounded-[2.5rem] p-8 shadow-2xl border-2 border-white text-center">
             <h3 className="text-2xl font-serif text-slate-900 mb-2">Cancel Order?</h3>
             <p className="text-slate-500 text-sm mb-8">This will restore the farmer's stock and remove this order.</p>
             <div className="flex gap-4">
                <button onClick={() => setCancelData(null)} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200">Keep It</button>
                <button onClick={confirmCancelOrder} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-xs uppercase tracking-widest hover:bg-red-700 shadow-lg shadow-red-200">Yes, Cancel</button>
             </div>
           </div>
        </div>
      )}

      {/* Rating Modal */}
      {ratingData && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[600] flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="bg-white max-w-sm w-full rounded-[2.5rem] p-8 shadow-2xl border-2 border-white text-center">
             <h3 className="text-2xl font-serif text-slate-900 mb-2">Rate Experience</h3>
             <p className="text-slate-500 text-sm mb-6">How was your order from {ratingData.farmerName}?</p>
             <div className="flex justify-center mb-8">
               <StarRating initialValue={ratingValue} onRate={setRatingValue} interactive />
             </div>
             <div className="flex gap-4">
                <button onClick={() => setRatingData(null)} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-xs uppercase tracking-widest hover:bg-slate-200">Later</button>
                <button onClick={submitRating} className="flex-1 py-4 rounded-2xl bg-emerald-600 text-white font-black text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-200">Submit</button>
             </div>
           </div>
        </div>
      )}

      {view === 'messages' && <MessagesView currentUser={user} />}
      </div>
    </div>
  );
};

export default BuyerDashboard;
