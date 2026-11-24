let aktifKullanici = null;
let referans = { yemekhaneler: [], ogunler: [], alerjenler: [] };

const bugunStr = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' });

async function api(yol, secenekler = {}) {
  const res = await fetch('/api' + yol, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...secenekler
  });
  const veri = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(veri.hata || 'İşlem başarısız.');
  return veri;
}

function bildirimGoster(mesaj, tur = 'basari') {
  const el = document.getElementById('bildirim');
  el.textContent = mesaj;
  el.className = `bildirim ${tur}`;
  setTimeout(() => el.classList.add('gizli'), 4500);
}

function sekmeAc(ad) {
  document.querySelectorAll('main > section').forEach(s => s.classList.add('gizli'));
  document.getElementById('sekme-' + ad)?.classList.remove('gizli');
  document.querySelectorAll('#ana-nav button[data-sekme]').forEach(b => {
    b.classList.toggle('aktif', b.dataset.sekme === ad);
  });
  if (ad === 'gunun') gununMenusuYukle();
  if (ad === 'haftalik') haftalikMenulerYukle();
  if (ad === 'rezervasyonlar') rezervasyonlarimYukle();
  if (ad === 'bakiye') bakiyeYukleEkran();
  if (ad === 'profil') profilYukle();
  if (ad === 'yonetici') yoneticiYukle();
}

function kullaniciArayuzuGuncelle() {
  const bilgi = document.getElementById('kullanici-bilgi');
  const girisGerekli = document.querySelectorAll('.giris-gerekli');
  const yoneticiGerekli = document.querySelectorAll('.yonetici-gerekli');
  const btnGiris = document.getElementById('btn-giris-sekme');

  if (aktifKullanici) {
    bilgi.textContent = `${aktifKullanici.ad} ${aktifKullanici.soyad} (${aktifKullanici.rol}) · ${Number(aktifKullanici.bakiye).toFixed(2)} TL`;
    girisGerekli.forEach(e => e.classList.remove('gizli'));
    btnGiris.classList.add('gizli');
    yoneticiGerekli.forEach(e => e.classList.toggle('gizli', aktifKullanici.rol !== 'yonetici'));
  } else {
    bilgi.textContent = 'Misafir';
    girisGerekli.forEach(e => e.classList.add('gizli'));
    yoneticiGerekli.forEach(e => e.classList.add('gizli'));
    btnGiris.classList.remove('gizli');
  }
}

async function gununMenusuYukle() {
  const yh = document.getElementById('gunun-yemekhane').value;
  const ogun = document.getElementById('gunun-ogun').value;
  const tarih = document.getElementById('gunun-tarih').value;
  const kap = document.getElementById('gunun-icerik');
  try {
    const veri = await api(`/menu/gunun?yemekhane_id=${yh}&ogun_id=${ogun}&tarih=${tarih}`);
    if (!veri.menu) {
      kap.innerHTML = '<p>Seçilen kriterlere uygun menü bulunamadı.</p>';
      return;
    }
    const kulAlerjen = new Set(veri.kullanici_alerjenleri || []);
    kap.innerHTML = `
      <p><strong>${veri.menu.yemekhane}</strong> · ${veri.menu.tarih} · ${veri.menu.ogun}
      <br/>Öğrenci: <strong>${veri.menu.ogrenci_fiyati} TL</strong> · Personel: <strong>${veri.menu.personel_fiyati} TL</strong> · Toplam Kalori: <strong>${veri.toplam_kalori} kcal</strong></p>
      <div class="kart-izgara">
        ${veri.yemekler.map(y => {
          const uyariVar = (y.alerjen_idler || []).some(id => kulAlerjen.has(id));
          return `
            <div class="kart ${uyariVar ? 'alerjen-uyari' : ''}">
              <div><strong>${y.ad}</strong> <span class="etiket">${y.kategori}</span></div>
              <div>${y.kalori} kcal ${y.vejetaryen ? '<span class="etiket veg">Vejetaryen</span>' : ''}</div>
              <div>${y.alerjenler.length ? y.alerjenler.map(a => `<span class="etiket alerjen">${a}</span>`).join('') : '<small>Alerjen yok</small>'}</div>
              ${uyariVar ? '<div><span class="uyari-etiket">⚠ Alerjen Uyarısı!</span></div>' : ''}
            </div>`;
        }).join('')}
      </div>`;
  } catch (e) {
    bildirimGoster(e.message, 'hata');
  }
}

