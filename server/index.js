// Servidor do Perfil Online: Express serve o front compilado e o Socket.io
// leva as jogadas em tempo real. As salas ficam em memória.

const path = require('path');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { Sala, ErroJogo, TEMAS, NIVEIS } = require('./regras');

const PORTA = Number(process.env.PORT) || 3000;
const SALA_OCIOSA_MS = 6 * 60 * 60 * 1000; // apaga salas paradas há 6 h
const PULAR_AUSENTE_MS = 25 * 1000; // pula a vez de quem caiu
const baralho = require(process.env.CARTAS || path.join(__dirname, '..', 'data', 'cartas.json'));

const app = express();
const servidor = http.createServer(app);
const io = new Server(servidor, { cors: { origin: process.env.CORS_ORIGIN || false } });

/** codigo -> { sala, hostChave, chaves: Map<chave,id>, tocadaEm, ausenteDesde } */
const salas = new Map();

const ALFABETO = 'BCDFGHJKLMNPQRSTVWXZ23456789';
function novoCodigo() {
  for (;;) {
    const c = Array.from(crypto.randomBytes(5), (b) => ALFABETO[b % ALFABETO.length]).join('');
    if (!salas.has(c)) return c;
  }
}
const novaChave = () => crypto.randomBytes(16).toString('hex');
const novoId = () => crypto.randomBytes(6).toString('hex');

function log(...a) { console.log(new Date().toISOString(), ...a); }

function transmitir(reg) {
  reg.tocadaEm = Date.now();
  io.to(reg.sala.codigo).emit('estado', reg.sala.visao());
  enviarSegredo(reg);
}

/** A resposta vai só para os aparelhos do mediador da carta. */
function enviarSegredo(reg, apenasSocket) {
  const seg = reg.sala.segredo();
  if (!seg) return;
  const alvos = apenasSocket ? [apenasSocket]
    : [...(io.sockets.adapter.rooms.get(reg.sala.codigo) || [])].map((sid) => io.sockets.sockets.get(sid));
  for (const s of alvos) if (s && s.data.id === seg.para) s.emit('segredo', seg);
}

function buscar(codigo) {
  const reg = salas.get(String(codigo || '').toUpperCase().trim());
  if (!reg) throw new ErroJogo('Sala não encontrada. Confira o código.');
  return reg;
}

/** Envolve um handler: erros de regra voltam como {ok:false, erro}. */
function seguro(fn) {
  return async (dados = {}, responder = () => {}) => {
    if (typeof responder !== 'function') responder = () => {};
    try {
      responder({ ok: true, ...(await fn(dados)) });
    } catch (e) {
      if (!(e instanceof ErroJogo)) log('erro inesperado', e);
      responder({ ok: false, erro: e instanceof ErroJogo ? e.message : 'Algo deu errado. Tente de novo.' });
    }
  };
}

