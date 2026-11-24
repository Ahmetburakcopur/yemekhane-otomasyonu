const crypto = require('crypto');

const oturumlar = new Map();
const SURE_MS = 30 * 60 * 1000; // 30 dakika

async function oturumOlustur(kullanici) {
  const token = crypto.randomBytes(24).toString('hex');
  oturumlar.set(token, {
    kullanici,
    bitis: Date.now() + SURE_MS
  });
  return token;
}

async function oturumGetir(token) {
  if (!token) return null;
  const kayit = oturumlar.get(token);
  if (!kayit) return null;
  if (Date.now() > kayit.bitis) {
    oturumlar.delete(token);
    return null;
  }
  kayit.bitis = Date.now() + SURE_MS; // her istekte yenile
  return kayit.kullanici;
}

async function oturumSil(token) {
  if (token) oturumlar.delete(token);
}

module.exports = { oturumOlustur, oturumGetir, oturumSil };