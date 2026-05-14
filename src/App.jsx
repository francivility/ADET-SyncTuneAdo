import { useState, useRef, useEffect, useCallback } from 'react';

const API_URL = '/api/chat';

export default function App() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: "Hi, I'm Sync AI — your personal instrument consultant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [autoScroll, setAutoScroll] = useState(true);

  const handleScroll = useCallback(() => {
    if (!chatContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  }, []);

  useEffect(() => {
    if (autoScroll && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Simulated typing effect
  const [displayedMessages, setDisplayedMessages] = useState([]);
  const typingSpeed = 10;

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role === 'assistant' && !displayedMessages.some((m) => m.id === lastMsg.id)) {
      let start = 0;
      const fullText = lastMsg.content;
      const timer = setInterval(() => {
        start++;
        setDisplayedMessages((prev) => {
          const existing = prev.find((m) => m.id === lastMsg.id);
          if (existing) {
            return prev.map((m) =>
              m.id === lastMsg.id ? { ...m, content: fullText.slice(0, start) } : m
            );
          }
          return [...prev, { ...lastMsg, content: fullText.slice(0, start) }];
        });
        if (start >= fullText.length) clearInterval(timer);
      }, typingSpeed);
      return () => clearInterval(timer);
    }
    if (lastMsg.role === 'user' && !displayedMessages.some((m) => m.id === lastMsg.id)) {
      setDisplayedMessages((prev) => [...prev, lastMsg]);
    }
  }, [messages]);

  useEffect(() => {
    setDisplayedMessages(messages.filter((m) => m.role === 'user' || m.role === 'assistant'));
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        }),
      });
      const data = await res.json();
      const reply = data.reply || "I'm having trouble answering right now.";
      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'assistant', content: reply }]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gradient-to-b from-[#F1E0CF] to-[#f8ede0] font-serif overflow-hidden">
      {/* Header – glass effect with original accent */}
      <header className="bg-white/30 backdrop-blur-sm border-b border-[#d4c0a1]/40 px-4 py-3 flex items-center justify-between shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[#B3562B]">Sync AI</h1>
          <p className="text-sm text-[#B3562B]/70">Instrument Consultant</p>
        </div>
        <div className="w-3 h-3 bg-[#B3562B] rounded-full shadow-md shadow-[#B3562B]/30"></div>
      </header>

      {/* Messages area – full height, soft backdrop */}
      <div
        ref={chatContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-5 space-y-5 scroll-smooth"
      >
        {displayedMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] px-5 py-3 rounded-2xl text-[15px] leading-relaxed transition-all duration-200 ${
                msg.role === 'user'
                  ? 'bg-[#B3562B] text-white shadow-lg shadow-[#B3562B]/20 rounded-br-md'
                  : 'bg-white/60 backdrop-blur-sm text-gray-900 shadow-md shadow-black/5 rounded-bl-md'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-md max-w-[85%]">
              <div className="flex space-x-1.5 justify-center py-1">
                <span className="w-2 h-2 bg-[#B3562B] rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-[#B3562B] rounded-full animate-bounce200" />
                <span className="w-2 h-2 bg-[#B3562B] rounded-full animate-bounce400" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input bar – sticky at bottom, glass finish */}
      <div className="sticky bottom-0 bg-white/30 backdrop-blur-md border-t border-[#d4c0a1]/40 p-3">
        <form onSubmit={sendMessage} className="flex items-center gap-2 max-w-3xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me about instruments..."
            className="flex-1 min-w-0 rounded-full border border-[#B3562B]/30 bg-white/70 backdrop-blur-sm px-5 py-3 text-sm placeholder-[#B3562B]/50 focus:outline-none focus:ring-2 focus:ring-[#B3562B] focus:border-transparent shadow-inner font-serif"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="min-h-[48px] min-w-[48px] rounded-full bg-[#B3562B] text-white flex items-center justify-center hover:bg-[#9b4a22] transition-all duration-200 disabled:opacity-50 shadow-lg shadow-[#B3562B]/20"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}