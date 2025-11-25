'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Clock, Pencil } from 'lucide-react';
import { useRequireUser } from '@/lib/useRequireUser';
import './styles.css';

const parseStoryText = (raw) => {
    if (!raw) return { chapter: null, text: '' };
    try {
        if (typeof raw === 'string') {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') return parsed;
            return { chapter: null, text: raw };
        }
        return raw;
    } catch {
        return { chapter: null, text: String(raw) };
    }
};

const parseStoryImages = (raw) => {
    if (!raw) return [];
    try {
        if (typeof raw === 'string') {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
            return [];
        }
        return Array.isArray(raw) ? raw : [];
    } catch {
        return [];
    }
};

function StoriesPage() {
    const params = useSearchParams();
    const router = useRouter();
    const { user, loading: authLoading } = useRequireUser();
    const visionId = params.get('visionId');

    const [stories, setStories] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Image Editing States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [imagePrompt, setImagePrompt] = useState('');
    const [isUpdatingImage, setIsUpdatingImage] = useState(false);
    const [visionImageUrl, setVisionImageUrl] = useState('');

    useEffect(() => {
        if (authLoading) return;
        if (!visionId) {
            setError('Missing vision reference');
            return;
        }

        // 1. Fetch Stories
        const fetchStories = async () => {
            setLoading(true);
            setError('');
            try {
                const res = await fetch(`/api/stories?visionId=${encodeURIComponent(visionId)}`);
                const data = await res.json();
                if (!res.ok) {
                    throw new Error(data.error || 'Could not load stories');
                }
                const normalized = (data.stories || []).map((s) => {
                    const storyObj = parseStoryText(s.story_text);
                    const images = parseStoryImages(s.story_images);
                    return {
                        id: s.story_id,
                        chapter: storyObj.chapter || images[0]?.chapter || null,
                        text: storyObj.text || '',
                        image: images[0]?.image || '',
                        prompt: images[0]?.prompt || '',
                        chapterImageDescription: s.chapter_image_description || [],
                        created_at: s.created_at,
                    };
                });
                setStories(normalized);
                if (normalized.length) {
                    setSelectedId(normalized[0].id);
                    setImagePrompt(normalized[0].prompt || '');
                }
            } catch (err) {
                console.error('Stories fetch failed', err);
                setError(err.message || 'Could not load stories');
            } finally {
                setLoading(false);
            }
        };
        fetchStories();

        // 2. Fetch Vision Data (to get the Base64 image string)
        const fetchVisionImage = async () => {
            try {
                const res = await fetch(`/api/visions?visionId=${encodeURIComponent(visionId)}`);
                const data = await res.json();
                if (res.ok && data.vision) {
                    // Grab the raw image data (Base64)
                    const dbImage = data.vision.image_url || data.vision.imageUrl || '';
                    setVisionImageUrl(dbImage);
                }
            } catch (err) {
                console.error('Vision image fetch failed', err);
            }
        };
        fetchVisionImage();
    }, [authLoading, visionId]);

    const selectedStory = useMemo(() => stories.find((s) => s.id === selectedId) || null, [stories, selectedId]);

    // Update the prompt input when changing chapters
    useEffect(() => {
        if (selectedStory) {
            setImagePrompt(selectedStory.prompt || selectedStory?.chapterImageDescription?.[0]?.prompt || '');
        }
    }, [selectedStory]);

    const handleImageUpdate = async () => {
        if (!selectedStory || !imagePrompt.trim()) {
            setIsModalOpen(false);
            return;
        }
        setIsUpdatingImage(true);
        setIsModalOpen(false);
        try {
            // Send request to API, passing the Base64 visionImageUrl
            const res = await fetch('/api/vision-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: imagePrompt,
                    imageUrl: visionImageUrl || null, // This is the Base64 string from DB
                    model: 'black-forest-labs/FLUX.1-kontext-dev', 
                }),
            });
            
            const data = await res.json();
            if (!res.ok || !data.image) {
                throw new Error(data.error || 'Failed to update image');
            }

            // Save new image to database
            await fetch('/api/stories', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    storyId: selectedStory.id,
                    imageUrl: data.image,
                    imagePrompt,
                }),
            });

            // Update UI
            setStories((prev) =>
                prev.map((s) =>
                    s.id === selectedStory.id
                        ? { ...s, image: data.image, prompt: imagePrompt }
                        : s
                )
            );
        } catch (err) {
            console.error('Story image update failed', err);
            alert(err.message || 'Failed to update image');
        } finally {
            setIsUpdatingImage(false);
        }
    };

    if (authLoading) return null;

    return (
        <div className="stories-container">
            <header className="stories-header">
                <button className="back-button" onClick={() => router.back()}>
                    <ArrowLeft size={18} />
                    <span>Go Back</span>
                </button>
            </header>

            {error && <div className="stories-error">{error}</div>}
            
            {loading ? (
                <div className="stories-loading">
                    <div className="loader-spinner"></div>
                    <p>Loading your story...</p>
                </div>
            ) : (
                <div className="stories-layout">
                    <aside className="stories-sidebar">
                        <div className="sidebar-header">
                            <BookOpen size={20} />
                            <h3>Chapters</h3>
                        </div>
                        <div className="chapter-list">
                            {stories.length === 0 && <div className="empty-chapters">No chapters yet.</div>}
                            {stories.map((s, idx) => (
                                <button
                                    key={s.id}
                                    className={`chapter-item ${s.id === selectedId ? 'active' : ''}`}
                                    onClick={() => setSelectedId(s.id)}
                                >
                                    <span className="chapter-number">Chapter {s.chapter || idx + 1}</span>
                                    <span className="chapter-meta">
                                        {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </aside>

                    <main className="stories-content">
                        {selectedStory ? (
                            <article className="story-card fade-in">
                                <div className="story-image-container">
                                    <div className="story-image-wrapper">
                                        {selectedStory.image ? (
                                            <img 
                                                src={selectedStory.image} 
                                                alt={`Chapter ${selectedStory.chapter || ''}`} 
                                                className={`story-image ${isUpdatingImage ? 'story-image-blur' : ''}`} 
                                            />
                                        ) : (
                                            <div className="story-image placeholder">
                                                <span>No illustration available</span>
                                            </div>
                                        )}
                                        <button
                                            className="story-image-edit"
                                            onClick={() => {
                                                setImagePrompt(selectedStory.prompt || selectedStory?.chapterImageDescription?.[0]?.prompt || '');
                                                setIsModalOpen(true);
                                            }}
                                            title="Edit image prompt"
                                        >
                                            <Pencil size={16} />
                                        </button>
                                        {isUpdatingImage && (
                                            <div className="story-image-loading">
                                                <span className="image-spinner" aria-label="Updating image" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="story-body">
                                    <div className="story-meta">
                                        <span className="chapter-badge">Chapter {selectedStory.chapter || stories.indexOf(selectedStory) + 1}</span>
                                        <span className="date-badge">
                                            <Clock size={14} />
                                            {new Date(selectedStory.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                    
                                    <div className="story-text">
                                        {selectedStory.text.split('\n').map((paragraph, i) => (
                                            paragraph.trim() && <p key={i}>{paragraph}</p>
                                        ))}
                                    </div>
                                </div>
                            </article>
                        ) : (
                            <div className="no-selection">
                                <BookOpen size={48} opacity={0.2} />
                                <p>Select a chapter from the list to begin reading.</p>
                            </div>
                        )}
                    </main>
                </div>
            )}
            {isModalOpen && (
                <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Edit Image Description</h3>
                        <p className="modal-hint">Update the prompt to regenerate this chapter's illustration.</p>
                        <textarea
                            className="modal-input"
                            value={imagePrompt}
                            onChange={(e) => setImagePrompt(e.target.value)}
                            placeholder="Describe the scene..."
                            autoFocus
                        />
                        <div className="modal-actions">
                            <button className="btn-cancel" onClick={() => setIsModalOpen(false)}>Cancel</button>
                            <button className="btn-submit" onClick={handleImageUpdate}>Update Image</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StoriesPage;