# RPJams

Música e ambiente sincronizados para a mesa de RPG. Veja [CONTEXT.md](CONTEXT.md) para o que o app faz e [docs/adr](docs/adr) para as decisões.

## Rodar no seu computador

```bash
npm install
npm run db:setup   # cria as tabelas (só na primeira vez)
npx next dev -p 3005
```

Abra http://localhost:3005, crie uma sala e use os dois links: o de mestre (secreto) e o de jogadores.

`.env.local` precisa de `DATABASE_URL`, `NEON_REALTIME_SECRET` e `NEXT_PUBLIC_NEON_REALTIME_URL` (mesmo valor de `NEON_REALTIME_URL`). `npx neon@latest deploy` aplica o `neon.ts` e puxa as variáveis do Neon. A porta 3005 é a que está liberada no Neon Realtime.

## Como a sincronia funciona

O servidor só guarda o que cada camada toca e quando começou (`layer_state.started_at_ms`). Cada navegador toca o vídeo no player do YouTube e, a cada segundo, corrige a posição se estiver mais de 1,5 s fora. O código fica em `lib/layer-player.ts`.
