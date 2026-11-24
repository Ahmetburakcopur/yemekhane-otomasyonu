const { createClient } = require('redis');

const redisHost = process.env.REDIS_HOST || 'redis';
const redisPort = process.env.REDIS_PORT || '6379';

const redisClient = createClient({
  url: `redis://${redisHost}:${redisPort}`
});

redisClient.on('error', (err) => {
  console.error('Redis bağlantı hatası:', err);
});

let baglandi = false;

async function redisGetir() {
  if (!baglandi) {
    await redisClient.connect();
    baglandi = true;
  }
  return redisClient;
}

module.exports = { redisGetir };