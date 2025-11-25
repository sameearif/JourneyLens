import React from 'react';
import { Image as ImageIcon } from 'lucide-react';

import './VisionCard.css';

function VisionCard({ title, description, imageUrl, onClick }) {
    return (
        <div className="vision-card" onClick={onClick}>
            <div className="card-image-container">
                {imageUrl ? (
                    <img src={imageUrl} alt={title} className="card-image" />
                ) : (
                    <ImageIcon size={48} className="card-placeholder-icon" strokeWidth={1} />
                )}
            </div>
            <div className="card-content">
                <h3 className="card-title">{title}</h3>
                <p className="card-description">{description}</p>
            </div>
        </div>
    );
}

export default VisionCard;