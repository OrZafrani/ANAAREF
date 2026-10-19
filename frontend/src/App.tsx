import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './layout/Layout';
import LibraryPage from './pages/LibraryPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout><LibraryPage /></Layout>} />
        <Route path="/library" element={<Layout><LibraryPage /></Layout>} />
      </Routes>
    </BrowserRouter>
  );
}
