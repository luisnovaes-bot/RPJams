# 0001 - YouTube como única fonte de áudio

**Status:** aceito (2026-10-21)

## Contexto
O grupo quer ouvir as mesmas faixas em sincronia sem que todos precisem de conta paga. Spotify exigiria Premium de cada jogador; upload de arquivos exigiria armazenamento.

## Decisão
As faixas são links do YouTube tocados pelo player oficial (IFrame API) no navegador de cada pessoa. O servidor só sincroniza estado (qual faixa, de onde, quando começou), nunca transmite áudio.

## Consequências
- Custo zero de banda e armazenamento.
- Os termos do YouTube exigem player visível de no mínimo 200x200 px: ele fica discreto num canto da tela.
- Quem não tem YouTube Premium pode ver anúncios e sair de sincronia por alguns segundos; o app re-sincroniza quando o anúncio acaba. Quem tem Premium e está logado no YouTube no mesmo navegador normalmente não vê anúncios no player embutido (depende de cookies de terceiros estarem liberados).
- Vídeos com incorporação bloqueada pelo dono não tocam; o app avisa o mestre ao colar o link.
- O áudio precisa continuar com a aba em segundo plano. O player do YouTube continua tocando, mas o navegador desacelera timers em abas ocultas, o que pode afetar fades e re-sincronização. Isso precisa ser testado cedo.
