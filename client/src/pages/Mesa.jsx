import { useCallback, useEffect, useState } from 'react';
import { pedir, guardar, irPara, useEstado, useConectado, useAoConectar, useSegredo } from '../conexao';
import { Carta, Tabuleiro, Placar, Convite, PainelVez, PainelMediador, Resultado } from '../components/Jogo';

/**
 * Uma só tela para o anfitrião (telão) e para o jogador (celular).
 * modo="host": mostra convite, tabuleiro grande e controles da partida.
 * modo="jogador": pede o nome, entra na sala e mostra as jogadas.
 */
export default function Mesa({ codigo, modo }) {
  const souHost = modo === 'host';
  const estado = useEstado();
  const segredo = useSegredo();
  const conectado = useConectado();
  const [meuId, setMeuId] = useState(null);
  const [erro, setErro] = useState('');
  const [precisaNome, setPrecisaNome] = useState(false);
  const [nome, setNome] = useState(guardar.ler('nome') || '');

  const reconectar = useCallback(async () => {
    setErro('');
    if (souHost) {
      const h = guardar.ler(`host:${codigo}`);
      if (!h) { setErro('Esta tela não é a do anfitrião desta sala. Entre como jogador.'); return; }
      const r = await pedir('host', { codigo, hostChave: h.hostChave, chave: h.chave });
      if (!r.ok) return setErro(r.erro);
      if (r.id) setMeuId(r.id);
      return;
    }
    const j = guardar.ler(`jogador:${codigo}`);
    if (!j) { setPrecisaNome(true); await pedir('ver', { codigo }).then((r) => !r.ok && setErro(r.erro)); return; }
    const r = await pedir('entrar', { codigo, chave: j.chave, nome: guardar.ler('nome') });
    if (!r.ok) { setErro(r.erro); return; }
    setMeuId(r.id);
  }, [codigo, souHost]);
  useAoConectar(reconectar);

  async function entrar(e) {
    e.preventDefault();
    if (!nome.trim()) return setErro('Digite seu nome.');
    const r = await pedir('entrar', { codigo, nome: nome.trim() });
    if (!r.ok) return setErro(r.erro);
    guardar.gravar('nome', nome.trim());
    guardar.gravar(`jogador:${codigo}`, { chave: r.chave });
    setMeuId(r.id);
    setPrecisaNome(false);
  }

  // Mantém a tela do anfitrião acesa durante a partida.
  useEffect(() => {
    if (!souHost || !('wakeLock' in navigator)) return;
    let trava;
    const pedirTrava = () => navigator.wakeLock.request('screen').then((t) => { trava = t; }).catch(() => {});
    pedirTrava();
    document.addEventListener('visibilitychange', pedirTrava);
    return () => { document.removeEventListener('visibilitychange', pedirTrava); trava?.release().catch(() => {}); };
  }, [souHost]);

  const comando = async (tipo) => { const r = await pedir('comando', { tipo }); if (!r.ok) setErro(r.erro); };
  const abrir = async (n) => { const r = await pedir('jogada', { tipo: 'abrir', n }); if (!r.ok) setErro(r.erro); };

  if (!souHost && precisaNome && !meuId) {
    return (
      <main className="pagina estreita">
        <header className="marca"><span className="rotulo">Sala {codigo}</span><h1>Perfil <em>Online</em></h1></header>
        <form className="painel" onSubmit={entrar}>
          <label className="campo">
            <span className="rotulo">Seu nome</span>
            <input id="nome-sala" value={nome} maxLength={18} autoFocus onChange={(e) => setNome(e.target.value)} placeholder="Como vão te chamar" />
          </label>
          <button className="botao grande">Entrar na sala</button>
          {estado && <span className="sutil">{estado.jogadores.length} jogador(es) na sala{estado.fase !== 'lobby' ? '. A partida já começou: você entra a partir da próxima carta.' : '.'}</span>}
          {erro && <p className="erro">{erro}</p>}
        </form>
      </main>
    );
  }

  if (!estado) {
    return (
      <main className="pagina estreita">
        <header className="marca"><h1>Perfil <em>Online</em></h1></header>
        <section className="painel">
          <h2>{erro ? 'Não deu para entrar' : `Entrando na sala ${codigo}…`}</h2>
          {erro && <p className="erro">{erro}</p>}
          <button type="button" className="botao fantasma" onClick={() => irPara('/')}>Voltar ao início</button>
        </section>
      </main>
    );
  }

  const souMediador = !!meuId && estado.fase === 'jogo' && estado.mediador === meuId;
  const podeAbrir = !!meuId && estado.etapa === 'abrir' && (estado.vez === meuId || souMediador);
  const segredoAtual = souMediador && segredo && segredo.numCarta === estado.numCarta ? segredo : null;
  const lobby = estado.fase === 'lobby';

  return (
    <main className={`pagina mesa ${souHost ? 'telao' : 'celular'}`}>
      <header className="barra">
        <div>
          <span className="rotulo">{souHost ? 'Anfitrião' : 'Sala'} · {estado.codigo}</span>
          <h1 className="titulo-mesa">Perfil <em>Online</em></h1>
        </div>
        {!conectado && <span className="tag alerta">Reconectando…</span>}
      </header>
      {erro && <p className="erro" role="alert">{erro} <button type="button" className="botao fantasma mini" onClick={() => setErro('')}>OK</button></p>}

      {lobby ? (
        <div className="grade-mesa">
          <div className="coluna">
            {souHost ? <Convite codigo={estado.codigo} grande /> : (
              <section className="painel"><h2>Você está na sala</h2><p className="sutil">Aguarde o anfitrião começar a partida.</p></section>
            )}
          </div>
          <div className="coluna">
            <Placar estado={estado} meuId={meuId} souHost={souHost} />
            {souHost && (
              <section className="painel">
                <p className="sutil">{estado.cartasNoBaralho} cartas · chegada na casa {estado.config.meta} · dicas especiais {estado.config.especiais ? 'ligadas' : 'desligadas'}</p>
                <button type="button" className="botao grande" disabled={estado.jogadores.length < 2} onClick={() => comando('iniciar')}>
                  {estado.jogadores.length < 2 ? 'Esperando pelo menos 2 jogadores' : 'Começar partida'}
                </button>
              </section>
            )}
          </div>
        </div>
      ) : (
        <div className="grade-mesa">
          <div className="coluna">
            {souMediador && <PainelMediador estado={estado} segredo={segredoAtual} />}
            {meuId && !souMediador && <PainelVez estado={estado} meuId={meuId} />}
            {!meuId && estado.fase === 'jogo' && <VezTelao estado={estado} />}
            <Resultado estado={estado} souHost={souHost} />
            <Carta estado={estado} podeAbrir={podeAbrir} aoAbrir={abrir} />
            {souHost && estado.fase === 'jogo' && (
              <section className="painel controles">
                <span className="rotulo">Controles do anfitrião</span>
                {estado.ultimoErro && (
                  <p className="linha">
                    <span>{estado.ultimoErro.nome} chutou “{estado.ultimoErro.palpite}”. Estava certo?</span>
                    <button type="button" className="botao fantasma mini" onClick={() => comando('valer')}>Valer resposta</button>
                  </p>
                )}
                <div className="linha">
                  <button type="button" className="botao fantasma mini" onClick={() => comando('pular')}>Pular a vez</button>
                  <button type="button" className="botao fantasma mini" onClick={() => comando('revelar')}>Revelar resposta</button>
                </div>
              </section>
            )}
          </div>
          <div className="coluna">
            <Placar estado={estado} meuId={meuId} souHost={souHost} />
            <Tabuleiro estado={estado} compacto={!souHost} />
            {souHost && <Convite codigo={estado.codigo} />}
          </div>
        </div>
      )}
    </main>
  );
}

function VezTelao({ estado }) {
  const j = estado.jogadores.find((x) => x.id === estado.vez);
  return (
    <section className="painel vez" aria-live="polite">
      <span className="rotulo">Vez de</span>
      <h2 className="vez-nome"><span className="bola" style={{ background: j?.cor }} />{j?.nome}</h2>
      {estado.mediador && <p className="sutil">Mediador: <b>{estado.jogadores.find((x) => x.id === estado.mediador)?.nome}</b></p>}
      {estado.evento && <p className="aviso">{estado.evento}</p>}
      <p className="sutil">{estado.etapa === 'abrir' ? 'Escolhendo uma dica…' : estado.mediador ? 'Falando o palpite…' : 'Pensando no palpite…'}</p>
    </section>
  );
}