io.on('connection', (socket) => {
  const exigirHost = () => {
    if (!socket.data.host) throw new ErroJogo('Só o anfitrião pode fazer isso.');
    return buscar(socket.data.codigo);
  };
  const exigirJogador = () => {
    if (!socket.data.id) throw new ErroJogo('Entre na sala primeiro.');
    return buscar(socket.data.codigo);
  };
  function entrarNaSalaComoJogador(reg, nome, chave) {
    let id = chave && reg.chaves.get(chave);
    if (!id) { chave = novaChave(); id = novoId(); }
    const existente = reg.sala.jogador(id);
    reg.sala.adicionarJogador({ id, nome: nome || existente?.nome });
    reg.chaves.set(chave, id);
    socket.data.id = id;
    socket.data.codigo = reg.sala.codigo;
    socket.join(reg.sala.codigo);
    return { id, chave };
  }

  socket.on('criar', seguro(({ config, nome }) => {
    const codigo = novoCodigo();
    const sala = new Sala({ codigo, baralho, config });
    const reg = { sala, hostChave: novaChave(), chaves: new Map(), tocadaEm: Date.now() };
    salas.set(codigo, reg);
    socket.data.host = true;
    socket.data.codigo = codigo;
    socket.join(codigo);
    let jogador = {};
    if (nome) jogador = entrarNaSalaComoJogador(reg, nome);
    log('sala criada', codigo, sala.config);
    transmitir(reg);
    return { codigo, hostChave: reg.hostChave, ...jogador };
  }));

  socket.on('host', seguro(({ codigo, hostChave, chave }) => {
    const reg = buscar(codigo);
    if (reg.hostChave !== hostChave) throw new ErroJogo('Esta tela não é a do anfitrião desta sala.');
    socket.data.host = true;
    socket.data.codigo = reg.sala.codigo;
    socket.join(reg.sala.codigo);
    let jogador = {};
    if (chave && reg.chaves.has(chave)) jogador = entrarNaSalaComoJogador(reg, null, chave);
    transmitir(reg);
    return { codigo: reg.sala.codigo, ...jogador };
  }));

  socket.on('entrar', seguro(({ codigo, nome, chave }) => {
    const reg = buscar(codigo);
    const r = entrarNaSalaComoJogador(reg, nome, chave);
    transmitir(reg);
    return r;
  }));

  socket.on('ver', seguro(({ codigo }) => {
    const reg = buscar(codigo);
    socket.join(reg.sala.codigo);
    socket.emit('estado', reg.sala.visao());
    return {};
  }));

  socket.on('jogada', seguro(({ tipo, n, texto, resultado }) => {
    const reg = exigirJogador();
    const { sala } = reg;
    const id = socket.data.id;
    if (tipo === 'abrir') sala.abrirDica(id, n);
    else if (tipo === 'chutar') sala.chutar(id, texto);
    else if (tipo === 'passar') sala.passar(id);
    else if (tipo === 'julgar') sala.julgar(id, resultado);
    else throw new ErroJogo('Jogada desconhecida.');
    transmitir(reg);
    return {};
  }));

  socket.on('comando', seguro(({ tipo, id }) => {
    const reg = exigirHost();
    const { sala } = reg;
    const acoes = {
      iniciar: () => sala.iniciar(),
      proxima: () => sala.proximaCarta(),
      revelar: () => sala.revelar(),
      valer: () => sala.valerUltimoChute(),
      pular: () => sala.pularVez(),
      remover: () => sala.remover(id),
      nova: () => sala.novaPartida(),
    };
    if (!acoes[tipo]) throw new ErroJogo('Comando desconhecido.');
    acoes[tipo]();
    transmitir(reg);
    return {};
  }));

  socket.on('disconnect', () => {
    const reg = salas.get(socket.data.codigo);
    if (!reg || !socket.data.id) return;
    const id = socket.data.id;
    // Só marca offline se não houver outra aba do mesmo jogador conectada.
    const aindaLa = [...(io.sockets.adapter.rooms.get(reg.sala.codigo) || [])]
      .some((sid) => io.sockets.sockets.get(sid)?.data.id === id);
    if (!aindaLa) { reg.sala.conexao(id, false); transmitir(reg); }
  });
});

// Faxina: pula a vez de quem caiu e apaga salas abandonadas.
setInterval(() => {
  const agora = Date.now();
  for (const [codigo, reg] of salas) {
    if (agora - reg.tocadaEm > SALA_OCIOSA_MS) { salas.delete(codigo); log('sala apagada', codigo); continue; }
    const daVez = reg.sala.jogadorDaVez();
    if (daVez && !daVez.online) {
      reg.ausenteDesde ??= agora;
      if (agora - reg.ausenteDesde > PULAR_AUSENTE_MS) {
        reg.ausenteDesde = null;
        try { reg.sala.pularVez(); transmitir(reg); } catch { /* fase mudou */ }
      }
    } else reg.ausenteDesde = null;
  }
}, 5000).unref();

app.get('/api/saude', (_req, res) => res.json({ ok: true, salas: salas.size, cartas: baralho.length }));
app.get('/api/baralho', (_req, res) => {
  const porTema = Object.fromEntries(TEMAS.map((t) => [t, baralho.filter((c) => c.categoria === t).length]));
  // contagem[tema][nivel]: o front calcula quantas cartas sobram para cada filtro.
  const contagem = Object.fromEntries(TEMAS.map((t) => [t, Object.fromEntries(
    [...NIVEIS, 'sem'].map((n) => [n, baralho.filter((c) => c.categoria === t && (c.nivel || 'sem') === n).length]),
  )]));
  res.json({ total: baralho.length, porTema, niveis: NIVEIS, contagem });
});

const dist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(dist, { maxAge: '1h', index: false }));
app.get(/^\/(?!api|socket\.io).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));

if (require.main === module) {
  servidor.listen(PORTA, () => log(`Perfil Online em http://localhost:${PORTA} (${baralho.length} cartas)`));
}
module.exports = { app, servidor, io, salas };