async function haftalikMenulerYukle() {
  const yh = document.getElementById('haftalik-yemekhane').value;
  const bas = document.getElementById('haftalik-baslangic').value;
  const kap = document.getElementById('haftalik-icerik');
  try {
    const veri = await api(`/menu/haftalik?yemekhane_id=${yh}&baslangic=${bas}`);
    if (!veri.menuler.length) {
      kap.innerHTML = '<p>Bu hafta için menü bulunamadı.</p>';
      return;
    }
    const simdi = new Date();
    kap.innerHTML = veri.menuler.map(m => {
      const tamFiyat = Number(aktifKullanici && aktifKullanici.rol === 'ogrenci' ? m.ogrenci_fiyati : m.personel_fiyati);
      const yarimFiyat = (tamFiyat * 0.6).toFixed(2);
      const kahvaltiMi = m.ogun === 'Kahvaltı';
      const sureDoldu = simdi >= new Date(m.rezervasyon_son.replace(' ', 'T'));
      const zatenAktif = m.kullanici_rez_durum === 'aktif' || m.kullanici_rez_durum === 'kullanildi';
      const pasif = !aktifKullanici || sureDoldu || m.bos_yer <= 0 || zatenAktif;

      let btnMetin = 'Rezervasyon Yap';
      if (!aktifKullanici) btnMetin = 'Giriş Gerekli';
      else if (zatenAktif) btnMetin = `Durum: ${m.kullanici_rez_durum} (${m.kullanici_rez_porsiyon || 'tam'})`;
      else if (sureDoldu) btnMetin = 'Süre Doldu';
      else if (m.bos_yer <= 0) btnMetin = 'Kapasite Dolu';

      return `
        <div class="kart">
          <div><strong>${m.tarih}</strong> · ${m.ogun}</div>
          <div>Boş Yer: <strong>${m.bos_yer}</strong> / ${m.kapasite}</div>
          <div>Tam: <strong>${tamFiyat.toFixed(2)} TL</strong> ${!kahvaltiMi ? `· Yarım: <strong>${yarimFiyat} TL</strong>` : ''} ${m.ortalama_puan ? `· ★ ${m.ortalama_puan}` : ''}</div>
          <small>Son Saat: ${m.rezervasyon_son}</small>
          ${!pasif && !kahvaltiMi ? `
            <div class="porsiyon-secim">
              <label><input type="radio" name="por-${m.menu_id}" value="tam" checked /> Tam</label>
              <label><input type="radio" name="por-${m.menu_id}" value="yarim" /> Yarım (%60)</label>
            </div>` : ''}
          <button class="btn-birincil" ${pasif ? 'disabled' : ''} onclick="rezervasyonYap(${m.menu_id})">${btnMetin}</button>
        </div>`;
    }).join('');
  } catch (e) {
    bildirimGoster(e.message, 'hata');
  }
}

window.rezervasyonYap = async function(menuId) {
  const seciliRadio = document.querySelector(`input[name="por-${menuId}"]:checked`);
  const porsiyon = seciliRadio ? seciliRadio.value : 'tam';
  try {
    const res = await api('/rezervasyonlar', {
      method: 'POST',
      body: JSON.stringify({ menu_id: menuId, porsiyon })
    });
    aktifKullanici.bakiye = res.bakiye;
    kullaniciArayuzuGuncelle();
    bildirimGoster(`${res.mesaj} Güncel bakiye: ${Number(res.bakiye).toFixed(2)} TL`);
    haftalikMenulerYukle();
  } catch (e) {
    bildirimGoster(e.message, 'hata');
  }
};

