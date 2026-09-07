-- 002_lembrete_marcacoes.sql
--
-- Ajusta o nome da tabela "marcacoes" se no teu esquema tiver outro nome.
-- Corre isto uma vez na tua base de dados Neon (consola do Neon, ou psql, ou
-- qualquer cliente ligado à mesma DATABASE_URL que a app usa).

ALTER TABLE marcacoes
  ADD COLUMN IF NOT EXISTS cliente_email        TEXT,
  ADD COLUMN IF NOT EXISTS status                TEXT NOT NULL DEFAULT 'agendada',
  ADD COLUMN IF NOT EXISTS token_confirmacao      TEXT,
  ADD COLUMN IF NOT EXISTS token_criado_em        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lembrete_enviado_em    TIMESTAMPTZ;

-- garante que cada token só pode apontar para uma marcação
CREATE UNIQUE INDEX IF NOT EXISTS idx_marcacoes_token_confirmacao
  ON marcacoes (token_confirmacao)
  WHERE token_confirmacao IS NOT NULL;

-- acelera a query diária do cron (procura por data + status)
CREATE INDEX IF NOT EXISTS idx_marcacoes_data_status
  ON marcacoes (data, status);

-- valores possíveis para "status": 'agendada' | 'confirmada' | 'cancelada'
--
-- marcações antigas (feitas antes desta alteração) ficam automaticamente
-- com status = 'agendada' por causa do DEFAULT acima.


-- ============================================================================
-- PASSO CRÍTICO — só necessário se a tabela "marcacoes" tiver um UNIQUE em
-- (profissional, data, hora)
-- ============================================================================
--
-- O reservar.js apanha o erro 23505 ("violação de UNIQUE") como proteção
-- contra duas pessoas reservarem o mesmo horário ao mesmo tempo — o que
-- significa que provavelmente já existe uma constraint UNIQUE nessas 3
-- colunas. Se for esse o caso, SEM este passo, um horário cancelado por um
-- cliente (pelo link do email) fica bloqueado PARA SEMPRE, porque a
-- constraint não sabe distinguir uma marcação cancelada de uma ativa.
--
-- 1) Corre esta query para veres se existe, e com que nome:

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'marcacoes'::regclass
  AND contype = 'u';

-- 2) Se aparecer uma linha cuja definição mencione profissional, data e hora,
--    substitui NOME_DA_CONSTRAINT abaixo pelo conname devolvido e corre:

-- ALTER TABLE marcacoes DROP CONSTRAINT NOME_DA_CONSTRAINT;

-- 1b) Se o passo 1 não devolver nada, pode ser um índice único "solto" (sem
--     constraint por trás). Confirma com esta query:

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'marcacoes'
  AND indexdef ILIKE '%UNIQUE%';

-- Se aparecer um índice cuja definição mencione profissional, data e hora,
-- substitui NOME_DO_INDICE abaixo pelo indexname devolvido e corre:

-- DROP INDEX NOME_DO_INDICE;

-- 3) De seguida cria um índice único "parcial", que só considera marcações
--    que NÃO estão canceladas (isto resolve o problema, mantendo a mesma
--    proteção contra corridas em simultâneo):

CREATE UNIQUE INDEX IF NOT EXISTS idx_marcacoes_unico_ativo
  ON marcacoes (profissional, data, hora)
  WHERE status != 'cancelada';

-- Se no passo 1 não apareceu nenhuma linha (ou seja, não existe UNIQUE
-- constraint, só o índice normal criado no passo 3 acima já chega — não
-- precisas de fazer mais nada).

