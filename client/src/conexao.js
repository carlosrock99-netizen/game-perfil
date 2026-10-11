import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

export const socket = io({ autoConnect: true, reconnectionDelayMax: 3000 });

/** Emite e espera a resposta do servidor ({ok, erro, ...}). */
export function pedir(evento, dados = {}) {
  return new Promise((resolve) => {
    const limite = setTimeout(() => resolve({ ok: false, erro: 'O servidor não respondeu. Confira a internet.' }), 8000);
    socket.emit(evento, dados, (r) => { clearTimeout(limite); resolve(r || { ok: false, erro: 'Resposta vazia.' }); });
  });
}

/** Estado da sala, sempre o mais recente que o servidor mandou. */
export function useEstado() {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    const f = (e) => setEstado((atual) => (!atual || e.versao >= atual.versao || e.codigo !== atual.codigo ? e : atual));
    socket.on('estado', f);
    return () => socket.off('estado', f);
  }, []);
  return estado;
}

/** Resposta e dicas da carta: chega só no aparelho do mediador. */
export function useSegredo() {
  const [segredo, setSegredo] = useState(null);
  useEffect(() => {
    socket.on('segredo', setSegredo);
    return () => socket.off('segredo', setSegredo);
  }, []);
  return segredo;
}

export function useConectado() {
  const [on, setOn] = useState(socket.connected);
  useEffect(() => {
    const a = () => setOn(true); const b = () => setOn(false);
    socket.on('connect', a); socket.on('disconnect', b);
    return () => { socket.off('connect', a); socket.off('disconnect', b); };
  }, []);
  return on;
}

/** Ao reconectar, roda `fn` de novo (para voltar à sala). */
export function useAoConectar(fn) {
  useEffect(() => {
    socket.on('connect', fn);
    if (socket.connected) fn();
    return () => socket.off('connect', fn);
  }, [fn]);
}

export const guardar = {
  ler(chave) { try { return JSON.parse(localStorage.getItem('perfil:' + chave)); } catch { return null; } },
  gravar(chave, valor) { try { localStorage.setItem('perfil:' + chave, JSON.stringify(valor)); } catch { /* sem storage */ } },
  apagar(chave) { try { localStorage.removeItem('perfil:' + chave); } catch { /* sem storage */ } },
};

export function irPara(caminho) {
  window.history.pushState({}, '', caminho);
  window.dispatchEvent(new PopStateEvent('popstate'));
}
