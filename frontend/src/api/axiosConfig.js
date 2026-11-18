import axios from 'axios';

// Klien API untuk Backend Utama (Yii2)
export const yiiApi = axios.create({
  baseURL: import.meta.env.VITE_YII_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Klien API untuk Backend Service (Node.js)
export const nodeApi = axios.create({
  baseURL: import.meta.env.VITE_NODE_API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor otomatis menyisipkan JWT token dari localStorage ke kedua backend
const attachToken = (config) => {
  const token = localStorage.getItem('simrs_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

yiiApi.interceptors.request.use(attachToken);
nodeApi.interceptors.request.use(attachToken);