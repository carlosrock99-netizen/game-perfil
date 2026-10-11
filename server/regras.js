// Regras da partida. Módulo puro: não sabe nada de rede. O servidor chama
// os métodos e manda `visao()` para todos da sala.
//
// Base: regras do AdrielFerr/perfil (RegrasPartida.php), mais o que o
// Perfil de tabuleiro tem e o original não tinha: dicas especiais.
//
//  - 20 dicas por carta; o jogador da vez abre uma dica e chuta ou passa.
//  - Acertou: anda 1 casa por dica ainda fechada (mínimo 1).
//  - Errou o chute: fica fora desta carta e volta na próxima.
//  - Todos fora ou dicas acabaram: ninguém anda, a resposta aparece.
//  - Vence quem chegar primeiro à casa final (meta).
//  - Dicas especiais (opcional): ao abrir, além da dica, aplicam um efeito.
//  - Carta nunca se repete na mesma partida.
//
// Dois modos:
//  - digitado: o jogador digita o palpite e o servidor confere.
//  - mediador: a cada carta um jogador da roda vira mediador. Só ele vê a
//    resposta e as 20 dicas; lê a dica em voz alta, ouve o palpite falado e
//    aperta Acertou, Errou ou Passou. Quando alguém acerta, o mediador anda o
//    mesmo número de casas (as dicas que ficaram fechadas).

const { verificar } = require('./palpite');

const TOTAL_DICAS = 20;
const MAX_JOGADORES = 12;
const CORES = ['#ff6b6b', '#4dabf7', '#3ddc97', '#ffa94d', '#c084fc', '#f783ac', '#20c997', '#fcc419', '#a9e34b', '#e599f7', '#74c0fc', '#ff8787'];
const ESPECIAIS = {
  perca: 'Perca a vez',
  avance: 'Avance 3 casas',
  volte: 'Volte 2 casas',
  outra: 'Abra outra dica',
};
const TEMAS = ['pessoa', 'lugar', 'coisa', 'ano'];

class ErroJogo extends Error {}
const falha = (msg) => { throw new ErroJogo(msg); };

function sortear(lista, rnd = Math.random) {
  return lista[Math.floor(rnd() * lista.length)];
}

class Sala {
  /**
   * @param {object} p
   * @param {string} p.codigo
   * @param {object[]} p.baralho cartas no formato de data/cartas.json
   * @param {object} [p.config] {meta, temas, niveis, especiais}
   * @param {Function} [p.rnd] gerador aleatório (para testes)
   */
  constructor({ codigo, baralho, config = {}, rnd = Math.random }) {
    this.codigo = codigo;
    this.rnd = rnd;
    this.baralhoCompleto = baralho;
    this.config = {
      meta: Math.min(120, Math.max(10, Number(config.meta) || 50)),
      temas: (config.temas || TEMAS).filter((t) => TEMAS.includes(t)),
      niveis: Array.isArray(config.niveis) ? config.niveis : [],
      especiais: config.especiais !== false,
      modo: config.modo === 'digitado' ? 'digitado' : 'mediador',
    };
    if (!this.config.temas.length) this.config.temas = [...TEMAS];
    if (!this.baralho().length) falha('Nenhuma carta com esses temas e níveis.');
    this.fase = 'lobby'; // lobby | jogo | revelada | fim
    this.etapa = null; // abrir | decidir (dentro de 'jogo')
    this.jogadores = [];
    this.vez = 0;
    this.iniciador = 0;
    this.carta = null;
    this.numCarta = 0;
    this.mediador = null;
    this.especiais = {};
    this.abertas = [];
    this.fora = new Set();
    this.usadas = new Set();
    this.evento = null;
    this.ultimoErro = null;
    this.acerto = null;
    this.vencedor = null;
    this.versao = 0;
  }

  baralho() {
    const { temas, niveis } = this.config;
    return this.baralhoCompleto.filter(
      (c) => temas.includes(c.categoria) && (!niveis.length || !c.nivel || niveis.includes(c.nivel)),
    );
  }

