# face-animator

Estrutura inicial com React 19, Vite, TypeScript, MUI, ESLint, Husky e lint-staged.
Permite carregar um arquivo de áudio local e visualizar sua forma de onda mono em toda a largura da janela. O botão de remover limpa o áudio carregado, sem alterar o arquivo original. Inclui play/pause e um indicador de posição da reprodução. Não há corte ou edição do áudio.

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
