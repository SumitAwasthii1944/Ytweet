import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6380';
const redis = new Redis(REDIS_URL);

redis.on('error', (err) => console.error('Redis error', err));
redis.on('ready', () => console.info('Redis ready'));

export default redis;

export const disconnectRedis = async () => {
  try { await redis.quit(); } catch (e) { /* ignore */ }
};