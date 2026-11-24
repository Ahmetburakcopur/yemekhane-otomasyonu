const express = require('express');
const cookieParser = require('cookie-parser');
const apiRoutes = require('./routes/apiRoutes');

const app = express();
const PORT = 8000;

app.use(express.json());
app.use(cookieParser());

app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`Yemekhane API ${PORT} portunda çalışıyor...`);
});