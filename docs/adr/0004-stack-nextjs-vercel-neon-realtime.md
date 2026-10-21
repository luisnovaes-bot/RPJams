# 0004 - Next.js na Vercel com Neon Postgres e Neon Realtime

**Status:** aceito (2026-10-21)

## Contexto
Custo zero e hospedagem na Vercel. Funções da Vercel não seguram WebSocket, então o tempo real precisa vir de fora.

## Decisão
- Next.js (App Router) na Vercel para as telas e a API.
- Neon Postgres (conta pessoal, região aws-us-east-2, Postgres 18, configurado em `neon.ts`) guarda salas, listas, faixas, estado das camadas e presença.
- Neon Realtime (beta, grátis) entrega ao navegador as mudanças da tabela `layer_state` e `presence` por WebSocket. A API "sela" a consulta de cada sala; o navegador só assina.
- Cada navegador toca o YouTube por conta própria e calcula a posição a partir de `started_at_ms` e do relógio do servidor (`/api/time`).

## Consequências
- O Realtime está em beta e só existe em algumas regiões dos EUA/Europa/Ásia. Se ele falhar, dá para trocar por consultas periódicas sem mudar o resto.
- Cada endereço onde o app roda precisa estar na lista de origens permitidas do Realtime (lista em `neon.ts`, aplicada com `npx neon@latest deploy`).
