const { dbYazma, dbOkuma } = require('../db');

// --- Kullanıcı & Oturum ---
async function kullaniciBulEposta(eposta) {
  const [rows] = await dbOkuma.query(
    'SELECT id, ad, soyad, eposta, sifre_hash, rol, ogrenci_no, bakiye, aktif FROM kullanicilar WHERE eposta = ?',
    [eposta]
  );
  return rows[0] || null;
}

async function kullaniciBakiyeKaynaktan(kullaniciId) {
  const [rows] = await dbYazma.query(
    'SELECT id, ad, soyad, eposta, rol, ogrenci_no, bakiye FROM kullanicilar WHERE id = ?',
    [kullaniciId]
  );
  return rows[0] || null;
}

// --- Referans Veriler (Replika) ---
async function yemekhaneleriGetir() {
  const [rows] = await dbOkuma.query('SELECT id, ad, konum, kapasite FROM yemekhaneler ORDER BY id');
  return rows;
}

async function ogunleriGetir() {
  const [rows] = await dbOkuma.query('SELECT id, ad, sira, son_saat, servis_baslangic, servis_bitis FROM ogunler ORDER BY sira');
  return rows;
}

async function alerjenleriGetir() {
  const [rows] = await dbOkuma.query('SELECT id, ad FROM alerjenler ORDER BY ad');
  return rows;
}

async function yemekleriGetir() {
  const [rows] = await dbOkuma.query(
    `SELECT y.id, y.ad, y.kalori, y.vejetaryen, k.ad AS kategori, k.sira AS kategori_sira
       FROM yemekler y
       JOIN yemek_kategorileri k ON k.id = y.kategori_id
      ORDER BY k.sira, y.ad`
  );
  return rows;
}

// --- Kullanıcı Alerjenleri (Aşama 4) ---
async function kullaniciAlerjenleriniGetir(kullaniciId) {
  const [rows] = await dbYazma.query(
    'SELECT alerjen_id FROM kullanici_alerjenleri WHERE kullanici_id = ?',
    [kullaniciId]
  );
  return rows.map((r) => r.alerjen_id);
}

