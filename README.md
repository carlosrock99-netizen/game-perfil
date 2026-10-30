# Perfil Online

Jogo de adivinhação no estilo do tabuleiro **Perfil**, para jogar em grupo com
**cada pessoa no próprio celular**. O anfitrião cria a sala, a turma entra pelo
link ou QR code, e a tela do anfitrião vira o telão com a carta, o tabuleiro e a
classificação.

**No ar:** https://http--game-perfil--wgs9cp9p72ty.code.run

Baseado no projeto [AdrielFerr/perfil](https://github.com/AdrielFerr/perfil)
(MIT): de lá vêm o baralho de 175 cartas com 20 dicas cada, as regras e o
verificador de palpite. O que este projeto acrescenta é o jogo online em tempo
real, o tabuleiro e as dicas especiais.

## Como se joga

1. O anfitrião abre o site, escolhe os temas, o nível de dificuldade, a casa de
   chegada (e, se quiser, um tempo por vez) e cria a sala.
2. A turma entra pelo QR code, pelo link de convite ou digitando o código de 5 letras.
3. A ordem das vezes é sorteada. Na sua vez você **abre uma dica** da carta (1 a 20).
   A dica aparece para todos.
4. Depois você **dá o palpite** ou **passa a vez**. O palpite funciona de um de dois
   jeitos, escolhidos ao criar a sala:
   - **Mediador na roda (padrão):** a cada carta, o próximo jogador da roda vira
     mediador. Só o celular dele mostra a resposta e as 20 dicas. Ele lê a dica em
     voz alta, ouve o palpite falado e aperta **Acertou**, **Errou** ou **Passou**.
     Nessa carta ele não joga. Quando alguém acerta, **o mediador anda o mesmo
     número de casas** que o acertador. Se ninguém acerta, ninguém anda.
   - **Palpite digitado:** o jogador digita o palpite e o jogo confere sozinho.
     Serve para jogar a distância, por chamada de vídeo.
   - Acertou: anda **1 casa por dica ainda fechada** (mínimo 1).
   - Errou: fica fora desta carta e volta na próxima.
   - Todos erraram ou as 20 dicas acabaram: ninguém anda.
5. **Dicas especiais** (opcional): duas por carta, escondidas. Ao abrir, além da
   dica, aplicam um efeito: perca a vez, avance 3 casas, volte 2 casas ou abra
   outra dica.
6. Ganha quem chegar primeiro à casa final (30, 50 ou 80).

No modo digitado, o anfitrião também pode **valer um chute** que o sistema recusou (sinônimo, erro
de digitação maior), **pular a vez** de quem sumiu, **revelar a resposta** e
**remover jogadores**. Se alguém cair da internet na própria vez, a vez é pulada
sozinha depois de 25 segundos.

O anfitrião tem um botão **Desfazer** para corrigir a última jogada (um acerto
julgado errado, uma dica aberta sem querer). Com a partida em andamento, o telão
entra em **modo apresentação**: mostra só a dica aberta em destaque, o tabuleiro
com os peões e a classificação, escondendo o QR e os controles de gerenciamento.
O jogador pode ligar/desligar o **aviso sonoro e a vibração** que tocam quando
chega a vez dele. O **cronômetro por vez** (opcional) passa a vez sozinho de quem
não agir a tempo.

## Telas

| Endereço | Quem usa | O que mostra |
| --- | --- | --- |
| `/` | todos | criar sala ou entrar com código |
| `/host/CODIGO` | anfitrião (TV, notebook ou celular) | convite com QR, carta, tabuleiro, classificação, ordem das vezes e controles; em jogo vira **modo apresentação** (dica em destaque + tabuleiro + placar) |
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
npm run typecheck   # checagem de tipos (JSDoc + @ts-check)
```

## Publicar

O jogo precisa de um servidor que aceite WebSocket. **Netlify e Vercel não servem**
(só hospedam páginas estáticas).

### Render (link público, grátis)

O `render.yaml` já descreve o serviço (Node, build, start e health check em
`/api/saude`). O caminho mais rápido é um *Blueprint*:

1. Garanta que o repositório está no GitHub. Repositório privado: autorize o
   GitHub App do Render na sua instalação (Dashboard → Account Settings → GitHub).
2. No dashboard do Render: **New + → Blueprint** e escolha este repositório.
3. Confirme o serviço `perfil-online`, plano **Free**, e clique em **Apply**.
4. Quando o build terminar, o Render mostra uma URL do tipo
   `https://perfil-online-xxxx.onrender.com`. Compartilhe o link (ou o QR do
   lobby) e todo mundo entra.

