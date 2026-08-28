import { useEffect, useState } from 'react';
import { connectOnlineStatusSocket } from './onlineStatusSocket';
import { applyOnlineStatusMessage } from './onlineListReducer';

// One socket per mount, closed on unmount — the effect has no reactive
// dependencies, so React never opens a second connection for the same
// mounted instance, and the cleanup function always runs exactly once.
export function useOnlineStatus() {
    const [onlineUsers, setOnlineUsers] = useState([]);

    useEffect(() => {
        const connection = connectOnlineStatusSocket({
            onMessage: (message) => {
                setOnlineUsers((current) => applyOnlineStatusMessage(current, message));
            },
        });
        return () => connection.close();
    }, []);

    return onlineUsers;
}
