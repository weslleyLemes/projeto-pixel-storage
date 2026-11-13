API_SPEC = {
    "openapi": "3.0.3",
    "info": {
        "title": "Pixel Breeders projeto Camada API",
        "version": "1.0.0",
        "description": "API de autenticação e gerenciamento de arquivos.",
    },
    "servers": [{"url": "/api"}],
    "components": {
        "securitySchemes": {
            "sessionCookie": {"type": "apiKey", "in": "cookie", "name": "session"},
            "csrfToken": {"type": "apiKey", "in": "header", "name": "X-CSRF-Token"},
        },
        "schemas": {
            "Credentials": {
                "type": "object",
                "required": ["email", "password"],
                "properties": {
                    "email": {"type": "string", "format": "email"},
                    "password": {"type": "string", "format": "password"},
                },
            },
            "StoredFile": {
                "type": "object",
                "properties": {
                    "id": {"type": "string", "format": "uuid"},
                    "name": {"type": "string"},
                    "mimeType": {"type": "string"},
                    "size": {"type": "integer"},
                    "createdAt": {"type": "string", "format": "date-time"},
                },
            },
            "Error": {
                "type": "object",
                "properties": {"error": {"type": "string"}},
            },
        },
    },
    "paths": {
        "/health": {
            "get": {"tags": ["Sistema"], "summary": "Verificar saúde da API", "responses": {"200": {"description": "API disponível"}}}
        },
        "/auth/csrf": {
            "get": {"tags": ["Autenticação"], "summary": "Obter token CSRF da sessão", "responses": {"200": {"description": "Token CSRF"}}}
        },
        "/auth/register": {
            "post": {
                "tags": ["Autenticação"], "summary": "Cadastrar usuário comum", "security": [{"csrfToken": []}],
                "requestBody": {"required": True, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Credentials"}}}},
                "responses": {"201": {"description": "Conta criada"}, "400": {"description": "Dados inválidos"}, "409": {"description": "E-mail já cadastrado"}},
            }
        },
        "/auth/login": {
            "post": {
                "tags": ["Autenticação"], "summary": "Iniciar sessão", "security": [{"csrfToken": []}],
                "requestBody": {"required": True, "content": {"application/json": {"schema": {"$ref": "#/components/schemas/Credentials"}}}},
                "responses": {"200": {"description": "Sessão iniciada"}, "401": {"description": "Credenciais inválidas"}},
            }
        },
        "/auth/logout": {
            "post": {"tags": ["Autenticação"], "summary": "Encerrar sessão", "security": [{"sessionCookie": [], "csrfToken": []}], "responses": {"204": {"description": "Sessão encerrada"}}}
        },
        "/auth/me": {
            "get": {"tags": ["Autenticação"], "summary": "Consultar usuário autenticado", "security": [{"sessionCookie": []}], "responses": {"200": {"description": "Usuário atual"}, "401": {"description": "Autenticação necessária"}}}
        },
        "/files": {
            "get": {"tags": ["Arquivos"], "summary": "Listar arquivos do usuário", "security": [{"sessionCookie": []}], "responses": {"200": {"description": "Lista de arquivos"}}},
            "post": {
                "tags": ["Arquivos"], "summary": "Enviar arquivo (máximo 10 MB)", "security": [{"sessionCookie": [], "csrfToken": []}],
                "requestBody": {"required": True, "content": {"multipart/form-data": {"schema": {"type": "object", "required": ["file"], "properties": {"file": {"type": "string", "format": "binary"}}}}}},
                "responses": {"201": {"description": "Arquivo enviado"}, "413": {"description": "Arquivo excede o limite"}, "415": {"description": "Formato não aceito"}},
            },
        },
        "/files/{file_id}": {
            "parameters": [{"name": "file_id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}}],
            "patch": {
                "tags": ["Arquivos"], "summary": "Renomear ou versionar arquivo", "security": [{"sessionCookie": [], "csrfToken": []}],
                "requestBody": {"required": True, "content": {"application/json": {"schema": {"type": "object", "required": ["name"], "properties": {"name": {"type": "string"}, "keepPrevious": {"type": "boolean", "default": False}}}}}},
                "responses": {"200": {"description": "Arquivo atualizado"}, "404": {"description": "Arquivo não encontrado"}},
            },
            "delete": {"tags": ["Arquivos"], "summary": "Excluir arquivo", "security": [{"sessionCookie": [], "csrfToken": []}], "responses": {"204": {"description": "Arquivo excluído"}, "404": {"description": "Arquivo não encontrado"}}},
        },
        "/files/{file_id}/download": {
            "get": {"tags": ["Arquivos"], "summary": "Baixar arquivo do usuário", "security": [{"sessionCookie": []}], "parameters": [{"name": "file_id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}}], "responses": {"200": {"description": "Conteúdo do arquivo", "content": {"application/octet-stream": {"schema": {"type": "string", "format": "binary"}}}}, "404": {"description": "Arquivo não encontrado"}}}
        },
        "/files/{file_id}/share": {
            "post": {
                "tags": ["Compartilhamento"], "summary": "Criar link temporário", "security": [{"sessionCookie": [], "csrfToken": []}],
                "parameters": [{"name": "file_id", "in": "path", "required": True, "schema": {"type": "string", "format": "uuid"}}],
                "requestBody": {"content": {"application/json": {"schema": {"type": "object", "properties": {"expiresInMinutes": {"type": "integer", "minimum": 0, "default": 60}}}}}},
                "responses": {"200": {"description": "Link criado com data de expiração"}, "404": {"description": "Arquivo não encontrado"}},
            }
        },
        "/share/{token}": {
            "get": {"tags": ["Compartilhamento"], "summary": "Baixar arquivo por link temporário", "parameters": [{"name": "token", "in": "path", "required": True, "schema": {"type": "string"}}], "responses": {"200": {"description": "Conteúdo do arquivo"}, "404": {"description": "Link indisponível"}, "410": {"description": "Link expirado"}}}
        },
        "/admin/users": {
            "get": {"tags": ["Administração"], "summary": "Listar usuários", "security": [{"sessionCookie": []}], "responses": {"200": {"description": "Lista de usuários"}, "403": {"description": "Acesso restrito"}}}
        },
        "/admin/users/{user_id}": {
            "delete": {"tags": ["Administração"], "summary": "Excluir usuário comum e seus arquivos", "security": [{"sessionCookie": [], "csrfToken": []}], "parameters": [{"name": "user_id", "in": "path", "required": True, "schema": {"type": "integer"}}], "responses": {"204": {"description": "Usuário excluído"}, "403": {"description": "Operação não permitida"}, "404": {"description": "Usuário não encontrado"}}}
        },
    },
}