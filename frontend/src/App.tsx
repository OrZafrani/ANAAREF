import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';
import CreateSimulation from './pages/CreateSimulation';
import SelectEvents from './pages/SelectEvents';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/simulations/new" element={<CreateSimulation />} />
          <Route path="/simulations/events" element={<SelectEvents />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
