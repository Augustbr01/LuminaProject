---
name: Import Flow
description: Full PDF import flow — bank selector, month selector, file picker, processing, success/error states
type: reference
---

# Fluxo de Importação

Tela cheia (cobre a aba de Extratos). Disparada pelo botão "Importar".
Gerencia 6 steps via state machine.

## Header

- Título: "Importar extrato" (16px/500)
- Botão X à direita para fechar
- Borda inferior: 1px `borderDefault`
- Abaixo: **progress bar de 3 segmentos** (banco / mês / arquivo)
  - Segmento ativo e anteriores: `accentPrimary`
  - Segmentos futuros: `borderDefault`
  - Altura: 3px, border radius 2px

## Steps

### 1. Banco (`step = 'bank'`)

- Título: "Selecione o banco"
- Subtítulo: "De qual banco é esse extrato?"
- Lista de bancos como itens selecionáveis:

  ```
  [Nome do banco]         [CheckCircle se selecionado]
  ```

  Item selecionado: fundo `accentSoft`, borda `accentPrimary`.
  Item normal: fundo `bgSurface`, borda `borderDefault`.
  Border radius: 10px. Padding: `13px 14px`.

- Bancos disponíveis: Nubank, Itaú, Bradesco, Santander, Banco do Brasil,
  Caixa, Inter, C6 Bank, XP Investimentos.
- Botão "Continuar" primary, largura 100%. Desabilitado (opacity 0.4) até selecionar banco.

### 2. Mês (`step = 'month'`)

- Botão "Voltar" no topo (ícone chevron-left + texto "Voltar", `textMuted`).
- Título: "Mês do extrato"
- Subtítulo: "[Banco selecionado] · Selecione o período"
- Lista de meses no mesmo estilo dos bancos.
- **Bloqueio de duplicata inline:** se `banco + mês` já importado:
  - Banner vermelho abaixo da lista:
    `ícone AlertTriangle + "Você já importou o extrato [Banco] de [Mês]."`
    Fundo `rgba(240,78,78,0.08)`, borda `rgba(240,78,78,0.25)`, border radius 10px.
  - Botão "Continuar" permanece desabilitado.
- Botão "Continuar" desabilitado se nenhum mês selecionado ou se há duplicata.

### 3. Arquivo (`step = 'file'`)

- Botão "Voltar".
- Título: "Selecione o PDF"
- Subtítulo: "[Banco] · [Mês]"
- **Chips de resumo:** dois chips verdes com banco e mês selecionados.
  Fundo `accentSoft`, texto `accentPrimary`, border radius 20px, 12px/500.

- **Área de drop/pick:**
  - Borda dashed `borderDefault` (sem arquivo) ou `accentPrimary` (com arquivo)
  - Border radius 12px, padding `32px 20px`
  - **Sem arquivo:**
    - Ícone `Upload` 24px, `textMuted` em container `bgElevated` 44px
    - "Toque para selecionar o PDF" (14px/500, `textMuted`)
    - "Apenas arquivos .pdf" (12px, `textMuted`)
  - **Com arquivo:**
    - Ícone `FileText` 24px, `accentPrimary` em container `accentSoft` 44px
    - Nome do arquivo (14px/500, `textPrimary`)
    - "Toque para trocar" (12px, `textMuted`)
  - Toque → abre Expo Document Picker filtrado para PDF.

- Botão primary "Importar extrato" — desabilitado até ter arquivo (opacity 0.4).
- Link ghost "Simular erro" (desenvolvimento only, não vai para produção).

### 4. Processando (`step = 'processing'`)

- Centralizado verticalmente.
- `LoadingSpinner`
- "Processando extrato..." (16px/500, `textPrimary`)
- "A IA está extraindo e categorizando suas transações" (13px, `textMuted`)
- Chips animados: "Lendo PDF" · "Extraindo" · "Categorizando"
  Fundo `accentSoft`, texto `accentPrimary`, border radius 20px, 11px.

### 5. Sucesso (`step = 'success'`)

- Centralizado verticalmente.
- Círculo 64px fundo `accentSoft` com ícone `CheckCircle` 32px, `accentPrimary`.
- "Extrato importado!" (18px/500, `textPrimary`)
- "**42 transações** categorizadas com sucesso." (13px, `textMuted`)
  - Número em `accentPrimary`/500.
- "1 transação com revisão sugerida." (12px, `textMuted`)
- Botões:
  - Primary "Ver transações" → abre `TransactionsScreen`
  - Ghost "Voltar para extratos" → fecha o flow

### 6. Erro genérico (`step = 'error_generic'`)

- Centralizado verticalmente.
- Círculo 64px fundo `rgba(240,78,78,0.12)` com ícone `X` 28px, `stateError`.
- "Erro ao processar" (18px/500, `textPrimary`)
- "Não foi possível extrair as transações do PDF. Verifique se o arquivo não está protegido por senha." (13px, `textMuted`)
- **Caixa de erro:**
  Fundo `rgba(240,78,78,0.08)`, borda `rgba(240,78,78,0.2)`, border radius 10px.
  - "Código do erro" (12px, `stateError`, bold)
  - "PDF_PARSE_FAILED · 422" (11px, `stateError`, monospace)
- Botões:
  - Primary "Tentar novamente" → volta para `step = 'file'`
  - Ghost "Cancelar" → fecha o flow

## Regra de negócio no fluxo

A validação de duplicata ocorre **no step 2 (mês)**, antes de qualquer chamada à IA.
Se `userId + banco + mesAno` já existe no banco de dados:
- Backend retorna 409.
- Frontend mostra o banner de erro inline — não avança para o step 3.
- O PDF **não é enviado** ao backend nesse caso.
