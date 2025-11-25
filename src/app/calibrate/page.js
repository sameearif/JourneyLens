'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useRequireUser } from '@/lib/useRequireUser';
import Chat from '@/app/chat/page';
import './styles.css';

function Calibrate() {
    const router = useRouter();
    const { loading: authLoading } = useRequireUser();
    const [showChat, setShowChat] = useState(false);

    const handleBegin = () => {
        setShowChat(true);
    };

    const handleClose = () => {
        router.push('/visions');
    };

    if (authLoading) {
        return null;
    }

    return (
        <div className="calibrate-container">
            {showChat ? (
                <div className="calibrate-chat-wrapper">
                    <Chat onBack={() => setShowChat(false)} />
                </div>
            ) : (
                <div className="calibrate-content">
                    <div className="icon-wrapper">
                        <Sparkles size={40} strokeWidth={1.5} />
                    </div>
                    
                    <h1 className="calibrate-title">Vision Calibration</h1>
                    
                    <p className="calibrate-text">
                        You are about to begin a guided session with JourneyLens AI. 
                    </p>
                    
                    <p className="calibrate-text">
                        The AI will ask you a series of questions to help clarify your goals, 
                        identify obstacles, and refine your roadmap. This conversation is the 
                        first step in bringing your vision to life.
                    </p>

                    <div className="calibrate-tips">
                        <span>Tip: Be as specific as possible with your answers.</span>
                    </div>

                    <button className="begin-button" onClick={handleBegin}>
                        <span>Begin Session</span>
                        <ArrowRight size={18} />
                    </button>
                    <button className="secondary-back" onClick={handleClose}>
                        Go Back
                    </button>
                </div>
            )}
        </div>
    );
}

export default Calibrate;
