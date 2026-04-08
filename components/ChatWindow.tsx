
import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from '../types';

interface ChatProps {
  currentUser: User;
  recipientId: string;
  recipientName: string;
  onClose: () => void;
}

const ChatWindow: React.FC<ChatProps> = ({ currentUser, recipientId, recipientName, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chatKey = `chat_${[currentUser.id, recipientId].sort().join('_')}`;
    const saved = localStorage.getItem(chatKey);
    if (saved) setMessages(JSON.parse(saved));

    // Simple pooling to simulate real-time for demo
    const interval = setInterval(() => {
        const updated = localStorage.getItem(chatKey);
        if (updated) {
            const parsed = JSON.parse(updated);
            if (parsed.length !== messages.length) setMessages(parsed);
        }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentUser.id, recipientId, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      receiverId: recipientId,
      text: inputText,
      timestamp: new Date().toISOString()
    };

    const updated = [...messages, newMessage];
    const chatKey = `chat_${[currentUser.id, recipientId].sort().join('_')}`;
    localStorage.setItem(chatKey, JSON.stringify(updated));
    setMessages(updated);
    setInputText('');
  };

  return (
    <div className="fixed bottom-6 right-6 w-[360px] h-[500px] bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border-2 border-slate-100 flex flex-col z-[200] animate-in slide-in-from-bottom-10 duration-300">
      <div className="p-5 bg-emerald-600 rounded-t-[1.8rem] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white font-black">
            {recipientName[0]}
          </div>
          <div>
            <h3 className="text-white font-black text-sm">{recipientName}</h3>
            <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse"></div>
                <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest">Online</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm font-medium shadow-sm ${
              m.senderId === currentUser.id ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border-2 border-slate-100 rounded-tl-none'
            }`}>
              {m.text}
              <div className={`text-[9px] mt-1 font-bold ${m.senderId === currentUser.id ? 'text-emerald-200' : 'text-slate-400'}`}>
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 border-t border-slate-100 bg-white rounded-b-[2rem]">
        <div className="relative">
          <input 
            type="text" 
            placeholder="Type your message..."
            className="w-full pl-4 pr-12 py-3 bg-slate-100 border-2 border-slate-200 rounded-xl text-sm font-bold placeholder-slate-400 focus:border-emerald-500 focus:bg-white transition-all outline-none"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <button 
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-emerald-600 text-white rounded-lg flex items-center justify-center shadow-lg hover:bg-emerald-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatWindow;