async function rezervasyonlarimYukle() {
  const kap = document.getElementById('rezervasyonlar-icerik');
  try {
    const veri = await api('/rezervasyonlar');
    if (!veri.rezervasyonlar.length) {
      kap.innerHTML = '<p>Henüz rezervasyonunuz yok.</p>';
      return;
    }
    const simdi = new Date();
    kap.innerHTML = `<div class="kart-izgara">${veri.rezervasyonlar.map(r => {
      const iptalEdilebilir = r.durum === 'aktif' && simdi < new Date(r.rezervasyon_son.replace(' ', 'T'));
      const degerlendirilebilir = r.durum === 'kullanildi';
      return `
        <div class="kart">
          <div><strong>${r.tarih}</strong> · ${r.yemekhane} (${r.ogun})</div>
          <div>Ücret: ${r.ucret} TL · Porsiyon: <strong>${r.porsiyon === 'yarim' ? 'Yarım' : 'Tam'}</strong> <span class="etiket ${r.durum}">${r.durum}</span></div>
          ${iptalEdilebilir ? `<button class="btn-iptal" onclick="rezervasyonIptal(${r.id})">İptal Et</button>` : ''}
          ${degerlendirilebilir ? `
            <div class="deg-form">
              <select id="puan-${r.menu_id}">
                ${[5,4,3,2,1].map(p => `<option value="${p}" ${r.kullanici_puani == p ? 'selected' : ''}>${p} Puan</option>`).join('')}
              </select>
              <input type="text" id="yorum-${r.menu_id}" placeholder="Yorumunuz" value="${r.kullanici_yorumu || ''}" />
              <button class="btn-birincil" onclick="degerlendir(${r.menu_id})">Kaydet</button>
            </div>` : ''}
        </div>`;
    }).join('')}</div>`;
  } catch (e) {
    bildirimGoster(e.message, 'hata');
  }
}

window.rezervasyonIptal = async function(id) {
  try {
    const res = await api(`/rezervasyonlar/${id}`, { method: 'DELETE' });
    aktifKullanici.bakiye = res.bakiye;
    kullaniciArayuzuGuncelle();
    bildirimGoster(`${res.mesaj} Güncel bakiye: ${Number(res.bakiye).toFixed(2)} TL`);
    rezervasyonlarimYukle();
  } catch (e) {
    bildirimGoster(e.message, 'hata');
  }
};

window.degerlendir = async function(menuId) {
  const puan = document.getElementById(`puan-${menuId}`).value;
  const yorum = document.getElementById(`yorum-${menuId}`).value;
  try {
    const res = await api('/degerlendirmeler', {
      method: 'POST',
      body: JSON.stringify({ menu_id: menuId, puan: Number(puan), yorum })
    });
    bildirimGoster(res.mesaj);
  } catch (e) {
    bildirimGoster(e.message, 'hata');
  }
};

async function bakiyeYukleEkran() {
  try {
    const veri = await api('/bakiye');
    document.getElementById('bakiye-tutar').textContent = `${Number(veri.bakiye).toFixed(2)} TL`;
    aktifKullanici.bakiye = veri.bakiye;
    kullaniciArayuzuGuncelle();
    document.getElementById('bakiye-hareketler').innerHTML = `
      <div class="tablo-kap">
        <table>
          <thead><tr><th>Tarih</th><th>Tür</th><th>Tutar</th><th>Açıklama</th></tr></thead>
          <tbody>
            ${veri.hareketler.map(h => `
              <tr><td>${h.olusturma}</td><td>${h.tur}</td><td>${h.tutar} TL</td><td>${h.aciklama || ''}</td></tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    bildirimGoster(e.message, 'hata');
  }
}

async function profilYukle() {
  try {
    const veri = await api('/profil/alerjenler');
    const seciliSet = new Set(veri.secili);
    document.getElementById('profil-alerjenler').innerHTML = veri.alerjenler.map(a => `
      <label><input type="checkbox" name="kul_alerjen" value="${a.id}" ${seciliSet.has(a.id) ? 'checked' : ''} /> ${a.ad}</label>
    `).join('');
  } catch (e) {
    bildirimGoster(e.message, 'hata');
  }
}