  // ---------- jogadores ----------
  adicionarJogador({ id, nome }) {
    const limpo = String(nome || '').trim().slice(0, 18);
    if (!limpo) falha('Digite um nome.');
    const existente = this.jogadores.find((j) => j.id === id);
    if (existente) { existente.nome = limpo; existente.online = true; return this.mudou(existente); }
    if (this.jogadores.length >= MAX_JOGADORES) falha(`A sala já tem ${MAX_JOGADORES} jogadores.`);
    if (this.fase === 'fim') falha('Esta partida já terminou.');
    if (this.jogadores.some((j) => j.nome.toLowerCase() === limpo.toLowerCase())) falha('Já tem alguém com esse nome na sala.');
    const usadas = this.jogadores.map((j) => j.cor);
    const cor = CORES.find((c) => !usadas.includes(c)) || CORES[this.jogadores.length % CORES.length];
    const jogador = { id, nome: limpo, cor, casa: 0, acertos: 0, online: true };
    this.jogadores.push(jogador);
    // Quem entra no meio da carta só joga a partir da próxima.
    if (this.fase === 'jogo') this.fora.add(id);
    return this.mudou(jogador);
  }

  conexao(id, online) {
    const j = this.jogador(id);
    if (j && j.online !== online) { j.online = online; this.mudou(); }
  }

  remover(id) {
    const ix = this.jogadores.findIndex((j) => j.id === id);
    if (ix < 0) return;
    const daVez = this.jogadorDaVez();
    this.jogadores.splice(ix, 1);
    this.fora.delete(id);
    if (!this.jogadores.length) { this.fase = 'lobby'; return this.mudou(); }
    if (ix < this.iniciador) this.iniciador--;
    this.iniciador %= this.jogadores.length;
    if (this.fase === 'jogo' && id === this.mediador) {
      this.encerrarCarta('O mediador saiu da sala. A carta foi encerrada.');
    } else if (this.fase === 'jogo') {
      if (daVez && daVez.id === id) {
        this.vez = (ix - 1 + this.jogadores.length) % this.jogadores.length;
        this.passarVez(`${daVez.nome} saiu da sala.`);
      } else {
        this.vez = this.jogadores.indexOf(daVez);
      }
    }
    return this.mudou();
  }

  // ---------- fluxo ----------
  iniciar() {
    if (this.fase !== 'lobby') falha('A partida já começou.');
    if (this.jogadores.length < 2) falha('Precisa de pelo menos 2 jogadores.');
    for (let i = this.jogadores.length - 1; i > 0; i--) {
      const k = Math.floor(this.rnd() * (i + 1));
      [this.jogadores[i], this.jogadores[k]] = [this.jogadores[k], this.jogadores[i]];
    }
    this.iniciador = 0;
    this.novaCarta();
    return this.mudou();
  }

  novaCarta() {
    let livres = this.baralho().filter((c) => !this.usadas.has(c.id));
    if (!livres.length) { this.usadas.clear(); livres = this.baralho(); }
    this.carta = sortear(livres, this.rnd);
    this.usadas.add(this.carta.id);
    this.abertas = [];
    this.fora = new Set();
    this.especiais = {};
    if (this.config.especiais) {
      const tipos = Object.keys(ESPECIAIS);
      const numeros = Array.from({ length: TOTAL_DICAS }, (_, i) => i + 1);
      for (let k = 0; k < 2; k++) {
        const [n] = numeros.splice(Math.floor(this.rnd() * numeros.length), 1);
        this.especiais[n] = sortear(tipos, this.rnd);
      }
    }
    this.numCarta++;
    this.fase = 'jogo';
    this.etapa = 'abrir';
    if (this.modoMediador()) {
      this.mediador = this.jogadores[this.iniciador].id;
      this.fora.add(this.mediador);
      this.vez = (this.iniciador + 1) % this.jogadores.length;
    } else {
      this.mediador = null;
      this.vez = this.iniciador;
    }
    this.acerto = null;
    this.ultimoErro = null;
    this.evento = null;
  }

  proximaCarta() {
    if (this.fase !== 'revelada') falha('A carta ainda está em jogo.');
    this.iniciador = (this.iniciador + 1) % this.jogadores.length;
    this.novaCarta();
    return this.mudou();
  }

  revelar() {
    if (this.fase !== 'jogo') return;
    this.encerrarCarta('O anfitrião revelou a resposta. Ninguém anda.');
    return this.mudou();
  }

