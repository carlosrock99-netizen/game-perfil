// Converte o cartas.sql do projeto AdrielFerr/perfil (MIT) em data/cartas.json.
// Uso: node scripts/importar-sql.js caminho/para/cartas.sql
const fs = require('fs');
const path = require('path');

const origem = process.argv[2];
if (!origem) { console.error('Informe o caminho do cartas.sql'); process.exit(1); }
const sql = fs.readFileSync(origem, 'utf8');

// Lê os valores de um INSERT respeitando aspas e '' escapado.
function valores(linha) {
  const ini = linha.indexOf('VALUES (') + 8;
  const out = []; let atual = ''; let aspas = false;
  for (let i = ini; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '\\') { atual += linha[++i]; continue; }
      if (c === "'" && linha[i + 1] === "'") { atual += "'"; i++; continue; }
      if (c === "'") { aspas = false; continue; }
      atual += c;
    } else if (c === "'") aspas = true;
    else if (c === ',') { out.push(atual.trim()); atual = ''; }
    else if (c === ')') { out.push(atual.trim()); break; }
    else atual += c;
  }
  return out;
}

const cartas = []; let carta = null;
for (const linha of sql.split('\n')) {
  if (linha.startsWith('INSERT INTO `cartas`')) {
    const m = linha.match(/SELECT `id`, (NULL|'[^']*'), '((?:[^']|'')*)', '((?:[^']|'')*)', (NULL|'(?:[^']|'')*'),.*`chave` = '(\w+)'/);
    if (!m) throw new Error('Linha de carta não reconhecida: ' + linha.slice(0, 120));
    carta = {
      id: cartas.length + 1,
      categoria: m[5],
      resposta: m[2].replace(/''/g, "'"),
      alternativas: [],
      fonte: m[4] === 'NULL' ? null : m[4].slice(1, -1).replace(/''/g, "'"),
      nivel: null,
      dicas: [],
    };
    cartas.push(carta);
  } else if (linha.startsWith('INSERT INTO `dicas`')) {
    const v = valores(linha); // carta, numero, texto, normalizado, dificuldade, origem
    carta.dicas.push({ n: Number(v[1]), texto: v[2], dificuldade: v[4] });
  } else if (linha.includes('`respostas_alternativas`')) {
    carta.alternativas.push(valores(linha)[1]);
  }
}
for (const c of cartas) {
  c.dicas.sort((a, b) => a.n - b.n);
  if (c.dicas.length !== 20) throw new Error(`${c.resposta} tem ${c.dicas.length} dicas`);
}
const destino = path.join(__dirname, '..', 'data', 'cartas.json');
fs.writeFileSync(destino, JSON.stringify(cartas, null, 1));
const porTema = cartas.reduce((a, c) => ((a[c.categoria] = (a[c.categoria] || 0) + 1), a), {});
console.log(`${cartas.length} cartas gravadas em data/cartas.json`, porTema);