async function yoneticiYukle() {
  try {
    const veri = await api('/yonetici/veriler');
    document.getElementById('yon-yemekler').innerHTML = veri.yemekler.map(y => `
      <label><input type="checkbox" name="yon_yemek" value="${y.id}" /> ${y.ad} (${y.kategori})</label>
    `).join('');
    document.getElementById('yon-rapor').innerHTML = `
      <table>
        <thead><tr><th>Tarih</th><th>Yemekhane</th><th>Öğün</th><th>Doluluk</th><th>Ort. Puan</th></tr></thead>
        <tbody>
          ${veri.rapor.map(r => `
            <tr>
              <td>${r.tarih}</td><td>${r.yemekhane}</td><td>${r.ogun}</td>
              <td>${r.rezerve}/${r.kapasite} (%${r.doluluk_yuzde})</td>
              <td>${r.ortalama_puan ? `${r.ortalama_puan} (${r.oy_sayisi})` : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  } catch (e) {
    bildirimGoster(e.message, 'hata');
  }
}

async function baslat() {
  referans = await api('/referanslar');
  const yhOpts = referans.yemekhaneler.map(y => `<option value="${y.id}">${y.ad}</option>`).join('');
  const ogunOpts = referans.ogunler.map(o => `<option value="${o.id}">${o.ad}</option>`).join('');

  ['gunun-yemekhane', 'haftalik-yemekhane', 'yon-yemekhane'].forEach(id => document.getElementById(id).innerHTML = yhOpts);
  ['gunun-ogun', 'yon-ogun'].forEach(id => document.getElementById(id).innerHTML = ogunOpts);
  document.getElementById('gunun-ogun').value = '2';

  const bugun = bugunStr();
  ['gunun-tarih', 'haftalik-baslangic', 'yon-tarih'].forEach(id => document.getElementById(id).value = bugun);

  try {
    const ben = await api('/ben');
    aktifKullanici = ben.kullanici;
  } catch (_) {
    aktifKullanici = null;
  }
  kullaniciArayuzuGuncelle();
  gununMenusuYukle();

  document.querySelectorAll('#ana-nav button[data-sekme]').forEach(btn => {
    btn.addEventListener('click', () => sekmeAc(btn.dataset.sekme));
  });
  document.getElementById('btn-gunun-getir').addEventListener('click', gununMenusuYukle);
  document.getElementById('btn-haftalik-getir').addEventListener('click', haftalikMenulerYukle);

  document.getElementById('form-giris').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const res = await api('/giris', {
        method: 'POST',
        body: JSON.stringify({
          eposta: document.getElementById('giris-eposta').value,
          sifre: document.getElementById('giris-sifre').value
        })
      });
      aktifKullanici = res.kullanici;
      kullaniciArayuzuGuncelle();
      bildirimGoster('Giriş başarılı.');
      sekmeAc('haftalik');
    } catch (err) {
      bildirimGoster(err.message, 'hata');
    }
  });

  document.getElementById('btn-cikis').addEventListener('click', async () => {
    await api('/cikis', { method: 'POST' });
    aktifKullanici = null;
    kullaniciArayuzuGuncelle();
    bildirimGoster('Çıkış yapıldı.');
    sekmeAc('gunun');
  });

  document.getElementById('form-bakiye').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const tutar = Number(document.getElementById('yukleme-tutar').value);
      const res = await api('/bakiye/yukle', { method: 'POST', body: JSON.stringify({ tutar }) });
      document.getElementById('yukleme-tutar').value = '';
      bildirimGoster(res.mesaj);
      bakiyeYukleEkran();
    } catch (err) {
      bildirimGoster(err.message, 'hata');
    }
  });

  document.getElementById('form-alerjen').addEventListener('submit', async (e) => {
    e.preventDefault();
    const alerjen_idler = Array.from(document.querySelectorAll('input[name="kul_alerjen"]:checked')).map(c => Number(c.value));
    try {
      const res = await api('/profil/alerjenler', {
        method: 'PUT',
        body: JSON.stringify({ alerjen_idler })
      });
      bildirimGoster(res.mesaj);
    } catch (err) {
      bildirimGoster(err.message, 'hata');
    }
  });

  document.getElementById('form-menu-kaydet').addEventListener('submit', async (e) => {
    e.preventDefault();
    const yemek_idler = Array.from(document.querySelectorAll('input[name="yon_yemek"]:checked')).map(c => Number(c.value));
    try {
      const res = await api('/yonetici/menu', {
        method: 'POST',
        body: JSON.stringify({
          yemekhane_id: Number(document.getElementById('yon-yemekhane').value),
          ogun_id: Number(document.getElementById('yon-ogun').value),
          tarih: document.getElementById('yon-tarih').value,
          ogrenci_fiyati: Number(document.getElementById('yon-ogr-fiyat').value),
          personel_fiyati: Number(document.getElementById('yon-per-fiyat').value),
          yemek_idler
        })
      });
      bildirimGoster(res.mesaj);
      yoneticiYukle();
    } catch (err) {
      bildirimGoster(err.message, 'hata');
    }
  });
}

baslat();