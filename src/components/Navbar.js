'use client';

import { usePathname, useRouter } from 'next/navigation';
import './Navbar.css';

function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const showLogout = pathname !== '/';

    const handleLogout = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem('journeylens:user');
        }
        router.push('/');
    };

    const handleLogoClick = () => {
        router.push('/visions');
    };

    return (
          <div className='navbar-wrapper'>
            <button className='logo' onClick={handleLogoClick} aria-label="Go to visions">
                <div className='logo-image'/>
                <div className='logo-text'>
                    <span>JourneyLens.</span>
                </div>
            </button>
            <div className='nav-items'>
                {showLogout && <button className="nav-logout" onClick={handleLogout}>Logout</button>}
            </div>
          </div>
    )
}

export default Navbar;
