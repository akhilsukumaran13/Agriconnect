
import React, { useState } from 'react';
import { User, Role } from '../types';
import { db } from '../services/db';

interface LoginProps {
  onLogin: (user: User) => void;
}

const LoginView: React.FC<LoginProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [role, setRole] = useState<Role>('buyer');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  const inputClasses = "w-full px-5 py-3 md:px-6 md:py-4 rounded-xl md:rounded-2xl border-2 border-slate-200 bg-slate-50/50 text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all font-bold text-base md:text-lg";

  const handleStartRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    const existing = await db.users.findOne({ email: formData.email });
    if (existing) {
      setError('An account with this email already exists.');
      return;
    }

    setIsSendingSms(true);
    setTimeout(() => {
      setIsSendingSms(false);
      setIsVerifying(true);
    }, 1500);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verificationCode === '123456') {
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        name: formData.name,
        email: formData.email.toLowerCase().trim(),
        phone: formData.phone,
        password: formData.password,
        role: role,
        favorites: [],
        rating: role === 'farmer' ? 0.0 : undefined,
        deliveryDistance: role === 'farmer' ? 15 : undefined,
        thresholdQuantity: role === 'farmer' ? 50 : undefined,
        currentQuantity: role === 'farmer' ? 0 : undefined,
        location: { address: 'Kerala, India', lat: 9.2648, lng: 76.5511 } // Default location so they appear on the map
      };

      await db.users.insertOne(newUser);
      onLogin(newUser);
    } else {
      setError('Invalid code. Use 123456.');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const user = await db.login(
      formData.email.toLowerCase().trim(), 
      formData.password 
    );
    
    if (user) {
      onLogin(user);
    } else {
      setError('Invalid credentials.');
    }
  };

  if (isSendingSms) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
           <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop" className="w-full h-full object-cover blur-sm" alt="Background" />
           <div className="absolute inset-0 bg-white/80 backdrop-blur-md"></div>
        </div>
        <div className="text-center space-y-6 relative z-10">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-900 font-bold uppercase tracking-widest text-[10px]">VERIFYING SECURITY...</p>
        </div>
      </div>
    );
  }

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-[#F8FAF9] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 z-0">
           <img src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop" className="w-full h-full object-cover" alt="Background" />
           <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"></div>
        </div>
        <div className="max-w-md w-full bg-white/95 backdrop-blur-xl rounded-[2rem] shadow-2xl p-8 space-y-8 border border-white/50 relative z-10">
          <div className="text-center">
            <h2 className="text-2xl font-serif text-slate-900 mb-2">Security Code</h2>
            <p className="text-slate-500 text-sm font-medium leading-relaxed">Sent to <span className="text-emerald-600 font-bold">{formData.phone}</span></p>
          </div>
          <form onSubmit={handleVerify} className="space-y-6">
            <input 
              type="text" maxLength={6} required
              className="w-full text-center text-3xl tracking-[0.2em] font-black py-5 rounded-2xl border-2 border-slate-200 bg-slate-50 focus:border-emerald-500 outline-none"
              placeholder="000000"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
            <button className="w-full bg-emerald-600 text-white font-bold py-4 rounded-xl shadow-xl hover:bg-emerald-700 transition-all text-base uppercase tracking-widest">
              Confirm
            </button>
          </form>
          <div className="text-center">
             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">DEMO CODE: 123456</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Image - Green Field Sunset */}
      <div className="absolute inset-0 z-0">
        <img 
            src="https://images.unsplash.com/photo-1500382017468-9049fed747ef?q=80&w=2832&auto=format&fit=crop" 
            className="w-full h-full object-cover animate-in fade-in duration-1000 scale-105" 
            alt="Agriculture Background" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/50 to-emerald-900/30 backdrop-blur-[2px]"></div>
      </div>

      <div className="max-w-lg w-full bg-white/90 backdrop-blur-2xl rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] p-8 md:p-12 space-y-8 md:space-y-10 relative z-10 border border-white/40 overflow-hidden">
        
        <div className="text-center">
          <div className="mx-auto w-24 h-24 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-2xl shadow-emerald-500/20 transform hover:scale-110 transition-transform duration-500 relative overflow-hidden group">
             {/* Logo Container Background Accent */}
             <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/50 to-amber-50/50 opacity-50 group-hover:opacity-100 transition-opacity"></div>
             {/* Brand Logo */}
             <svg className="w-14 h-14 relative z-10" viewBox="0 0 24 24" fill="none">
                 <path d="M5 18c-3-3-3-8 0-11 3-3 8-3 11 0" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
                 <path d="M12 21v-8" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" />
                 <path d="M12 14c-3-3-5-1-5 2s2 3 5-2z" fill="#10B981" />
                 <path d="M12 14c3-3 5-1 5 2s-2 3-5-2z" fill="#10B981" />
                 <circle cx="17" cy="9" r="2" fill="#F59E0B" />
             </svg>
          </div>
          <h2 className="text-4xl font-serif text-slate-900 tracking-tight">
            Agri<span className="text-[#F59E0B]">co</span>nnect
          </h2>
          <p className="text-emerald-800 font-black uppercase text-[9px] tracking-[0.4em] mt-3">Cultivating Connections</p>
        </div>

        {isRegistering && (
          <div className="flex bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/50">
            <button onClick={() => setRole('buyer')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${role === 'buyer' ? 'bg-white shadow-md text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>BUYER</button>
            <button onClick={() => setRole('farmer')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${role === 'farmer' ? 'bg-white shadow-md text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>FARMER</button>
            <button onClick={() => setRole('driver')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${role === 'driver' ? 'bg-white shadow-md text-emerald-700' : 'text-slate-500 hover:text-slate-700'}`}>DRIVER</button>
          </div>
        )}

        <form onSubmit={isRegistering ? handleStartRegistration : handleLogin} className="space-y-4 md:space-y-6">
          {error && <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-xs font-black border border-red-100 flex items-center gap-2 animate-in slide-in-from-top-2"><span className="text-lg">!</span> {error}</div>}
          
          {isRegistering && (
            <input type="text" required className={inputClasses} placeholder="Full Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
          )}
          {isRegistering && (
            <input type="tel" required className={inputClasses} placeholder="Mobile Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          )}
          <input type="email" required className={inputClasses} placeholder="Email Address" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <input type="password" required className={inputClasses} placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
          
          {isRegistering && (
            <input type="password" required className={inputClasses} placeholder="Confirm Password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
          )}

          <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 md:py-5 rounded-2xl shadow-xl hover:bg-emerald-600 transition-all text-lg tracking-wide active:scale-[0.98] shadow-slate-900/20 hover:shadow-emerald-500/30">
            {isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <button onClick={() => { setIsRegistering(!isRegistering); setError(''); }} className="w-full text-center text-[10px] font-black text-slate-500 hover:text-emerald-700 uppercase tracking-widest transition-colors">
          {isRegistering ? 'Already have an account? Login' : 'Don\'t have an account? Join Now'}
        </button>
      </div>
    </div>
  );
};

export default LoginView;
