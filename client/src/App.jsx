import { useEffect, useState } from 'react';
import Inicio from './pages/Inicio';
import Mesa from './pages/Mesa';

// Rotas: /  ·  /sala/CODIGO (jogador)  ·  /host/CODIGO (telão do anfitrião)
function rota() {
  const m = window.location.pathname.match(/^\/(sala|host)\/([A-Za-z0-9]{5})\/?$/);
  return m ? { tela: m[1], codigo: m[2].toUpperCase() } : { tela: 'inicio' };
}

export default function App() {
  const [r, setR] = useState(rota);
  useEffect(() => {
    const f = () => setR(rota());
    window.addEventListener('popstate', f);
    return () => window.removeEventListener('popstate', f);
  }, []);
  if (r.tela === 'inicio') return <Inicio />;
  return <Mesa key={r.tela + r.codigo} codigo={r.codigo} modo={r.tela === 'host' ? 'host' : 'jogador'} />;
}
