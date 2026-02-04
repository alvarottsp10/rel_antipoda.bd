# 📋 FOLHA DE CONTROLO DE OBRA - GUIA DE INSTALAÇÃO

## 📑 Índice
1. [Visão Geral](#visão-geral)
2. [Requisitos](#requisitos)
3. [Instalação no Servidor](#instalação-no-servidor)
4. [Configuração da Aplicação](#configuração-da-aplicação)
5. [Instalação nos PCs dos Funcionários](#instalação-nos-pcs-dos-funcionários)
6. [Testar a Instalação](#testar-a-instalação)
7. [Manutenção](#manutenção)
8. [Resolução de Problemas](#resolução-de-problemas)

---

## 🎯 Visão Geral

Esta aplicação permite registar horas de trabalho em obras/projetos. É composta por:

```
┌─────────────────────────────────────────────────────────────┐
│                        SERVIDOR                              │
│  ┌─────────────┐    ┌─────────────────┐                     │
│  │   Node.js   │───▶│  database.sqlite │                    │
│  │   (API)     │    │  (Base de dados) │                    │
│  │  Porta 3000 │    └─────────────────┘                     │
│  └──────┬──────┘                                            │
└─────────┼───────────────────────────────────────────────────┘
          │
    Rede Local
          │
┌─────────┼───────────────────────────────────────────────────┐
│    ┌────▼────┐    ┌─────────┐    ┌─────────┐               │
│    │  PC 1   │    │  PC 2   │    │  PC 3   │   ...         │
│    │ Browser │    │ Browser │    │ Browser │               │
│    └─────────┘    └─────────┘    └─────────┘               │
│                    FUNCIONÁRIOS                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Requisitos

### No Servidor:
- Windows 10/11 ou Windows Server
- Mínimo 4GB RAM
- 1GB espaço em disco
- **Permissões de administrador** (para instalar Node.js)
- Porta 3000 disponível

### Nos PCs dos Funcionários:
- Browser moderno (Chrome, Edge, Firefox)
- Acesso à rede onde está o servidor

---

## 🖥️ Instalação no Servidor

### Passo 1: Instalar Node.js

1. Ir a: https://nodejs.org/
2. Descarregar a versão **LTS** (Long Term Support)
3. Executar o instalador
4. Seguir o assistente (Next, Next, Next...)
5. **Importante**: Marcar a opção "Add to PATH"

**Verificar instalação** (abrir CMD ou PowerShell):
```cmd
node --version
npm --version
```
Deve aparecer algo como: `v20.x.x` e `10.x.x`

### Passo 2: Criar Pasta da Aplicação

```cmd
mkdir C:\FolhaControloObra
mkdir C:\FolhaControloObra\servidor
mkdir C:\FolhaControloObra\aplicacao
```

### Passo 3: Copiar Ficheiros

Copiar para `C:\FolhaControloObra\servidor\`:
- `package.json`
- `server.js`
- `database.js`
- `.env`

Copiar para `C:\FolhaControloObra\aplicacao\`:
- `index.html`
- `app.js`
- `admin.js`
- `calendar-simple.js`
- `styles.css`
- `api.js`

### Passo 4: Instalar Dependências

Abrir CMD como **Administrador**:
```cmd
cd C:\FolhaControloObra\servidor
npm install
```

Aguardar a instalação (pode demorar 1-2 minutos).

### Passo 5: Configurar o Servidor

Editar o ficheiro `.env`:
```env
PORT=3000
HOST=0.0.0.0
JWT_SECRET=MUDAR_PARA_UMA_CHAVE_SECRETA_UNICA_E_LONGA
DB_PATH=./database.sqlite
```

**IMPORTANTE**: Mudar `JWT_SECRET` para algo único e secreto!

### Passo 6: Iniciar o Servidor

```cmd
cd C:\FolhaControloObra\servidor
npm start
```

Deve aparecer:
```
╔════════════════════════════════════════════════════════════╗
║   🚀 FOLHA DE CONTROLO DE OBRA - SERVIDOR                  ║
║   ✅ Servidor a correr em: http://0.0.0.0:3000             ║
╚════════════════════════════════════════════════════════════╝
```

### Passo 7: Configurar Firewall

1. Abrir "Firewall do Windows com Segurança Avançada"
2. Regras de Entrada → Nova Regra
3. Tipo: Porta
4. TCP, Porta específica: 3000
5. Permitir a conexão
6. Aplicar a todos os perfis
7. Nome: "Folha Controlo Obra"

### Passo 8: Criar Serviço Windows (Opcional mas Recomendado)

Para o servidor iniciar automaticamente com o Windows:

1. Instalar PM2 globalmente:
```cmd
npm install -g pm2
npm install -g pm2-windows-startup
```

2. Configurar:
```cmd
cd C:\FolhaControloObra\servidor
pm2 start server.js --name "folha-controlo-obra"
pm2 save
pm2-startup install
```

---

## ⚙️ Configuração da Aplicação

### Configurar URL do Servidor

No ficheiro `aplicacao/api.js`, alterar a primeira linha:

```javascript
// ANTES (desenvolvimento local)
const API_BASE_URL = 'http://localhost:3000/api';

// DEPOIS (produção - usar IP ou nome do servidor)
const API_BASE_URL = 'http://192.168.1.100:3000/api';
// ou
const API_BASE_URL = 'http://nome-servidor:3000/api';
```

**Descobrir o IP do servidor:**
```cmd
ipconfig
```
Procurar "IPv4 Address" (ex: 192.168.1.100)

---

## 💻 Instalação nos PCs dos Funcionários

### Opção A: Acesso via Browser (Mais Simples)

1. Copiar a pasta `aplicacao` para uma pasta partilhada do servidor ou para cada PC
2. Abrir o ficheiro `index.html` no browser

Ou aceder diretamente se configurares o servidor para servir ficheiros estáticos.

### Opção B: Criar Atalho

1. Copiar pasta `aplicacao` para `C:\FolhaControloObra\` em cada PC
2. Criar atalho para `index.html` no Desktop
3. Renomear atalho para "Folha de Controlo de Obra"

### Opção C: Pasta de Rede Partilhada

1. Partilhar a pasta `aplicacao` no servidor
2. Nos PCs, criar atalho para `\\servidor\aplicacao\index.html`

---

## ✅ Testar a Instalação

### 1. Testar Servidor
No browser do servidor, ir a:
```
http://localhost:3000/api/health
```
Deve aparecer: `{"status":"ok",...}`

### 2. Testar de Outro PC
No browser de outro PC na rede:
```
http://192.168.1.100:3000/api/health
```
(substituir pelo IP correto)

### 3. Testar Login
- Utilizador: `admin`
- Password: `admin123`

**IMPORTANTE**: Mudar a password do admin após primeiro login!

---

## 🔧 Manutenção

### Backup da Base de Dados

O ficheiro `database.sqlite` contém todos os dados. Para fazer backup:

```cmd
copy C:\FolhaControloObra\servidor\database.sqlite C:\Backups\database_%date%.sqlite
```

**Recomendação**: Configurar backup automático diário.

### Ver Logs

Se usar PM2:
```cmd
pm2 logs folha-controlo-obra
```

### Reiniciar Servidor

```cmd
pm2 restart folha-controlo-obra
```

Ou sem PM2:
```cmd
Ctrl+C (para parar)
npm start (para iniciar)
```

### Atualizar Aplicação

1. Parar servidor: `pm2 stop folha-controlo-obra`
2. Fazer backup da base de dados
3. Substituir ficheiros
4. Iniciar servidor: `pm2 start folha-controlo-obra`

---

## 🔥 Resolução de Problemas

### "Não consigo ligar ao servidor"

1. Verificar se servidor está a correr
2. Verificar IP do servidor
3. Verificar firewall
4. Testar: `ping IP_DO_SERVIDOR`

### "Erro de autenticação"

1. Verificar se token não expirou (24h)
2. Limpar localStorage do browser (F12 → Application → Clear)
3. Fazer login novamente

### "Base de dados corrompida"

1. Parar servidor
2. Renomear `database.sqlite` para `database_old.sqlite`
3. Iniciar servidor (cria nova BD)
4. Recuperar dados do backup

### "Porta 3000 já em uso"

Mudar porta no ficheiro `.env`:
```env
PORT=3001
```

E atualizar `api.js` nos clientes.

### "npm install falha"

1. Verificar conexão à internet
2. Tentar: `npm cache clean --force`
3. Tentar novamente: `npm install`

---

## 📞 Suporte

Para problemas técnicos:
1. Verificar esta documentação
2. Consultar logs do servidor
3. Contactar responsável de IT

---

## 📝 Notas Importantes

1. **Segurança**: 
   - Mudar password do admin
   - Mudar JWT_SECRET
   - Fazer backups regulares

2. **Rede**: 
   - O servidor precisa de IP fixo ou nome DNS
   - Todos os PCs precisam de acesso à mesma rede

3. **Performance**: 
   - SQLite suporta bem até ~100 utilizadores simultâneos
   - Para mais, considerar migrar para MySQL/PostgreSQL

---

**Versão**: 1.0.0  
**Data**: Janeiro 2026
