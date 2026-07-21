// The "Online page": same WebSocket-driven state as the sidebar, rendered as
// a full list. Both update immediately from the same onlineUsers state, so
// there is no divergence between the two views.
export default function OnlinePage({ onlineUsers }) {
    return (
        <section className="online-page">
            <h2>Who&apos;s online</h2>
            {onlineUsers.length === 0 && <p>No one is currently online.</p>}
            <ul>
                {onlineUsers.map((user) => (
                    <li key={user.userId}>
                        <strong>{user.userName}</strong>
                        {user.filmTitle
                            ? <span> is reviewing <em>{user.filmTitle}</em></span>
                            : <span> has no active film</span>}
                    </li>
                ))}
            </ul>
        </section>
    );
}
