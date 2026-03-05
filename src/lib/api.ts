import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor de token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor de resposta — suporte ao formato FastAPI { detail: "..." }
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    // FastAPI retorna { detail: "..." }, fallback para { message: "..." }
    const detail = error.response?.data?.detail;
    const message =
      typeof detail === 'string'
        ? detail
        : error.response?.data?.message || 'Ocorreu um erro inesperado';
    return Promise.reject(new Error(message));
  }
);

export default api;
