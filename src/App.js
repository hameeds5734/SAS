import React, { Suspense, lazy } from 'react';
import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/dashboard';
import { ProgressSpinner } from 'primereact/progressspinner';

const Addbill = lazy(() => import('./components/addbill'));
const AcCreation = lazy(() => import('./components/account-creation'));
const Balance = lazy(() => import('./components/balance'));
const Payments = lazy(() => import('./components/payments'));
const ViewInvBill = lazy(() => import('./components/view-inv-bill'));

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
      <ProgressSpinner style={{ width: 50, height: 50 }} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />}>
          <Route index element={<Navigate to="/addbill" replace />} />
          <Route path="addbill" element={<Suspense fallback={<PageLoader />}><Addbill /></Suspense>} />
          <Route path="addbill/:id" element={<Suspense fallback={<PageLoader />}><Addbill /></Suspense>} />
          <Route path="vib" element={<Suspense fallback={<PageLoader />}><ViewInvBill /></Suspense>} />
          <Route path="ac" element={<Suspense fallback={<PageLoader />}><AcCreation /></Suspense>} />
          <Route path="balance" element={<Suspense fallback={<PageLoader />}><Balance /></Suspense>} />
          <Route path="payments" element={<Suspense fallback={<PageLoader />}><Payments /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