async function kullaniciAlerjenleriniKaydet(kullaniciId, alerjenIdler) {
  const conn = await dbYazma.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('DELETE FROM kullanici_alerjenleri WHERE kullanici_id = ?', [kullaniciId]);
    for (const alerjenId of alerjenIdler) {
      await conn.query(
        'INSERT INTO kullanici_alerjenleri (kullanici_id, alerjen_id) VALUES (?, ?)',
        [kullaniciId, alerjenId]
      );
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// --- Menüler (Replika) ---
async function gununMenusuGetir(yemekhaneId, tarih, ogunId) {
  const [rows] = await dbOkuma.query(
    `SELECT * FROM v_menu_detay
      WHERE yemekhane_id = ? AND tarih = ? AND ogun_id = ?
      ORDER BY kategori_sira, yemek`,
    [yemekhaneId, tarih, ogunId]
  );
  return rows;
}

async function haftalikMenuleriGetir(yemekhaneId, baslangicTarih, bitisTarih, kullaniciId) {
  const [menuler] = await dbOkuma.query(
    `SELECT d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun,
            d.kapasite, d.rezerve, d.bos_yer, d.doluluk_yuzde, d.rezervasyon_son,
            m.ogrenci_fiyati, m.personel_fiyati,
            COALESCE(p.oy_sayisi, 0) AS oy_sayisi, p.ortalama_puan,
            r.id AS kullanici_rez_id, r.durum AS kullanici_rez_durum, r.porsiyon AS kullanici_rez_porsiyon
       FROM v_menu_doluluk d
       JOIN menuler m ON m.id = d.menu_id
       LEFT JOIN v_menu_puan p ON p.menu_id = d.menu_id
       LEFT JOIN rezervasyonlar r ON r.menu_id = d.menu_id AND r.kullanici_id = ?
      WHERE d.yemekhane_id = ? AND d.tarih BETWEEN ? AND ?
      ORDER BY d.tarih, d.ogun_id`,
    [kullaniciId || 0, yemekhaneId, baslangicTarih, bitisTarih]
  );
  return menuler;
}

// --- Rezervasyonlar & Bakiye ---
async function rezervasyonYap(kullaniciId, menuId, porsiyon = 'tam') {
  const [rows] = await dbYazma.query('CALL sp_rezervasyon_yap(?, ?, ?)', [kullaniciId, menuId, porsiyon]);
  return rows[0][0];
}

async function rezervasyonIptal(kullaniciId, rezervasyonId) {
  const [rows] = await dbYazma.query('CALL sp_rezervasyon_iptal(?, ?)', [kullaniciId, rezervasyonId]);
  return rows[0][0];
}

async function rezervasyonlarimiGetir(kullaniciId) {
  const [rows] = await dbOkuma.query(
    `SELECT r.id, r.menu_id, r.durum, r.porsiyon, r.ucret, r.olusturma, r.kullanma_zamani, r.iptal_zamani,
            m.tarih, yh.ad AS yemekhane, o.ad AS ogun,
            TIMESTAMP(m.tarih, o.son_saat) AS rezervasyon_son,
            d.puan AS kullanici_puani, d.yorum AS kullanici_yorumu
       FROM rezervasyonlar r
       JOIN menuler m ON m.id = r.menu_id
       JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
       JOIN ogunler o ON o.id = m.ogun_id
       LEFT JOIN degerlendirmeler d ON d.menu_id = r.menu_id AND d.kullanici_id = r.kullanici_id
      WHERE r.kullanici_id = ?
      ORDER BY m.tarih DESC, o.sira DESC`,
    [kullaniciId]
  );
  return rows;
}

async function bakiyeYukle(kullaniciId, tutar) {
  const [rows] = await dbYazma.query('CALL sp_bakiye_yukle(?, ?)', [kullaniciId, tutar]);
  return rows[0][0];
}

async function bakiyeHareketleriGetir(kullaniciId) {
  const [rows] = await dbOkuma.query(
    `SELECT id, tur, tutar, rezervasyon_id, aciklama, olusturma
       FROM bakiye_hareketleri
      WHERE kullanici_id = ?
      ORDER BY olusturma DESC, id DESC
      LIMIT 50`,
    [kullaniciId]
  );
  return rows;
}

// --- Değerlendirme ---
async function kullanilmisRezervasyonVarMi(kullaniciId, menuId) {
  const [rows] = await dbOkuma.query(
    `SELECT id FROM rezervasyonlar WHERE kullanici_id = ? AND menu_id = ? AND durum = 'kullanildi'`,
    [kullaniciId, menuId]
  );
  return rows.length > 0;
}

async function degerlendirmeKaydet(kullaniciId, menuId, puan, yorum) {
  await dbYazma.query(
    `INSERT INTO degerlendirmeler (kullanici_id, menu_id, puan, yorum)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE puan = VALUES(puan), yorum = VALUES(yorum)`,
    [kullaniciId, menuId, puan, yorum || null]
  );
}

// --- Yönetici Paneli ---
async function yoneticiRaporGetir() {
  const [rows] = await dbOkuma.query(
    `SELECT d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun,
            d.kapasite, d.rezerve, d.bos_yer, d.doluluk_yuzde,
            m.ogrenci_fiyati, m.personel_fiyati,
            COALESCE(p.oy_sayisi, 0) AS oy_sayisi, p.ortalama_puan
       FROM v_menu_doluluk d
       JOIN menuler m ON m.id = d.menu_id
       LEFT JOIN v_menu_puan p ON p.menu_id = d.menu_id
      ORDER BY d.tarih DESC, d.yemekhane_id, d.ogun_id
      LIMIT 60`
  );
  return rows;
}

async function menuKaydet({ yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_idler }) {
  const conn = await dbYazma.getConnection();
  try {
    await conn.beginTransaction();
    const [mevcut] = await conn.query(
      'SELECT id FROM menuler WHERE yemekhane_id = ? AND tarih = ? AND ogun_id = ?',
      [yemekhane_id, tarih, ogun_id]
    );
    let menuId;
    if (mevcut.length > 0) {
      menuId = mevcut[0].id;
      await conn.query(
        'UPDATE menuler SET ogrenci_fiyati = ?, personel_fiyati = ? WHERE id = ?',
        [ogrenci_fiyati, personel_fiyati, menuId]
      );
      await conn.query('DELETE FROM menu_yemekleri WHERE menu_id = ?', [menuId]);
    } else {
      const [res] = await conn.query(
        'INSERT INTO menuler (yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati) VALUES (?, ?, ?, ?, ?)',
        [yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati]
      );
      menuId = res.insertId;
    }

    for (const yemekId of yemek_idler) {
      await conn.query('INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES (?, ?)', [menuId, yemekId]);
    }

    await conn.commit();
    return menuId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  kullaniciBulEposta,
  kullaniciBakiyeKaynaktan,
  yemekhaneleriGetir,
  ogunleriGetir,
  alerjenleriGetir,
  yemekleriGetir,
  kullaniciAlerjenleriniGetir,
  kullaniciAlerjenleriniKaydet,
  gununMenusuGetir,
  haftalikMenuleriGetir,
  rezervasyonYap,
  rezervasyonIptal,
  rezervasyonlarimiGetir,
  bakiyeYukle,
  bakiyeHareketleriGetir,
  kullanilmisRezervasyonVarMi,
  degerlendirmeKaydet,
  yoneticiRaporGetir,
  menuKaydet
};