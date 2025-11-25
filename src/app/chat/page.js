'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Send, ArrowLeft } from 'lucide-react';
import { useRequireUser } from '@/lib/useRequireUser';
import './styles.css';

const INTRO_MESSAGE = "Hi! I'd love to help you craft your vision. What would you like this vision to be about?";
const SUMMARY_THRESHOLD = 10;

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
    const [isLoading, setIsLoading] = useState(false); // Standard chat loading
    const [isSummarizing, setIsSummarizing] = useState(false); // Summary/Generation phase
    const [hasSummarized, setHasSummarized] = useState(false);
    
    // Progress state for the loading bar
    const [progress, setProgress] = useState({
        step: 0,
        total: 3,
        label: ''
    });

    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const triggerSummary = async (allMessages) => {
        setHasSummarized(true);
        setIsSummarizing(true);
        setIsLoading(false); // Ensure standard typing bubble is OFF

        try {
            // =========================================================
            // STEP 1: GENERATE VISION SUMMARY
            // =========================================================
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

            // =========================================================
            // STEP 2: ORGANIZE TODOS
            // =========================================================
            setProgress({ step: 2, total: 3, label: 'Generating to-dos...' });
            
            // Normalize data
            const normalizeTodos = (list) =>
                Array.isArray(list)
                    ? list.map((t) => ({
                        text: typeof t === 'string' ? t : t?.text || '',
                        checked: typeof t === 'string' ? false : !!t?.checked,
                    }))
                    : [];

            const longTermTodos = normalizeTodos(summaryData.longTermTodos);
            const shortTermTodos = normalizeTodos(summaryData.shortTermTodos);
            
            // Small artificial delay so the user sees "Step 2"
            await new Promise(r => setTimeout(r, 800));

            // =========================================================
            // STEP 3: GENERATE STORY & IMAGES (SEQUENTIAL)
            // =========================================================
            setProgress({ step: 3, total: 3, label: 'Generating story & images...' });

            let imageUrl = '';
            let storyText = '';
            let storyImagePrompt = '';
            let storyImageUrl = '';

            // 3a. Generate Main Vision Image
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
                    if (imgResp.ok && imgData.image) {
                        imageUrl = imgData.image;
                    }
                } catch (imgErr) {
                    console.error('Vision image generation failed', imgErr);
                }
            }

            // 3b. Generate Story Text (Happens AFTER main image is done)
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
            } catch (storyErr) {
                console.error('Story generation failed', storyErr);
            }

            // 3c. Generate Story Image (Happens AFTER story text is done)
            if (storyImagePrompt) {
                const combinedPrompt = [
                    storyImagePrompt,
                    summaryData.characterDescription ? `Character style: ${summaryData.characterDescription}` : null,
                    'Keep the character consistent with the existing vision image.',
                ]
                .filter(Boolean)
                .join('\n');

                try {
                    const storyImgResp = await fetch('/api/vision-image', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            prompt: combinedPrompt,
                            imageUrl: imageUrl || null, 
                        }),
                    });
                    const storyImgData = await storyImgResp.json();
                    if (storyImgResp.ok && storyImgData.image) {
                        storyImageUrl = storyImgData.image;
                    }
                } catch (chapterImgErr) {
                    console.error('Story image generation failed', chapterImgErr);
                }
            }

            // =========================================================
            // FINAL: SAVE & REDIRECT
            // =========================================================
            let visionId = null;
            if (user?.user_id) {
                try {
                    const compactHistory = allMessages
                        .slice(-50)
                        .map((m) => ({ sender: m.sender, text: m.text }));

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
                    if (!saveResp.ok) {
                        throw new Error(saveData.error || 'Failed to save vision');
                    }

                    visionId = saveData.vision?.vision_id || saveData.vision?.id;

                    // Save Story Chapter
                    if (visionId && storyText) {
                        try {
                            await fetch('/api/stories', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    visionId,
                                    chapter: 1,
                                    storyText,
                                    storyImagePrompt,
                                    storyImageUrl,
                                    runningSummary: storyText,
                                }),
                            });
                        } catch (storySaveErr) {
                            console.error('Saving story chapter failed', storySaveErr);
                        }
                    }
                } catch (saveErr) {
                    console.error('Save failed', saveErr);
                    if ((saveErr?.message || '').includes('User not found')) {
                        if (typeof window !== 'undefined') window.localStorage.removeItem('journeylens:user');
                        setMessages(p => [...p, { id: p.length+1, sender: 'ai', text: 'Session lost. Please log in again.' }]);
                        router.push('/');
                        return;
                    }
                    setMessages(p => [...p, { id: p.length+1, sender: 'ai', text: 'Could not save vision. Please try again.' }]);
                    setHasSummarized(false);
                    return;
                }
            }
            
            router.push(visionId ? `/visions/${visionId}` : '/visions');

        } catch (err) {
            console.error('Process failed', err);
            setMessages((prev) => [
                ...prev,
                {
                    id: prev.length + 1,
                    sender: 'ai',
                    text: 'I had trouble generating your vision. Please try again.',
                },
            ]);
            setHasSummarized(false);
        } finally {
            setIsSummarizing(false);
        }
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isSummarizing, progress]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading || isSummarizing || hasSummarized) return;

        const userMessage = {
            id: messages.length + 1,
            sender: 'user',
            text: inputValue
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputValue('');

        try {
            const allMessages = [...messages, userMessage];
            const userCount = allMessages.filter((m) => m.sender === 'user').length;

            if (!hasSummarized && userCount >= SUMMARY_THRESHOLD) {
                await triggerSummary(allMessages);
                return;
            }

            setIsLoading(true);

            // UPDATED: Appending "\n\nNext question: " to user messages
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: allMessages.map((m) => ({
                        role: m.sender === 'ai' ? 'model' : 'user',
                        // Inject the prompt instruction if it is a user message
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

            if (!response.ok) {
                setMessages((prev) => [...prev, {
                    id: (messages.length + 2),
                    sender: 'ai',
                    text: data.error || 'Failed to get response'
                }]);
                return;
            }

            const aiResponse = {
                id: (messages.length + 2),
                sender: 'ai',
                text: data.text || "I'm not sure how to respond to that yet."
            };
            setMessages((prev) => [...prev, aiResponse]);

        } catch (err) {
            console.error('Chat send failed', err);
            setMessages((prev) => [...prev, {
                id: (messages.length + 2),
                sender: 'ai',
                text: "I'm having trouble responding right now. Please try again."
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (authLoading) {
        return null;
    }

    return (
        <div className="chat-container">
            <div className="chat-header">
                <button className="back-button" onClick={onBack || (() => router.push('/visions'))} aria-label="Go back">
                    <ArrowLeft size={20} />
                    <span>Go Back</span>
                </button>
            </div>

            <div className="chat-messages">
                {messages.map((msg) => (
                    <div key={msg.id} className={`message-wrapper ${msg.sender}`}>
                        <span className="message-sender">
                            {msg.sender === 'ai' ? 'JourneyLens AI' : 'You'}
                        </span>
                        <div className="message-bubble">
                            {msg.text}
                        </div>
                    </div>
                ))}

                {/* Standard Chat Loading Bubble - ONLY when NOT summarizing */}
                {isLoading && !isSummarizing && (
                    <div className="message-wrapper ai">
                        <span className="message-sender">JourneyLens AI</span>
                        <div className="message-bubble">
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress Card - ONLY when summarizing */}
                {isSummarizing && (
                    <div className="progress-card">
                        <div className="progress-header">
                            <span className="progress-step">
                                {progress.step}/{progress.total}
                            </span>
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
                <form className="input-wrapper" onSubmit={handleSend}>
                    <input
                        className="chat-input"
                        placeholder="Type your message..."
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        disabled={isLoading || isSummarizing}
                    />
                    <button type="submit" className="send-button" disabled={isLoading || isSummarizing}>
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Chat;
