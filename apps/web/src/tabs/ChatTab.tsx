import React, { useState, useRef, useEffect } from 'react';
import { reoApi } from '../api';
import { icons } from '../icons';

interface Message {
  role: 'user' | 'reo';
  text: string;
}

const QUICK_MESSAGES = ['Motivate me', 'Roast me', 'How am I doing today?', 'Give me a pep talk'];

export function ChatTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Task 5: Load chat history from Supabase on mount
  useEffect(() => {
    reoApi.getChatHistory(50).then(history => {
      if (history && history.length > 0) {
        const mapped: Message[] = history.map(m => ({
          role: m.role === 'user' ? 'user' : 'reo',
          text: m.content,
        }));
        setMessages(mapped);
      } else {
        // No history — show welcome message
        setMessages([
          { role: 'reo', text: 'Hey! What\u2019s up? Ask me anything — or just say "roast me" if you\u2019re feeling brave.' },
        ]);
      }
      setLoadingHistory(false);
    }).catch(() => {
      setMessages([
        { role: 'reo', text: 'Hey! What\u2019s up? Ask me anything — or just say "roast me" if you\u2019re feeling brave.' },
      ]);
      setLoadingHistory(false);
    });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    const userMsg = text.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setSending(true);

    try {
      const res = await reoApi.chat(userMsg);
      setMessages(prev => [...prev, { role: 'reo', text: res.message }]);
    } catch {
      setMessages(prev => [...prev, { role: 'reo', text: 'Waduh, connection error. Try again!' }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4">
        {loadingHistory ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <div className="w-32 h-2 skeleton" />
            <div className="w-48 h-2 skeleton" />
            <div className="w-24 h-2 skeleton" />
          </div>
        ) : (
          messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'reo' && (
                <img src="/mascot.png" alt="" width={28} height={28} className="object-contain mr-2 mt-1 flex-shrink-0" aria-hidden="true" />
              )}
              <div className={`max-w-[75%] px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[#2563EB] text-white rounded-[12px_12px_4px_12px]'
                  : 'card rounded-[12px_12px_12px_4px]'
              }`}>
                {m.text}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <img src="/mascot.png" alt="" width={28} height={28} className="object-contain mr-2 mt-1" aria-hidden="true" />
            <div className="card rounded-[12px_12px_12px_4px] px-4 py-3">
              <div className="flex gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#94A3B8] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#94A3B8] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#94A3B8] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick messages */}
      <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
        {QUICK_MESSAGES.map(q => (
          <button key={q} onClick={() => send(q)} disabled={sending}
            className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors duration-150 hover:bg-[#F1F5F9]"
            style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-secondary)' }}>
            {q}
          </button>
        ))}
      </div>

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); send(input); }} className="flex gap-2">
        <input type="text" value={input} onChange={e => setInput(e.target.value)}
          placeholder="Say something to Reo…" className="input-field flex-1"
          name="chat-message" autoComplete="off" disabled={sending} />
        <button type="submit" disabled={sending || !input.trim()}
          className="btn-primary px-4" aria-label="Send message">
          {icons.send}
        </button>
      </form>
    </div>
  );
}
