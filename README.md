# Perfil Online

Jogo de adivinhação no estilo do tabuleiro **Perfil**, para jogar em grupo com
**cada pessoa no próprio celular**. O anfitrião cria a sala, a turma entra pelo
link ou QR code, e a tela do anfitrião vira o telão com a carta, o tabuleiro e a
classificação.

Baseado no projeto [AdrielFerr/perfil](https://github.com/AdrielFerr/perfil)
(MIT): de lá vêm o baralho de 175 cartas com 20 dicas cada, as regras e o
verificador de palpite. O que este projeto acrescenta é o jogo online em tempo
real, o tabuleiro e as dicas especiais.

## Como se joga

1. O anfitrião abre o site, escolhe os temas, a casa de chegada e cria a sala.
2. A turma entra pelo QR code, pelo link de convite ou digitando o código de 5 letras.
3. A ordem das vezes é sorteada. Na sua vez você **abre uma dica** da carta (1 a 20).
   A dica aparece para todos.
4. Depois você **chuta** a resposta ou **passa a vez**.
   - Acertou: anda **1 casa por dica ainda fechada** (mínimo 1).
   - Errou: fica fora desta carta e volta na próxima.
   - Todos erraram ou as 20 dicas acabaram: ninguém anda.
5. **Dicas especiais** (opcional): duas por carta, escondidas. Ao abrir, além da
   dica, aplicam um efeito: perca a vez, avance 3 casas, volte 2 casas ou abra
   outra dica.
6. Ganha quem chegar primeiro à casa final (30, 50 ou 80).

O anfitrião também pode **valer um chute** que o sistema recusou (sinônimo, erro
de digitação maior), **pular a vez** de quem sumiu, **revelar a resposta** e
**remover jogadores**. Se alguém cair da internet na própria vez, a vez é pulada
sozinha depois de 25 segundos.

## Telas

| Endereço | Quem usa | O que mostra |
| --- | --- | --- |
| `/` | todos | criar sala ou entrar com código |
| `/host/CODIGO` | anfitrião (TV, notebook ou celular) | convite com QR, carta, tabuleiro, classificação, ordem das vezes e controles |
| `/sala/CODIGO` | jogadores | a vez, o campo de palpite, a carta e o tabuleiro |

O anfitrião pode jogar do mesmo aparelho (marcado por padrão ao criar a sala) ou
deixar a tela só como telão. Quem recarrega a página volta para a mesma sala e
para a mesma posição.

## Rodar no computador

Requer Node 18 ou mais novo.

```bash
npm install
npm run build      # compila o front (client/dist)
npm start          # http://localhost:3000
```

Para desenvolver com recarga automática, em dois terminais:

```bash
npm run dev                 # servidor na porta 3000
npm --prefix client run dev # front em http://localhost:5173, já com --host
```

Para jogar na rede de casa, abra no celular o endereço de rede que o Vite ou o
servidor mostrar (por exemplo `http://192.168.0.10:3000`).

Testes das regras:

```bash
npm test
```

## Publicar

O jogo precisa de um servidor que aceite WebSocket. **Netlify e Vercel não servem**
(só hospedam páginas estáticas).

- **Render (grátis):** suba o repositório no GitHub, crie um *Blueprint* no Render
  e aponte para este repositório. O `render.yaml` já tem tudo. No plano grátis o
  servidor dorme após 15 minutos parado e leva uns 30 segundos para acordar:
  abra o site um pouco antes de jogar.
- **Railway ou Fly.io:** detectam o `package.json`; comando de build
  `npm install && npm run build`, comando de início `npm start`.
- **Docker / Portainer:**
  ```bash
  docker build -t perfil-online .
  docker run -p 3000:3000 perfil-online
  ```

Variáveis de ambiente (todas opcionais):

| Variável | Padrão | Para quê |
| --- | --- | --- |
| `PORT` | `3000` | porta do servidor |
| `CARTAS` | `data/cartas.json` | outro arquivo de baralho |
| `CORS_ORIGIN` | desligado | só se o front for servido de outro domínio |

## Baralho

As cartas ficam em `data/cartas.json`:

```json
{
  "id": 1,
  "categoria": "pessoa",
  "resposta": "Santos Dumont",
  "alternativas": ["Alberto Santos-Dumont"],
  "fonte": "https://pt.wikipedia.org/wiki/Santos_Dumont",
  "nivel": null,
  "dicas": [{ "n": 1, "texto": "...", "dificuldade": "media" }]
}
```

- `categoria`: `pessoa`, `lugar`, `coisa` ou `ano`. Cada carta precisa de 20 dicas.
- `alternativas`: outras respostas aceitas. O verificador já perdoa acento,
  maiúscula, artigo, hífen, pequenos erros de digitação e só o sobrenome
  ("Shakespeare").
- `nivel` (`facil`, `medio`, `dificil`): o servidor já filtra por nível, mas as
  175 cartas importadas ainda não têm nível definido. Ver o roteiro abaixo.

**Para atualizar o baralho a partir do projeto original** (que gera cartas novas
pelo Wikidata no painel `/admin` dele e exporta para `cartas.sql`):

```bash
npm run importar-cartas -- caminho/para/perfil/cartas.sql
```

## Como funciona por dentro

```
client/  React + Vite: telas de início, telão e jogador
server/
  index.js   Express + Socket.io: salas em memória, reconexão, faxina
  regras.js  regras da partida (módulo puro, sem rede, coberto por testes)
  palpite.js conferência do palpite (portado do original em PHP)
data/cartas.json  baralho
scripts/importar-sql.js  converte o cartas.sql do projeto original
test/  testes das regras e do verificador
```

- O servidor é a única autoridade: valida a vez, confere o palpite e só envia a
  resposta da carta depois que ela é revelada.
- Cada jogador recebe uma chave guardada no navegador. Com ela, recarregar a
  página devolve o jogador à mesma vaga. A tela do anfitrião tem uma chave própria.
- As salas ficam na memória do servidor e são apagadas depois de 6 horas paradas.
  Se o servidor reiniciar, as salas em andamento se perdem.
- Até 12 jogadores por sala.

## Roteiro

- [ ] Nível de dificuldade por carta (fácil, médio, difícil) e filtro na criação da sala.
- [ ] Mais temas além dos quatro do Perfil (esportes, música, cinema etc.).
- [ ] Guardar as salas no Redis para sobreviver a reinício do servidor.
- [ ] Cronômetro opcional por vez.
- [ ] Trazer o gerador de cartas do Wikidata para Node.

## Créditos e licença

MIT. Baralho, regras base e verificador de palpite de
[Adriel Ferreira](https://github.com/AdrielFerr/perfil), também MIT.
Perfil é marca da Grow Jogos e Brinquedos; este projeto não tem relação com ela.
