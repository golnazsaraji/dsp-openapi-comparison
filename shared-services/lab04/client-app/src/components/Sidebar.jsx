// The "logged-in-user sidebar": a compact, always-visible list of who's
// online right now, kept current purely by the WebSocket-driven onlineUsers
// state passed down from App (see src/realtime/useOnlineStatus.js) — no
// polling, no manual refresh.
export default function Sidebar({ onlineUsers, currentUser }) {
    return (
        <aside className="sidebar">
            <h3>Online users</h3>
            <ul>
                {onlineUsers.map((user) => (
                    <li key={user.userId} className={user.userId === currentUser?.id ? 'me' : ''}>
                        {user.userName}
                        {user.filmTitle ? ` — watching "${user.filmTitle}"` : ''}
                    </li>
                ))}
                {onlineUsers.length === 0 && <li className="empty">No one online</li>}
            </ul>
        </aside>
    );
}
