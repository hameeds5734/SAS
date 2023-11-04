import React,{Suspense} from 'react';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from './components';
import Addbill from './components/addbill';
import Navbar from 'react-bootstrap/Navbar';

//const Addbill=React.lazy(()=>import('./components/addbill'));
const AcCreation=React.lazy(()=>import('./components/account-creation'));
const Balance=React.lazy(()=>import('./components/balance'));
const DtleDailySale=React.lazy(()=>import('./components/detailed-daily-sale'));
const DtleViewBill=React.lazy(()=>import('./components/detailed-view-bill'));
const EctDailySale=React.lazy(()=>import('./components/ect-daily-sale'));
const ViewInvBill=React.lazy(()=>import('./components/view-inv-bill'));

function Loading() {
  return <h2>🌀 Loading...</h2>;
}
function App() {
  return (
    <div className="App">
      <Navbar bg="light">
        <Navbar.Brand className="setmar" href="#"><h3>Shop Name</h3></Navbar.Brand>
      </Navbar>
      <br></br>
      <BrowserRouter>
       <Routes>
        <Route path="/" element={<Home/>}></Route>
        <Route path='/addbill' element={<Addbill/>}></Route>
        <Route path="/ac" element={<Suspense fallback={<Loading />}> <AcCreation /> </Suspense>}></Route>
        <Route path="/balance" element={<Suspense fallback={<Loading />}> <Balance/> </Suspense>}></Route>
        <Route path="/dds" element={<Suspense fallback={<Loading />}> <DtleDailySale/> </Suspense>}></Route>
        <Route path="/dvb" element={<Suspense fallback={<Loading />}> <DtleViewBill/> </Suspense>}></Route>
        <Route path="/eds" element={<Suspense fallback={<Loading />}> <EctDailySale/></Suspense>}></Route>
        <Route path="/vib" element={<Suspense fallback={<Loading />}> <ViewInvBill/> </Suspense>}></Route>
       </Routes>
      </BrowserRouter>
      
    </div>
  );
}

export default App;
