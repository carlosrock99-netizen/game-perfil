const test = require('node:test');
const assert = require('node:assert');
const { Sala, ErroJogo } = require('../server/regras');
const { verificar } = require('../server/palpite');

const carta = (id, categoria, resposta, alternativas = []) => ({
  id, categoria, resposta, alternativas, nivel: null,
  dicas: Array.from({ length: 20 }, (_, i) => ({ n: i + 1, texto: `Dica ${i + 1} de ${resposta}` })),
});
const BARALHO = [carta(1, 'pessoa', 'Santos Dumont', ['Alberto Santos-Dumont']), carta(2, 'lugar', 'Paris')];

function salaPronta(config = {}) {
  let s = 42;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  const sala = new Sala({ codigo: 'TESTE', baralho: BARALHO, config: { especiais: false, modo: 'digitado', ...config }, rnd });
  sala.adicionarJogador({ id: 'a', nome: 'Ana' });
  sala.adicionarJogador({ id: 'b', nome: 'Beto' });
  sala.adicionarJogador({ id: 'c', nome: 'Caio' });
  sala.iniciar();
  return sala;
}
const daVez = (s) => s.jogadorDaVez().id;

test('palpite aceita acento, caixa, artigo, erro de digitação e alternativa', () => {
  assert.ok(verificar('santos dumont', 'Santos Dumont').acertou);
  assert.ok(verificar('SANTOS-DUMONT', 'Santos Dumont').acertou);
  assert.ok(verificar('Santos Dumomt', 'Santos Dumont').acertou);
  assert.ok(verificar('alberto santos dumont', 'Santos Dumont', ['Alberto Santos-Dumont']).acertou);
  assert.ok(verificar('a paris', 'Paris').acertou);
  assert.ok(!verificar('pari', 'Paris').acertou);
  assert.ok(!verificar('', 'Paris').acertou);
});

test('só o jogador da vez joga, e na ordem abrir → decidir', () => {
  const s = salaPronta();
  const outro = s.jogadores.find((j) => j.id !== daVez(s)).id;
  assert.throws(() => s.abrirDica(outro, 1), ErroJogo);
  assert.throws(() => s.chutar(daVez(s), 'x'), /Primeiro abra/);
  s.abrirDica(daVez(s), 5);
  assert.throws(() => s.abrirDica(daVez(s), 6), /Primeiro chute/);
});

test('acertar anda 1 casa por dica fechada e revela a carta', () => {
  const s = salaPronta();
  const id = daVez(s);
  s.abrirDica(id, 1); s.abrirDica; // 1 aberta
  s.chutar(id, s.carta.resposta);
  assert.equal(s.jogador(id).casa, 19);
  assert.equal(s.fase, 'revelada');
  assert.ok(s.visao().carta.resposta);
});

test('a resposta não vaza enquanto a carta está em jogo', () => {
  const s = salaPronta();
  assert.equal(s.visao().carta.resposta, null);
  assert.ok(!JSON.stringify(s.visao()).includes(s.carta.resposta));
});

test('chute errado tira da carta; todos fora encerra sem pontos', () => {
  const s = salaPronta();
  for (let i = 0; i < 3; i++) { const id = daVez(s); s.abrirDica(id, i + 1); s.chutar(id, 'resposta errada'); }
  assert.equal(s.fase, 'revelada');
  assert.ok(s.jogadores.every((j) => j.casa === 0));
});

test('passar mantém o jogador vivo e a vez gira', () => {
  const s = salaPronta();
  const ordem = [];
  for (let i = 0; i < 4; i++) { const id = daVez(s); ordem.push(id); s.abrirDica(id, i + 1); s.passar(id); }
  assert.equal(ordem[0], ordem[3]);
  assert.equal(new Set(ordem).size, 3);
});

test('dicas acabam: ninguém anda', () => {
  const s = salaPronta();
  for (let n = 1; n <= 20; n++) { const id = daVez(s); s.abrirDica(id, n); if (s.fase === 'jogo') s.passar(id); }
  assert.equal(s.fase, 'revelada');
});

test('anfitrião valida o último chute com as casas daquele momento', () => {
  const s = salaPronta();
  const id = daVez(s);
  s.abrirDica(id, 1); s.abrirDica; s.chutar(id, 'Santos Dumon'); // pode ou não acertar dependendo da carta
  if (s.fase === 'jogo') { s.valerUltimoChute(); }
  assert.equal(s.fase, 'revelada');
  assert.equal(s.jogador(id).casa, 19);
});

