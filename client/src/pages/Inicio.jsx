import { useEffect, useState } from 'react';
import { pedir, guardar, irPara } from '../conexao';
import { ROTULO_TEMA } from '../components/Jogo';

const TEMAS = ['pessoa', 'lugar', 'coisa', 'ano'];
const METAS = [30, 50, 80];
const NIVEIS = [
  { id: 'facil', nome: 'Fácil', dica: 'objetos do dia a dia, nomes e datas que todo mundo conhece' },
  { id: 'medio', nome: 'Médio', dica: 'conhecimento geral, cultura brasileira e mundial' },
  { id: 'dificil', nome: 'Difícil', dica: 'pede leitura, história e geografia além do básico' },
  { id: 'complexo', nome: 'Complexo', dica: 'para quem gosta de quiz: nomes e anos pouco lembrados' },
];

export default function Inicio() {
  const [nome, setNome] = useState(guardar.ler('nome') || '');
  const [vouJogar, setVouJogar] = useState(true);
  const [temas, setTemas] = useState(TEMAS);
  const [meta, setMeta] = useState(50);
  const [especiais, setEspeciais] = useState(true);
  const [modo, setModo] = useState('mediador');
  const [niveis, setNiveis] = useState(['facil', 'medio', 'dificil', 'complexo']);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [baralho, setBaralho] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { fetch('/api/baralho').then((r) => r.json()).then(setBaralho).catch(() => {}); }, []);

  const alternarTema = (t) => setTemas((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));
  const alternarNivel = (n) => setNiveis((a) => (a.includes(n) ? a.filter((x) => x !== n) : [...a, n]));
  const contar = (ts, ns) => (baralho?.contagem
    ? ts.reduce((s, t) => s + ns.reduce((q, n) => q + (baralho.contagem[t]?.[n] || 0), 0) + (baralho.contagem[t]?.sem || 0), 0)
    : null);
  const cartasDisponiveis = contar(temas, niveis);

  async function criar(e) {
    e.preventDefault();
    if (vouJogar && !nome.trim()) return setErro('Digite seu nome para jogar também.');
    if (!temas.length) return setErro('Escolha pelo menos um tema.');
    if (!niveis.length) return setErro('Escolha pelo menos um nível.');
    if (cartasDisponiveis !== null && cartasDisponiveis < 5) return setErro('Poucas cartas com esses temas e níveis. Marque mais opções.');
    setOcupado(true); setErro('');
    guardar.gravar('nome', nome.trim());
    const r = await pedir('criar', { nome: vouJogar ? nome.trim() : null, config: { temas, niveis, meta, especiais, modo } });
    setOcupado(false);
    if (!r.ok) return setErro(r.erro);
    guardar.gravar(`host:${r.codigo}`, { hostChave: r.hostChave, chave: r.chave || null });
    if (r.chave) guardar.gravar(`jogador:${r.codigo}`, { chave: r.chave });
    irPara(`/host/${r.codigo}`);
  }

  function entrar(e) {
    e.preventDefault();
    const c = codigo.trim().toUpperCase();
    if (c.length < 5) return setErro('O código tem 5 letras ou números.');
    irPara(`/sala/${c}`);
  }

  return (
    <main className="pagina inicio">
      <header className="marca">
        <span className="rotulo">Jogo de dicas para a turma</span>
        <h1>Perfil <em>Online</em></h1>
        <p className="lead">Uma carta, 20 dicas, quem descobrir primeiro anda mais no tabuleiro. Cada um joga do próprio celular.</p>
      </header>

      <div className="grade-inicio">
        <form className="painel" onSubmit={criar}>
          <h2>Criar sala</h2>
          <label className="campo">
            <span className="rotulo">Seu nome</span>
            <input id="nome" value={nome} maxLength={18} onChange={(e) => setNome(e.target.value)} placeholder="Como vão te chamar" />
          </label>
          <label className="check">
            <input id="vou-jogar" type="checkbox" checked={vouJogar} onChange={(e) => setVouJogar(e.target.checked)} />
            Também vou jogar deste aparelho
          </label>
          <fieldset className="campo">
            <legend className="rotulo">Como se dá o palpite</legend>
            <div className="opcoes">
              <button type="button" className={`opcao${modo === 'mediador' ? ' marcada' : ''}`} aria-pressed={modo === 'mediador'} onClick={() => setModo('mediador')}>Mediador na roda</button>
              <button type="button" className={`opcao${modo === 'digitado' ? ' marcada' : ''}`} aria-pressed={modo === 'digitado'} onClick={() => setModo('digitado')}>Palpite digitado</button>
            </div>
            <span className="sutil">{modo === 'mediador'
              ? 'A cada carta um jogador vira mediador: vê a resposta, lê as dicas e confirma o palpite falado. Melhor para jogar junto.'
              : 'Cada um digita o palpite e o jogo confere sozinho. Melhor para jogar a distância.'}</span>
          </fieldset>
          <fieldset className="campo">
            <legend className="rotulo">Temas</legend>
            <div className="opcoes">
              {TEMAS.map((t) => (
                <button key={t} type="button" className={`opcao${temas.includes(t) ? ' marcada' : ''}`} aria-pressed={temas.includes(t)} onClick={() => alternarTema(t)}>
                  {ROTULO_TEMA[t]}{baralho && <small>{contar([t], niveis)}</small>}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="campo">
            <legend className="rotulo">Nível de dificuldade</legend>
            <div className="opcoes">
              {NIVEIS.map((n) => (
                <button key={n.id} type="button" className={`opcao nivel-${n.id}${niveis.includes(n.id) ? ' marcada' : ''}`} aria-pressed={niveis.includes(n.id)} onClick={() => alternarNivel(n.id)}>
                  {n.nome}{baralho && <small>{contar(temas, [n.id]) - contar(temas, [])}</small>}
                </button>
              ))}
            </div>
            <span className="sutil">{niveis.length === 1 ? NIVEIS.find((n) => n.id === niveis[0]).dica : 'Pode marcar mais de um. As cartas saem misturadas entre os níveis marcados.'}</span>
          </fieldset>
          <fieldset className="campo">
            <legend className="rotulo">Casa de chegada</legend>
            <div className="opcoes">
              {METAS.map((m) => (
                <button key={m} type="button" className={`opcao${meta === m ? ' marcada' : ''}`} aria-pressed={meta === m} onClick={() => setMeta(m)}>{m}</button>
              ))}
            </div>
            <span className="sutil">{meta <= 30 ? 'Partida de uns 15 minutos.' : meta <= 50 ? 'Partida de uns 25 minutos.' : 'Partida de mais de 40 minutos.'}</span>
          </fieldset>
          <label className="check">
            <input id="especiais" type="checkbox" checked={especiais} onChange={(e) => setEspeciais(e.target.checked)} />
            Dicas especiais (perca a vez, avance 3, volte 2, abra outra)
          </label>
          {cartasDisponiveis !== null && <span className="sutil">{cartasDisponiveis} cartas no baralho escolhido.</span>}
          <button className="botao grande" disabled={ocupado}>{ocupado ? 'Criando…' : 'Criar sala'}</button>
        </form>

        <div className="coluna">
          <form className="painel" onSubmit={entrar}>
            <h2>Entrar numa sala</h2>
            <label className="campo">
              <span className="rotulo">Código da sala</span>
              <input id="codigo" value={codigo} maxLength={5} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="Ex.: K7BXQ" className="input-codigo" autoCapitalize="characters" />
            </label>
            <button className="botao fantasma grande">Entrar</button>
          </form>
          <section className="painel regras">
            <h2>Como joga</h2>
            <ol>
              <li>A cada carta, um jogador da roda é o mediador e vê a resposta.</li>
              <li>Na sua vez, escolha um número. O mediador lê a dica em voz alta.</li>
              <li>Fale o palpite ou passe a vez. Errou, fica fora até a próxima carta.</li>
              <li>Quem acerta anda 1 casa por dica ainda fechada. O mediador anda o mesmo tanto.</li>
              <li>Ganha quem chegar primeiro à casa final.</li>
            </ol>
          </section>
        </div>
      </div>
      {erro && <p className="erro flutuante" role="alert">{erro}</p>}
      <footer className="rodape sutil">Cartas e regras base do projeto <a href="https://github.com/AdrielFerr/perfil" target="_blank" rel="noreferrer">AdrielFerr/perfil</a> (MIT).</footer>
    </main>
  );
}
