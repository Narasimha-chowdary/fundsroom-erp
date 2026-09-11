import dotenv from 'dotenv';
dotenv.config();

import app from './app';

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[Fundsroom ERP] Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