  novaPartida() {
    for (const j of this.jogadores) { j.casa = 0; j.acertos = 0; }
    this.usadas.clear();
    this.fase = 'lobby';
    this.etapa = null;
    this.carta = null;
    this.mediador = null;
    this.vencedor = null;
    this.acerto = null;
    this.evento = null;
    return this.mudou();
  }

  // ---------- jogadas ----------
  abrirDica(id, n) {
    this.exigirVez(id, 'abrir');
    n = Number(n);
    if (!Number.isInteger(n) || n < 1 || n > TOTAL_DICAS) falha('Número de dica inválido.');
    if (this.abertas.includes(n)) falha('Essa dica já está aberta.');
    const j = this.jogadorDaVez();
    this.abertas.push(n);
    this.ultimoErro = null;
    this.evento = null;
    const especial = this.especiais[n];
    if (especial === 'perca') { this.passarVez(`${j.nome} tirou PERCA A VEZ.`); return this.mudou(); }
    if (especial === 'avance') {
      this.andar(j, 3);
      this.evento = `${j.nome} avançou 3 casas.`;
      if (this.vencedor) return this.mudou();
    }
    if (especial === 'volte') { this.andar(j, -2); this.evento = `${j.nome} voltou 2 casas.`; }
    if (especial === 'outra' && this.abertas.length < TOTAL_DICAS) {
      this.evento = `${j.nome} abre outra dica.`;
      return this.mudou();
    }
    this.etapa = 'decidir';
    return this.mudou();
  }

  chutar(id, texto) {
    this.exigirVez(id, 'decidir');
    if (this.modoMediador()) falha('Fale o palpite em voz alta. O mediador confirma.');
    const palpite = String(texto || '').trim().slice(0, 80);
    if (!palpite) falha('Digite um palpite.');
    const j = this.jogador(id);
    const r = verificar(palpite, this.carta.resposta, this.carta.alternativas);
    if (r.acertou) { this.pontuar(j, palpite); return this.mudou(); }
    this.fora.add(id);
    this.ultimoErro = { id, nome: j.nome, palpite, fechadas: TOTAL_DICAS - this.abertas.length };
    this.passarVez(`${j.nome} chutou “${palpite}” e errou. Está fora desta carta.`);
    return this.mudou();
  }

  passar(id) {
    this.exigirVez(id, 'decidir');
    this.passarVez(`${this.jogadorDaVez().nome} passou a vez.`);
    return this.mudou();
  }

  /** Modo mediador: o mediador diz se o palpite falado acertou. */
  julgar(id, resultado) {
    if (!this.modoMediador()) falha('Esta sala usa palpite digitado.');
    if (this.fase !== 'jogo') falha('A carta não está em jogo.');
    if (id !== this.mediador) falha('Só o mediador confirma o palpite.');
    if (this.etapa !== 'decidir') falha('Primeiro abra uma dica.');
    const j = this.jogadorDaVez();
    if (resultado === 'acertou') this.pontuar(j, null);
    else if (resultado === 'errou') {
      this.fora.add(j.id);
      this.passarVez(`${j.nome} errou o palpite. Está fora desta carta.`);
    } else if (resultado === 'passou') this.passarVez(`${j.nome} passou a vez.`);
    else falha('Resultado inválido.');
    return this.mudou();
  }

  /** O anfitrião aceita o último chute errado (erro de digitação, sinônimo). */
  valerUltimoChute() {
    if (this.fase !== 'jogo' || !this.ultimoErro) falha('Não há chute para validar.');
    const { id, palpite, fechadas } = this.ultimoErro;
    const j = this.jogador(id);
    if (!j) falha('Esse jogador saiu da sala.');
    this.pontuar(j, palpite, fechadas);
    return this.mudou();
  }

  pularVez() {
    if (this.fase !== 'jogo') falha('Não há vez para pular.');
    this.passarVez(`${this.jogadorDaVez().nome} foi pulado pelo anfitrião.`);
    return this.mudou();
  }

  // ---------- internos ----------
  pontuar(j, palpite, fechadas = TOTAL_DICAS - this.abertas.length) {
    const casas = Math.max(1, fechadas);
    j.acertos++;
    this.acerto = { id: j.id, nome: j.nome, palpite, casas, abertas: TOTAL_DICAS - fechadas, mediador: null };
    this.andar(j, casas);
    const m = this.mediador && this.jogador(this.mediador);
    if (m && !this.vencedor) {
      this.andar(m, casas);
      this.acerto.mediador = { id: m.id, nome: m.nome, casas };
    }
    if (!this.vencedor) { this.fase = 'revelada'; this.etapa = null; }
  }

