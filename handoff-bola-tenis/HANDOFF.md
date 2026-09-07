# Handoff — faces da bola de tênis (Ciência na Real)

Contexto transferido do chat no workspace `milkway` (2026-09-07).

## Objetivo

Criar faces (olhos + boca) para a **bola de tênis** do cenário com T-Rex, usadas no `face-animator` para animar fala. As faces **não** vão coladas na cena: o programa troca conjuntos de faces; o amarelo é **chroma key** e sai na edição/export.

## Spec das imagens

- Tamanho: **74×74 px**
- Fundo: círculo **amarelo chroma** (#FFCC00-ish) em quadrado (cantos pretos ok, como a referência antiga)
- Feições **só** dentro do círculo amarelo
- Estilo: cartoon simples, legível no tamanho pequeno; deve parecer boca/olhos **da bola**, não cópia do emoji antigo
- Referência antiga = só escala/abertura; **não** copiar

## Conjuntos planejados (3)

O app anima com várias imagens de boca (`face-0`, `face-2`, `face-4` no set `normal` atual — 40×40). Para a bola, o plano é **3 faces** (fechada / intermediária / aberta). Ajustar naming ao encaixar no loader (`face-*.png`).

| Estado | Status | Arquivo |
|--------|--------|---------|
| Boca aberta | gerada, aguardando ajuste | `boca-aberta-74.png` |
| Boca intermediária | pendente | — |
| Boca fechada | pendente | — |

**Não** substituir ainda `src/faces/normal/` — set de produção atual continua lá.

## Arquivos neste handoff

- `boca-aberta-74.png` — face aberta 74×74
- `refs/cenario-bg.png` — background da prateleira / bola no T-Rex
- `refs/referencia-face-aberta-antiga.png` — face antiga (proporção)
- `refs/boca-aberta-gen-1024.png` — geração hi-res antes do resize
- Cópia de trabalho: `src/faces/tennis/boca-aberta-74.png`

## Próximos passos no Cursor (abrir este repo)

1. Revisar `boca-aberta-74.png` sobre a bola do `refs/cenario-bg.png`
2. Ajustar se necessário (tamanho da boca, dentes, brilho nos olhos, etc.)
3. Gerar as outras 2 faces no **mesmo estilo**
4. Renomear para `face-0.png` / `face-2.png` / `face-4.png` (ou o padrão do app) e registrar o set no `Faces/index.ts` se criar pasta nova (`tennis`)

## Nota

Conversa original: workspace milkway. Assets de estação Milkway **não** fazem parte deste handoff.
