'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, ArrowRight, ArrowLeft, Image as ImageIcon, BookOpen, NotebookPen, Lightbulb, Trash2 } from 'lucide-react';
import { useRequireUser } from '@/lib/useRequireUser';
import './styles.css';

function ViewVision() {
    const params = useParams();
    const router = useRouter();
    const { user, loading: authLoading } = useRequireUser();

    const [title, setTitle] = useState('Your Vision Title');
    const [description, setDescription] = useState('A concise description of your vision will appear here.');
    const [characterDescription, setCharacterDescription] = useState('A short description of the character/avatar vibe and look.');
    const [longTermTodos, setLongTermTodos] = useState([]);
    const [shortTermTodos, setShortTermTodos] = useState([]);
    const [imagePrompt, setImagePrompt] = useState('A compelling scene that represents this vision...');
    const [imageUrl, setImageUrl] = useState('');
    
    const [loading, setLoading] = useState(true);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const [isDirty, setIsDirty] = useState(false);
    
    const longListRef = useRef(null);
    const shortListRef = useRef(null);

    useEffect(() => {
        if (authLoading) return;
        const fetchVision = async () => {
            try {
                const response = await fetch(`/api/visions?visionId=${params.id}`);
                const data = await response.json();
                if (!response.ok) {
                    setError(data.error || 'Could not load vision');
                    return;
                }
                const v = data.vision;
                setTitle(v.title || 'Your Vision Title');
                setDescription(v.description || '');
                setCharacterDescription(v.character_description || v.characterDescription || '');
                // Handle different potential database field names for image
                setImageUrl(v.image_url || v.imageUrl || '');
                
                const normalize = (list) =>
                    Array.isArray(list)
                        ? list.map((item) => ({
                              text: typeof item === 'string' ? item : item?.text || '',
                              checked: !!item?.checked,
                          }))
                        : [];
                setLongTermTodos(normalize(v.long_term_todos));
                setShortTermTodos(normalize(v.short_term_todos));
            } catch (err) {
                console.error('Vision fetch failed', err);
                setError('Could not load vision');
            } finally {
                setLoading(false);
                setIsDirty(false);
            }
        };
        fetchVision();
    }, [authLoading, params.id]);

    const handleImageEditClick = () => {
        if (characterDescription) {
            setImagePrompt(characterDescription);
        }
        setIsModalOpen(true);
    };

    const normalizeForSave = (todos = []) =>
        (todos || [])
            .map((t) => {
                const textValue = typeof t === 'string' ? t : t?.text || '';
                return {
                    text: textValue,
                    checked: typeof t === 'string' ? false : !!t?.checked,
                };
            })
            .filter((t) => (t.text || '').trim());

    const buildSavePayload = (overrides = {}) => {
        const filteredLong = normalizeForSave(longTermTodos);
        const filteredShort = normalizeForSave(shortTermTodos);

        return {
            visionId: params.id,
            userId: user?.user_id,
            title,
            description,
            characterDescription,
            chatHistory: [],
            imageUrl,
            longTermTodos: filteredLong,
            shortTermTodos: filteredShort,
            ...overrides,
        };
    };

    const saveVision = async (overrides = {}) => {
        if (!user?.user_id) {
            setError('Missing user. Please log in again.');
            return false;
        }

        setIsSaving(true);
        setError('');
        const payload = buildSavePayload(overrides);

        try {
            const res = await fetch('/api/visions', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || data.detail || 'Failed to save vision');
            }
            setIsDirty(false);
            return true;
        } catch (err) {
            console.error('Save vision failed', err);
            setError(err.message || 'Failed to save vision');
            return false;
        } finally {
            setIsSaving(false);
        }
    };

    const generateImage = async (prompt) => {
        if (!prompt) return;
        try {
            setIsGeneratingImage(true);
            const response = await fetch('/api/vision-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    prompt,
                }),
            });
            const data = await response.json();
            if (!response.ok || !data.image) {
                throw new Error(data.error || 'Failed to generate image');
            }
            setImageUrl(data.image);
            await saveVision({ characterDescription: prompt, imageUrl: data.image });
        } catch (err) {
            console.error('Image generation failed', err);
            setError(err.message || 'Failed to generate image');
        } finally {
            setIsGeneratingImage(false);
        }
    };

    const handlePromptSubmit = async () => {
        const promptValue = imagePrompt || '';
        setCharacterDescription(promptValue);
        setIsModalOpen(false);
        // Persist the updated character description immediately
        await saveVision({ characterDescription: promptValue });
        // Then generate a new image and persist it when ready
        await generateImage(promptValue);
    };

    const handleSave = async () => {
        await saveVision();
    };

    const handleDelete = async () => {
        if (!user?.user_id) {
            setError('Missing user. Please log in again.');
            return;
        }
        setIsDeleting(true);
        setError('');
        try {
            const res = await fetch('/api/visions', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ visionId: params.id, userId: user.user_id }),
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || data.detail || 'Failed to delete vision');
            }
            router.push('/visions');
        } catch (err) {
            console.error('Delete vision failed', err);
            setError(err.message || 'Failed to delete vision');
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    if (authLoading || loading) return null;
    if (error) return <div className="view-error">{error}</div>;

    return (
        <div className="finalize-container">
            <div className="finalize-frame">
                <div className="finalize-content-wrapper">
                    <button className="go-back-link" onClick={() => router.back()}>
                        <ArrowLeft size={16} /> Go Back
                    </button>
                    
                    <div className="finalize-header">
                        <h1 className="finalize-title">Your Vision Statement</h1>
                        <p className="finalize-subtitle">A powerful reminder of the person you're becoming.</p>
                    </div>

                    <div className="review-card">
                        <div className="review-image-container">
                            {imageUrl ? (
                                <img
                                    src={imageUrl}
                                    alt="Vision"
                                    className={`review-image ${isGeneratingImage ? 'review-image-blur' : ''}`}
                                />
                            ) : (
                                <div style={{textAlign: 'center', color: '#9ca3af'}}>
                                    <ImageIcon size={64} strokeWidth={1} style={{marginBottom: '12px'}} />
                                    <p>No image yet</p>
                                </div>
                            )}
                            <button className="image-edit-btn" onClick={handleImageEditClick} title="Edit Image Prompt">
                                <Pencil size={16} />
                            </button>
                            {isGeneratingImage && (
                                <div className="image-loading">
                                    <span className="image-spinner" aria-label="Generating image" />
                                </div>
                            )}
                        </div>
                        
                        <div className="review-form">
                            <div className="review-group">
                                <label className="review-label">Title</label>
                                <input 
                                    type="text" 
                                    className="review-input" 
                                    value={title} 
                                    onChange={(e) => { setTitle(e.target.value); setIsDirty(true); }} 
                                />
                            </div>
                            <div className="review-group">
                                <label className="review-label">Description</label>
                                <textarea 
                                    className="review-textarea" 
                                    value={description} 
                                    onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }} 
                                />
                            </div>
                            
                            <div className="todo-section">
                                {/* Long Term Column */}
                                <div className="todo-column">
                                    <div className="review-label">Long-term Todos</div>
                                    <ul className="todo-list" ref={longListRef}>
                                        {longTermTodos.map((item, idx) => {
                                            const text = typeof item === 'string' ? item : (item?.text || '');
                                            return (
                                                <li key={idx} className="todo-item">
                                                    <label className="todo-check">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!item.checked}
                                                            onChange={(e) => {
                                                                setLongTermTodos((prev) =>
                                                                    prev.map((t, i) =>
                                                                        i === idx ? { ...t, checked: e.target.checked } : t
                                                                    )
                                                                );
                                                                setIsDirty(true);
                                                            }}
                                                        />
                                                        <span className="custom-box" />
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={text}
                                                        onChange={(e) => {
                                                            setLongTermTodos((prev) =>
                                                                prev.map((t, i) =>
                                                                    i === idx ? { ...t, text: e.target.value } : t
                                                                )
                                                            );
                                                            setIsDirty(true);
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setLongTermTodos((prev) => prev.filter((_, i) => i !== idx));
                                                            setIsDirty(true);
                                                        }}
                                                        className="todo-remove"
                                                    >
                                                        ✕
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    <div className="todo-add-row">
                                        <button
                                            type="button"
                                            className="todo-add"
                                            onClick={() => {
                                                setLongTermTodos((prev) => [...prev, { text: '', checked: false }]);
                                                setIsDirty(true);
                                                if (longListRef.current) {
                                                    // Small timeout to ensure DOM update before scroll
                                                    setTimeout(() => {
                                                        longListRef.current.scrollTo({ top: longListRef.current.scrollHeight, behavior: 'smooth' });
                                                    }, 100);
                                                }
                                            }}
                                        >
                                            + Add long-term todo
                                        </button>
                                    </div>
                                </div>

                                {/* Short Term Column */}
                                <div className="todo-column">
                                    <div className="review-label">Short-term Todos</div>
                                    <ul className="todo-list" ref={shortListRef}>
                                        {shortTermTodos.map((item, idx) => {
                                            const text = typeof item === 'string' ? item : (item?.text || '');
                                            return (
                                                <li key={idx} className="todo-item">
                                                    <label className="todo-check">
                                                        <input
                                                            type="checkbox"
                                                            checked={!!item.checked}
                                                            onChange={(e) => {
                                                                setShortTermTodos((prev) =>
                                                                    prev.map((t, i) =>
                                                                        i === idx ? { ...t, checked: e.target.checked } : t
                                                                    )
                                                                );
                                                                setIsDirty(true);
                                                            }}
                                                        />
                                                        <span className="custom-box" />
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={text}
                                                        onChange={(e) => {
                                                            setShortTermTodos((prev) =>
                                                                prev.map((t, i) =>
                                                                    i === idx ? { ...t, text: e.target.value } : t
                                                                )
                                                            );
                                                            setIsDirty(true);
                                                        }}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setShortTermTodos((prev) => prev.filter((_, i) => i !== idx));
                                                            setIsDirty(true);
                                                        }}
                                                        className="todo-remove"
                                                    >
                                                        ✕
                                                    </button>
                                                </li>
                                            );
                                        })}
                                        {shortTermTodos.length === 0 && <li className="todo-empty">No items yet.</li>}
                                    </ul>
                                    <div className="todo-add-row">
                                        <button
                                            type="button"
                                            className="todo-add"
                                            onClick={() => {
                                                setShortTermTodos((prev) => [...prev, { text: '', checked: false }]);
                                                setIsDirty(true);
                                                if (shortListRef.current) {
                                                    setTimeout(() => {
                                                        shortListRef.current.scrollTo({ top: shortListRef.current.scrollHeight, behavior: 'smooth' });
                                                    }, 100);
                                                }
                                            }}
                                        >
                                            + Add short-term todo
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="action-footer">
                            {error && <span className="save-error">{error}</span>}
                            <div className="action-buttons">
                                <button className="btn-secondary" onClick={() => router.push('/advice')}>
                                    <Lightbulb size={16} /> Get Advice
                                </button>
                                <button className="btn-secondary" onClick={() => router.push(`/stories?visionId=${params.id}`)}>
                                    <BookOpen size={16} /> View Story
                                </button>
                                <button className="btn-secondary" onClick={() => router.push(`/journals?visionId=${params.id}`)}>
                                    <NotebookPen size={16} /> Write Journal
                                </button>
                            </div>
                            <div className="action-buttons">
                                <button
                                    className="btn-danger"
                                    onClick={() => setIsDeleteModalOpen(true)}
                                    disabled={isSaving || isGeneratingImage || isDeleting}
                                >
                                    {isDeleting ? <span className="btn-spinner" aria-label="Deleting" /> : <><Trash2 size={16} /> Delete Vision</>}
                                </button>
                                <button className="btn-primary full-width" onClick={handleSave} disabled={isSaving || isGeneratingImage || !isDirty}>
                                    {isSaving ? <span className="btn-spinner" aria-label="Saving" /> : <>Save Changes<ArrowRight size={16} /></>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Edit Image Description</h3>
                        <p style={{fontSize: '0.9rem', color: '#6b7280', marginBottom: '12px'}}>Describe what you want the image to look like.</p>
                        <textarea
                            className="modal-input"
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="E.g., A futuristic city with flying cars..."
                            autoFocus
                        />
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
                            <button className="btn-submit" onClick={handlePromptSubmit}>Update Image</button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="modal-overlay" onClick={() => !isDeleting && setIsDeleteModalOpen(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3 className="modal-title">Delete this vision?</h3>
                        <p className="modal-hint">This will permanently remove the vision and its saved details.</p>
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting}>Cancel</button>
                            <button className="btn-submit danger" onClick={handleDelete} disabled={isDeleting}>
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default ViewVision;
