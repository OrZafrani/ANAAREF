import { useEffect, useState } from 'react';
import { getHealth } from '../lib/api';
import './Home.css';

export default function Home() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((e: Error) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  return (
    <div className="home-container">
      <h1 className="home-title">ANAAREF</h1>
      <section>
        <h2 className="home-subtitle">סטטוס שרת</h2>
        {loading && <p>טוען...</p>}
        {error && <p className="error">{error}</p>}
        {data && (
          <pre className="json-output">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </section>
    </div>
  );
}
