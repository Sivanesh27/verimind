import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createSocket } from '../lib/socket.js';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext({ socket: null, connected: false });

export function SocketProvider({ children }) {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!token || !user) return undefined;
    const s = createSocket(token);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [token, user]);

  return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>;
}

export const useSocket = () => useContext(SocketContext);

/** Subscribe to a socket event for the lifetime of the component; the handler may change freely. */
export function useSocketEvent(event, handler) {
  const { socket } = useSocket();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!socket) return undefined;
    const fn = (payload) => ref.current(payload);
    socket.on(event, fn);
    return () => socket.off(event, fn);
  }, [socket, event]);
}
