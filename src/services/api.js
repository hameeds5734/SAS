import axios from 'axios';

const API = axios.create({ baseURL: 'http://localhost:5000/api' });

export const placesApi = {
  getAll: () => API.get('/places'),
  create: (data) => API.post('/places', data),
  update: (id, data) => API.put(`/places/${id}`, data),
  remove: (id) => API.delete(`/places/${id}`),
};

export const customersApi = {
  getAll: () => API.get('/customers'),
  create: (data) => API.post('/customers', data),
  update: (id, data) => API.put(`/customers/${id}`, data),
  remove: (id) => API.delete(`/customers/${id}`),
};

export const baseProductsApi = {
  getAll: () => API.get('/base-products'),
  create: (data) => API.post('/base-products', data),
  update: (id, data) => API.put(`/base-products/${id}`, data),
  remove: (id) => API.delete(`/base-products/${id}`),
};

export const productsApi = {
  getAll: () => API.get('/products'),
  create: (data) => API.post('/products', data),
  update: (id, data) => API.put(`/products/${id}`, data),
  remove: (id) => API.delete(`/products/${id}`),
};

export const billsApi = {
  getAll: () => API.get('/bills'),
  getById: (id) => API.get(`/bills/${id}`),
  getByCustomer: (customerId) => API.get(`/bills/by-customer/${customerId}`),
  create: (data) => API.post('/bills', data),
  update: (id, data) => API.put(`/bills/${id}`, data),
  remove: (id) => API.delete(`/bills/${id}`),
};

export const paymentsApi = {
  getAll: () => API.get('/payments'),
  getByCustomer: (customerId) => API.get(`/payments/customer/${customerId}`),
  create: (data) => API.post('/payments', data),
  update: (id, data) => API.put(`/payments/${id}`, data),
  remove: (id) => API.delete(`/payments/${id}`),
};

export const reportsApi = {
  getReport: (params) => API.get('/reports', { params }),
  getCustomerBalance: (params) => API.get('/reports/customer-balance', { params }),
  getDaywiseBalance: (params) => API.get('/reports/daywise-balance', { params }),
  getCustomerStatement: (params) => API.get('/reports/customer-statement', { params }),
  getDailySale: (params) => API.get('/reports/daily-sale', { params }),
  getProductSale: (params) => API.get('/reports/product-sale', { params }),
  getPaymentsReport: (params) => API.get('/reports/payments-report', { params }),
};
