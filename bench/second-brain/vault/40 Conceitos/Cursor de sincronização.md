---
tags: [glossario, integracao]
aliases: [cursor, ponteiro de sync]
type: conceito
---
# Cursor de sincronização

Um marcador guardado no banco que diz "já enviei tudo até a fatura de id N". Na rodada seguinte, só o que vier depois entra. Isso torna a integração **retomável**: se cair no meio, recomeça de onde parou, sem reenviar o mundo.

Pegadinha: o cursor só vale se o envio for em ordem. Se pular uma fatura e avançar, ela fica para trás para sempre. É a história por trás de [[D-23 Sincronização com o ERP em lotes com cursor]] e do incidente do ERP em [[I-2026-08 ERP fora do ar travou a sincronização]].