No plano grátis o serviço dorme após 15 minutos sem acesso e leva ~30s para
acordar: abra o link um pouco antes de jogar. Para ficar sempre acordado, use um
plano pago ou um ping periódico em `/api/saude`.

**Alternativa por API (sem dashboard):** com uma chave em
`dashboard.render.com/u/settings#api-keys`, dá para criar o serviço via
`POST https://api.render.com/v1/services` (campos `repo`, `branch`,
`serviceDetails.buildCommand`/`startCommand` e `healthCheckPath`, iguais ao
`render.yaml`).

### Northflank (grátis, sempre ligado)

Roda 24/7 no plano **Developer Sandbox**, sem dormir e com WebSocket nativo.

- **No ar:** https://http--game-perfil--wgs9cp9p72ty.code.run
- Serviço `game-perfil` no projeto `Default` (região US‑Central), build por
  **Dockerfile**, porta **3000** pública e health check em `/api/saude`.

Para subir de novo: **Create service → Combined service** → repositório público
`https://github.com/carlosrock99-netizen/game-perfil` → branch `main` →
**Dockerfile** (`/Dockerfile`, contexto `/`) → **Add port 3000 HTTP público** →
**Create service**.

### Waifly (grátis, 24/7, sem cartão)

O Waifly é um painel Pterodactyl: você sobe os arquivos, ele instala as
dependências no start e roda 24/7 (300 MB RAM / 1 GB de disco no plano free).

1. Gere o pacote de produção:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\pacote-waifly.ps1
   ```
   Isso cria `perfil-online-waifly.zip` (front compilado + servidor + baralho,
   sem `node_modules`).
2. No painel (`panel.waifly.com`), abra o servidor → **Files** → **Upload** o
   zip → botão direito → **Unarchive**.
3. Em **Startup**, defina o comando `npm start`. O servidor lê a porta de
   `PORT` ou `SERVER_PORT`, então **não** fixe porta no código.
4. Em **Console**, clique em **Start**. O log mostra o `npm install` e depois
   `Perfil Online em http://localhost:XXXX`.
5. Use o **Web Address** do dashboard (ou aponte um domínio próprio).

O plano free não inclui subdomínio/SSL; sem domínio o endereço `http://IP:PORTA`
funciona (o WebSocket vai por `ws://`). Para HTTPS grátis, aponte um domínio seu
ou use um proxy Cloudflare.

### Railway ou Fly.io

Detectam o `package.json`; comando de build `npm install && npm run build`,
comando de início `npm start`.
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
- `nivel`: `facil`, `medio`, `dificil` ou `complexo`. A classificação fica em
  `data/niveis.json` (resposta → nível) e é reaplicada a cada importação. Carta
  sem nível entra em qualquer filtro.

Distribuição atual das 175 cartas: 54 fáceis, 77 médias, 33 difíceis e 11
complexas. Na criação da sala dá para marcar um ou mais níveis; as cartas saem
misturadas entre os marcados.

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
tsconfig.json  checagem de tipos (JSDoc + @ts-check)
```

- O servidor é a única autoridade: valida a vez, confere o palpite e só envia a
  resposta da carta depois que ela é revelada.
- Cada jogador recebe uma chave guardada no navegador. Com ela, recarregar a
  página devolve o jogador à mesma vaga. A tela do anfitrião tem uma chave própria.
- As salas ficam na memória do servidor e são apagadas depois de 6 horas paradas.
  Se o servidor reiniciar, as salas em andamento se perdem.
- Até 12 jogadores por sala.

## Roteiro

- [x] Nível de dificuldade por carta (fácil, médio, difícil, complexo) e filtro na criação da sala.
- [x] Cronômetro opcional por vez (quem não age a tempo passa a vez).
- [x] Desfazer a última jogada (anfitrião).
- [x] Aviso sonoro/vibração na sua vez e modo apresentação do telão.
- [ ] Mais cartas no nível complexo (hoje são 11).
- [ ] Mais temas além dos quatro do Perfil (esportes, música, cinema etc.).
- [ ] Guardar as salas no Redis para sobreviver a reinício do servidor.
- [ ] Trazer o gerador de cartas do Wikidata para Node.

## Créditos e licença

MIT. Baralho, regras base e verificador de palpite de
[Adriel Ferreira](https://github.com/AdrielFerr/perfil), também MIT.
Perfil é marca da Grow Jogos e Brinquedos; este projeto não tem relação com ela.
