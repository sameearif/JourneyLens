'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown'; // Import Markdown renderer
import { useRequireUser } from '@/lib/useRequireUser';
import '../chat/styles.css'; // Ensure this points to your updated styles.css
import { ADVICE_SYSTEM_PROMPT } from '@/lib/prompts';

function Advice() {
  const router = useRouter();
  const { user, loading: authLoading } = useRequireUser();

  const [messages, setMessages] = useState([
    { 
      id: 1, 
      sender: 'ai', 
      text: "What's on your mind? I'll tailor advice using your vision and latest journal." 
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [context, setContext] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Fetch Vision/Journal Context on Mount
  useEffect(() => {
    if (authLoading) return;
    if (!user?.user_id) return;

    const loadContext = async () => {
      try {
        // Grab the most recent vision for the user
        const visionRes = await fetch(`/api/visions?userId=${encodeURIComponent(user.user_id)}`);
        const visionData = await visionRes.json();
        if (!visionRes.ok || !Array.isArray(visionData.visions) || visionData.visions.length === 0) {
          setContext(null);
          return;
        }
        const vision = visionData.visions[0];

        // Latest journal for that vision
        let latestJournal = '';
        const journalsRes = await fetch(`/api/journals?visionId=${encodeURIComponent(vision.vision_id || vision.id)}`);
        const journalsData = await journalsRes.json();
        if (journalsRes.ok && Array.isArray(journalsData.journals) && journalsData.journals.length > 0) {
          latestJournal = journalsData.journals[0]?.journal_text || '';
        }

        setContext({
          visionTitle: vision.title || '',
          visionDescription: vision.description || '',
          longTermTodos: vision.long_term_todos || [],
          shortTermTodos: vision.short_term_todos || [],
          journalSummary: vision.journal_running_summary || '',
          latestJournal,
        });
      } catch (err) {
        console.error('Failed to load advice context', err);
        setContext(null);
      }
    };
    loadContext();
  }, [authLoading, user]);

  const buildSystemMessage = () => {
    if (!context) return '';
    const fmtList = (items) =>
      (items || [])
        .map((t) => (typeof t === 'string' ? t : t?.text || ''))
        .filter(Boolean)
        .join('; ');

    return [
      ADVICE_SYSTEM_PROMPT.trim(),
      `Vision Title: ${context.visionTitle}`,
      `Vision Description: ${context.visionDescription}`,
      context.journalSummary ? `Journal Running Summary: ${context.journalSummary}` : null,
      context.latestJournal ? `Latest Journal Entry: ${context.latestJournal}` : null,
      `Long-Term Todos: ${fmtList(context.longTermTodos)}`,
      `Short-Term Todos: ${fmtList(context.shortTermTodos)}`,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = { id: messages.length + 1, sender: 'user', text: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const system = buildSystemMessage();
      
      // Standardizing roles for the API
      const allMessages = [
        ...messages.map((m) => ({
          role: m.sender === 'ai' ? 'assistant' : 'user',
          content: m.text,
        })),
        { role: 'user', content: userMessage.text },
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, systemPrompt: system }),
      });

      const textBody = await response.text();
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? (() => { try { return JSON.parse(textBody); } catch { return {}; } })() : {};

      const replyText = response.ok ? data.text || "I'm not sure yet, could you clarify?" : data.error || 'Could not fetch advice.';

      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, sender: 'ai', text: replyText },
      ]);
    } catch (err) {
      console.error('Advice chat failed', err);
      setMessages((prev) => [
        ...prev,
        { id: prev.length + 1, sender: 'ai', text: 'I ran into an issue. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <div className="chat-container">
      <div className="chat-header">
        <button className="back-button" onClick={() => router.push('/visions')} aria-label="Go back">
          <ArrowLeft size={20} />
          <span>Go Back</span>
        </button>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
            <span className="message-sender">{msg.sender === 'ai' ? 'JourneyLens Advice' : 'You'}</span>
            <div className="message-bubble">
                {/* UPDATED: Use ReactMarkdown to render AI text cleanly */}
                <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="message-wrapper ai">
            <span className="message-sender">JourneyLens Advice</span>
            <div className="message-bubble">
              <div className="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <form className="input-wrapper" onSubmit={handleSend}>
          <input
            className="chat-input"
            placeholder="Share what's on your mind..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
          />
          <button type="submit" className="send-button" disabled={isLoading}>
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default Advice;