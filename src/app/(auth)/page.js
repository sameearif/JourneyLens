'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';

import './styles.css';

function Auth() {
    const [isLogin, setIsLogin] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        fullname: '',
        username: '',
        password: '',
    });
    const [status, setStatus] = useState({ error: '', success: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const handleInputChange = (field) => (event) => {
        setFormData({ ...formData, [field]: event.target.value });
    };

    const handleAuthToggle = (loginMode) => {
        setIsLogin(loginMode);
        setStatus({ error: '', success: '' });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setStatus({ error: '', success: '' });

        // Short-circuit signups for the demo environment.
        if (!isLogin) {
            setStatus({ error: 'Sign-up has been disabled for the demo purposes', success: '' });
            return;
        }

        setIsSubmitting(true);

        try {
            const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    password: formData.password,
                    fullname: formData.fullname,
                }),
            });

            const data = await response.json();
            if (!response.ok) {
                setStatus({ error: data.error || 'Something went wrong', success: '' });
                return;
            }

            if (isLogin) {
                setStatus({ error: '', success: 'Login successful' });
                if (typeof window !== 'undefined' && data.user) {
                    window.localStorage.setItem('journeylens:user', JSON.stringify(data.user));
                }
                router.push('/visions');
            } else {
                setStatus({ error: '', success: 'Account created! You can now log in.' });
                setIsLogin(true);
            }
        } catch (error) {
            console.error('Auth submission failed', error);
            setStatus({ error: 'Unexpected error. Please try again.', success: '' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className='auth-wrapper'>
            <div className='auth-card'>
                <div className='auth-header'>
                    <div className='auth-image'/>
                    <h1 className="auth-title">JourneyLens.</h1>
                    <p className="auth-subtitle">Your reflective AI motivational partner</p>
                </div>

                <div className="auth-toggle">
                    <button 
                        type="button" 
                        className={`toggle-btn ${isLogin ? 'active' : ''}`}
                        onClick={() => handleAuthToggle(true)}
                    >
                        Login
                    </button>
                    <button 
                        type="button" 
                        className={`toggle-btn ${!isLogin ? 'active' : ''}`}
                        onClick={() => handleAuthToggle(false)}
                    >
                        Sign Up
                    </button>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {!isLogin && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="fullname">Full Name</label>
                            <input 
                                id="fullname" 
                                type="text" 
                                className="form-input" 
                                placeholder="Enter your full name"
                                value={formData.fullname}
                                onChange={handleInputChange('fullname')}
                                autoComplete="name"
                                required
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label" htmlFor="username">Username</label>
                        <input 
                            id="username" 
                            type="text" 
                            className="form-input" 
                            placeholder="Enter your username"
                            value={formData.username}
                            onChange={handleInputChange('username')}
                            autoComplete="username"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <div className="input-wrapper">
                            <input 
                                id="password" 
                                type={showPassword ? "text" : "password"} 
                                className="form-input" 
                                placeholder={isLogin ? "Enter your password" : "Create a password"}
                                value={formData.password}
                                onChange={handleInputChange('password')}
                                autoComplete={isLogin ? "current-password" : "new-password"}
                                minLength={6}
                                required
                            />
                            <button 
                                type="button" 
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>
                    {status.error && <div className="form-message error">{status.error}</div>}
                    {status.success && <div className="form-message success">{status.success}</div>}
                    <button 
                        type="submit" 
                        className="submit-button"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Please wait...' : isLogin ? "Login" : "Create Account"}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Auth;
