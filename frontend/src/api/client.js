import axios from 'axios';

const attachToken = (config) => {
  const token = localStorage.getItem('simrs_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

const handleAuthError = (error) => {
  if (error.response && error.response.status === 401) {
    localStorage.removeItem('simrs_token');
    localStorage.removeItem('simrs_user');
    window.location.href = '/login';
  }
  return Promise.reject(error);
};

export const yiiApi = axios.create({
  baseURL: import.meta.env.VITE_YII_API_URL || 'http://simrs-api.test',
  headers: { 'Content-Type': 'application/json' },
});
yiiApi.interceptors.request.use(attachToken);
yiiApi.interceptors.response.use((res) => res, handleAuthError);

export const nodeApi = axios.create({
  baseURL: import.meta.env.VITE_NODE_API_URL || 'http://127.0.0.1:3001/api',
  headers: { 'Content-Type': 'application/json' },
});
nodeApi.interceptors.request.use(attachToken);
nodeApi.interceptors.response.use((res) => res, handleAuthError);