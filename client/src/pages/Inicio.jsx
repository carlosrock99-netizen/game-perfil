import { useEffect, useState } from 'react';
import { pedir, guardar, irPara } from '../conexao';
import { ROTULO_TEMA } from '../components/Jogo';

const TEMAS = ['pessoa', 'lugar', 'coisa', 'ano'];
const METAS = [30, 50, 80];

export default function Inicio() {
  const [nome, setNome] = useState(guardar.ler('nome') || '');
  const [vouJogar, setVouJogar] = useState(true);
  const [temas, setTemas] = useState(TEMAS);
  const [meta, setMeta] = useState(50);
  const [especiais, setEspeciais] = useState(true);
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [baralho, setBaralho] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { fetch('/api/baralho').then((r) => r.json()).then(setBaralho).catch(() => {}); }, []);

  const alternarTema = (t) => setTemas((a) => (a.includes(t) ? a.filter((x) => x !== t) : [...a, t]));
  const cartasDisponiveis = baralho ? temas.reduce((s, t) => s + (baralho.porTema[t] || 0), 0) : null;

  async function criar(e) {
    e.preventDefault();
    if (vouJogar && !nome.trim()) return setErro('Digite seu nome para jogar também.');
    if (!temas.length) return setErro('Escolha pelo menos um tema.');
    setOcupado(true); setErro('');
    guardar.gravar('nome', nome.trim());
    const r = await pedir('criar', { nome: vouJogar ? nome.trim() : null, config: { temas, meta, especiais } });
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
            <legend className="rotulo">Temas</legend>
            <div className="opcoes">
              {TEMAS.map((t) => (
                <button key={t} type="button" className={`opcao${temas.includes(t) ? ' marcada' : ''}`} aria-pressed={temas.includes(t)} onClick={() => alternarTema(t)}>
                  {ROTULO_TEMA[t]}{baralho && <small>{baralho.porTema[t]}</small>}
                </button>
              ))}
            </div>
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
              <li>Na sua vez, abra uma dica da carta. Todos veem a dica.</li>
              <li>Chute a resposta ou passe a vez. Errou o chute, fica fora até a próxima carta.</li>
              <li>Quem acerta anda 1 casa por dica ainda fechada.</li>
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
