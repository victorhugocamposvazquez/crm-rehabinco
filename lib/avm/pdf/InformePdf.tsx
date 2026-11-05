import React, { type ReactNode } from "react";
import { Circle, Document, Image, Page, Rect, Svg, Text, View } from "@react-pdf/renderer";
import { EMPRESA_DOCUMENTOS } from "@/lib/empresa-documentos";
import { AVISO_LEGAL_PDF, eurosPdf, inicialesMarca, type FilaEntornoPdf, type FilaFicha, type InformePdfModel, type TonoChip } from "./model";
import { fmtNumero } from "../ui/format";

type Tokens = {
  paper: string;
  ink: string;
  muted: string;
  dim: string;
  line: string;
  soft: string;
  brand: string;
  brandFg: string;
  good: string;
  goodBg: string;
  bad: string;
  badBg: string;
  warn: string;
  warnBg: string;
  info: string;
  infoBg: string;
  value: string;
  contactBg: string;
  contactFg: string;
  contactMuted: string;
  marker: string;
};

function tokensDe(model: InformePdfModel): Tokens {
  const dark = model.theme === "dark";
  const brand = model.marca.color || "#121214";
  const clara = luminance(brand) > 0.75;
  return {
    paper: dark ? "#0a0a0b" : "#ffffff",
    ink: dark ? "#f3f3f1" : "#121214",
    muted: dark ? "#a3a3ab" : "#5f5f66",
    dim: dark ? "#73737b" : "#8e8e95",
    line: dark ? "#2a2a30" : "#e4e4df",
    soft: dark ? "#17171a" : "#f4f4f1",
    brand: dark && clara ? "#ffffff" : brand,
    brandFg: clara ? "#0a0a0b" : "#ffffff",
    good: dark ? "#4ade80" : "#15803d",
    goodBg: dark ? "#143024" : "#e8f5ec",
    bad: dark ? "#f87171" : "#b42323",
    badBg: dark ? "#3a1818" : "#fbe9e9",
    warn: dark ? "#f5b942" : "#a15c00",
    warnBg: dark ? "#3a2a10" : "#fdf1df",
    info: dark ? "#7ab8ff" : "#1d4ed8",
    infoBg: dark ? "#14233a" : "#e8eefc",
    value: dark ? "#f3f3f1" : clara ? "#121214" : brand,
    contactBg: dark ? "#ffffff" : clara ? "#efefed" : "#e5f0ee",
    contactFg: dark ? "#0a0a0b" : "#121214",
    contactMuted: dark ? "#3f3f46" : "#5f5f66",
    marker: dark ? "#f3f3f1" : clara ? "#121214" : brand,
  };
}

function luminance(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length < 6) return 0;
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(n(0)) + 0.7152 * lin(n(2)) + 0.0722 * lin(n(4));
}

function tono(t: Tokens, tone: TonoChip): { fg: string; bg: string } {
  if (tone === "good") return { fg: t.good, bg: t.goodBg };
  if (tone === "bad") return { fg: t.bad, bg: t.badBg };
  if (tone === "warn") return { fg: t.warn, bg: t.warnBg };
  return { fg: t.info, bg: t.infoBg };
}

const base = {
  page: { fontFamily: "Inter", fontSize: 9, paddingTop: 34, paddingHorizontal: 42, paddingBottom: 56 },
  row: { flexDirection: "row" },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  kicker: { fontSize: 8, letterSpacing: 0.8, textTransform: "uppercase", fontWeight: 600, marginBottom: 4 },
  h1: { fontSize: 16, fontWeight: 700, letterSpacing: -0.3 },
  h2: { fontSize: 11, fontWeight: 600, marginBottom: 4 },
  muted: { fontSize: 9 },
  num: { fontVariant: "tabular-nums" as const },
} as const;

