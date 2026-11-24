const crypto = require('crypto');
const { redisGetir } = require('../redisClient');

const SURE_SN = 30 * 60; // 30 dakika (1800 saniye)
const ONEK = 'oturum:';

async function oturumOlustur(kullanici) {
  const client = await redisGetir();
  const token = crypto.randomBytes(24).toString('hex');
  await client.setEx(ONEK + token, SURE_SN, JSON.stringify(kullanici));
  return token;
}

async function oturumGetir(token) {
  if (!token) return null;
  const client = await redisGetir();
  const veri = await client.get(ONEK + token);
  if (!veri) return null;
  // Her aktif istekte oturum süresini 30 dakika yenile
  await client.expire(ONEK + token, SURE_SN);
  return JSON.parse(veri);
}

async function oturumSil(token) {
  if (!token) return;
  const client = await redisGetir();
  await client.del(ONEK + token);
}

module.exports = { oturumOlustur, oturumGetir, oturumSil };