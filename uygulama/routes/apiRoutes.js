const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/yemekhaneController');
const { oturumGetir } = require('../utils/oturum');

async function opsiyonelOturum(req, res, next) {
  const token = req.cookies.oturum_token;
  if (token) {
    req.kullanici = await oturumGetir(token);
  }
  next();
}

async function oturumGerekli(req, res, next) {
  const token = req.cookies.oturum_token;
  const kullanici = await oturumGetir(token);
  if (!kullanici) {
    return res.status(401).json({ hata: 'Bu işlem için giriş yapmalısınız.' });
  }
  req.kullanici = kullanici;
  next();
}

function yoneticiGerekli(req, res, next) {
  if (req.kullanici.rol !== 'yonetici') {
    return res.status(403).json({ hata: 'Bu işlem için yönetici yetkisi gerekir.' });
  }
  next();
}

router.get('/saglik', (req, res) => res.json({ durum: 'ok' }));

// Kimlik doğrulama
router.post('/giris', ctrl.giris);
router.post('/cikis', ctrl.cikis);
router.get('/ben', oturumGerekli, ctrl.ben);

// Profil alerjenleri (Aşama 4)
router.get('/profil/alerjenler', oturumGerekli, ctrl.profilAlerjenleriGetir);
router.put('/profil/alerjenler', oturumGerekli, ctrl.profilAlerjenleriKaydet);

// Menüler
router.get('/referanslar', ctrl.referanslar);
router.get('/menu/gunun', opsiyonelOturum, ctrl.gununMenusu);
router.get('/menu/haftalik', opsiyonelOturum, ctrl.haftalikMenuler);

// Rezervasyon
router.get('/rezervasyonlar', oturumGerekli, ctrl.rezervasyonlarim);
router.post('/rezervasyonlar', oturumGerekli, ctrl.rezervasyonYap);
router.delete('/rezervasyonlar/:id', oturumGerekli, ctrl.rezervasyonIptal);

// Bakiye
router.get('/bakiye', oturumGerekli, ctrl.bakiyeBilgisi);
router.post('/bakiye/yukle', oturumGerekli, ctrl.bakiyeYukle);

// Değerlendirme
router.post('/degerlendirmeler', oturumGerekli, ctrl.degerlendirmeEkle);

// Yönetici
router.get('/yonetici/veriler', oturumGerekli, yoneticiGerekli, ctrl.yoneticiVerileri);
router.post('/yonetici/menu', oturumGerekli, yoneticiGerekli, ctrl.yoneticiMenuKaydet);

module.exports = router;