function Cabecera({ model, t }: { model: InformePdfModel; t: Tokens }) {
  const logo = model.theme === "dark" ? model.marca.logoDark ?? model.marca.logoLight : model.marca.logoLight ?? model.marca.logoDark;
  const cif = /rehabinco/i.test(model.marca.name) ? `CIF ${EMPRESA_DOCUMENTOS.cif}` : null;
  const contacto = [cif, model.marca.phone, model.marca.email, model.marca.web].filter(Boolean).join(" · ");
  return (
    <View style={{ ...base.between, borderBottomWidth: 0.6, borderBottomColor: t.line, paddingBottom: 8, marginBottom: 10 }}>
      <View style={{ ...base.row, alignItems: "center", gap: 8, flex: 1 }}>
        {logo ? (
          <Image src={logo} style={{ height: 22, width: 96, objectFit: "contain" }} />
        ) : (
          <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: t.brand, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.brandFg, fontWeight: 700, fontSize: 11 }}>{inicialesMarca(model.marca.name)}</Text>
          </View>
        )}
        <View>
          <Text style={{ fontWeight: 600, fontSize: 11, color: t.ink }}>{model.marca.name}</Text>
          {contacto ? <Text style={{ color: t.muted, fontSize: 8, marginTop: 1 }}>{contacto}</Text> : null}
        </View>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{ fontWeight: 600, fontSize: 9, color: t.ink }}>{model.titulo}</Text>
        <Text style={{ color: t.muted, fontSize: 8, marginTop: 1 }}>{model.fecha}</Text>
        <Text style={{ color: t.muted, fontSize: 8 }}>ref. {model.idCorto}</Text>
      </View>
    </View>
  );
}

function Pie({ t }: { t: Tokens }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        left: 42,
        right: 42,
        bottom: 22,
        borderTopWidth: 0.6,
        borderTopColor: t.line,
        paddingTop: 6,
        flexDirection: "row",
        gap: 12,
      }}
    >
      <Text style={{ flex: 1, color: t.dim, fontSize: 7, lineHeight: 1.35 }}>{AVISO_LEGAL_PDF}</Text>
      <Text
        style={{ color: t.dim, fontSize: 7.5 }}
        render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
      />
    </View>
  );
}

function Chip({ text, tone, t }: { text: string; tone: TonoChip; t: Tokens }) {
  const c = tono(t, tone);
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: c.fg, fontSize: 7.5, fontWeight: 500 }}>{text}</Text>
    </View>
  );
}

