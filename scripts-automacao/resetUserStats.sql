-- Script SQL para reset direto no banco de dados
-- ATENÇÃO: Execute apenas se necessário e com backup!

-- 1. BACKUP das estatísticas atuais
CREATE TABLE usuario_stats_backup_emergency AS 
SELECT 
  uid,
  email,
  nome,
  sobrenome,
  status,
  total_estacoes_feitas,
  media_geral,
  melhor_nota,
  pior_nota,
  tempo_total_treinamento,
  pontos_experiencia,
  nivel_atual,
  conquistas,
  historico_simulacoes,
  estatisticas_por_especialidade,
  progresso_semanal,
  metas_semana,
  data_ultima_atualizacao,
  NOW() as backup_timestamp
FROM usuarios;

-- 2. RESET COMPLETO
UPDATE usuarios SET 
  status = 'offline',
  total_estacoes_feitas = 0,
  media_geral = 0,
  melhor_nota = 0,
  pior_nota = 0,
  tempo_total_treinamento = 0,
  pontos_experiencia = 0,
  nivel_atual = 'Iniciante',
  ultima_atividade = NULL,
  conquistas = '[]',
  historico_simulacoes = '[]',
  estatisticas_por_especialidade = '{}',
  progresso_semanal = '[]',
  metas_semana = '{"estacoesPlanejadas": 0, "estacoesRealizadas": 0, "progresso": 0}',
  data_ultima_atualizacao = NOW()
WHERE 1=1;

-- 3. RESET APENAS STATUS
-- UPDATE usuarios SET status = 'offline', data_ultima_atualizacao = NOW();

-- 4. RESET APENAS ESTATÍSTICAS DE ESTAÇÕES
-- UPDATE usuarios SET 
--   total_estacoes_feitas = 0,
--   estatisticas_por_especialidade = '{}',
--   data_ultima_atualizacao = NOW();

-- 5. RESET APENAS NOTAS
-- UPDATE usuarios SET 
--   media_geral = 0,
--   melhor_nota = 0,
--   pior_nota = 0,
--   data_ultima_atualizacao = NOW();

-- 6. RESET APENAS PROGRESSO/CONQUISTAS
-- UPDATE usuarios SET 
--   pontos_experiencia = 0,
--   nivel_atual = 'Iniciante',
--   conquistas = '[]',
--   data_ultima_atualizacao = NOW();

-- 7. VERIFICAR RESULTADOS
SELECT 
  COUNT(*) as total_usuarios,
  COUNT(CASE WHEN status = 'online' THEN 1 END) as usuarios_online,
  SUM(total_estacoes_feitas) as total_estacoes,
  AVG(CASE WHEN media_geral > 0 THEN media_geral END) as media_geral,
  COUNT(CASE WHEN pontos_experiencia > 0 THEN 1 END) as usuarios_com_progresso
FROM usuarios;

-- 8. RESTAURAR BACKUP (se necessário)
-- UPDATE usuarios u 
-- SET 
--   status = b.status,
--   total_estacoes_feitas = b.total_estacoes_feitas,
--   media_geral = b.media_geral,
--   melhor_nota = b.melhor_nota,
--   pior_nota = b.pior_nota,
--   tempo_total_treinamento = b.tempo_total_treinamento,
--   pontos_experiencia = b.pontos_experiencia,
--   nivel_atual = b.nivel_atual,
--   conquistas = b.conquistas,
--   historico_simulacoes = b.historico_simulacoes,
--   estatisticas_por_especialidade = b.estatisticas_por_especialidade,
--   progresso_semanal = b.progresso_semanal,
--   metas_semana = b.metas_semana
-- FROM usuario_stats_backup_emergency b
-- WHERE u.uid = b.uid;
