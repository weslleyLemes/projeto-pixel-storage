# Resumo 
Aplicação web para armazenar, organizar, baixar e compartilhar arquivos. Inclui autenticação por usuário, painel administrativo, links temporários e documentação interativa da API.
<img width="1916" height="935" alt="Captura de tela 2026-11-13 165723" src="https://github.com/user-attachments/assets/30ddba3c-331f-40af-9ffe-7a1fba88f0d6" />
<img width="1913" height="933" alt="Captura de tela 2026-11-13 165953" src="https://github.com/user-attachments/assets/8c2bce8a-37d6-4619-a0dc-aedd2132dbdb" />
<img width="1915" height="933" alt="Captura de tela 2026-11-13 165836" src="https://github.com/user-attachments/assets/25e120b4-70be-4203-b125-2910f65e24c8" />

> **Atenção:** este projeto está configurado para avaliação e desenvolvimento local.

## Funcionalidades

- Cadastro de usuários, login, restauração de sessão e logout.
- Autorização por função: usuários gerenciam os próprios arquivos; administradores têm acesso ao painel de usuários.
- Upload com limite de 10 MiB por arquivo. O seletor da interface apresenta PNG, JPG/JPEG, PDF e TXT.
- Listagem, busca, visualização prévia de imagens, PDFs e TXT, download e exclusão com confirmação.
- Renomeação e versionamento: ao manter a versão anterior, a aplicação cria uma cópia do arquivo atual com o novo nome.
- Links compartilháveis que permitem baixar um arquivo sem entrar na aplicação. A interface cria links com validade de 60 minutos; a API permite informar o prazo em minutos.
- Barra de progresso e estado de upload/download; o progresso de arquivos pequenos é simulado para tornar o feedback visível.
- Cache de listagens em memória por usuário e cabeçalhos HTTP de cache/ETag para downloads.
- Logs de ações da interface no console do navegador e logs de requisições no backend.
- Documentação interativa OpenAPI/Swagger.
- Layout responsivo.

## Tecnologias

- **Frontend:** React 18, TypeScript, Vite, React Router, Axios e Lucide React.
- **Backend:** Python 3.12, Flask, Flask-SQLAlchemy, SQLAlchemy e Werkzeug.
- **Banco de dados:** SQLite.
- **Arquivos:** filesystem em volume Docker.
- **Proxy/web server:** Nginx.
- **Execução local:** Docker Compose.

## Executar localmente

Requisitos: Docker Desktop com Docker Compose.

O arquivo `.env` de demonstração acompanha o repositório para que o Compose funcione imediatamente após o clone. Na raiz do projeto, execute:

```bash
docker compose up --build
```

Depois que os serviços iniciarem, acesse:

   - Aplicação: http://localhost:8080
   - Documentação da API: http://localhost:8080/api/docs/
   - Especificação OpenAPI: http://localhost:8080/api/openapi.json
   - Verificação de saúde: http://localhost:8080/api/health

O administrador é criado no primeiro início usando `ADMIN_EMAIL` e `ADMIN_PASSWORD` definidos no `.env` versionado. Para esta configuração local de demonstração, use `admin@local.test` / `admin`. O processo é idempotente: se a conta já existir, suas credenciais e função não são redefinidas. Cadastre usuários comuns pela interface.

### Comandos úteis

```bash
docker compose logs -f backend
docker compose ps
docker compose down
```

Os dados ficam nos volumes Docker `db_data` e `file_storage`; `docker compose down` os preserva. **Atenção:** `docker compose down -v` apaga os volumes e remove o banco e os arquivos armazenados.

## Armazenamento e cache

- O banco SQLite fica em `/app/data/pixel_storage.db`, no volume Docker `db_data`.
- Os binários ficam em `/app/storage`, no volume Docker `file_storage`. O banco mantém metadados e uma chave aleatória para localizar cada binário; o nome enviado pelo usuário não é usado como caminho físico.
- A listagem é mantida em cache na memória do processo por 60 segundos por padrão (`FILE_CACHE_TTL_SECONDS`). Upload, renomeação, versionamento e exclusão invalidam a listagem daquele usuário.
- Downloads enviam `Cache-Control` e `ETag` para permitir revalidação/cache HTTP pelo cliente. Isso não é armazenamento de objetos S3/MinIO nem um cache distribuído.

## Links temporários

O botão de link temporário gera uma URL para download sem sessão autenticada, válida por 60 minutos na interface. O backend registra a expiração e responde com HTTP `410` após o prazo. O prazo padrão da API pode ser configurado por `SHARE_LINK_TTL_MINUTES`; a requisição de criação também aceita `expiresInMinutes`. Trate essas URLs como credenciais: quem tiver o link pode baixar o arquivo até a expiração.

## API

Swagger UI: `/api/docs/`. A interface permite consultar e experimentar os endpoints. Rotas protegidas exigem a sessão e, para operações mutáveis, um token CSRF enviado no header `X-CSRF-Token`.

| Método | Endpoint | Acesso | Descrição |
|---|---|---|---|
| GET | `/api/health` | Público | Saúde do serviço |
| GET | `/api/openapi.json` | Público | Especificação OpenAPI |
| GET | `/api/auth/csrf` | Público | Obter token CSRF da sessão |
| POST | `/api/auth/register` | CSRF | Criar usuário comum |
| POST | `/api/auth/login` | CSRF | Iniciar sessão |
| POST | `/api/auth/logout` | Sessão + CSRF | Encerrar sessão |
| GET | `/api/auth/me` | Sessão | Consultar usuário autenticado |
| GET | `/api/files` | Sessão | Listar os próprios arquivos |
| POST | `/api/files` | Sessão + CSRF | Enviar arquivo |
| GET | `/api/files/{file_id}/download` | Sessão | Baixar arquivo próprio |
| PATCH | `/api/files/{file_id}` | Sessão + CSRF | Renomear ou versionar arquivo |
| DELETE | `/api/files/{file_id}` | Sessão + CSRF | Excluir arquivo próprio |
| POST | `/api/files/{file_id}/share` | Sessão + CSRF | Criar link temporário |
| GET | `/api/share/{token}` | Link | Baixar arquivo compartilhado |
| GET | `/api/admin/users` | Administrador | Listar usuários |
| DELETE | `/api/admin/users/{user_id}` | Administrador + CSRF | Excluir usuário comum e seus arquivos |

## Testes e build

Testes do backend (a partir da pasta `backend`):

```bash
python -m pip install -r requirements.txt pytest
python -m pytest
```

Build do frontend (a partir da pasta `frontend`):

```bash
npm install
npm run build
```

## Configuração

O `.env` está incluído intencionalmente para permitir iniciar o projeto com um único comando após o clone. Seus valores são públicos e servem exclusivamente para desenvolvimento local.

| Variável | Finalidade | Padrão da aplicação |
|---|---|---|
| `SECRET_KEY` | Assinar a sessão Flask | Chave fixa de demonstração; não usar em produção |
| `ADMIN_EMAIL` | E-mail do administrador inicial | `admin@local.test` |
| `ADMIN_PASSWORD` | Senha do administrador inicial | `admin`; pública e apenas para demonstração local |
| `MAX_CONTENT_LENGTH` | Tamanho máximo da requisição em bytes | `10485760` (10 MiB) |
| `FILE_CACHE_TTL_SECONDS` | TTL do cache de listagem | `60` segundos |
| `SHARE_LINK_TTL_MINUTES` | Validade padrão dos links | `60` minutos |

## Uso de IA

A IA foi utilizada como apoio para estruturar a solução, discutir decisões arquiteturais, implementar partes do código e revisar explicações. 
