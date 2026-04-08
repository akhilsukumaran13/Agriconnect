
import React, { useState, useEffect, useCallback } from 'react';
import { User, Role, Product, Order, Location } from './types';
import LoginView from './views/Login';
import FarmerDashboard from './views/FarmerDashboard';
import BuyerDashboard from './views/BuyerDashboard';
import AdminDashboard from './views/AdminDashboard';
import DriverDashboard from './views/DriverDashboard';
import { getAddressFromCoords, getCoordsFromAddress } from './services/geminiService';
import { db } from './services/db';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [showManualLoc, setShowManualLoc] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [showMobileLocation, setShowMobileLocation] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleLocationClick = () => {
    if (userLocation) {
      setShowMobileLocation(!showMobileLocation);
      // Auto-hide after 5 seconds
      if (!showMobileLocation) {
        setTimeout(() => setShowMobileLocation(false), 5000);
      }
    } else {
      fetchLocation(true);
    }
  };
  
  const updateLocationState = async (loc: Location) => {
    setUserLocation(loc);
    if (currentUser) {
      await db.users.updateOne(currentUser.id, { location: loc });
      const updated = { ...currentUser, location: loc };
      setCurrentUser(updated);
      localStorage.setItem('agro_user', JSON.stringify(updated));
    }
  };

  const fetchLocation = useCallback(async (force = false) => {
    if (!force && userLocation) return;
    
    if (!("geolocation" in navigator)) {
      setLocationError("Geolocation not supported");
      setShowManualLoc(true);
      return;
    }
    
    setIsLocating(true);
    setLocationError(null);

    const options = {
      timeout: 15000,
      enableHighAccuracy: true,
      maximumAge: 0
    };

    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const loc = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        const address = await getAddressFromCoords(loc.lat, loc.lng);
        const finalLoc = { ...loc, address };
        await updateLocationState(finalLoc);
        setShowManualLoc(false);
      } catch (err) {
        setLocationError("Address resolution failed");
        setShowManualLoc(true);
      } finally {
        setIsLocating(false);
      }
    }, (err) => {
      setIsLocating(false);
      setShowManualLoc(true);
      setLocationError("Permission denied or timeout");
    }, options);
  }, [currentUser, userLocation]);

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

  useEffect(() => {
    const checkAuth = async () => {
      const savedUser = localStorage.getItem('agro_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          if (parsed && parsed.id) {
            const actualUser = await db.users.findOne({ id: parsed.id });
            if (actualUser && actualUser.id === parsed.id) {
              setCurrentUser(actualUser);
              setIsLoggedIn(true);
              if (actualUser.location) {
                setUserLocation(getLoc(actualUser.location));
              }
              return;
            }
          }
        } catch (e) {
          console.error("Auth check failed", e);
        }
        // If we get here, the saved user was invalid or not found
        localStorage.removeItem('agro_user');
      }
    };
    checkAuth();
  }, []);

  // Periodic refresh logic in a separate effect to handle dependencies correctly
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.id) return;

    const interval = setInterval(async () => {
      try {
        const actualUser = await db.users.findOne({ id: currentUser.id });
        if (actualUser && actualUser.id === currentUser.id) {
          setCurrentUser(prev => {
            if (!prev) return actualUser;
            
            const hasChanged = 
              prev.materialDebt !== actualUser.materialDebt || 
              prev.trustScore !== actualUser.trustScore || 
              prev.currentQuantity !== actualUser.currentQuantity ||
              prev.walletBalance !== actualUser.walletBalance ||
              prev.role !== actualUser.role ||
              prev.name !== actualUser.name;

            if (hasChanged) {
              localStorage.setItem('agro_user', JSON.stringify(actualUser));
              return actualUser;
            }
            return prev;
          });
        }
      } catch (err) {
        console.error("Periodic refresh failed:", err);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isLoggedIn, currentUser?.id]);

  useEffect(() => {
    if (isLoggedIn && !userLocation && !isLocating) {
      fetchLocation();
    }
  }, [isLoggedIn, userLocation, isLocating, fetchLocation]);

  const handleManualLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualAddress.trim()) return;
    setIsLocating(true);
    try {
      const coords = await getCoordsFromAddress(manualAddress);
      const finalLoc = { ...coords, address: manualAddress };
      await updateLocationState(finalLoc);
      setShowManualLoc(false);
    } catch (err) {
      setLocationError("Location not found");
    } finally {
      setIsLocating(false);
    }
  };

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
    localStorage.setItem('agro_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsLoggedIn(false);
    setUserLocation(null);
    localStorage.removeItem('agro_user');
  };

  const updateCurrentUser = async (updates: Partial<User>) => {
    if (currentUser) {
      await db.users.updateOne(currentUser.id, updates);
      const updated = { ...currentUser, ...updates };
      setCurrentUser(updated);
      localStorage.setItem('agro_user', JSON.stringify(updated));
    }
  };

  if (!isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen flex flex-col font-sans text-slate-900 bg-slate-50 relative">
      {/* Global Dashboard Background - Subtle Crop Pattern */}
      <div className="fixed inset-0 z-0">
        <img 
            src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?q=80&w=1770&auto=format&fit=crop" 
            className="w-full h-full object-cover opacity-[0.03]" 
            alt="Agriculture Pattern" 
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50/80 to-slate-100/50 pointer-events-none"></div>
      </div>
      
      {/* Blurred top region */}
      <div className="fixed top-0 left-0 right-0 h-24 backdrop-blur-md z-40 pointer-events-none"></div>

      <header className="bg-white/90 backdrop-blur-xl border border-slate-200/80 sticky top-16 z-50 mx-4 rounded-2xl px-4 py-3 flex items-center justify-between shadow-sm transition-all relative">
        <div className="flex items-center gap-2 md:gap-3">
          <button 
            onClick={() => setShowMobileMenu(true)}
            className="md:hidden p-2 -ml-2 text-slate-600 hover:text-emerald-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="bg-white p-1.5 md:p-2 rounded-2xl shadow-lg shadow-emerald-200/20 border border-slate-100 transform hover:scale-105 transition-transform duration-300">
            {/* Custom AgriConnect Logo: Orange Arch + Green Plant + Dot */}
            <svg className="w-5 h-5 md:w-8 md:h-8" viewBox="0 0 24 24" fill="none">
              <path d="M5 18c-3-3-3-8 0-11 3-3 8-3 11 0" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M12 21v-8" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M12 14c-3-3-5-1-5 2s2 3 5-2z" fill="#10B981" />
              <path d="M12 14c3-3 5-1 5 2s-2 3-5-2z" fill="#10B981" />
              <circle cx="17" cy="9" r="2" fill="#F59E0B" />
            </svg>
          </div>
          <h1 className="text-xl md:text-2xl font-serif font-black text-slate-800 tracking-tight block">
            Agri<span className="text-[#F59E0B]">co</span>nnect
          </h1>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6 relative">
          <button 
            onClick={handleLocationClick}
            disabled={isLocating}
            className={`group hidden md:flex items-center gap-2 md:gap-3 text-[10px] md:text-xs font-black uppercase tracking-widest transition-all px-3 py-2 md:px-4 md:py-2.5 rounded-xl border relative ${isLocating ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-white text-slate-500 hover:border-emerald-200 hover:text-emerald-700 hover:shadow-md border-slate-200'}`}
          >
            <svg className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isLocating ? 'animate-spin' : 'text-emerald-500 group-hover:scale-110 transition-transform'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
            <span className="truncate max-w-[80px] md:max-w-[160px]">
              {isLocating ? 'Locating...' : (userLocation?.address || 'Set Location')}
            </span>
            {/* Location Info Popup */}
            {showMobileLocation && userLocation && (
              <div className="absolute top-full right-0 mt-3 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 animate-in fade-in slide-in-from-top-2 z-[100]">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-50 p-2 rounded-lg">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Current Location</p>
                    <p className="text-xs font-bold text-slate-700 leading-relaxed">{userLocation.address}</p>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowManualLoc(true);
                        setShowMobileLocation(false);
                      }}
                      className="mt-3 text-[9px] font-black text-emerald-600 uppercase tracking-widest hover:underline"
                    >
                      Change Location
                    </button>
                  </div>
                </div>
                <div className="absolute -top-1.5 right-6 w-3 h-3 bg-white border-t border-l border-slate-100 rotate-45"></div>
              </div>
            )}
          </button>

          <div className="hidden md:flex items-center gap-2 md:gap-5 md:border-l-2 md:border-slate-100 md:pl-6">
            <div className="text-right">
              <p className="text-xs md:text-sm font-black text-slate-800 tracking-tight leading-none mb-0.5 md:mb-1 max-w-[80px] sm:max-w-none truncate">
                {currentUser?.name}
              </p>
              <p className="inline-block text-[9px] font-black text-emerald-600 uppercase tracking-widest leading-none bg-emerald-50 px-1.5 py-0.5 rounded">{currentUser?.role}</p>
            </div>
            <button onClick={handleLogout} className="w-9 h-9 md:w-11 md:h-11 flex items-center justify-center bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 transition-all rounded-xl border border-slate-200 hover:border-red-200 shadow-sm active:scale-95" title="Logout">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Sidebar Menu */}
      {showMobileMenu && (
        <>
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] md:hidden animate-in fade-in duration-300"
            onClick={() => setShowMobileMenu(false)}
          />
          <div className="fixed inset-y-0 left-0 w-80 bg-white z-[110] md:hidden flex flex-col shadow-2xl animate-in slide-in-from-left duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black">
                  {currentUser?.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-slate-900 leading-tight">{currentUser?.name}</p>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{currentUser?.role}</p>
                </div>
              </div>
              <button onClick={() => setShowMobileMenu(false)} className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {/* Location in Sidebar for Mobile */}
              <div className="space-y-3">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Current Location</p>
                <button 
                  onClick={() => { setShowManualLoc(true); setShowMobileMenu(false); }}
                  className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left hover:bg-emerald-50 transition-colors"
                >
                  <div className="bg-white p-2 rounded-lg shadow-sm">
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-700 truncate">{userLocation?.address || 'Set Location'}</p>
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-0.5">Change Location</p>
                  </div>
                </button>
              </div>

              {/* Role Specific Navigation */}
              {currentUser?.role === 'farmer' && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Control Room</p>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { id: 'overview', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                      { id: 'products', label: 'Inventory', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
                      { id: 'resources', label: 'Resources', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
                      { id: 'orders', label: 'Orders', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
                      { id: 'wallet', label: 'Wallet', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
                      { id: 'logistics', label: 'Logistics', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                      { id: 'messages', label: 'Chats', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          window.location.hash = `farmer-${item.id}`;
                          setShowMobileMenu(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-bold"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                        </svg>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentUser?.role === 'buyer' && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Marketplace</p>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { id: 'marketplace', label: 'Marketplace', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
                      { id: 'orders', label: 'Track Orders', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2' },
                      { id: 'messages', label: 'Messages', icon: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72' },
                      { id: 'b2b', label: 'B2B Portal', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          window.location.hash = `buyer-${item.id}`;
                          setShowMobileMenu(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-bold"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                        </svg>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {currentUser?.role === 'admin' && (
                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Command Center</p>
                  <div className="grid grid-cols-1 gap-1">
                    {[
                      { id: 'resources', label: 'Resources', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
                      { id: 'logistics', label: 'Logistics', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
                      { id: 'financial', label: 'Financial', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
                      { id: 'farmers', label: 'Farmers', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          window.location.hash = `admin-${item.id}`;
                          setShowMobileMenu(false);
                        }}
                        className="w-full flex items-center gap-4 p-4 rounded-2xl text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-all font-bold"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                        </svg>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-100">
              <button 
                onClick={() => { handleLogout(); setShowMobileMenu(false); }}
                className="w-full flex items-center justify-center gap-3 bg-red-50 text-red-600 font-black py-4 rounded-2xl border border-red-100 hover:bg-red-600 hover:text-white transition-all uppercase tracking-widest text-xs"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                Logout Account
              </button>
            </div>
          </div>
        </>
      )}

      {showManualLoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl animate-in zoom-in duration-300 border border-white/50">
            <h2 className="text-2xl md:text-3xl font-serif text-slate-900 tracking-tight mb-6 text-center">Set Location</h2>
            <form onSubmit={handleManualLocation} className="space-y-6">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Search Area</label>
                 <input 
                  type="text" placeholder="e.g. Nashik, Maharashtra" 
                  className="w-full px-6 py-4 rounded-2xl border-2 border-slate-100 font-bold focus:border-emerald-600 outline-none text-lg"
                  value={manualAddress} onChange={e => setManualAddress(e.target.value)} required
                 />
               </div>
               {locationError && <p className="text-red-500 text-[10px] font-bold uppercase text-center">{locationError}</p>}
               <div className="flex flex-col gap-3">
                  <button type="submit" disabled={isLocating} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:bg-emerald-600 transition-all uppercase tracking-widest text-xs">
                    Update Manually
                  </button>
                  <button 
                    type="button" 
                    onClick={() => fetchLocation(true)} 
                    disabled={isLocating}
                    className="w-full bg-emerald-50 text-emerald-700 font-black py-4 rounded-2xl border border-emerald-100 hover:bg-emerald-100 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    <svg className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                    {isLocating ? 'Locating...' : 'Detect Automatically'}
                  </button>
                  <button type="button" onClick={() => setShowManualLoc(false)} className="w-full text-slate-400 font-black py-2 uppercase tracking-widest text-[10px] hover:text-slate-600">Cancel</button>
               </div>
            </form>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-x-hidden relative z-10">
        {currentUser?.role === 'farmer' ? (
          <div className="mt-20">
            <FarmerDashboard user={currentUser} onUpdateUser={updateCurrentUser} />
          </div>
        ) : currentUser?.role === 'admin' ? (
          <div className="mt-20">
            <AdminDashboard user={currentUser} />
          </div>
        ) : currentUser?.role === 'driver' ? (
          <div className="mt-20">
            <DriverDashboard user={currentUser} />
          </div>
        ) : (
          <div className="mt-20">
            <BuyerDashboard user={currentUser!} onUpdateUser={updateCurrentUser} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
