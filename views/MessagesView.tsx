
import React, { useState, useEffect, useRef } from 'react';
import { User, ChatMessage } from '../types';
import { db } from '../services/db';

interface Props {
  currentUser: User;
}

const MessagesView: React.FC<Props> = ({ currentUser }) => {
  const [conversations, setConversations] = useState<{user: User, lastMsg?: ChatMessage}[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<User | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showListOnMobile, setShowListOnMobile] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadConversations = async () => {
      const allUsers = await db.users.find();
      const others = allUsers.filter(u => u.id !== currentUser.id && u.role !== currentUser.role);
      
      const convosWithLastMsg = await Promise.all(others.map(async u => {
        const msgs = await db.messages.find({ senderId: currentUser.id, receiverId: u.id });
        // The API returns all messages between the two users, sorted by timestamp ASC
        // We need to find the last one
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
        return {
          user: u,
          lastMsg
        };
      }));

      setConversations(convosWithLastMsg.sort((a, b) => {
        if (!a.lastMsg) return 1;
        if (!b.lastMsg) return -1;
        return new Date(b.lastMsg.timestamp).getTime() - new Date(a.lastMsg.timestamp).getTime();
      }));
    };
    loadConversations();
  }, [currentUser.id, currentUser.role]);

  useEffect(() => {
    if (!selectedRecipient) return;
    
    const loadMsgs = async () => {
      const msgs = await db.messages.find({ 
        senderId: currentUser.id, 
        receiverId: selectedRecipient.id 
      });
      
      // Check if we need to update state to avoid infinite loops if references change but content is same
      setMessages(prev => {
        if (prev.length !== msgs.length || (msgs.length > 0 && prev.length > 0 && msgs[msgs.length-1].id !== prev[prev.length-1].id)) {
          return msgs;
        }
        return prev;
      });
    };
    
    loadMsgs();
    const interval = setInterval(loadMsgs, 2000);
    return () => clearInterval(interval);
  }, [selectedRecipient, currentUser.id]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedRecipient) return;

    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderId: currentUser.id,
      receiverId: selectedRecipient.id,
      text: inputText,
      timestamp: new Date().toISOString()
    };

    // Optimistic update
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    try {
      await db.messages.insertOne(newMessage);
    } catch (err) {
      console.error("Failed to send message:", err);
      // Revert optimistic update on failure
      setMessages(prev => prev.filter(m => m.id !== newMessage.id));
      alert("Failed to send message. Please try again.");
    }
  };

  const selectUser = (u: User) => {
    setSelectedRecipient(u);
    setShowListOnMobile(false);
  };

  return (
    <div className="flex flex-col lg:flex-row h-[500px] md:h-[600px] lg:h-[700px] bg-white rounded-3xl md:rounded-[3rem] shadow-2xl border-2 border-slate-50 overflow-hidden animate-in fade-in slide-in-from-bottom-5">
      {/* Sidebar - Contacts */}
      <div className={`${showListOnMobile ? 'flex' : 'hidden lg:flex'} w-full lg:w-80 xl:w-96 border-r-2 border-slate-50 flex-col h-full bg-[#FBFDFB]`}>
        <div className="p-6 md:p-10 border-b-2 border-slate-50">
          <h2 className="text-2xl md:text-3xl font-serif text-slate-900 tracking-tight">Farm Connect</h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Active Channels</p>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {conversations.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-medium italic text-xs">No active chats.</div>
          ) : (
            conversations.map(c => (
              <button 
                key={c.user.id}
                onClick={() => selectUser(c.user)}
                className={`w-full p-6 md:p-8 flex items-center gap-4 md:gap-6 border-b border-slate-50 transition-all hover:bg-white text-left ${selectedRecipient?.id === c.user.id ? 'bg-white border-l-4 md:border-l-8 border-l-emerald-600 shadow-inner' : ''}`}
              >
                <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex-shrink-0 flex items-center justify-center text-lg md:text-xl font-black shadow-lg ${selectedRecipient?.id === c.user.id ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {c.user.name[0]}
                </div>
                <div className="flex-1 truncate">
                  <div className="flex justify-between items-center mb-1">
                    <h4 className="font-bold text-slate-900 truncate text-sm md:text-base">{c.user.name}</h4>
                    {c.lastMsg && <span className="text-[8px] md:text-[9px] font-black text-slate-400 uppercase tracking-widest">{new Date(c.lastMsg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                  <p className="text-[10px] md:text-xs text-slate-400 truncate font-medium">{c.lastMsg ? c.lastMsg.text : `Message...`}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`${!showListOnMobile ? 'flex' : 'hidden lg:flex'} flex-1 flex-col h-full bg-white relative`}>
        {selectedRecipient ? (
          <>
            <div className="p-4 md:p-8 border-b-2 border-slate-50 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3 md:gap-5">
                <button onClick={() => setShowListOnMobile(true)} className="lg:hidden w-10 h-10 flex items-center justify-center text-slate-400">
                  <svg className="w-6 h-6 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                </button>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-emerald-50 text-emerald-600 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-base md:text-lg border-2 border-emerald-100">
                  {selectedRecipient.name[0]}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm md:text-base">{selectedRecipient.name}</h3>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                    <span className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Active</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-10 space-y-4 md:space-y-6 bg-slate-50/30 no-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 grayscale p-10">
                    <svg className="w-12 h-12 md:w-20 md:h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72"></path></svg>
                    <p className="text-lg md:text-xl font-serif italic text-slate-400">Secure farm negotiation channel.</p>
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} className={`flex ${m.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] md:max-w-[70%] px-4 py-2 md:px-6 md:py-4 rounded-2xl md:rounded-[2rem] text-xs md:text-sm font-medium shadow-md transition-all ${
                      m.senderId === currentUser.id ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                    }`}>
                      {m.text}
                      <div className={`text-[8px] md:text-[9px] mt-1.5 md:mt-2 font-black tracking-widest uppercase ${m.senderId === currentUser.id ? 'text-emerald-200' : 'text-slate-400'}`}>
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={scrollRef} />
            </div>

            <form onSubmit={sendMessage} className="p-4 md:p-8 border-t-2 border-slate-50 bg-white">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Send message..."
                  className="w-full pl-6 pr-16 md:pr-20 py-4 md:py-5 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-[1.8rem] text-sm md:text-base font-bold focus:bg-white focus:border-emerald-600 outline-none transition-all"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />
                <button 
                  type="submit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 md:w-14 md:h-14 bg-emerald-600 text-white rounded-lg md:rounded-2xl flex items-center justify-center shadow-xl active:scale-90 transition-all"
                >
                  <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-10 md:p-20 text-center space-y-6 md:space-y-8 animate-in fade-in duration-1000">
             <div className="w-20 h-20 md:w-32 md:h-32 bg-slate-50 rounded-[2.5rem] md:rounded-[3.5rem] flex items-center justify-center text-slate-300 shadow-inner">
                <svg className="w-10 h-10 md:w-16 md:h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"></path></svg>
             </div>
             <div className="max-w-md">
                <h3 className="text-xl md:text-3xl font-serif text-slate-900 tracking-tight">Select a Chat</h3>
                <p className="text-slate-500 text-xs md:text-sm font-medium leading-relaxed mt-2 md:mt-4">Connect with buyers and farmers directly to negotiate.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesView;
