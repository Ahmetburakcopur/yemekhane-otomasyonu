const mysql = require('mysql2/promise');

const ortakAyar = {
  port: Number(process.env.DB_PORT || 3306),
  database: process.env.DB_ADI || 'yemekhane',
  user: process.env.DB_KULLANICI || 'yemekhane_app',
  password: process.env.DB_SIFRE || 'Uyg_2026',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: '+03:00',
  dateStrings: true
};

// Yazma işlemleri ve anlık bakiye okumaları için kaynak (primary)
const dbYazma = mysql.createPool({
  ...ortakAyar,
  host: process.env.DB_YAZMA_HOST || 'mysql-primary'
});

// Listeleme ve raporlama işlemleri için salt-okunur replika
const dbOkuma = mysql.createPool({
  ...ortakAyar,
  host: process.env.DB_OKUMA_HOST || 'mysql-replica'
});

module.exports = { dbYazma, dbOkuma };