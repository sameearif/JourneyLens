'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, Book, Plus, Calendar, Save, Sparkles } from 'lucide-react';
import { useRequireUser } from '@/lib/useRequireUser';
import './styles.css';

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(dateStr));
    } catch {
        return dateStr;
    }
};

const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
        return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: 'numeric' }).format(new Date(dateStr));
    } catch {
        return '';
    }
};

function JournalsPage() {
    const params = useSearchParams();
    const router = useRouter();
    const { loading: authLoading } = useRequireUser();
    const visionId = params.get('visionId');

    const [entries, setEntries] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draftText, setDraftText] = useState('');
    const [draftDate, setDraftDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [placeholder, setPlaceholder] = useState('');
    const [showToast, setShowToast] = useState(false); // State for popup
    const textareaRef = useRef(null);

    useEffect(() => {
        const update = () => {
            const w = window.innerWidth || document.documentElement.clientWidth;
            const LONG_PLACEHOLDER = `Take a few minutes to write about a personal experience that has shaped you. Let your thoughts and feelings flow honestly about what happened, how it affected you, and why it matters. Don’t worry about grammar, spelling, or structure; what matters is that you express yourself openly.`;
            const SHORT_PLACEHOLDER = 'Start writing here...';
            setPlaceholder(w > 1000 ? LONG_PLACEHOLDER : SHORT_PLACEHOLDER);
        };
        update();
        window.addEventListener('resize', update);
        return () => window.removeEventListener('resize', update);
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [draftText]);

    useEffect(() => {
        if (authLoading) return;
        if (!visionId) {
            setError('Missing vision reference');
            return;
        }
        const fetchEntries = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`/api/journals?visionId=${encodeURIComponent(visionId)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Could not load journals');
                
                const sorted = (data.journals || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                setEntries(sorted);
                
                if (sorted.length) {
                    selectEntry(sorted[0]);
                } else {
                    startNewEntry();
                }
            } catch (err) {
                console.error('Fetch journals failed', err);
                setError(err.message || 'Could not load journals');
            } finally {
                setLoading(false);
            }
        };
        fetchEntries();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [authLoading, visionId]);

    const selectEntry = (entry) => {
        setSelectedId(entry.journal_id);
        setDraftText(entry.journal_text || '');
        setDraftDate(entry.entry_date);
    };

    const startNewEntry = () => {
        setSelectedId('new');
        setDraftText('');
        const today = new Date().toISOString();
        setDraftDate(today);
        setTimeout(() => textareaRef.current?.focus(), 100);
    };

    const handleSave = async () => {
        if (selectedId !== 'new') return; // existing entries are locked
        if (!visionId || !draftText?.trim()) return;
        setSaving(true);
        setError('');
        setShowToast(false); // Reset toast if already open
        try {
            const res = await fetch('/api/journals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    visionId,
                    entryDate: draftDate,
                    journalText: draftText.trim(),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to save entry');
            
            const newEntry = data.journal;
            // Update list: remove old version if exists, add new to top
            const others = entries.filter((e) => e.journal_id !== newEntry.journal_id);
            const updated = [newEntry, ...others];
            
            setEntries(updated);
            setSelectedId(newEntry.journal_id);
            setDraftText(newEntry.journal_text || '');
            setDraftDate(newEntry.entry_date);

            // Show Success Toast
            setShowToast(true);
            setTimeout(() => setShowToast(false), 4000); // Hide after 4s

        } catch (err) {
            console.error('Save journal failed', err);
            setError(err.message || 'Failed to save entry');
        } finally {
            setSaving(false);
        }
    };

    if (authLoading) return null;

    return (
        <div className="journals-container">
            {/* Header */}
            <header className="journals-header">
                <button className="back-button" onClick={() => router.back()}>
                    <ArrowLeft size={18} />
                    <span>Back to Vision</span>
                </button>
            </header>

            {error && <div className="journals-error">{error}</div>}
            
            {loading ? (
                <div className="journals-loading">
                    <div className="loader-spinner"></div>
                    <p>Loading journals...</p>
                </div>
            ) : (
                <div className="journals-layout">
                    {/* Sidebar */}
                    <aside className="journals-sidebar">
                        <div className="sidebar-header">
                            <div className="sidebar-title-group">
                                <Book size={20} />
                                <h3>Journal</h3>
                            </div>
                            <button className="new-entry-btn" onClick={startNewEntry} aria-label="New Entry">
                                <Plus size={18} />
                                <span>New</span>
                            </button>
                        </div>
                        
                        <div className="entry-list">
                            {entries.length === 0 && <div className="empty-entries">No entries yet. Start writing!</div>}
                            {entries.map((e) => (
                                <button
                                    key={e.journal_id}
                                    className={`entry-item ${e.journal_id === selectedId ? 'active' : ''}`}
                                    onClick={() => selectEntry(e)}
                                >
                                    <span className="entry-date">{formatDate(e.entry_date)}</span>
                                    <span className="entry-snippet">
                                        {(e.journal_text || '').slice(0, 50) || 'Empty entry...'}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </aside>

                    {/* Editor Area */}
                    <main className="journals-content">
                        <div className="editor-card">
                            <div className="editor-header">
                                <div className="editor-date">
                                    <Calendar size={16} />
                                    <span>
                                        {selectedId === 'new' 
                                            ? 'New Entry' 
                                            : `${formatDate(draftDate)} • ${formatTime(draftDate)}`
                                        }
                                    </span>
                                </div>
                                <div className="editor-actions">
                                    <button 
                                        className={`save-button ${saving ? 'saving' : ''}`}
                                        disabled={selectedId !== 'new' || saving || !draftText.trim()}
                                        onClick={() => {
                                            if (selectedId === 'new') handleSave();
                                        }}
                                    >
                                        {saving ? (
                                            <>
                                                <span className="spinner"></span>
                                                Saving...
                                            </>
                                        ) : (
                                            <>
                                                <Save size={16} />
                                                {selectedId === 'new' ? 'Save Entry' : 'Saved'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>

                            <textarea
                                ref={textareaRef}
                                className="journal-textarea"
                                value={draftText}
                                onChange={(e) => {
                                    if (selectedId === 'new') setDraftText(e.target.value);
                                }}
                                placeholder={placeholder}
                                spellCheck={false}
                                readOnly={selectedId !== 'new'}
                            />
                        </div>
                    </main>
                </div>
            )}

            {/* Success Popup */}
            {showToast && (
                <div className="toast-notification">
                    <Sparkles size={20} className="toast-icon" />
                    <span>A chapter of your story has been generated!</span>
                </div>
            )}
        </div>
    );
}

export default JournalsPage;