  andar(j, casas) {
    j.casa = Math.max(0, Math.min(this.config.meta, j.casa + casas));
    if (j.casa >= this.config.meta) {
      this.vencedor = { id: j.id, nome: j.nome };
      this.fase = 'fim';
      this.etapa = null;
    }
  }

  passarVez(evento) {
    this.evento = evento;
    if (this.abertas.length >= TOTAL_DICAS) return this.encerrarCarta(`${evento} As dicas acabaram e ninguém anda.`);
    const n = this.jogadores.length;
    for (let passo = 1; passo <= n; passo++) {
      const ix = (this.vez + passo) % n;
      if (!this.fora.has(this.jogadores[ix].id)) {
        this.vez = ix;
        this.etapa = 'abrir';
        return;
      }
    }
    this.encerrarCarta(`${evento} Todos erraram e ninguém anda.`);
  }

  encerrarCarta(evento) {
    this.fase = 'revelada';
    this.etapa = null;
    this.acerto = null;
    this.evento = evento;
  }

  exigirVez(id, etapa) {
    if (this.fase !== 'jogo') falha('A carta não está em jogo.');
    const j = this.jogadorDaVez();
    const mediadorAgindo = this.modoMediador() && id === this.mediador;
    if (!j || (j.id !== id && !mediadorAgindo)) falha('Não é a sua vez.');
    if (this.etapa !== etapa) falha(etapa === 'abrir' ? 'Primeiro chute ou passe a vez.' : 'Primeiro abra uma dica.');
  }

  modoMediador() { return this.config.modo === 'mediador'; }

  /** O que só o mediador pode ver: resposta e todas as dicas. */
  segredo() {
    if (!this.mediador || this.fase !== 'jogo') return null;
    return {
      para: this.mediador,
      numCarta: this.numCarta,
      resposta: this.carta.resposta,
      alternativas: this.carta.alternativas,
      dicas: this.carta.dicas.map((d, i) => ({
        n: i + 1, texto: d.texto, especial: this.especiais[i + 1] ? ESPECIAIS[this.especiais[i + 1]] : null,
      })),
    };
  }

  jogador(id) { return this.jogadores.find((j) => j.id === id); }
  jogadorDaVez() { return this.fase === 'jogo' ? this.jogadores[this.vez] : null; }
  mudou(r) { this.versao++; return r; }

  /** Estado público: a resposta só sai depois de revelada. */
  visao() {
    const c = this.carta;
    const mostrarResposta = this.fase === 'revelada' || this.fase === 'fim';
    return {
      codigo: this.codigo,
      versao: this.versao,
      fase: this.fase,
      etapa: this.etapa,
      config: this.config,
      totalDicas: TOTAL_DICAS,
      cartasNoBaralho: this.baralho().length,
      jogadores: this.jogadores.map((j) => ({
        id: j.id, nome: j.nome, cor: j.cor, casa: j.casa, acertos: j.acertos, online: j.online, fora: this.fora.has(j.id),
      })),
      vez: this.jogadorDaVez()?.id ?? null,
      mediador: this.mediador,
      numCarta: this.numCarta,
      carta: c && {
        categoria: c.categoria,
        resposta: mostrarResposta ? c.resposta : null,
        fonte: mostrarResposta ? c.fonte : null,
        dicas: this.abertas.map((n) => ({
          n,
          texto: c.dicas[n - 1].texto,
          especial: this.especiais[n] ? ESPECIAIS[this.especiais[n]] : null,
        })),
        especiaisPendentes: Object.keys(this.especiais).filter((n) => !this.abertas.includes(+n)).length,
      },
      evento: this.evento,
      ultimoErro: this.ultimoErro && { nome: this.ultimoErro.nome, palpite: this.ultimoErro.palpite },
      acerto: this.acerto,
      vencedor: this.vencedor,
    };
  }
}

module.exports = { Sala, ErroJogo, TOTAL_DICAS, TEMAS, ESPECIAIS };