function Ficha({ filas, t, conRef }: { filas: FilaFicha[]; t: Tokens; conRef?: string | null }) {
  const todas = conRef ? [{ label: "Referencia catastral", value: conRef, catastro: true }, ...filas] : filas;
  return (
    <View>
      {todas.map((f) => (
        <View key={f.label} style={{ ...base.row, justifyContent: "space-between", marginBottom: 3, gap: 8 }}>
          <Text style={{ color: t.muted, fontSize: 8.5 }}>{f.label}</Text>
          <View style={{ ...base.row, alignItems: "center", gap: 4, maxWidth: "62%", justifyContent: "flex-end" }}>
            <Text style={{ fontSize: 8.5, color: t.ink, textAlign: "right" }}>{f.value}</Text>
            {f.catastro ? <Chip text="Catastro" tone="good" t={t} /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function BarraZona({ model, t }: { model: InformePdfModel; t: Tokens }) {
  const bar = model.zoneBar;
  if (!bar) return null;
  const x = 8 + (bar.leftPct / 100) * 214;
  return (
    <View style={{ marginTop: 8 }}>
      <Svg width="230" height="22" viewBox="0 0 230 22">
        <Rect x="0" y="6" width="230" height="8" rx="4" fill={t.soft} />
        <Rect x="0" y="6" width="70" height="8" rx="4" fill={t.goodBg} />
        <Rect x="160" y="6" width="70" height="8" rx="4" fill={t.warnBg} />
        <Circle cx={x} cy="10" r="6" fill={t.marker} stroke={t.paper} strokeWidth={2} />
      </Svg>
      <View style={{ ...base.row, justifyContent: "space-between" }}>
        <Text style={{ color: t.dim, fontSize: 7 }}>P25 · {bar.p25}</Text>
        <Text style={{ color: t.dim, fontSize: 7 }}>mediana · {bar.median}</Text>
        <Text style={{ color: t.dim, fontSize: 7 }}>P75 · {bar.p75}</Text>
      </View>
      {bar.note ? <Text style={{ color: t.muted, fontSize: 8, marginTop: 3 }}>{bar.note}</Text> : null}
    </View>
  );
}

function Anillos({ model, t }: { model: InformePdfModel; t: Tokens }) {
  const comps = model.comparables;
  const R = 108;
  const cx = 140;
  const cy = 140;
  return (
    <View>
      <Svg width="220" height="220" viewBox="0 0 280 280">
        {[100, 200, 300].map((m) => {
          const r = (R * m) / 300;
          return (
            <Circle key={m} cx={cx} cy={cy} r={r} fill="none" stroke={t.line} strokeWidth={0.8} strokeDasharray="3 3" />
          );
        })}
        {[100, 200, 300].map((m) => {
          const r = (R * m) / 300;
          return (
            <Text key={`t${m}`} x={cx + r - 2} y={cy - 4} fill={t.dim} style={{ fontSize: 7 }} textAnchor="end">
              {m} m
            </Text>
          );
        })}
        {comps.map((c, i) => {
          const a = (i / Math.max(comps.length, 1)) * Math.PI * 2 - 1.2;
          const r = (R * Math.min(c.distanceM, 300)) / 300;
          return (
            <Circle
              key={`${c.zone}-${i}`}
              cx={cx + Math.cos(a) * r}
              cy={cy + Math.sin(a) * r}
              r={3 + c.weight * 6}
              fill={t.info}
              fillOpacity={0.65}
            />
          );
        })}
        <Circle cx={cx} cy={cy} r={5.5} fill={t.ink} stroke={t.paper} strokeWidth={1.6} />
      </Svg>
    </View>
  );
}

function ListaEntorno({ items, t, marca }: { items: FilaEntornoPdf[]; t: Tokens; marca: string }) {
  return (
    <View>
      {items.map((item, i) => {
        const c = tono(t, item.tone);
        return (
          <View key={`${item.title}-${i}`} style={{ ...base.row, gap: 6, marginBottom: 4 }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: c.fg, fontSize: 7, fontWeight: 700 }}>{marca === "info" ? "i" : marca}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 8.5, color: t.ink }}>{item.title}</Text>
              {item.sub ? <Text style={{ fontSize: 7.5, color: t.dim }}>{item.sub}</Text> : null}
            </View>
            {item.points != null ? (
              <Text style={{ fontSize: 8, fontWeight: 600, color: item.points >= 0 ? t.good : t.bad }}>
                {item.points > 0 ? `+${item.points}` : `−${Math.abs(item.points)}`}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function Tile({ label, value, foot, t }: { label: string; value: string; foot: string; t: Tokens }) {
  return (
    <View style={{ flex: 1, borderWidth: 0.6, borderColor: t.line, borderRadius: 6, padding: 7 }}>
      <Text style={{ color: t.muted, fontSize: 7.5 }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: 600, color: t.ink, marginTop: 1 }}>{value}</Text>
      <Text style={{ color: t.dim, fontSize: 7, marginTop: 1 }}>{foot}</Text>
    </View>
  );
}

function Pagina({ model, t, children }: { model: InformePdfModel; t: Tokens; children: ReactNode }) {
  return (
    <Page size="A4" wrap={false} style={{ ...base.page, backgroundColor: t.paper, color: t.ink }}>
      <Cabecera model={model} t={t} />
      {children}
      <Pie t={t} />
    </Page>
  );
}

function Propietario({ model, t }: { model: InformePdfModel; t: Tokens }) {
  const sub = [model.tipo, model.surface != null ? `${fmtNumero(model.surface)} m²` : null, model.localidad, model.catastralRef ? `ref. catastral ${model.catastralRef}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <Pagina model={model} t={t}>
        <View style={{ ...base.row, alignItems: "flex-end", marginBottom: 8 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ ...base.kicker, color: t.dim }}>Valoración de tu vivienda</Text>
            <Text style={{ ...base.h1, color: t.ink }}>{model.address}</Text>
            <Text style={{ ...base.muted, color: t.muted, marginTop: 2 }}>{sub}</Text>
          </View>
          <View style={{ width: 168, alignItems: "flex-end" }}>
            <Text style={{ ...base.kicker, color: t.dim }}>Valor estimado de venta</Text>
            <Text style={{ fontSize: 22, fontWeight: 700, color: t.value }}>{eurosPdf(model.valueMid)}</Text>
            <Text style={{ color: t.muted, fontSize: 9, marginTop: 2 }}>
              entre {eurosPdf(model.valueLow)} y {eurosPdf(model.valueHigh)}
            </Text>
            <View style={{ marginTop: 4 }}>
              <Chip text={`estimación ${model.confidenceLabel}`} tone="info" t={t} />
            </View>
          </View>
        </View>
        <View style={{ ...base.row, gap: 6, marginBottom: 8 }}>
          <Tile
            t={t}
            label="Precio por m²"
            value={model.pricePerM2 != null ? `${fmtNumero(Math.round(model.pricePerM2))} €` : "sin dato"}
            foot={model.zoneMedian != null ? `tu zona: ${fmtNumero(Math.round(model.zoneMedian))} €/m² de oferta` : "sin mediana de zona"}
          />
          <Tile
            t={t}
            label="Alquiler estimado"
            value={model.rentMonthly != null ? `${fmtNumero(model.rentMonthly)} €/mes` : "sin dato"}
            foot={model.grossYield != null ? `rentabilidad bruta ${fmtNumero(model.grossYield, 1)} %` : "sin rentabilidad"}
          />
          <Tile t={t} label="Base del cálculo" value={`${model.comparablesCount} viviendas`} foot="en venta a menos de 300 m" />
        </View>
        <View style={{ ...base.row, gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>Tu vivienda</Text>
            <Ficha filas={model.ficha} t={t} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>El mercado de tu zona</Text>
            <Ficha filas={model.mercadoOwner} t={t} />
            <BarraZona model={model} t={t} />
          </View>
        </View>
        <View style={{ marginTop: 8 }}>
          <Text style={base.h2}>Cómo lo hemos calculado</Text>
          {model.bullets.map((b, i) => (
            <Text key={b} style={{ fontSize: 8.5, color: t.ink, marginBottom: 2 }}>
              {i + 1}. {b}
            </Text>
          ))}
        </View>
      </Pagina>
      <Pagina model={model} t={t}>
        <View style={{ ...base.row, gap: 10 }}>
          <View style={{ flex: 1.3 }}>
            <Text style={base.h2}>Viviendas parecidas en venta cerca</Text>
            <View style={{ ...base.row, borderBottomWidth: 0.5, borderBottomColor: t.line, paddingBottom: 3 }}>
              {["Zona", "m²", "Precio", "€/m²", "Distancia"].map((h, i) => (
                <Text key={h} style={{ flex: i === 0 ? 2.2 : 1, fontSize: 7, color: t.muted, textAlign: i === 0 ? "left" : "right" }}>
                  {h}
                </Text>
              ))}
            </View>
            {model.comparables.map((c, i) => (
              <View key={`${c.zone}-${i}`} style={{ ...base.row, borderBottomWidth: 0.4, borderBottomColor: t.line, paddingVertical: 2 }}>
                <Text style={{ flex: 2.2, fontSize: 7.5, color: t.ink }}>{c.zone}</Text>
                <Text style={{ flex: 1, fontSize: 7.5, textAlign: "right" }}>{c.m2}</Text>
                <Text style={{ flex: 1, fontSize: 7.5, textAlign: "right" }}>{eurosPdf(c.price)}</Text>
                <Text style={{ flex: 1, fontSize: 7.5, textAlign: "right" }}>{fmtNumero(c.ppm2)}</Text>
                <Text style={{ flex: 1, fontSize: 7.5, textAlign: "right" }}>{c.distanceM} m</Text>
              </View>
            ))}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>Dónde están</Text>
            <Anillos model={model} t={t} />
            <Text style={{ color: t.dim, fontSize: 7, marginTop: 2 }}>Punto central: tu vivienda. Círculos: viviendas en venta; el tamaño indica lo parecida que es.</Text>
          </View>
        </View>
        <View style={{ ...base.row, gap: 12, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>Tu entorno · a favor</Text>
            <ListaEntorno items={model.positivos.slice(0, 5)} t={t} marca="+" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>A tener en cuenta</Text>
            <ListaEntorno items={model.negativos} t={t} marca="−" />
            <ListaEntorno items={model.avisos} t={t} marca="i" />
          </View>
        </View>
        <View style={{ marginTop: 8, backgroundColor: t.contactBg, borderRadius: 6, padding: 8, ...base.row, justifyContent: "space-between", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: 600, fontSize: 9, color: t.contactFg }}>¿Quieres saber cuánto podrías obtener de verdad?</Text>
            <Text style={{ fontSize: 8, color: t.contactMuted, marginTop: 2 }}>
              Te acompañamos en la venta: visita sin compromiso, estrategia de precio y seguimiento de las viviendas comparables cada mes.
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ fontWeight: 600, fontSize: 9, color: t.contactFg }}>{model.marca.agentName}</Text>
            {model.marca.agentPhone ? <Text style={{ fontSize: 8, color: t.contactFg }}>{model.marca.agentPhone}</Text> : null}
            {model.marca.email ? <Text style={{ fontSize: 8, color: t.contactMuted }}>{model.marca.email}</Text> : null}
          </View>
        </View>
      </Pagina>
    </>
  );
}

function Interno({ model, t }: { model: InformePdfModel; t: Tokens }) {
  const sub = [model.tipo, model.surface != null ? `${fmtNumero(model.surface)} m²` : null, model.localidad, model.catastralRef ? `ref. ${model.catastralRef}` : null, `método ${model.methodVersion}`]
    .filter(Boolean)
    .join(" · ");
  return (
    <>
      <Pagina model={model} t={t}>
        <View style={{ ...base.row, alignItems: "flex-end", marginBottom: 8 }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ ...base.kicker, color: t.dim }}>Zona interna · solo para la agencia</Text>
            <Text style={{ ...base.h1, color: t.ink }}>{model.address}</Text>
            <Text style={{ color: t.muted, fontSize: 8, marginTop: 2 }}>{sub}</Text>
          </View>
          <View style={{ width: 168, alignItems: "flex-end" }}>
            <Text style={{ ...base.kicker, color: t.dim }}>Valor de cierre</Text>
            <Text style={{ fontSize: 22, fontWeight: 700, color: t.value }}>{eurosPdf(model.valueMid)}</Text>
            <Text style={{ color: t.muted, fontSize: 8, marginTop: 2 }}>
              {eurosPdf(model.valueLow)} – {eurosPdf(model.valueHigh)} · {model.rangeNote}
            </Text>
          </View>
        </View>
        <View style={{ ...base.row, gap: 6, marginBottom: 8 }}>
          <Tile
            t={t}
            label="€/m² ajustado"
            value={model.pricePerM2 != null ? `${fmtNumero(Math.round(model.pricePerM2))} €` : "sin dato"}
            foot={model.zoneMedian != null ? `zona ${fmtNumero(Math.round(model.zoneMedian))} €` : ""}
          />
          <Tile t={t} label="Confianza" value={`${model.confidence} %`} foot={`precisión del formulario ${model.precision} %`} />
          <Tile
            t={t}
            label="Alquiler"
            value={model.rentMonthly != null ? `${fmtNumero(model.rentMonthly)} €/mes` : "sin dato"}
            foot={
              model.rentMonthly != null
                ? [model.rentMethod, model.grossYield != null ? `${fmtNumero(model.grossYield, 1)} % bruto` : null].filter(Boolean).join(" · ")
                : ""
            }
          />
          <Tile t={t} label="Precio de oferta sugerido" value={eurosPdf(model.offerPrice)} foot={model.offerNote} />
        </View>
        <View style={{ ...base.row, gap: 12, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>Fuentes usadas</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
              {model.sources.map((s) => (
                <Chip key={s.label} text={s.label} tone={s.tone} t={t} />
              ))}
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>Por qué esta confianza</Text>
            {model.penalties.map((p) => (
              <View key={p.text} style={{ ...base.row, gap: 6, marginBottom: 2 }}>
                <Text style={{ color: t.bad, fontSize: 8, fontWeight: 600, width: 18 }}>{p.points}</Text>
                <Text style={{ flex: 1, fontSize: 8, color: t.ink }}>{p.text}</Text>
              </View>
            ))}
          </View>
        </View>
        <View style={{ ...base.row, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>Ficha del inmueble</Text>
            <Ficha filas={model.ficha} t={t} conRef={model.catastralRef} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>Mercado de la zona</Text>
            <Ficha filas={model.mercadoInterno} t={t} />
            <BarraZona model={model} t={t} />
          </View>
        </View>
      </Pagina>
      <Pagina model={model} t={t}>
        <Text style={base.h2}>Comparables · {model.comparablesCount} usados · ajustes solo por atributos del inmueble</Text>
        <View style={{ ...base.row, borderBottomWidth: 0.5, borderBottomColor: t.line, paddingBottom: 2 }}>
          {["Portal", "Anuncio", "Precio", "m²", "€/m²", "Ajustes", "€/m²", "Dist.", "Peso"].map((h, i) => (
            <Text key={`${h}${i}`} style={{ flex: i === 1 || i === 5 ? 1.6 : 1, fontSize: 6.5, color: t.muted, textAlign: i === 0 || i === 1 || i === 5 ? "left" : "right" }}>
              {h}
            </Text>
          ))}
        </View>
        {model.comparables.map((c, i) => (
          <View key={`${c.portal}-${i}`} style={{ ...base.row, borderBottomWidth: 0.3, borderBottomColor: t.line, paddingVertical: 1.5, alignItems: "flex-start" }}>
            <Text style={{ flex: 1, fontSize: 6.5 }}>{c.portal}</Text>
            <Text style={{ flex: 1.6, fontSize: 6.5 }}>{c.zone}</Text>
            <Text style={{ flex: 1, fontSize: 6.5, textAlign: "right" }}>{eurosPdf(c.price)}</Text>
            <Text style={{ flex: 1, fontSize: 6.5, textAlign: "right" }}>{c.m2}</Text>
            <Text style={{ flex: 1, fontSize: 6.5, textAlign: "right" }}>{fmtNumero(c.ppm2)}</Text>
            <Text style={{ flex: 1.6, fontSize: 6, fontFamily: "JetBrains Mono", color: t.muted }}>{c.adjustments.map((a) => a.text).join("  ") || "—"}</Text>
            <Text style={{ flex: 1, fontSize: 6.5, textAlign: "right", fontWeight: 600 }}>{fmtNumero(c.adjustedPpm2)}</Text>
            <Text style={{ flex: 1, fontSize: 6.5, textAlign: "right" }}>{c.distanceM} m</Text>
            <Text style={{ flex: 1, fontSize: 6.5, textAlign: "right" }}>{fmtNumero(c.weight, 2)}</Text>
          </View>
        ))}
        <View style={{ ...base.row, gap: 10, marginTop: 8 }}>
          <View style={{ width: 200 }}>
            <Anillos model={model} t={t} />
            <Text style={{ color: t.dim, fontSize: 7 }}>Inmueble en el centro. Comparables por distancia; el radio del círculo sigue el peso. Anillos 100 / 200 / 300 m.</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={base.h2}>Cómo se ha calculado</Text>
            <Text style={{ fontFamily: "JetBrains Mono", fontSize: 7, color: t.muted, lineHeight: 1.45 }}>
              {model.explanation.map((l, i) => `${i + 1}. ${l}`).join("\n")}
            </Text>
          </View>
        </View>
      </Pagina>
      <Pagina model={model} t={t}>
        <View style={{ ...base.between, marginBottom: 6 }}>
          <Text style={base.h2}>Entorno</Text>
          <Chip text="no cambia el precio · informa" tone="info" t={t} />
        </View>
        {model.envScore != null ? (
          <View style={{ ...base.row, alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Text style={{ fontSize: 18, fontWeight: 700 }}>{model.envScore}</Text>
            <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: t.soft, position: "relative" }}>
              <View style={{ position: "absolute", left: `${model.envScore}%`, top: -3, width: 12, height: 12, borderRadius: 6, backgroundColor: t.ink, borderWidth: 2, borderColor: t.paper }} />
            </View>
            <Text style={{ color: t.muted, fontSize: 8 }}>{model.envWord}</Text>
          </View>
        ) : null}
        <View style={{ ...base.row, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ ...base.kicker, color: t.dim }}>A favor</Text>
            <ListaEntorno items={model.positivos} t={t} marca="+" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ ...base.kicker, color: t.dim }}>En contra</Text>
            <ListaEntorno items={model.negativos} t={t} marca="−" />
            <Text style={{ ...base.kicker, color: t.dim, marginTop: 6 }}>Riesgos y avisos</Text>
            <ListaEntorno items={model.avisos} t={t} marca="i" />
          </View>
        </View>
        <Text style={{ ...base.h2, marginTop: 8 }}>Capas consultadas</Text>
        {model.layers.length ? (
          model.layers.map((capa) => (
            <View key={capa.name} style={{ ...base.row, justifyContent: "space-between", borderBottomWidth: 0.4, borderBottomColor: t.line, paddingVertical: 2 }}>
              <Text style={{ fontSize: 8, flex: 1 }}>{capa.name}</Text>
              <Text style={{ fontSize: 8, color: t.muted }}>{capa.date}</Text>
            </View>
          ))
        ) : (
          <Text style={{ fontSize: 8, color: t.muted }}>Sin capas cargadas en esta valoración.</Text>
        )}
        <Text style={{ ...base.h2, marginTop: 8 }}>Datos de la valoración</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {model.meta.map((m) => (
            <View key={m.label} style={{ width: "33%", marginBottom: 4 }}>
              <Text style={{ color: t.dim, fontSize: 7 }}>{m.label}</Text>
              <Text style={{ fontSize: 8, fontWeight: 600, fontFamily: m.mono ? "JetBrains Mono" : "Inter" }}>{m.value}</Text>
            </View>
          ))}
        </View>
      </Pagina>
    </>
  );
}

export function InformePdfDocument({ model }: { model: InformePdfModel }) {
  const t = tokensDe(model);
  return (
    <Document title={model.titulo} author={model.marca.name}>
      {model.variant === "propietario" ? <Propietario model={model} t={t} /> : <Interno model={model} t={t} />}
    </Document>
  );
}
