import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import API from './api';
import { useOnlineStatus } from './realtime/useOnlineStatus';
import LoginForm from './components/LoginForm';
import Sidebar from './components/Sidebar';
import OnlinePage from './components/OnlinePage';
import FilmsToReviewPage from './components/FilmsToReviewPage';

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // One WebSocket connection for the lifetime of the app shell, feeding
    // both the sidebar and the Online page from the same state.
    const onlineUsers = useOnlineStatus();

    useEffect(() => {
        API.currentSession()
            .then(setUser)
            .catch(() => setUser(null))
            .finally(() => setLoading(false));
    }, []);

    async function handleLogin(email, password) {
        const loggedInUser = await API.login(email, password);
        setUser(loggedInUser);
    }

    async function handleLogout() {
        await API.logout();
        setUser(null);
    }

    if (loading) return <p>Loading...</p>;
    if (!user) return <LoginForm onLogin={handleLogin} />;

    return (
        <BrowserRouter>
            <div className="app-layout">
                <Sidebar onlineUsers={onlineUsers} currentUser={user} />
                <main>
                    <nav>
                        <Link to="/online">Online</Link>
                        <Link to="/to-review">Films to review</Link>
                        <button type="button" onClick={handleLogout}>Log out</button>
                    </nav>
                    <Routes>
                        <Route path="/online" element={<OnlinePage onlineUsers={onlineUsers} />} />
                        <Route path="/to-review" element={<FilmsToReviewPage />} />
                        <Route path="*" element={<Navigate to="/online" replace />} />
                    </Routes>
                </main>
            </div>
        </BrowserRouter>
    );
}
