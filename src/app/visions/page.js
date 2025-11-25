'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import VisionCard from '@/components/VisionCard';
import { useRequireUser } from '@/lib/useRequireUser';
import './styles.css';

function Visions() {
    const router = useRouter();
    const { user, loading: authLoading } = useRequireUser();
    const [visions, setVisions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [hasFetched, setHasFetched] = useState(false);

    useEffect(() => {
        if (authLoading) return;
        if (user && !hasFetched) {
            fetchVisions(user.user_id);
        }
    }, [authLoading, user, hasFetched]);

    const fetchVisions = async (userId) => {
        setLoading(true);
        setError('');
        try {
            const response = await fetch(`/api/visions?userId=${encodeURIComponent(userId)}`);
            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Could not load visions');
                return;
            }

            const normalized = (data.visions || []).map((v) => ({
                ...v,
                imageUrl: v.image_url || v.imageUrl || null,
                description: v.description || '',
            }));
            setVisions(normalized);
            setHasFetched(true);
        } catch (err) {
            console.error('Vision fetch failed', err);
            setError('Could not load visions');
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        router.push('/calibrate');
    };

    const handleCardClick = (id) => {
        router.push(`/visions/${id}`);
    };

    return (
        <div className="home-container">
            <div className="home-header">
                <h1 className="home-title">My Visions</h1>
                <p className="home-subtitle">
                    Explore your goals and aspirations. Tap a card to edit or view details.
                </p>
            </div>

            {loading && (
                <div className="loading-container">
                    <div className="spinner" aria-label="Loading visions" />
                </div>
            )}
            {error && !loading && <p className="home-status error">{error}</p>}
            {!loading && !error && visions.length === 0 && (
                <div className="empty-state">
                    <h3 className="empty-title">No Visions Created</h3>
                    <p className="empty-text">
                        You haven’t created any visions yet. This is your space to dream, reflect, and define where you want to go. Start by creating your first vision and let your journey unfold.
                    </p>
                </div>
            )}

            <div className="visions-grid">
                {visions.map((vision) => (
                    <VisionCard 
                        key={vision.vision_id || vision.id}
                        title={vision.title}
                        description={vision.description}
                        imageUrl={vision.imageUrl}
                        onClick={() => handleCardClick(vision.vision_id || vision.id)}
                    />
                ))}
            </div>

            <div className="fab-container">
                <button 
                    className="fab-add" 
                    onClick={handleAdd}
                    aria-label="Create new vision"
                >
                    <Plus size={32} />
                </button>
            </div>
        </div>
    );
}

export default Visions;
