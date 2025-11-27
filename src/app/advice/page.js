'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Send, Pencil, X, Check, Mic, Square, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useRequireUser } from '@/lib/useRequireUser';
import '../chat/styles.css'; // Assuming this path is correct
import { ADVICE_SYSTEM_PROMPT } from '@/lib/prompts'; // Assuming this prompt is defined

const formatAssistantText = (text) => (text || '').replace(/\r?\n/g, '\n\n');
const formatDisplayText = (text) => (text || '').replace(/\r?\n/g, '\n\n');

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
  
  // States for inline editing
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editContent, setEditContent] = useState(''); 
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState(null);
  const [audioPlayingId, setAudioPlayingId] = useState(null);
  const [audioReady, setAudioReady] = useState({ 1: true });
  const [canAutoplay, setCanAutoplay] = useState(false);
  
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const audioElementRef = useRef(null);
  const lastAutoPlayedIdRef = useRef(null);
  const lastAutoAttemptedIdRef = useRef(null);
  const pendingAutoPlayIdRef = useRef(null);
  const latestAiMessage = useMemo(
    () => [...messages].reverse().find((m) => m.sender === 'ai'),
    [messages]
  );
  const waitingForLatestAudio = useMemo(() => {
    if (!latestAiMessage) return false;
    return !audioReady[latestAiMessage.id] || audioLoadingId === latestAiMessage.id;
  }, [latestAiMessage, audioReady, audioLoadingId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // FIX: Removed 'editingMessageId' from the dependency array. 
    // Scrolling should only occur when a new message is added or loading state changes.
    scrollToBottom();
  }, [messages, isLoading]); 
  
  // --- Context Loading Logic (No Change) ---
  useEffect(() => {
    if (authLoading) return;
    if (!user?.user_id) return;

    const loadContext = async () => {
      try {
        const visionRes = await fetch(`/api/visions?userId=${encodeURIComponent(user.user_id)}`);
        const visionData = await visionRes.json();
        if (!visionRes.ok || !Array.isArray(visionData.visions) || visionData.visions.length === 0) {
          setContext(null);
          return;
        }
        const vision = visionData.visions[0];

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

  // --- Edit Handlers ---

  const startEditing = (msg) => {
    if (isLoading) return;
    setEditingMessageId(msg.id);
    setEditContent(msg.text);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditContent('');
    setInputValue(''); 
  };

  // --- Voice recording & transcription ---
  const cleanupMedia = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  const handleRecordToggle = async () => {
    if (isLoading || isTranscribing || editingMessageId !== null) return;
    if (isRecording) {
      cleanupMedia();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        cleanupMedia();
        if (!chunks.length) return;

        const blob = new Blob(chunks, { type: 'audio/webm' });
        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('file', blob, 'recording.webm');

          const resp = await fetch('/api/asr', { method: 'POST', body: formData });
          const data = await resp.json();
          if (!resp.ok) throw new Error(data.error || 'Transcription failed');

          const text = data.text || '';
          if (text) {
            setInputValue((prev) => (prev ? `${prev} ${text}` : text));
          }
        } catch (err) {
          console.error('Transcription error', err);
          setMessages((prev) => [...prev, {
            id: prev.length + 1,
            sender: 'ai',
            text: 'Could not transcribe audio. Please try again.',
          }]);
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone error', err);
      setMessages((prev) => [...prev, {
        id: prev.length + 1,
        sender: 'ai',
        text: 'Microphone permission denied or unavailable.',
      }]);
    }
  };

  useEffect(() => {
    audioCacheRef.current.set(1, '/advice-default.wav');
    return () => {
      cleanupMedia();
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      audioCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      audioCacheRef.current.clear();
    };
  }, []);

  // --- Text to Speech ---
  const playAudioForMessage = async (msg, prefetchedUrl = null) => {
    if (!msg?.text) return;
    if (audioPlayingId === msg.id) return;

    const audioUrl = prefetchedUrl || await fetchAudioUrl(msg);
    if (!audioUrl) return;

    try {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
        audioElementRef.current = null;
      }
      const audio = new Audio(audioUrl);
      audioElementRef.current = audio;
      setAudioPlayingId(msg.id);
      audio.onended = () => setAudioPlayingId(null);
      audio.onerror = () => setAudioPlayingId(null);
      await audio.play();
      return true;
    } catch (err) {
      console.error('Audio play failed', err);
      if (err?.name === 'NotAllowedError') {
        pendingAutoPlayIdRef.current = msg.id;
        lastAutoAttemptedIdRef.current = null;
      }
      setAudioPlayingId(null);
      return false;
    }
  };

  const fetchAudioUrl = async (msg) => {
    if (!msg?.text) return null;

    let audioUrl = audioCacheRef.current.get(msg.id);
    if (!audioUrl && msg.sender === 'ai' && msg.id === 1) {
      audioUrl = '/advice-default.wav';
      audioCacheRef.current.set(msg.id, audioUrl);
    }
    if (audioUrl) {
      setAudioReady((prev) => ({ ...prev, [msg.id]: true }));
      return audioUrl;
    }

    try {
      setAudioLoadingId(msg.id);
      const resp = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: msg.text }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'TTS failed');

      const base64 = data.audio;
      if (!base64) throw new Error('No audio returned');
      const byteChars = atob(base64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      audioUrl = URL.createObjectURL(blob);
      audioCacheRef.current.set(msg.id, audioUrl);
      setAudioReady((prev) => ({ ...prev, [msg.id]: true }));
      return audioUrl;
    } catch (err) {
      console.error('TTS error', err);
      setMessages((prev) => [...prev, {
        id: prev.length + 1,
        sender: 'ai',
        text: 'Could not play audio for this message.',
      }]);
      return null;
    } finally {
      setAudioLoadingId(null);
    }
  };

  const ensureAudioForMessages = async () => {
    const pending = messages.filter((m) => m.sender === 'ai' && !audioReady[m.id]);
    for (const msg of pending) {
      await fetchAudioUrl(msg);
    }
  };

  useEffect(() => {
    ensureAudioForMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  // Track user interaction to enable autoplay.
  useEffect(() => {
    if (canAutoplay) return;
    const enable = () => {
      setCanAutoplay(true);
      if (pendingAutoPlayIdRef.current) {
        lastAutoPlayedIdRef.current = null;
      }
    };
    window.addEventListener('pointerdown', enable, { once: true });
    window.addEventListener('keydown', enable, { once: true });
    return () => {
      window.removeEventListener('pointerdown', enable);
      window.removeEventListener('keydown', enable);
    };
  }, [canAutoplay]);

  // Auto-play latest AI response, stopping any previous playback.
  useEffect(() => {
    const autoPlay = async () => {
      if (!canAutoplay) {
        const latest = [...messages].reverse().find((m) => m.sender === 'ai');
        if (latest) pendingAutoPlayIdRef.current = latest.id;
        return;
      }
      if (isRecording || isTranscribing) return;
      const latestAi = [...messages].reverse().find((m) => m.sender === 'ai');
      if (!latestAi) return;
      if (latestAi.id === lastAutoPlayedIdRef.current) return;
      if (latestAi.id === lastAutoAttemptedIdRef.current) return;

      const cachedUrl = audioReady[latestAi.id] ? audioCacheRef.current.get(latestAi.id) : null;
      const audioUrl = cachedUrl || await fetchAudioUrl(latestAi);
      if (!audioUrl) return;

      lastAutoAttemptedIdRef.current = latestAi.id;
      const played = await playAudioForMessage(latestAi, audioUrl);
      if (played !== false) {
        lastAutoPlayedIdRef.current = latestAi.id;
        pendingAutoPlayIdRef.current = null;
      } else {
        lastAutoAttemptedIdRef.current = null;
      }
    };
    autoPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, audioReady, isRecording, isTranscribing, canAutoplay]);

  const saveEditedMessage = async (originalMsgId) => {
    if (!editContent.trim()) return;

    // 1. Find index of message being edited
    const editIndex = messages.findIndex(m => m.id === originalMsgId);
    if (editIndex === -1) return;

    // 2. Create new history: Slice up to this message, replace it, drop everything after
    const prevMessages = messages.slice(0, editIndex);
    const newMessage = { ...messages[editIndex], text: editContent };
    const newHistory = [...prevMessages, newMessage];

    // 3. Update state locally
    setMessages(newHistory);
    setEditingMessageId(null);
    setEditContent('');

    // 4. Trigger AI response based on new history
    await processMessageFlow(newHistory);
  };

  // --- Process Message Flow (Extracted from handleSend for reuse) ---

  const processMessageFlow = async (currentMessages) => {
    setIsLoading(true);

    try {
      const system = buildSystemMessage();
      
      const allMessages = currentMessages.map((m) => ({
        role: m.sender === 'ai' ? 'assistant' : 'user',
        content: m.text,
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: allMessages, systemPrompt: system }),
      });

      const textBody = await response.text();
      const isJson = response.headers.get('content-type')?.includes('application/json');
      const data = isJson ? (() => { try { return JSON.parse(textBody); } catch { return {}; } })() : {};

      const replyText = response.ok ? formatAssistantText(data.text || "I'm not sure yet, could you clarify?") : data.error || 'Could not fetch advice.';

      setMessages((prev) => [
        ...currentMessages, // Ensure all user/previous messages are present
        { id: currentMessages.length + 1, sender: 'ai', text: replyText },
      ]);
    } catch (err) {
      console.error('Advice chat failed', err);
      setMessages((prev) => [
        ...currentMessages,
        { id: currentMessages.length + 1, sender: 'ai', text: 'I ran into an issue. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };


  // --- Main Send Handler (Simplified) ---

  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || isTranscribing) return;

    const userMessage = { id: messages.length + 1, sender: 'user', text: inputValue };
    const updatedMessages = [...messages, userMessage];
    
    setMessages(updatedMessages);
    setInputValue('');
    
    // Process flow with the new message
    await processMessageFlow(updatedMessages);
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
        {messages.map((msg) => {
            const isEditing = editingMessageId === msg.id;
            return (
              <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
                <div className="message-header">
                  <span className="message-sender">{msg.sender === 'ai' ? 'JourneyLens AI' : 'You'}</span>
                  {msg.sender === 'ai' && (
                    <button
                      className="audio-button"
                      type="button"
                      onClick={() => playAudioForMessage(msg)}
                      disabled={isLoading || isRecording || isTranscribing || !audioReady[msg.id]}
                      aria-label="Play audio"
                    >
                      <Volume2 size={14} />
                    </button>
                  )}
                </div>
                
                <div className={`message-bubble ${isEditing ? 'editing' : ''}`}>
                    {isEditing ? (
                        <div className="inline-edit-area">
                            <textarea 
                                className="inline-edit-input"
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                autoFocus
                            />
                            <div className="inline-edit-actions">
                                <button 
                                    className="inline-action-btn cancel" 
                                    onClick={cancelEditing}
                                    title="Cancel"
                                >
                                    <X size={14} />
                                </button>
                                <button 
                                    className="inline-action-btn save" 
                                    onClick={() => saveEditedMessage(msg.id)}
                                    title="Save & Regenerate"
                                >
                                    <Check size={14} />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {msg.sender === 'ai' && !audioReady[msg.id] ? (
                              <div className="typing-indicator">
                                <span></span><span></span><span></span>
                              </div>
                            ) : (
                              <ReactMarkdown>{formatDisplayText(msg.text)}</ReactMarkdown>
                            )}
                            {msg.sender === 'user' && ( // Icon should always appear for user messages
                                <button
                                    className="edit-icon-btn"
                                    onClick={() => startEditing(msg)}
                                    aria-label="Edit message"
                                    disabled={isLoading}
                                >
                                    <Pencil size={12} />
                                </button>
                            )}
                        </>
                    )}
                </div>
              </div>
            );
        })}

        {isLoading && (
          <div className="message-wrapper ai">
            <div className="message-header">
              <span className="message-sender">JourneyLens Advice</span>
              <button
                className="audio-button"
                type="button"
                disabled
                aria-label="Play audio"
              >
                <Volume2 size={14} />
              </button>
            </div>
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
        {(isRecording || isTranscribing) && (
          <div className="voice-status">
            {isRecording ? 'Recording… tap to stop when ready.' : 'Transcribing your audio…'}
          </div>
        )}
        <form className="input-wrapper" onSubmit={handleSend}>
          <input
            className="chat-input"
            placeholder="Share what's on your mind..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={
              isLoading ||
              isTranscribing ||
              editingMessageId !== null ||
              waitingForLatestAudio
            }
          />
          <button
            type="button"
            className={`record-button ${isRecording ? 'recording' : ''}`}
            onClick={handleRecordToggle}
            disabled={isLoading || isTranscribing || editingMessageId !== null}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            {isRecording ? <Square size={16} /> : <Mic size={16} />}
          </button>
          <button
            type="submit"
            className="send-button"
            disabled={
              isLoading ||
              editingMessageId !== null ||
              isTranscribing ||
              waitingForLatestAudio
            }
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}

export default Advice;
