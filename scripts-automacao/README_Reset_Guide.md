# 🔄 Guia de Reset de Estatísticas dos Usuários

## 📋 Visão Geral

Este guia fornece várias opções para resetar estatísticas e status dos usuários da plataforma RevalidaFácil.

## ⚠️ ATENÇÃO - IMPORTANTE

- **TODAS as operações de reset são IRREVERSÍVEIS**
- **SEMPRE faça backup antes de executar qualquer reset**
- **Teste em ambiente de desenvolvimento primeiro**
- **Comunique aos usuários sobre a manutenção**

## 🛠️ Opções Disponíveis

### 1. 🎯 Página Admin (Recomendado)

**Arquivo:** `src/pages/AdminResetUsers.vue`

**Como usar:**
1. Acesse `/admin-reset-users` no navegador
2. Visualize as estatísticas atuais
3. Escolha entre reset completo ou seletivo
4. Confirme a operação

**Vantagens:**
- Interface visual intuitiva
- Estatísticas em tempo real
- Reset seletivo por categoria
- Log de operações
- Confirmação obrigatória

### 2. 📜 Script Node.js

**Arquivo:** `scripts-automacao/resetUserStats.js`

**Pré-requisitos:**
```bash
# Instalar dependências
cd scripts-automacao
npm install firebase-admin

# Baixar chave do Firebase Admin SDK
# Salvar como: revalida-companion-firebase-adminsdk.json
```

**Como usar:**

```bash
# Reset completo (com confirmação)
node resetUserStats.js --confirm

# Reset seletivo
node resetUserStats.js --selective --status --estacoes --notas

# Ver opções disponíveis
node resetUserStats.js
```

**Opções do reset seletivo:**
- `--status`: Resetar status dos usuários
- `--estacoes`: Resetar estatísticas de estações
- `--notas`: Resetar notas e médias
- `--tempo`: Resetar tempo de treinamento
- `--conquistas`: Resetar conquistas e progresso

### 3. 🌐 API Backend

**Arquivo:** `backend/routes/adminReset.js`

**Endpoints disponíveis:**

```javascript
// Reset completo
POST /api/admin/reset-all-user-stats
Headers: { Authorization: "Bearer YOUR_ADMIN_TOKEN" }

// Reset seletivo
POST /api/admin/reset-selective-user-stats
Body: {
  resetStatus: true,
  resetEstacoes: true,
  resetNotas: false,
  resetTempo: false,
  resetConquistas: true
}

// Obter estatísticas
GET /api/admin/user-stats-summary

// Criar backup
POST /api/admin/backup-user-stats
```

### 4. 💾 SQL Direto

**Arquivo:** `scripts-automacao/resetUserStats.sql`

**⚠️ Usar apenas em emergências!**

```sql
-- Executar no banco de dados
-- 1. Fazer backup
-- 2. Executar reset
-- 3. Verificar resultados
```

## 📊 Dados que Serão Resetados

### Reset Completo
- ✅ Status dos usuários → `offline`
- ✅ Total de estações feitas → `0`
- ✅ Estatísticas por especialidade → `{}`
- ✅ Média geral → `0`
- ✅ Melhor nota → `0`
- ✅ Pior nota → `0`
- ✅ Tempo total de treinamento → `0`
- ✅ Pontos de experiência → `0`
- ✅ Nível atual → `"Iniciante"`
- ✅ Conquistas → `[]`
- ✅ Histórico de simulações → `[]`
- ✅ Progresso semanal → `[]`
- ✅ Metas da semana → `{}`

### Dados Preservados
- ✅ Informações pessoais (nome, email, telefone)
- ✅ Data de cadastro
- ✅ Foto do perfil
- ✅ Configurações de conta
- ✅ Roles e permissões

## 🔐 Configuração de Segurança

### 1. Token de Admin (Backend)

```javascript
// No .env do backend
ADMIN_SECRET_TOKEN=seu_token_super_secreto_aqui

// No código
const requireAdminAuth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== process.env.ADMIN_SECRET_TOKEN) {
    return res.status(403).json({ error: 'Acesso negado' });
  }
  next();
};
```

### 2. Firebase Admin SDK

```javascript
// Baixar chave do Firebase Console
// Project Settings > Service Accounts > Generate new private key
// Salvar como: revalida-companion-firebase-adminsdk.json
```

### 3. Proteção da Página Admin

```javascript
// Adicionar middleware de autenticação admin
// No router ou na página AdminResetUsers.vue
```

## 📈 Monitoramento

### Logs Importantes

```javascript
// Firestore
console.log('✅ Reset concluído no Firestore!');
console.log(`📊 Total de usuários resetados: ${count}`);

// Backend
console.log('✅ Backend resetado com sucesso!');
console.log(`Database affected rows: ${result.affectedRows}`);
```

### Verificação Pós-Reset

```sql
-- Verificar estatísticas após reset
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN status = 'online' THEN 1 END) as online,
  SUM(total_estacoes_feitas) as total_estacoes,
  AVG(media_geral) as media
FROM usuarios;
```

## 🚨 Plano de Contingência

### Se algo der errado:

1. **Backup automático:** Todos os scripts criam backup automaticamente
2. **Restauração:** Use os comandos SQL de restore
3. **Suporte:** Contate o desenvolvedor imediatamente
4. **Comunicação:** Informe os usuários sobre o problema

### Restauração de Emergência:

```sql
-- Restaurar do backup mais recente
UPDATE usuarios u 
SET /* campos do backup */
FROM usuario_stats_backup_emergency b
WHERE u.uid = b.uid;
```

## 📋 Checklist de Execução

### Antes do Reset:
- [ ] Backup da base de dados completa
- [ ] Notificação aos usuários
- [ ] Teste em ambiente de desenvolvimento
- [ ] Validação dos tokens de acesso
- [ ] Verificação das estatísticas atuais

### Durante o Reset:
- [ ] Monitorar logs em tempo real
- [ ] Verificar progresso da operação
- [ ] Confirmar sincronização Firestore/Backend

### Após o Reset:
- [ ] Verificar estatísticas zeradas
- [ ] Testar login de usuários
- [ ] Validar funcionalidades
- [ ] Comunicar conclusão
- [ ] Documentar a operação

## 📞 Suporte

Em caso de dúvidas ou problemas:

1. Verificar logs da aplicação
2. Consultar documentação do Firebase
3. Revisar configurações do backend
4. Contatar equipe de desenvolvimento

---

**⚠️ Lembre-se: Esta é uma operação crítica que afeta todos os usuários. Execute com cautela!**
