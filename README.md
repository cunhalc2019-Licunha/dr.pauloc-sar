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

### Acesso do administrador
- Link **Área do administrador** no rodapé do site (ou direto em `/admin`).
- **Primeiro acesso / esqueci a senha:** o administrador digita o e-mail cadastrado, recebe um
  código de 6 dígitos (válido por 10 minutos) e cria a própria senha. Ninguém mais conhece a senha.
- Depois disso, entra com **e-mail + senha**. A sessão dura 8 horas.
- A senha fica guardada só como hash (scrypt), criptografada, em `auth/admin.json` — esse arquivo
  não é publicado no site.

### Configuração técnica (uma vez, na Vercel → Settings → Environment Variables)
| Variável | Valor |
|---|---|
| `GITHUB_TOKEN` | token do GitHub com permissão **Contents: Read and write** só neste repositório |
| `RESEND_API_KEY` | chave da conta no Resend (resend.com), usada para enviar o código por e-mail |

Opcionais: `ADMIN_EMAIL` (padrão `paulocesardrpc123@gmail.com`), `RESEND_FROM` (remetente; padrão
`onboarding@resend.dev`, que só envia para o e-mail dono da conta Resend), `GITHUB_REPO`, `GITHUB_BRANCH`.
Depois de definir as variáveis, faça um *Redeploy*.
Se o `GITHUB_TOKEN` for trocado, o administrador precisa criar a senha de novo (pelo código por e-mail).

### Desenvolvimento
```
npm install
npm run build   # gera public/
```
