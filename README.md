# face-animator

Estrutura inicial com React 19, Vite, TypeScript, MUI, ESLint, Husky e lint-staged.
Permite carregar um arquivo de áudio local e visualizar sua forma de onda mono em toda a largura da janela. O botão de remover limpa o áudio carregado, sem alterar o arquivo original. Inclui play/pause e um indicador de posição da reprodução. Não há corte ou edição do áudio.

O aplicativo publicado está em [https://imbroisi.github.io/face-animator/](https://imbroisi.github.io/face-animator/). O GitHub Pages atualiza essa URL a cada push em `main`.

## Desenvolvimento

```sh
npm install
npm run dev
```

## Validação

```sh
npm run lint
npm run build
```

O hook de pre-commit executa o ESLint com correções nos arquivos preparados para commit via lint-staged.

## Animação por disparo de amplitude

A implementação ativa está em `src/audio/mouthCycles.ts`. As constantes no início do arquivo são editáveis: `TRIGGER_OPENING` e `TRIGGER_CLOSING` (percentuais do pico mono completo), `FADEOUT`, `LINEAR_FADEOUT`, `OPENED_TIME`, `FADEIN`, `LINEAR_FADEIN` e `CLOSED_TIME`. Os tempos são em milissegundos.

Ao atingir TRIGGER_OPENING, abre até a última imagem disponível. Respeita OPENED_TIME como mínimo e mantém aberta até o nível ficar abaixo de TRIGGER_CLOSING por 20 ms. Depois fecha e aguarda antes de aceitar outro disparo. A abertura máxima é calculada a partir das imagens em `faces.normal`; não existe `TOP_MOUTH` fixo. O modo instantâneo troca a imagem no início da respectiva fase, mantendo sua duração configurada.

A análise registra os inícios dos ciclos apenas ao carregar o áudio. Durante a reprodução, uma busca binária localiza o ciclo e calcula a fase pelo relógio do áudio, sem timers. Pausa e navegação mantêm a sincronização. Recarregue o áudio após editar as configurações.

O Rhubarb não é usado nessa abordagem; o áudio é processado integralmente no navegador.

## Exportar MP4

Após carregar o áudio, clique em **Salvar MP4**. O diálogo escolhe o tamanho do quadro, a cor de fundo e o blur da face; essas opções ficam salvas no `localStorage`. O download usa o nome do áudio e inclui a animação completa a 30 fps, em **MP4 H.264 opaco** (`yuv420p`) com áudio AAC — o mesmo formato do relógio, estável no Filmora. A trilha vem do arquivo original (mantém os canais), não o áudio mono usado para análise. Os controles do editor não aparecem no vídeo.

Padrões: fundo `090b0d`, blur `2` px. Em 4K/1080p a largura da face se mantém e só a altura do quadro cresce.

A exportação tenta o FFmpeg no navegador; se falhar, usa o servidor local do Vite (`npm run dev` ou `npm run preview`). Instale FFmpeg e disponibilize-o no PATH, ou defina `FFMPEG_PATH`. Limites atuais no servidor: 200 MB por envio, uma hora de áudio, uma exportação por vez e dez minutos de processamento. Os arquivos temporários são removidos ao terminar.

Se as imagens tiverem tamanhos diferentes, o vídeo usa a maior largura e altura do conjunto; as menores são centralizadas sem redimensionamento, sobre o fundo escolhido.
