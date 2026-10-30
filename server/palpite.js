// Conferência de palpite. Portado de AdrielFerr/perfil (Normalizador.php e
// VerificadorPalpite.php, licença MIT) para JavaScript.
// @ts-check

/**
 * @typedef {Object} ResultadoPalpite
 * @property {boolean} acertou
 * @property {string|null} correspondencia
 * @property {boolean} exata
 */

const PALAVRAS_VAZIAS = new Set([
  'a', 'as', 'o', 'os', 'um', 'uma', 'uns', 'umas', 'de', 'da', 'do', 'das', 'dos', 'd',
  'e', 'em', 'na', 'no', 'nas', 'nos', 'por', 'para', 'com', 'sem', 'sob', 'sobre', 'ao',
  'aos', 'the', 'of', 'and', 'ii', 'iii', 'iv', 'jr', 'filho', 'neto', 'santo', 'santa', 'sao',
]);
const LIMITE_SEMELHANCA = 0.86;
const TAMANHO_MINIMO_TOLERANCIA = 6;

/**
 * @param {string} texto
 * @returns {string}
 */
function normalizar(texto) {
  return String(texto ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ß/g, 'ss').replace(/[øØ]/g, 'o').replace(/ł/g, 'l').replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const compactar = (t) => normalizar(t).replace(/ /g, '');
const semArtigoInicial = (n) => n.replace(/^(o|a|os|as|um|uma|the|le|la|el)\s+/, '');

/**
 * @param {string} texto
 * @param {number} [minimo]
 * @returns {string[]}
 */
function palavrasSignificativas(texto, minimo = 4) {
  const saida = [];
  for (const p of normalizar(texto).split(' ')) {
    if (!p || PALAVRAS_VAZIAS.has(p) || p.length < minimo || saida.includes(p)) continue;
    saida.push(p);
  }
  return saida;
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshtein(a, b) {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0];
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j];
      linha[j] = Math.min(linha[j] + 1, linha[j - 1] + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[b.length];
}

/**
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function semelhanca(a, b) {
  a = normalizar(a); b = normalizar(b);
  if (a === b) return 1;
  const maior = Math.max(a.length, b.length);
  return maior === 0 ? 0 : 1 - levenshtein(a, b) / maior;
}

/**
 * @param {string} palpite
 * @param {string} resposta
 * @param {string[]} [alternativas]
 * @returns {ResultadoPalpite}
 */
function verificar(palpite, resposta, alternativas = []) {
  const p = normalizar(palpite);
  const nada = { acertou: false, correspondencia: null, exata: false };
  if (!p) return nada;
  const candidatos = [resposta, ...alternativas];

  for (const c of candidatos) {
    const alvo = normalizar(c);
    if (!alvo) continue;
    if (p === alvo || semArtigoInicial(p) === semArtigoInicial(alvo) || compactar(palpite) === compactar(c)) {
      return { acertou: true, correspondencia: c, exata: true };
    }
  }
  if (p.length >= TAMANHO_MINIMO_TOLERANCIA) {
    for (const c of candidatos) {
      const alvo = normalizar(c);
      if (alvo.length < TAMANHO_MINIMO_TOLERANCIA) continue;
      if (semelhanca(p, alvo) >= LIMITE_SEMELHANCA) return { acertou: true, correspondencia: c, exata: false };
    }
  }
  // Sobrenome ou nome único de pessoa famosa: "pele", "shakespeare".
  for (const c of candidatos) {
    const palavras = palavrasSignificativas(c, 5);
    if (palavras.length < 2) continue;
    const ultima = palavras[palavras.length - 1];
    if (p === ultima && ultima.length >= 6) return { acertou: true, correspondencia: c, exata: false };
  }
  return nada;
}

module.exports = { normalizar, verificar, semelhanca };
