import { io } from 'socket.io-client';
import { API_URL } from './api.js';

export function createSocket(token) {
  return io(API_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 10_000,
  });
}
