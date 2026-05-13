import { Link, Route, Routes } from 'react-router-dom';
import { ClientListPage } from './pages/ClientListPage';
import { ClientFormPage } from './pages/ClientFormPage';

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }} data-testid="home-link">
            Client Manager
          </Link>
        </h1>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>TDD_Testing</span>
      </header>
      <Routes>
        <Route path="/" element={<ClientListPage />} />
        <Route path="/new" element={<ClientFormPage />} />
        <Route path="/:id" element={<ClientFormPage />} />
        <Route
          path="*"
          element={
            <div className="empty" data-testid="not-found">
              Page not found.
            </div>
          }
        />
      </Routes>
    </div>
  );
}
