import { CorsOptions } from 'cors';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:3000'];

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like curl, postman, server-to-server)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      return origin === allowed || origin.endsWith('.vercel.app');
    }) || /^https?:\/\/localhost(:\d+)?$/.test(origin);

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};
