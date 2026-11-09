import { useEffect, useState } from "react";

const API_URL = import.meta.env.VITE_API_URL;

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/api/health`)
      .then((res) => res.json())
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl font-bold mb-4">React + FastAPI + PostgreSQL</h1>
      {error && <p>Erro: {error}</p>}
      {data ? <pre>{JSON.stringify(data, null, 2)}</pre> : !error && <p>Carregando...</p>}
    </main>
  );
}
