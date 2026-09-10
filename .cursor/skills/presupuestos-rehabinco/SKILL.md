---
name: presupuestos-rehabinco
description: >-
  Redacta, corrige o convierte presupuestos y ampliaciones del CRM Rehabinco/Garal
  al esquema del wizard (partidas, propuesta JSON, bajas y ajuste comercial).
  Úsala al pedir un presupuesto, una ampliación sobre uno cerrado, o correcciones
  de totales, partidas, turnos u observaciones.
---

# Presupuestos Rehabinco / Garal

El PDF lo genera el CRM (`lib/presupuesto-pdf.ts`). En Cursor solo se rellenan **datos**, no se diseña el documento.

## Correcciones (el caso habitual)

Aplica el cambio pedido y devuelve el documento **completo**. Una cifra, un sitio:

- Total u objetivo comercial → `ajuste_comercial` (ampliación) o `porcentaje_descuento` (presupuesto). Nunca ambos.
- Quitar partida del inicial → `propuesta.bajas[]` (`descripcion`, `importe` positivo). No la dejes también en `lineas`.
- Quitar partida de la obra nueva → sácala de `lineas`.
- Turnos, premura, horario → `condicionantes_ejecucion`.
- Ocultar un bloque → el flag correspondiente a `false` (`mostrar_repercusion`, `mostrar_observaciones`, `mostrar_zonas`, `mostrar_programa`).

## Ampliación (`tipo: "ampliacion"`)

PDF de **2 hojas** (portada + desglose). Por defecto:

- `mostrar_zonas: false`, `mostrar_programa: false`
- `mostrar_repercusion: true`, `mostrar_observaciones: false`
- `porcentaje_descuento: 0`
- `densidad_tabla` la pone el CRM en compacta

Campos:

- `origen_numero`, `origen_total` = presupuesto inicial cerrado
- `lineas` = **solo altas** (obra nueva)
- `bajas` = partidas que se restan del inicial
- `ajuste_comercial` = signed (p. ej. `-1040`) para encajar el incremento

Incremento neto = altas − bajas + ajuste. Esa es la cifra de portada.

Nunca inventes el capítulo `00 · Repercusión` ni una partida «Ajuste comercial»: el CRM las escribe al guardar para el trigger de totales.

## Presupuesto completo (`tipo: "presupuesto"`)

Capítulos `01 · NOMBRE`, `02 · NOMBRE`. Partidas con unidad (`ml`, `m²`, `ud`, `h`, `pa`), cantidad y precio sin IVA.

Si no hay medición o precio en el material de origen: cantidad o precio `0` y avisa.

## Textos

Tono técnico, sobrio, España. No marketing. No toques fotos de portada ni anexos.

Condiciones por defecto si no piden otras: garantía 24 meses, precios con MO/materiales/medios/protecciones/residuos/limpieza, pago certificaciones 30 días, extra con contradictorios.

## Dónde va esto en el CRM

Pega el resultado en el **Copiloto** del wizard o de la ficha (`/presupuestos/[id]`), o transcribe los campos. No generes HTML/PDF libre.
