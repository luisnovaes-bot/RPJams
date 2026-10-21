# RPJams

App web para o grupo de RPG ouvir música e ambientação juntos, em sincronia, enquanto joga online. O mestre controla; os jogadores só ouvem.

## Glossário

- **Sala**: espaço permanente de um grupo. Guarda as listas entre sessões. Não tem login.
- **Link de mestre**: link secreto da sala. Quem tem, controla tudo. Se vazar, qualquer um controla.
- **Link de jogador**: link da sala que só permite ouvir e ajustar o próprio volume.
- **Mestre**: quem controla o som. A tela de mestre também toca o som.
- **Jogador**: quem ouve. Entra com um **apelido** e precisa clicar em "Entrar na sessão" (exigência do navegador para liberar áudio).
- **Camada**: um canal de áudio independente. Existem 2 (Camada 1 e Camada 2). Cada uma tem um **nome de tipo** editável (padrão "Música" e "Ambiente"), toca no máximo uma faixa por vez e tem seu botão de play/pause, de **loop** e seu volume.
- **Lista**: coleção de faixas que pertence a uma camada (ex.: "Batalhas" na Camada 1, "Ambientes" na Camada 2). Uma camada pode ter várias listas. Cada lista tem um **padrão de loop**.
- **Faixa**: um link do YouTube colado numa lista, com nome (título do YouTube por padrão, renomeável) e ponto de início opcional (`t=` do link). O mesmo link pode estar em várias listas; cada ocorrência é uma faixa própria.
- **Play geral / Pause geral**: botões no cabeçalho do mestre. O Pause geral pausa com fade o que estiver tocando; o Play geral retoma só as camadas que o Pause geral pausou. Se nada foi pausado assim, o Play geral põe para tocar as camadas paradas.
- **Lista ativa**: a lista da última faixa tocada na camada (ou a primeira lista com faixas). É ela que o play da camada começa.

## Comportamento

- O mestre clica numa faixa de uma lista e ela toca na camada daquela lista. Quando a faixa acaba (sem loop), a próxima da mesma lista começa sozinha; no fim da lista, a camada fica em silêncio. (Mudou em 21/10: antes a camada ficava em silêncio após cada faixa.)
- O botão de play/pause no topo da camada pausa e retoma (do mesmo ponto); se a camada está parada, toca a lista ativa desde a primeira faixa. Não existe mais botão de parar.
- O avanço para a próxima faixa é pedido pela tela do mestre, então ela precisa estar aberta durante a sessão.
- Trocar a faixa de uma camada faz fade de ~3 s: a antiga some em 1,5 s e a nova entra em 1,5 s (sem opção de corte seco por enquanto).
- Ao tocar uma faixa, o loop da camada assume o padrão da lista; o mestre pode mudar na hora. Listas novas da Camada 2 nascem com loop ligado; da Camada 1, desligado.
- O loop volta para o ponto de início da faixa.
- Volume: o mestre define o volume de cada camada para todos; cada pessoa (inclusive o mestre) ajusta o próprio volume de cada camada por cima disso.
- Jogadores não veem o nome da faixa, só se a camada está tocando.
- O mestre vê quem está conectado e se o áudio já foi liberado.
- Sincronia aceitável: até 1–2 s de diferença. Quem entra atrasado cai no ponto atual.
- O som continua tocando com a aba em segundo plano.
- Mestre pode adicionar, remover, renomear e reordenar faixas. Mover lista de camada fica para depois.

## Restrições

- Só computador (navegador desktop). Celular fica fora por ora.
- Grupo de 4 a 8 pessoas. Uso privado primeiro.
- Independente de VTT (Roll20, Foundry, etc.).
- Custo zero, hospedado na Vercel.

## Versão 2 (fora do escopo agora)

- **Cenas**: atalhos que trocam as duas camadas de uma vez (ex.: "Taverna").
- Corte seco na troca de faixa.
- Mover lista entre camadas.
- Efeitos sonoros pontuais.