test('chegar na meta termina a partida', () => {
  const s = salaPronta({ meta: 10 });
  const id = daVez(s);
  s.abrirDica(id, 1);
  s.chutar(id, s.carta.resposta);
  assert.equal(s.fase, 'fim');
  assert.equal(s.vencedor.id, id);
  assert.equal(s.jogador(id).casa, 10);
});

test('carta não se repete até o baralho acabar', () => {
  const s = salaPronta();
  const vistas = [s.carta.id];
  s.revelar(); s.proximaCarta(); vistas.push(s.carta.id);
  assert.notEqual(vistas[0], vistas[1]);
});

test('dicas especiais: duas por carta, com efeito ao abrir', () => {
  const s = salaPronta({ especiais: true });
  assert.equal(Object.keys(s.especiais).length, 2);
  const [n, tipo] = Object.entries(s.especiais)[0];
  const id = daVez(s);
  s.abrirDica(id, Number(n));
  const casa = s.jogador(id).casa;
  if (tipo === 'perca') assert.notEqual(daVez(s), id);
  if (tipo === 'avance') assert.equal(casa, 3);
  if (tipo === 'volte') assert.equal(casa, 0);
  if (tipo === 'outra') assert.equal(s.etapa, 'abrir');
  assert.ok(s.visao().carta.dicas[0].especial);
});

test('remover o jogador da vez passa a vez sem quebrar', () => {
  const s = salaPronta();
  const id = daVez(s);
  s.remover(id);
  assert.equal(s.jogadores.length, 2);
  assert.ok(s.jogadorDaVez());
  assert.notEqual(daVez(s), id);
});

test('quem entra no meio da carta joga a partir da próxima', () => {
  const s = salaPronta();
  s.adicionarJogador({ id: 'd', nome: 'Duda' });
  assert.ok(s.visao().jogadores.find((j) => j.id === 'd').fora);
  s.revelar(); s.proximaCarta();
  assert.ok(!s.visao().jogadores.find((j) => j.id === 'd').fora);
});

// ---------- modo mediador ----------
function salaMediador(config = {}) { return salaPronta({ modo: 'mediador', ...config }); }

test('mediador roda a cada carta e não joga na sua carta', () => {
  const s = salaMediador();
  const m1 = s.mediador;
  assert.ok(m1);
  assert.notEqual(daVez(s), m1);
  assert.ok(s.visao().jogadores.find((j) => j.id === m1).fora);
  s.revelar(); s.proximaCarta();
  assert.notEqual(s.mediador, m1);
});

test('mediador abre a dica pelo jogador e confirma o acerto; os dois andam as dicas fechadas', () => {
  const s = salaMediador();
  const m = s.mediador; const j = daVez(s);
  s.abrirDica(m, 1); s.abrirDica; // mediador abre por quem está na vez
  for (let n = 2; n <= 8; n++) { s.julgar(m, 'passou'); s.abrirDica(daVez(s), n); }
  const quem = daVez(s);
  s.julgar(m, 'acertou');
  assert.equal(s.jogador(quem).casa, 12);
  assert.equal(s.jogador(m).casa, 12);
  assert.equal(s.acerto.mediador.casas, 12);
  assert.ok(j);
});

test('modo mediador: chute digitado é recusado e errou tira da carta', () => {
  const s = salaMediador();
  const m = s.mediador; const j = daVez(s);
  s.abrirDica(j, 1);
  assert.throws(() => s.chutar(j, s.carta.resposta), /voz alta/);
  assert.throws(() => s.julgar(j, 'acertou'), /Só o mediador/);
  s.julgar(m, 'errou');
  assert.ok(s.fora.has(j));
});

test('resposta só aparece no segredo do mediador', () => {
  const s = salaMediador();
  assert.ok(!JSON.stringify(s.visao()).includes(s.carta.resposta));
  const seg = s.segredo();
  assert.equal(seg.para, s.mediador);
  assert.equal(seg.resposta, s.carta.resposta);
  assert.equal(seg.dicas.length, 20);
});

test('se o mediador sai, a carta é encerrada', () => {
  const s = salaMediador();
  s.remover(s.mediador);
  assert.equal(s.fase, 'revelada');
});
