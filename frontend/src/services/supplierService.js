import api from './api';

export const supplierService = {
  getAll: (params) => api.get('/suppliers', { params }),
  getById: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
  getEmissions: (id) => api.get(`/suppliers/${id}/emissions`),
};

export const emissionService = {
  getAll: (params) => api.get('/emissions', { params }),
  getById: (id) => api.get(`/emissions/${id}`),
  create: (data) => api.post('/emissions', data),
  update: (id, data) => api.put(`/emissions/${id}`, data),
  delete: (id) => api.delete(`/emissions/${id}`),
};

export const dashboardService = {
  getSummary: () => api.get('/dashboard/summary'),
  getTrends: (period) => api.get('/dashboard/trends', { params: { period } }),
};

export const carbonService = {
  calculate: (activityData) => api.post('/carbon/calculate', activityData),
  getForecast: () => api.get('/carbon/forecast'),
  getRecommendations: () => api.get('/carbon/recommendations'),
  scoreSupplier: (supplierId, data) => api.post(`/carbon/score/${supplierId}`, data),
};
