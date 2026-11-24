const bcrypt = require('bcryptjs');
const repo = require('../repositories/yemekhaneRepo');
const { oturumOlustur, oturumSil } = require('../utils/oturum');

function hataYaniti(res, err) {
  if (err && err.sqlState === '45000') {
    return res.status(400).json({ hata: err.sqlMessage || err.message });
  }
  console.error('Sunucu hatası:', err);
  return res.status(500).json({ hata: 'Sunucu tarafında beklenmeyen bir hata oluştu.' });
}

// --- Giriş / Çıkış / Ben ---
async function giris(req, res) {
  try {
    const { eposta, sifre } = req.body;
    if (!eposta || !sifre) {
      return res.status(400).json({ hata: 'E-posta ve şifre zorunludur.' });
    }
    const kullanici = await repo.kullaniciBulEposta(eposta.trim());
    if (!kullanici || !kullanici.aktif) {
      return res.status(401).json({ hata: 'E-posta veya şifre hatalı.' });
    }
    const eslesme = await bcrypt.compare(sifre, kullanici.sifre_hash);
    if (!eslesme) {
      return res.status(401).json({ hata: 'E-posta veya şifre hatalı.' });
    }
    const oturumVerisi = {
      id: kullanici.id,
      ad: kullanici.ad,
      soyad: kullanici.soyad,
      eposta: kullanici.eposta,
      rol: kullanici.rol,
      ogrenci_no: kullanici.ogrenci_no
    };
    const token = await oturumOlustur(oturumVerisi);
    res.cookie('oturum_token', token, { httpOnly: true, sameSite: 'lax' });
    return res.json({ kullanici: { ...oturumVerisi, bakiye: kullanici.bakiye } });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

async function cikis(req, res) {
  try {
    const token = req.cookies.oturum_token;
    await oturumSil(token);
    res.clearCookie('oturum_token');
    return res.json({ mesaj: 'Çıkış yapıldı.' });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

async function ben(req, res) {
  try {
    const guncel = await repo.kullaniciBakiyeKaynaktan(req.kullanici.id);
    return res.json({ kullanici: guncel });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

// --- Referans & Menüler ---
async function referanslar(req, res) {
  try {
    const [yemekhaneler, ogunler] = await Promise.all([
      repo.yemekhaneleriGetir(),
      repo.ogunleriGetir()
    ]);
    return res.json({ yemekhaneler, ogunler });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

async function gununMenusu(req, res) {
  try {
    const yemekhaneId = Number(req.query.yemekhane_id || 1);
    const ogunId = Number(req.query.ogun_id || 2);
    const tarih = req.query.tarih || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

    const satirlar = await repo.gununMenusuGetir(yemekhaneId, tarih, ogunId);
    if (satirlar.length === 0) {
      return res.json({ menu: null, yemekler: [], toplam_kalori: 0 });
    }
    const ilk = satirlar[0];
    const yemekler = satirlar.map((s) => ({
      yemek_id: s.yemek_id,
      ad: s.yemek,
      kategori: s.kategori,
      kalori: s.kalori,
      vejetaryen: Boolean(s.vejetaryen),
      alerjenler: s.alerjenler ? s.alerjenler.split(', ') : [],
      alerjen_idler: s.alerjen_idler ? s.alerjen_idler.split(',').map(Number) : []
    }));
    const toplam_kalori = yemekler.reduce((t, y) => t + Number(y.kalori), 0);

    return res.json({
      menu: {
        menu_id: ilk.menu_id,
        tarih: ilk.tarih,
        yemekhane: ilk.yemekhane,
        ogun: ilk.ogun,
        rezervasyon_son: ilk.rezervasyon_son,
        ogrenci_fiyati: ilk.ogrenci_fiyati,
        personel_fiyati: ilk.personel_fiyati
      },
      yemekler,
      toplam_kalori
    });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

async function haftalikMenuler(req, res) {
  try {
    const yemekhaneId = Number(req.query.yemekhane_id || 1);
    const bugun = new Date();
    const baslangic = req.query.baslangic || bugun.toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });
    const bitisObj = new Date(baslangic);
    bitisObj.setDate(bitisObj.getDate() + 6);
    const bitis = bitisObj.toISOString().slice(0, 10);

    const menuler = await repo.haftalikMenuleriGetir(
      yemekhaneId,
      baslangic,
      bitis,
      req.kullanici ? req.kullanici.id : 0
    );
    return res.json({ baslangic, bitis, menuler });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

// --- Rezervasyonlar ---
async function rezervasyonYap(req, res) {
  try {
    const { menu_id } = req.body;
    const sonuc = await repo.rezervasyonYap(req.kullanici.id, Number(menu_id));
    // Rezervasyondan hemen sonra bakiye kaynaktan (primary) okunur
    const guncelKullanici = await repo.kullaniciBakiyeKaynaktan(req.kullanici.id);
    return res.json({
      mesaj: 'Rezervasyon oluşturuldu.',
      rezervasyon_id: sonuc.rezervasyon_id,
      ucret: sonuc.ucret,
      bakiye: guncelKullanici.bakiye
    });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

async function rezervasyonIptal(req, res) {
  try {
    const rezervasyonId = Number(req.params.id);
    const sonuc = await repo.rezervasyonIptal(req.kullanici.id, rezervasyonId);
    const guncelKullanici = await repo.kullaniciBakiyeKaynaktan(req.kullanici.id);
    return res.json({
      mesaj: 'Rezervasyon iptal edildi ve ücret iade edildi.',
      iade: sonuc.iade,
      bakiye: guncelKullanici.bakiye
    });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

async function rezervasyonlarim(req, res) {
  try {
    const liste = await repo.rezervasyonlarimiGetir(req.kullanici.id);
    return res.json({ rezervasyonlar: liste });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

// --- Bakiye ---
async function bakiyeBilgisi(req, res) {
  try {
    const [kullanici, hareketler] = await Promise.all([
      repo.kullaniciBakiyeKaynaktan(req.kullanici.id),
      repo.bakiyeHareketleriGetir(req.kullanici.id)
    ]);
    return res.json({ bakiye: kullanici.bakiye, hareketler });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

async function bakiyeYukle(req, res) {
  try {
    const tutar = Number(req.body.tutar);
    const sonuc = await repo.bakiyeYukle(req.kullanici.id, tutar);
    const guncelKullanici = await repo.kullaniciBakiyeKaynaktan(req.kullanici.id);
    return res.json({
      mesaj: 'Bakiye yüklendi.',
      hareket_id: sonuc.hareket_id,
      bakiye: guncelKullanici.bakiye
    });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

// --- Değerlendirme ---
async function degerlendirmeEkle(req, res) {
  try {
    const { menu_id, puan, yorum } = req.body;
    const p = Number(puan);
    if (!p || p < 1 || p > 5) {
      return res.status(400).json({ hata: 'Puan 1 ile 5 arasında olmalıdır.' });
    }
    const kullanilmis = await repo.kullanilmisRezervasyonVarMi(req.kullanici.id, Number(menu_id));
    if (!kullanilmis) {
      return res.status(400).json({ hata: 'Yalnızca kullandığınız menüleri değerlendirebilirsiniz.' });
    }
    await repo.degerlendirmeKaydet(req.kullanici.id, Number(menu_id), p, yorum);
    return res.json({ mesaj: 'Değerlendirmeniz kaydedildi.' });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

// --- Yönetici ---
async function yoneticiVerileri(req, res) {
  try {
    const [rapor, yemekler] = await Promise.all([
      repo.yoneticiRaporGetir(),
      repo.yemekleriGetir()
    ]);
    return res.json({ rapor, yemekler });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

async function yoneticiMenuKaydet(req, res) {
  try {
    const { yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idler } = req.body;
    if (!yemekhane_id || !tarih || !ogun_id || !Array.isArray(yemek_idler) || yemek_idler.length === 0) {
      return res.status(400).json({ hata: 'Yemekhane, tarih, öğün ve en az bir yemek seçilmelidir.' });
    }
    const menuId = await repo.menuKaydet({
      yemekhane_id: Number(yemekhane_id),
      tarih,
      ogun_id: Number(ogun_id),
      ogrenci_fiyati: Number(ogrenci_fiyati),
      personel_fiyati: Number(personel_fiyati),
      yemek_idler: yemek_idler.map(Number)
    });
    return res.json({ mesaj: 'Menü kaydedildi.', menu_id: menuId });
  } catch (err) {
    return hataYaniti(res, err);
  }
}

module.exports = {
  giris,
  cikis,
  ben,
  referanslar,
  gununMenusu,
  haftalikMenuler,
  rezervasyonYap,
  rezervasyonIptal,
  rezervasyonlarim,
  bakiyeBilgisi,
  bakiyeYukle,
  degerlendirmeEkle,
  yoneticiVerileri,
  yoneticiMenuKaydet
};