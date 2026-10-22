# RPJams

App web para o grupo de RPG ouvir música e ambientação juntos, em sincronia, enquanto joga online. O mestre controla; os jogadores só ouvem.

## Glossário

- **Sala**: espaço permanente de um grupo. Guarda as camadas e faixas entre sessões. Não tem login.
- **Link de mestre**: link secreto da sala. Quem tem, controla tudo. Se vazar, o admin pode gerar um novo (o antigo para de funcionar).
- **Link de jogador**: link da sala que só permite ouvir e ajustar o próprio volume.
- **Mestre**: quem controla o som. A tela de mestre também toca o som.
- **Jogador**: quem ouve. Entra com um **apelido** e precisa clicar em "Entrar na sessão" (exigência do navegador para liberar áudio).
- **Camada**: um canal de áudio independente, de 1 a 4 por sala. A sala nasce com uma ("Música"); o mestre cria outras dando um nome, que vira o título do card. Cada camada toca no máximo uma faixa por vez e tem play/pause, **loop** e volume próprios.
- **Faixas**: a fila de vídeos do YouTube de uma camada, com nome (título do YouTube, renomeável) e ponto de início opcional (`t=` do link). Colar uma playlist acrescenta todos os vídeos na ordem dela. Por dentro cada camada guarda as faixas numa única lista do banco.
- **Play geral / Pause geral**: botões no cabeçalho do mestre. O Pause geral pausa com fade o que estiver tocando; o Play geral retoma só as camadas que o Pause geral pausou. Se nada foi pausado assim, põe para tocar as camadas paradas que têm faixas.
- **Admin**: painel em /chefao, protegido por ADMIN_PASSWORD, que lista as salas, links, quem está conectado e o que toca, e permite renomear, gerar novo link de mestre e apagar sala.

## Comportamento

- Clicar numa faixa toca ela na camada. Quando a faixa acaba (sem loop), a próxima da fila começa sozinha; no fim, a camada fica em silêncio. O avanço é pedido pela tela do mestre, então ela precisa estar aberta durante a sessão.
- O play/pause no topo da camada pausa e retoma do mesmo ponto; com a camada parada, toca a fila desde a primeira faixa.
- Trocar de faixa faz fade (a antiga some em 1,5 s e a nova entra em 1,5 s).
- O loop começa desligado em todas as camadas e só muda pelo botão da camada; trocar de faixa não mexe nele. O loop volta para o ponto de início da faixa.
- A faixa atual tem barra de minutagem para pular para qualquer ponto (tocando ou pausada).
- Volume: o mestre define o volume de cada camada para todos; cada jogador tem um único volume próprio, aplicado a todas as camadas.
- Jogadores não veem o nome das faixas, só o nome da camada e se ela está tocando. O player do YouTube (200x200, regra do YouTube) ainda pode mostrar o título por alguns segundos.
- Camada sem faixas mostra só o campo de colar link; ao esvaziar a fila, a camada para e volta a esse estado.
- O mestre vê quem está conectado e se o áudio já foi liberado.
- Sincronia aceitável: até 1–2 s de diferença. Quem entra atrasado cai no ponto atual.
- O som continua tocando com a aba em segundo plano.
- Cada conexão (IP) pode criar no máximo 5 salas por hora (janela deslizante); a 6ª recebe um aviso para aguardar.
- Logo depois de criar a sala, o botão "Abrir a sala como mestre" entra direto no painel (o clique já liberou o som).

## Restrições

- Só computador (navegador desktop). Celular fica fora por ora.
- Grupo de 4 a 8 pessoas. Uso privado primeiro.
- Independente de VTT (Roll20, Foundry, etc.).
- Custo zero, hospedado na Vercel.

## Versão 2 (fora do escopo agora)

- **Cenas**: atalhos que trocam várias camadas de uma vez (ex.: "Taverna").
- Corte seco na troca de faixa.
- Login de mestre (Neon Auth) e painel de efeitos sonoros curtos com arquivos de áudio.
- Efeitos sonoros pontuais.
