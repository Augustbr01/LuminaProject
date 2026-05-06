# Lumina — Assistente Financeiro Pessoal

## Overview

Lumina é um aplicativo mobile (iOS e Android) de gestão
financeira pessoal. O usuário importa extratos bancários
em PDF, e a IA extrai e categoriza as transações
automaticamente. O app exibe gráficos de gastos por
categoria, comparativos mensais e permite definir metas
financeiras com acompanhamento de progresso. O diferencial
é a categorização automática via IA sem necessidade de
integração bancária — o usuário controla quais dados
compartilha.

## Goals

1. Permitir que qualquer usuário importe um extrato PDF
   de qualquer banco brasileiro e veja suas transações
   categorizadas em menos de 30 segundos.
2. Oferecer um dashboard claro com gastos por categoria
   e histórico mensal baseado nos extratos importados.
3. Permitir que o usuário defina metas financeiras e
   acompanhe o progresso com base nos dados reais dos
   extratos.

## Core User Flow

1. Usuário baixa o app e cria conta via Clerk
   (e-mail ou Google).
2. Usuário acessa a aba "Extratos" e toca em
   "Importar extrato".
3. Seleciona um PDF do banco no dispositivo.
4. Informa o banco e o mês/ano do extrato.
5. O app envia o PDF ao back-end. Se o PDF estiver
   criptografado, o back-end retorna `PDF_ENCRYPTED` e
   o app exibe um modal pedindo a senha. O usuário
   informa a senha e o app reenvia o PDF com ela.
   O back-end valida a regra de negócio e chama a Claude API.
6. A IA retorna as transações categorizadas em JSON.
7. O app exibe a lista de transações com categoria,
   valor e data.
8. Transações com baixa confiança são sinalizadas
   para revisão rápida do usuário.
9. O dashboard é atualizado automaticamente com os
   novos dados.
10. O usuário acessa a aba "Metas", cria uma meta
    e acompanha o progresso mês a mês.

## Features

### Importação de Extratos

- Upload de PDF via Expo Document Picker.
- Usuário informa o banco (seletor) e o mês/ano.
- Se o PDF estiver protegido por senha, o app exibe
  um modal pedindo a senha ao usuário. A senha é
  enviada junto com o PDF no segundo envio e usada
  apenas para descriptografar em memória no back-end.
  A senha nunca é salva.
- Regra: 1 extrato por banco por mês por usuário.
  Segunda tentativa de upload é bloqueada antes de
  chamar a IA — exibe mensagem clara ao usuário.
- O PDF é processado em memória e descartado após
  a extração. Não é salvo no servidor.
- Indicador de progresso (loading) exibido durante
  o upload; ao final, sucesso ou erro. Estado
  transitório do mobile — não persistido no banco.

### Categorização por IA

- Claude API (claude-haiku-4-5) recebe o PDF nativo
  e retorna JSON estruturado com as transações.
- Categorias: alimentacao, transporte, moradia, lazer,
  saude, assinaturas, compras, investimento, outro.
- Campo `confidence` (0.0 a 1.0) salvo por transação.
- Transações com `confidence < 0.75` são sinalizadas
  na UI para revisão manual do usuário.
- Usuário pode corrigir a categoria de qualquer
  transação a qualquer momento.

### Dashboard e Gráficos

- Resumo do mês atual: total gasto, categoria maior,
  variação percentual vs mês anterior.
- Gráfico de pizza com distribuição por categoria.
- Gráfico de barras com histórico dos últimos 6 meses.
- Filtro por banco quando há múltiplos extratos
  no mesmo mês.

### Metas Financeiras

- Usuário cria meta com nome, valor alvo e data limite.
- Progresso calculado com base nas transações do tipo
  "investimento" registradas nos extratos.
- Barra de progresso + percentual + valor acumulado.
- Previsão de conclusão no ritmo atual.

## Scope

### In Scope

- Autenticação via Clerk (e-mail e Google).
- Upload e processamento de PDF via Claude API.
- Categorização automática com revisão manual.
- Dashboard com gráficos de gastos por categoria
  e histórico mensal.
- Metas financeiras com progresso e previsão.
- Regra de 1 extrato por banco por mês.
- iOS e Android via Expo.
- Back-end NestJS hospedado no Render.
- Banco de dados PostgreSQL gerenciado no Render.

### Out of Scope

- Integração com bancos via Open Banking ou API.
- Suporte a OFX ou CSV.
- Notificações push.
- Chat conversacional com os dados financeiros.
- Score de saúde financeira.
- Planos pagos e limites por plano.
- Exportação de relatórios em PDF.
- Versão web ou desktop.
- Compartilhamento entre usuários ou conta familiar.

## Success Criteria

1. Usuário autenticado importa um PDF e vê as transações
   categorizadas na tela em menos de 30 segundos.
2. O dashboard exibe corretamente gastos por categoria
   com gráfico de pizza atualizado após cada importação.
3. A regra de 1 extrato por banco por mês é respeitada —
   segunda tentativa bloqueia sem chamar a IA.
4. Usuário consegue criar uma meta e ver o progresso
   atualizado com base nos extratos importados.
5. O app roda em iOS e Android sem erros via Expo.
6. `npm run build` passa sem erros no back-end.
