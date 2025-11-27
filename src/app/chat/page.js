'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ArrowLeft, Pencil, X, Check, Mic, Square, Volume2 } from 'lucide-react'; 
import ReactMarkdown from 'react-markdown';
import { useRequireUser } from '@/lib/useRequireUser';
import './styles.css';

const INTRO_MESSAGE = "Hi! I'd love to help you craft your vision. What would you like this vision to be about?";
const SUMMARY_THRESHOLD = 10;
const formatAssistantText = (text) => (text || '').replace(/\r?\n/g, '\n\n');
const formatDisplayText = (text) => (text || '').replace(/\r?\n/g, '\n\n');

function Chat({ onBack }) {
    const router = useRouter();
    const { loading: authLoading, user } = useRequireUser();
    
    const [messages, setMessages] = useState([
        {
            id: 1,
            sender: 'ai',
            text: INTRO_MESSAGE
        }
    ]);
    
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [hasSummarized, setHasSummarized] = useState(false);
    
    // Edit states
    const [editingMessageId, setEditingMessageId] = useState(null);
    const [editContent, setEditContent] = useState('');
    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [audioLoadingId, setAudioLoadingId] = useState(null);
    const [audioPlayingId, setAudioPlayingId] = useState(null);
    const [audioReady, setAudioReady] = useState({ 1: true }); // default intro message uses bundled audio
    
    const [progress, setProgress] = useState({
        step: 0,
        total: 3,
        label: ''
    });

    const messagesEndRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioCacheRef = useRef(new Map());
    const audioElementRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // --- Extracted API Logic to reuse for both New Messages and Edits ---
    const processMessageFlow = async (currentMessages) => {
        try {
            const userCount = currentMessages.filter((m) => m.sender === 'user').length;

            if (!hasSummarized && userCount >= SUMMARY_THRESHOLD) {
                await triggerSummary(currentMessages);
                return;
            }

            setIsLoading(true);

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: currentMessages.map((m) => ({
                        role: m.sender === 'ai' ? 'model' : 'user',
                        content: m.sender === 'user' ? `${m.text}\n\nNext question: ` : m.text
                    }))
                }),
            });

            const textBody = await response.text();
            const isJson = response.headers.get('content-type')?.includes('application/json');
            const data = isJson ? (() => {
                try { return JSON.parse(textBody); } 
                catch (parseErr) { return {}; }
            })() : {};

            if (!response.ok) throw new Error(data.error || 'Failed to get response');

            setMessages((prev) => [...currentMessages, { // Ensure continuity after edit regeneration
                id: currentMessages.length + 1,
                sender: 'ai',
                text: formatAssistantText(data.text || "I'm not sure how to respond to that yet.")
            }]);

        } catch (err) {
            console.error('Chat failed', err);
            setMessages((prev) => [...currentMessages, {
                id: currentMessages.length + 1,
                sender: 'ai',
                text: formatAssistantText("I'm having trouble responding right now. Please try again.")
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const triggerSummary = async (allMessages) => {
        setHasSummarized(true);
        setIsSummarizing(true);
        setIsLoading(false);

        try {
            setProgress({ step: 1, total: 3, label: 'Generating vision...' });
            
            const summaryResponse = await fetch('/api/chat/summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: allMessages.map((m) => ({
                        role: m.sender === 'ai' ? 'model' : 'user',
                        content: m.text,
                    })),
                }),
            });

            const summaryData = await summaryResponse.json();
            if (!summaryResponse.ok) throw new Error(summaryData.error || 'Failed to summarize');

            setProgress({ step: 2, total: 3, label: 'Generating to-dos...' });
            
            const normalizeTodos = (list) =>
                Array.isArray(list) ? list.map((t) => ({
                    text: typeof t === 'string' ? t : t?.text || '',
                    checked: typeof t === 'string' ? false : !!t?.checked,
                })) : [];

            const longTermTodos = normalizeTodos(summaryData.longTermTodos);
            const shortTermTodos = normalizeTodos(summaryData.shortTermTodos);
            
            await new Promise(r => setTimeout(r, 800));

            setProgress({ step: 3, total: 3, label: 'Generating story & images...' });

            let imageUrl = '';
            let storyText = '';
            let storyImagePrompt = '';
            let storyImageUrl = '';

            // Image generation logic...
            if (summaryData.characterDescription || summaryData.description || summaryData.title) {
                try {
                    const imgResp = await fetch('/api/vision-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: summaryData.characterDescription || summaryData.description || summaryData.title,
                        }),
                    });
                    const imgData = await imgResp.json();
                    if (imgResp.ok) imageUrl = imgData.image;
                } catch (e) { console.error(e); }
            }

            // Story generation logic...
            try {
                const storyResp = await fetch('/api/chat/story', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        description: summaryData.description || '',
                        title: summaryData.title || '',
                        characterDescription: summaryData.characterDescription || '',
                        fullName: user?.fullname || '',
                    }),
                });
                const storyData = await storyResp.json();
                if (storyResp.ok) {
                    storyText = storyData.story || '';
                    storyImagePrompt = storyData.imagePrompt || '';
                }
            } catch (e) { console.error(e); }

            // Story Image Logic...
            if (storyImagePrompt) {
                 try {
                    const storyImgResp = await fetch('/api/vision-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: storyImagePrompt,
                            imageUrl: imageUrl || null, 
                        }),
                    });
                    const storyImgData = await storyImgResp.json();
                    if (storyImgResp.ok) storyImageUrl = storyImgData.image;
                } catch (e) { console.error(e); }
            }

            // Save Vision Logic...
            let visionId = null;
            if (user?.user_id) {
                const compactHistory = allMessages.slice(-50).map((m) => ({ sender: m.sender, text: m.text }));
                const payload = {
                    userId: user.user_id,
                    title: summaryData.title || 'Untitled Vision',
                    description: summaryData.description || '',
                    characterDescription: summaryData.characterDescription || '',
                    longTermTodos,
                    shortTermTodos,
                    imageUrl,
                    chatHistory: compactHistory,
                    storyRunningSummary: storyText || null,
                };

                const saveResp = await fetch('/api/visions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const saveData = await saveResp.json();
                if (!saveResp.ok) throw new Error(saveData.error || 'Failed to save');
                
                visionId = saveData.vision?.vision_id || saveData.vision?.id;

                if (visionId && storyText) {
                    await fetch('/api/stories', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            visionId, chapter: 1, storyText, storyImagePrompt, storyImageUrl, runningSummary: storyText,
                        }),
                    });
                }
            }
            router.push(visionId ? `/visions/${visionId}` : '/visions');

        } catch (err) {
            console.error('Process failed', err);
            setMessages(p => [...p, { id: p.length+1, sender: 'ai', text: 'Generation failed. Please try again.' }]);
            setHasSummarized(false);
        } finally {
            setIsSummarizing(false);
        }
    };

    useEffect(() => {
        // FIX: Removed 'editingMessageId' from dependencies to prevent unwanted scroll when entering edit mode.
        scrollToBottom();
    }, [messages, isSummarizing, progress]);

    // --- Edit Handlers ---

    const startEditing = (msg) => {
        if (isLoading || isSummarizing) return;
        setEditingMessageId(msg.id);
        setEditContent(msg.text);
    };

    const cancelEditing = () => {
        setEditingMessageId(null);
        setEditContent('');
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
        if (isLoading || isSummarizing || isTranscribing || editingMessageId !== null) return;
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
        // Pre-cache the first AI message audio if bundled
        audioCacheRef.current.set(1, '/chat-default.wav');
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

    const fetchAudioUrl = async (msg) => {
        if (!msg?.text) return null;

        let audioUrl = audioCacheRef.current.get(msg.id);
        if (!audioUrl && msg.sender === 'ai' && msg.id === 1) {
            audioUrl = '/chat-default.wav';
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

    // --- Text to Speech ---
    const playAudioForMessage = async (msg) => {
        if (!msg?.text) return;
        if (audioPlayingId === msg.id) return;

        const audioUrl = await fetchAudioUrl(msg);
        if (!audioUrl) return;

        try {
            if (audioElementRef.current) {
                audioElementRef.current.pause();
                audioElementRef.current = null;
            }
            const audio = new Audio(audioUrl);
            audioElementRef.current = audio;
            setAudioPlayingId(msg.id);
            audio.onended = () => setAudioPlayingId(null);
            audio.onerror = () => setAudioPlayingId(null);
            await audio.play();
        } catch (err) {
            console.error('Audio play failed', err);
            setAudioPlayingId(null);
        }
    };

    const saveEditedMessage = async (originalMsgId) => {
        if (!editContent.trim()) return;

        // 1. Find index of message being edited
        const editIndex = messages.findIndex(m => m.id === originalMsgId);
        if (editIndex === -1) return;

        // 2. Create new history: Slice up to this message, replace it, drop everything after
        const prevMessages = messages.slice(0, editIndex);
        const newMessage = { ...messages[editIndex], text: editContent };
        const newHistory = [...prevMessages, newMessage];

        // 3. Update state (this triggers regeneration, which in turn causes scroll when new message is added)
        setMessages(newHistory);
        setEditingMessageId(null);
        setEditContent('');

        // 4. Trigger AI response based on new history
        await processMessageFlow(newHistory);
    };

    // --- Main Send Handler ---

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading || isSummarizing || hasSummarized || isTranscribing) return;

        const userMessage = {
            id: messages.length + 1,
            sender: 'user',
            text: inputValue
        };
        const updatedMessages = [...messages, userMessage];

        setMessages(updatedMessages);
        setInputValue('');

        await processMessageFlow(updatedMessages);
    };

    if (authLoading) return null;

    return (
        <div className="chat-container">
            <div className="chat-header">
                <button className="back-button" onClick={onBack || (() => router.push('/visions'))} aria-label="Go back">
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
                                <span className="message-sender">
                                    {msg.sender === 'ai' ? 'JourneyLens AI' : 'You'}
                                </span>
                                        {msg.sender === 'ai' && (
                                    <button
                                        className="audio-button"
                                        type="button"
                                        onClick={() => playAudioForMessage(msg)}
                                        disabled={isLoading || isSummarizing || isRecording || isTranscribing || !audioReady[msg.id]}
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
                                                <X size={18} />
                                            </button>
                                            <button 
                                                className="inline-action-btn save" 
                                                onClick={() => saveEditedMessage(msg.id)}
                                                title="Save & Regenerate"
                                            >
                                                <Check size={18} />
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
                                        {msg.sender === 'user' && !isSummarizing && (
                                            <button
                                                className="edit-icon-btn"
                                                onClick={() => startEditing(msg)}
                                                aria-label="Edit message"
                                                disabled={isLoading} /* Added disabled status */
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

                {isLoading && !isSummarizing && (
                    <div className="message-wrapper ai">
                        <div className="message-header">
                            <span className="message-sender">JourneyLens AI</span>
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

                {isSummarizing && (
                    <div className="progress-card">
                        <div className="progress-header">
                            <span className="progress-step">{progress.step}/{progress.total}</span>
                            <span className="progress-label">{progress.label}</span>
                        </div>
                        <div className="progress-track">
                            <div 
                                className="progress-fill" 
                                style={{ width: `${(progress.step / progress.total) * 100}%` }}
                            />
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
                        placeholder="Type your message..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        disabled={isLoading || isSummarizing || editingMessageId !== null || isTranscribing}
                    />
                    <button
                        type="button"
                        className={`record-button ${isRecording ? 'recording' : ''}`}
                        onClick={handleRecordToggle}
                        disabled={isLoading || isSummarizing || isTranscribing || editingMessageId !== null}
                        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                    >
                        {isRecording ? <Square size={16} /> : <Mic size={16} />}
                    </button>
                    <button 
                        type="submit" 
                        className="send-button" 
                        disabled={isLoading || isSummarizing || editingMessageId !== null || isTranscribing}
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Chat;
