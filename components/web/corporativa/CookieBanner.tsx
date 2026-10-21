"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COOKIE_CONSENT_MAX_AGE,
  COOKIE_CONSENT_NAME,
  CONSENTIMIENTO_SOLO_NECESARIAS,
  CONSENTIMIENTO_TODAS,
  descripcionCategoria,
  etiquetaCategoria,
  parseConsentimiento,
  serializarConsentimiento,
  CATEGORIAS_COOKIES_OPCIONALES,
  type CategoriaCookieOpcional,
  type ConsentimientoCookies,
} from "@/lib/web/cookie-consent";
import { hrefPoliticaCookies, hrefPoliticaPrivacidad } from "@/lib/web/dominio";

type PrefsOpcionales = Record<CategoriaCookieOpcional, boolean>;

function leerConsentimiento(): ConsentimientoCookies | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith(`${COOKIE_CONSENT_NAME}=`));
  if (!match) return null;
  return parseConsentimiento(match.split("=").slice(1).join("="));
}

function guardarConsentimiento(c: ConsentimientoCookies) {
  const value = serializarConsentimiento(c);
  document.cookie = `${COOKIE_CONSENT_NAME}=${value}; path=/; max-age=${COOKIE_CONSENT_MAX_AGE}; SameSite=Lax`;
  window.dispatchEvent(new CustomEvent("rh-cookie-consent", { detail: c }));
}

export function CookieBanner() {
  const pathname = usePathname();
  const enDominio = !pathname.startsWith("/web");
  const politicaHref = hrefPoliticaCookies(enDominio);
  const privacidadHref = hrefPoliticaPrivacidad(enDominio);

  const [visible, setVisible] = useState(false);
  const [panel, setPanel] = useState<"bar" | "config">("bar");
  const [prefs, setPrefs] = useState<PrefsOpcionales>({ preferences: false, analytics: false, marketing: false });

  const revisar = useCallback(() => {
    const guardado = leerConsentimiento();
    if (guardado) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, []);

  useEffect(() => {
    revisar();
    const onShow = () => {
      setPanel("config");
      setVisible(true);
    };
    window.addEventListener("rh-cookie-config", onShow);
    return () => window.removeEventListener("rh-cookie-config", onShow);
  }, [revisar]);

  const cerrarCon = useCallback((c: ConsentimientoCookies) => {
    guardarConsentimiento(c);
    setVisible(false);
    setPanel("bar");
  }, []);

  const aceptarTodas = () => cerrarCon({ ...CONSENTIMIENTO_TODAS, ts: Date.now() });
  const soloNecesarias = () => cerrarCon({ ...CONSENTIMIENTO_SOLO_NECESARIAS, ts: Date.now() });
  const guardarSeleccion = () =>
    cerrarCon({
      v: 1,
      necessary: true,
      preferences: prefs.preferences,
      analytics: prefs.analytics,
      marketing: prefs.marketing,
      ts: Date.now(),
    });

  const tituloPanel = useMemo(() => (panel === "bar" ? "Tu privacidad" : "Configurar cookies"), [panel]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:p-5"
      role="dialog"
      aria-labelledby="cookie-banner-title"
      aria-modal="true"
    >
      <div className="w-full max-w-[640px] overflow-hidden rounded-[20px] border border-[rgba(8,8,8,.08)] bg-[#fefefe]/95 text-[#080808] shadow-[0_24px_80px_rgba(8,8,8,.18)] backdrop-blur-xl">
        <div className="flex flex-col gap-5 p-5 md:p-6">
          <div>
            <p id="cookie-banner-title" className="text-[18px] font-medium tracking-[-0.02em]">
              {tituloPanel}
            </p>
            {panel === "bar" ? (
              <p className="mt-2 text-[14px] leading-relaxed text-[#6b6b6b]">
                Usamos cookies necesarias y, con tu permiso, otras para preferencias, analítica y marketing. Puedes aceptar todas,
                rechazar las opcionales o elegir categorías.{" "}
                <Link href={politicaHref} className="font-medium text-[#080808] underline underline-offset-2">
                  Política de cookies
                </Link>
                {" · "}
                <Link href={privacidadHref} className="font-medium text-[#080808] underline underline-offset-2">
                  Privacidad
                </Link>
              </p>
            ) : (
              <p className="mt-2 text-[14px] leading-relaxed text-[#6b6b6b]">
                Activa solo las categorías que quieras. Las necesarias no se pueden desactivar.
              </p>
            )}
          </div>

          {panel === "config" ? (
            <ul className="flex flex-col gap-3">
              <li className="flex items-start justify-between gap-4 rounded-[14px] bg-[#f4f3f1] px-4 py-3.5">
                <div>
                  <p className="text-[14px] font-medium">{etiquetaCategoria("necessary")}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-[#6b6b6b]">{descripcionCategoria("necessary")}</p>
                </div>
                <span className="shrink-0 text-[12px] font-medium uppercase tracking-wide text-[#6b6b6b]">Siempre</span>
              </li>
              {CATEGORIAS_COOKIES_OPCIONALES.map((cat) => (
                <li key={cat} className="flex items-start justify-between gap-4 rounded-[14px] border border-[rgba(8,8,8,.08)] px-4 py-3.5">
                  <div>
                    <p className="text-[14px] font-medium">{etiquetaCategoria(cat)}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-[#6b6b6b]">{descripcionCategoria(cat)}</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prefs[cat]}
                    aria-label={etiquetaCategoria(cat)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${prefs[cat] ? "bg-[#080808]" : "bg-[#d9d6cf]"}`}
                    onClick={() => setPrefs((s) => ({ ...s, [cat]: !s[cat] }))}
                  >
                    <span
                      className={`absolute top-0.5 h-6 w-6 rounded-full bg-[#fefefe] shadow transition-transform ${prefs[cat] ? "translate-x-[22px]" : "translate-x-0.5"}`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
            {panel === "bar" ? (
              <>
                <button
                  type="button"
                  className="order-3 rounded-[13px] px-4 py-2.5 text-[14px] font-medium text-[#6b6b6b] hover:text-[#080808] sm:order-1 sm:mr-auto"
                  onClick={() => setPanel("config")}
                >
                  Elegir cookies
                </button>
                <button
                  type="button"
                  className="rounded-[13px] border border-[rgba(8,8,8,.14)] px-4 py-2.5 text-[14px] font-medium hover:bg-[#f4f3f1]"
                  onClick={soloNecesarias}
                >
                  Solo necesarias
                </button>
                <button type="button" className="corp-btn shrink-0" onClick={aceptarTodas}>
                  Aceptar todas
                  <span className="corp-btn-icon">✓</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="rounded-[13px] px-4 py-2.5 text-[14px] font-medium text-[#6b6b6b] hover:text-[#080808] sm:mr-auto"
                  onClick={() => setPanel("bar")}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="rounded-[13px] border border-[rgba(8,8,8,.14)] px-4 py-2.5 text-[14px] font-medium hover:bg-[#f4f3f1]"
                  onClick={soloNecesarias}
                >
                  Rechazar opcionales
                </button>
                <button type="button" className="corp-btn shrink-0" onClick={guardarSeleccion}>
                  Guardar preferencias
                  <span className="corp-btn-icon">✓</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Abre de nuevo el panel de cookies (p. ej. desde el pie). */
export function abrirConfiguracionCookies() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("rh-cookie-config"));
}
