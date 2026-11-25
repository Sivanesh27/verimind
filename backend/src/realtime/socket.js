import { Server } from 'socket.io';
import { env } from '../config/env.js';
import { verifyToken } from '../services/token.service.js';
import { findUserById } from '../repositories/users.repo.js';

let io = null;

export const rooms = {
  user: (id) => `user:${id}`,
  reviewers: 'reviewers',
  monitor: 'monitor',
};

export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
    pingInterval: 20_000,
  });

  // Authenticate every socket with the same JWT as the REST API.
  io.use(async (socket, next) => {
    try {
      const payload = verifyToken(socket.handshake.auth?.token);
      const user = await findUserById(payload.sub);
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket.data;
    socket.join(rooms.user(user.id));
    socket.join(rooms.monitor);
    if (user.role === 'reviewer' || user.role === 'admin') socket.join(rooms.reviewers);
  });

  return io;
}

/** Emit helper that is a no-op before the socket server starts (e.g. CLI eval scripts). */
export function emit(room, event, payload) {
  io?.to(room).emit(event, payload);
}
