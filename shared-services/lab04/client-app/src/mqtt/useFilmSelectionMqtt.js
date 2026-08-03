import { useEffect, useRef, useState } from 'react';
import { connectFilmSelectionMqtt } from './connectFilmSelectionMqtt';
import { applyFilmStatusMessage } from './filmSelectionReducer';
import { MQTT_WS_URL } from './mqttConfig';

// One MQTT connection per mounted call, closed on unmount — mirrors
// ../realtime/useOnlineStatus.js. filmIds is the caller's currently-visible
// film-to-review set; the subscription set is kept in sync whenever it
// changes (a stable, order-independent key avoids re-syncing on every
// render for an unchanged set of ids).
export function useFilmSelectionMqtt(filmIds) {
    const [filmStatusByFilmId, setFilmStatusByFilmId] = useState({});
    const connectionRef = useRef(null);
    const key = [...(filmIds || [])].map(String).sort().join(',');

    useEffect(() => {
        const connection = connectFilmSelectionMqtt({
            url: MQTT_WS_URL,
            onMessage: (topic, message) => {
                setFilmStatusByFilmId((current) => applyFilmStatusMessage(current, topic, message));
            },
        });
        connectionRef.current = connection;
        return () => {
            connectionRef.current = null;
            connection.close();
        };
    }, []);

    useEffect(() => {
        connectionRef.current?.setFilmIds(filmIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return filmStatusByFilmId;
}
