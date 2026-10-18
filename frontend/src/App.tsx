import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import Home from './pages/Home';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout children={undefined} />} />
        <Route index element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}
