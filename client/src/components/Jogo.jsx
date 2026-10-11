import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { pedir } from '../conexao';

export const NOMES_TEMA = { pessoa: 'uma pessoa', lugar: 'um lugar', coisa: 'uma coisa', ano: 'um ano' };
export const ROTULO_TEMA = { pessoa: 'Pessoa', lugar: 'Lugar', coisa: 'Coisa', ano: 'Ano' };

export function Carta({ estado, podeAbrir, aoAbrir }) {
  const { carta, totalDicas, fase } = estado;
  if (!carta) return null;
  const abertas = new Map(carta.dicas.map((d) => [d.n, d]));
  const recentes = [...carta.dicas].reverse();
  return (
    <section className={`carta tema-${carta.categoria}`} aria-label="Carta">
      <header className="carta-topo">
        <div>
          <div className="rotulo">Eu sou</div>
          <div className="carta-tema">{NOMES_TEMA[carta.categoria]}</div>
        </div>
        <div className="carta-conta">
          <b>{carta.dicas.length}</b>/{totalDicas} dicas
          {carta.especiaisPendentes > 0 && <small>{carta.especiaisPendentes} especial(is) escondida(s)</small>}
        </div>
      </header>
      <div className="numeros">
        {Array.from({ length: totalDicas }, (_, i) => i + 1).map((n) => {
          const d = abertas.get(n);
          return (
            <button
              key={n}
              type="button"
              className={`numero${d ? (d.especial ? ' especial' : ' aberta') : ''}`}
              disabled={!podeAbrir || !!d}
              onClick={() => aoAbrir(n)}
              aria-label={d ? `Dica ${n}, aberta` : `Abrir dica ${n}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {fase !== 'jogo' && carta.resposta && (
        <div className="resposta">
          <span className="rotulo">A resposta era</span>
          <strong>{carta.resposta}</strong>
          {carta.fonte && <a href={carta.fonte} target="_blank" rel="noreferrer">ver na Wikipédia</a>}
        </div>
      )}
      {recentes.length ? (
        <ol className="dicas">
          {recentes.map((d, i) => (
            <li key={d.n} className={i === 0 ? 'nova' : ''}>
              <b>{d.n}</b>
              <span>
                {d.texto}
                {d.especial && <em className="selo">{d.especial}</em>}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="vazio">Nenhuma dica aberta ainda.</p>
      )}
    </section>
  );
}

export function Tabuleiro({ estado, compacto }) {
  const meta = estado.config.meta;
  const colunas = 10;
  const linhas = Math.ceil(meta / colunas);
  const casas = [];
  for (let n = 1; n <= meta; n++) {
    const linha = Math.floor((n - 1) / colunas);
    const pos = (n - 1) % colunas;
    const col = linha % 2 ? colunas - 1 - pos : pos;
    casas.push(
      <div
        key={n}
        className={`casa${n === meta ? ' final' : n % 10 === 0 ? ' marco' : ''}`}
        style={{ gridRow: linhas - linha, gridColumn: col + 1 }}
      >
        <i>{n === meta ? 'FIM' : n}</i>
        <span className="peoes">
          {estado.jogadores.filter((j) => j.casa === n).map((j) => (
            <span key={j.id} className="peao" style={{ background: j.cor }} title={j.nome} />
          ))}
        </span>
      </div>,
    );
  }
  const largada = estado.jogadores.filter((j) => j.casa === 0);
  return (
    <section className={`painel${compacto ? ' compacto' : ''}`} aria-label="Tabuleiro">
      <div className="painel-topo">
        <h2>Tabuleiro</h2>
        <span className="sutil">Chegada na casa {meta}</span>
      </div>
      {largada.length > 0 && (
        <div className="largada">
          <span className="rotulo">Largada</span>
          {largada.map((j) => (
            <span key={j.id} className="largada-item"><span className="peao" style={{ background: j.cor }} />{j.nome}</span>
          ))}
        </div>
      )}
      <div className="tabuleiro" style={{ gridTemplateRows: `repeat(${linhas}, auto)` }}>{casas}</div>
    </section>
  );
}

export function Placar({ estado, meuId, souHost }) {
  const emJogo = estado.fase !== 'lobby';
  const lista = emJogo ? [...estado.jogadores].sort((a, b) => b.casa - a.casa) : estado.jogadores;
  return (
    <section className="painel" aria-label="Classificação">
      <div className="painel-topo">
        <h2>{emJogo ? 'Classificação' : `Jogadores (${estado.jogadores.length})`}</h2>
      </div>
      <ul className="placar">
        {lista.map((j, i) => (
          <li key={j.id} className={`${estado.vez === j.id ? 'da-vez' : ''}${j.fora ? ' fora' : ''}${j.online ? '' : ' off'}`}>
            <span className="bola" style={{ background: j.cor }} />
            <span className="nome">
              {emJogo && <span className="pos">{i + 1}º</span>}
              {j.nome}
              {j.id === meuId && <span className="sutil"> (você)</span>}
              {!j.online && <span className="tag">sem conexão</span>}
              {estado.fase === 'jogo' && estado.mediador === j.id && <span className="tag mediador">mediador</span>}
              {j.fora && estado.fase === 'jogo' && estado.mediador !== j.id && <span className="tag">fora da carta</span>}
            </span>
            {emJogo && <span className="pts" title="casa no tabuleiro">{j.casa}</span>}
            {souHost && j.id !== meuId && estado.fase !== 'fim' && (
              <button type="button" className="botao fantasma mini" onClick={() => pedir('comando', { tipo: 'remover', id: j.id })} aria-label={`Remover ${j.nome}`}>✕</button>
            )}
          </li>
        ))}
      </ul>
      {emJogo && (
        <p className="sutil ordem">Ordem das vezes: {estado.jogadores.map((j) => j.nome).join(' → ')}</p>
      )}
    </section>
  );
}

export function Convite({ codigo, grande }) {
  const link = `${window.location.origin}/sala/${codigo}`;
  const [qr, setQr] = useState('');
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#14213a', light: '#ffffff' } }).then(setQr).catch(() => setQr(''));
  }, [link]);
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sem clipboard */ }
  };
  const texto = encodeURIComponent(`Bora jogar Perfil! Entra na sala ${codigo}: ${link}`);
  return (
    <section className={`painel convite${grande ? ' grande' : ''}`} aria-label="Convite">
      <div className="convite-corpo">
        {qr && <img src={qr} alt={`QR code para entrar na sala ${codigo}`} className="qr" />}
        <div className="convite-texto">
          <span className="rotulo">Código da sala</span>
          <div className="codigo">{codigo}</div>
          <code className="link">{link}</code>
          <div className="linha">
            <a className="botao" href={`https://wa.me/?text=${texto}`} target="_blank" rel="noreferrer">Convidar no WhatsApp</a>
            <button type="button" className="botao fantasma" onClick={copiar}>{copiado ? 'Link copiado' : 'Copiar link'}</button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Painel do jogador: o que fazer agora. */
export function PainelVez({ estado, meuId }) {
  const [palpite, setPalpite] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const daVez = estado.jogadores.find((j) => j.id === estado.vez);
  const mediador = estado.jogadores.find((j) => j.id === estado.mediador);
  const minhaVez = meuId && estado.vez === meuId;
  const eu = estado.jogadores.find((j) => j.id === meuId);
  const vale = Math.max(1, estado.totalDicas - (estado.carta?.dicas.length || 0));

  useEffect(() => { setPalpite(''); setErro(''); }, [estado.carta?.categoria, estado.vez, estado.etapa]);

  const jogar = async (dados) => {
    setEnviando(true); setErro('');
    const r = await pedir('jogada', dados);
    setEnviando(false);
    if (!r.ok) setErro(r.erro);
  };

  if (estado.fase !== 'jogo') return null;
  return (
    <section className={`painel vez${minhaVez ? ' minha' : ''}`} aria-live="polite">
      <span className="rotulo">{minhaVez ? 'Sua vez' : 'Vez de'}</span>
      <h2 className="vez-nome">
        <span className="bola" style={{ background: daVez?.cor }} />
        {minhaVez ? 'Você joga agora' : daVez?.nome}
      </h2>
      {mediador && <p className="sutil">Mediador desta carta: <b>{mediador.nome}</b></p>}
      {estado.evento && <p className="aviso">{estado.evento}</p>}
      {minhaVez && estado.etapa === 'abrir' && (
        <p className="instrucao">{mediador ? 'Fale um número para o mediador ou toque nele na carta.' : 'Toque num número da carta para abrir uma dica.'}</p>
      )}
      {minhaVez && estado.etapa === 'decidir' && mediador && (
        <>
          <p className="instrucao">Fale seu palpite em voz alta. Acertar agora vale <b>{vale}</b> casa{vale > 1 ? 's' : ''}. O mediador confirma.</p>
          <button type="button" className="botao fantasma" disabled={enviando} onClick={() => jogar({ tipo: 'passar' })}>Passar a vez</button>
        </>
      )}
      {minhaVez && estado.etapa === 'decidir' && !mediador && (
        <>
          <p className="instrucao">Acertar agora vale <b>{vale}</b> casa{vale > 1 ? 's' : ''}. Errou, fica fora desta carta.</p>
          <form className="linha" onSubmit={(e) => { e.preventDefault(); if (palpite.trim()) jogar({ tipo: 'chutar', texto: palpite }); }}>
            <input id="palpite" value={palpite} onChange={(e) => setPalpite(e.target.value)} maxLength={80} autoComplete="off" placeholder="Seu palpite" aria-label="Seu palpite" />
            <button className="botao" disabled={enviando || !palpite.trim()}>Chutar</button>
          </form>
          <button type="button" className="botao fantasma" disabled={enviando} onClick={() => jogar({ tipo: 'passar' })}>Passar a vez</button>
        </>
      )}
      {!minhaVez && eu?.fora && <p className="sutil">Você errou o chute. Volta a jogar na próxima carta.</p>}
      {!minhaVez && !eu?.fora && <p className="sutil">{estado.etapa === 'abrir' ? 'Escolhendo uma dica…' : 'Pensando no palpite…'}</p>}
      {erro && <p className="erro">{erro}</p>}
    </section>
  );
}

/** Painel de quem é o mediador da carta: resposta, dica para ler e o veredito. */
export function PainelMediador({ estado, segredo }) {
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const daVez = estado.jogadores.find((j) => j.id === estado.vez);
  const ultima = estado.carta?.dicas[estado.carta.dicas.length - 1];
  const vale = Math.max(1, estado.totalDicas - (estado.carta?.dicas.length || 0));
  const abertas = new Set(estado.carta?.dicas.map((d) => d.n));

  const julgar = async (resultado) => {
    setEnviando(true); setErro('');
    const r = await pedir('jogada', { tipo: 'julgar', resultado });
    setEnviando(false);
    if (!r.ok) setErro(r.erro);
  };

  return (
    <section className="painel vez minha mediador" aria-live="polite">
      <span className="rotulo">Você é o mediador desta carta</span>
      <div className="segredo">
        <span className="rotulo">Resposta (não mostre)</span>
        <strong>{segredo ? segredo.resposta : '…'}</strong>
        {segredo?.alternativas?.length > 0 && <small>Também vale: {segredo.alternativas.join(', ')}</small>}
      </div>
      <p className="sutil">Vez de <b>{daVez?.nome}</b>.</p>
      {estado.evento && <p className="aviso">{estado.evento}</p>}
      {estado.etapa === 'abrir' && <p className="instrucao">Peça um número para {daVez?.nome} e toque nele na carta.</p>}
      {estado.etapa === 'decidir' && (
        <>
          {ultima && (
            <div className="ler">
              <span className="rotulo">Leia em voz alta · dica {ultima.n}</span>
              <p>{ultima.texto}</p>
              {ultima.especial && <em className="selo">{ultima.especial}</em>}
            </div>
          )}
          <p className="instrucao">{daVez?.nome} fala o palpite. Acertar vale <b>{vale}</b> casa{vale > 1 ? 's' : ''} para cada um de vocês.</p>
          <div className="veredito">
            <button type="button" className="botao certo" disabled={enviando} onClick={() => julgar('acertou')}>Acertou</button>
            <button type="button" className="botao errado" disabled={enviando} onClick={() => julgar('errou')}>Errou</button>
            <button type="button" className="botao fantasma" disabled={enviando} onClick={() => julgar('passou')}>Passou</button>
          </div>
        </>
      )}
      {segredo && (
        <details className="todas">
          <summary>Ver as 20 dicas</summary>
          <ol>
            {segredo.dicas.map((d) => (
              <li key={d.n} className={abertas.has(d.n) ? 'lida' : ''}>
                <b>{d.n}</b> {d.texto}{d.especial && <em className="selo">{d.especial}</em>}
              </li>
            ))}
          </ol>
        </details>
      )}
      {erro && <p className="erro">{erro}</p>}
    </section>
  );
}

/** Resultado da carta ou da partida. */
export function Resultado({ estado, souHost }) {
  const { fase, acerto, vencedor, evento } = estado;
  if (fase !== 'revelada' && fase !== 'fim') return null;
  return (
    <section className={`painel resultado${fase === 'fim' ? ' fim' : ''}`} aria-live="polite">
      {fase === 'fim' ? (
        <>
          <span className="rotulo">Fim de jogo</span>
          <h2 className="vencedor">{vencedor?.nome} venceu!</h2>
        </>
      ) : acerto ? (
        <p className="aviso ok">
          <b>{acerto.nome}</b> acertou com {acerto.abertas} dica{acerto.abertas > 1 ? 's' : ''} aberta{acerto.abertas > 1 ? 's' : ''} e andou <b>{acerto.casas}</b> casa{acerto.casas > 1 ? 's' : ''}.
          {acerto.mediador && <> O mediador <b>{acerto.mediador.nome}</b> também andou {acerto.mediador.casas}.</>}
        </p>
      ) : (
        <p className="aviso">{evento}</p>
      )}
      {souHost ? (
        fase === 'fim'
          ? <button type="button" className="botao" onClick={() => pedir('comando', { tipo: 'nova' })}>Jogar de novo</button>
          : <button type="button" className="botao" onClick={() => pedir('comando', { tipo: 'proxima' })}>Próxima carta</button>
      ) : (
        <p className="sutil">{fase === 'fim' ? 'O anfitrião pode começar outra partida.' : 'O anfitrião puxa a próxima carta.'}</p>
      )}
    </section>
  );
}
