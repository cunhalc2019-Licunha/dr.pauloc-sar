# Dr. Paulo César, O PC — Site

Site institucional publicado na Vercel (https://drpauloc-sar.vercel.app), com painel de edição em `/admin`.

## Estrutura
- `index.html` — molde do site. Os blocos e o layout ficam aqui.
  Textos e fotos editáveis têm a marcação `data-cms="chave"`.
- `content.json` — textos e fotos alterados pelo painel (gravado automaticamente).
- `build.mjs` + `lib/cms.mjs` — na publicação, juntam o molde com o `content.json` e geram `public/`.
- `admin/` — página do painel (login + edição).
- `api/` — funções da Vercel: login, envio de fotos e salvamento.
- `img/` — fotos do site; `img/uploads/` recebe as fotos enviadas pelo painel.

As fotos da galeria, logos de parceiros e miniaturas dos vídeos vêm de agaleradrpc.com.br e do YouTube.

## Painel /admin
Permite trocar **textos e fotos** dos blocos. Não cria, apaga nem reordena blocos.
Ao clicar em *Salvar e publicar*, o painel grava um commit neste repositório e a Vercel
publica a nova versão em cerca de 1 minuto. Todo o histórico fica no GitHub.

### Configuração (uma vez, na Vercel → Settings → Environment Variables)
| Variável | Valor |
|---|---|
| `ADMIN_PASSWORD` | senha de acesso ao painel (use uma senha forte) |
| `GITHUB_TOKEN` | token do GitHub com permissão **Contents: Read and write** só neste repositório |

Opcionais: `GITHUB_REPO` (padrão `cunhalc2019-Licunha/dr.pauloc-sar`), `GITHUB_BRANCH` (padrão `main`).
Depois de definir as variáveis, faça um *Redeploy*. Trocar a senha encerra todas as sessões abertas.

### Desenvolvimento
```
npm install
npm run build   # gera public/
```
