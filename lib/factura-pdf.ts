/** Maquetación HTML del PDF de facturas (794px = A4). */

export const FACTURA_PAGE_W = 794;
export const FACTURA_HEADER_H = 132;

export const FACTURA_INK = "#0B1D2E";
export const FACTURA_MUTED = "#64748B";
export const FACTURA_LINE = "#E2E8F0";
export const FACTURA_SURFACE = "#F8FAFC";

export const INVOICE_REHABINCO_LOGO = "/images/logo-web.png";

export function facturaDocumentStyles(): string {
  return `
      * { box-sizing: border-box; }
      html, body { margin:0; padding:0; }
      body {
        font-family: "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, Arial, sans-serif;
        color: ${FACTURA_INK};
        font-size: 13px;
        line-height: 1.45;
        background: #fff;
        width: ${FACTURA_PAGE_W}px;
        -webkit-font-smoothing: antialiased;
      }
      .invoice-header { display:block; width:${FACTURA_PAGE_W}px; height:${FACTURA_HEADER_H}px; border:0; margin:0; padding:0; }
      .invoice-body { padding: 32px 48px 48px; width: ${FACTURA_PAGE_W}px; }
      .inv-block { margin-bottom: 28px; }
      .inv-grid { display: table; width: 100%; border-collapse: collapse; }
      .inv-grid-row { display: table-row; }
      .inv-grid-cell { display: table-cell; vertical-align: top; width: 50%; }
      .inv-grid-cell--right { text-align: right; padding-left: 24px; }
      .inv-label {
        margin: 0 0 10px 0;
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: ${FACTURA_MUTED};
      }
      .inv-party p { margin: 0 0 3px 0; font-size: 13px; color: ${FACTURA_INK}; }
      .inv-party p strong { font-weight: 600; }
      .inv-rect {
        margin-bottom: 24px;
        padding: 12px 14px 12px 16px;
        border-left: 3px solid #D97706;
        background: ${FACTURA_SURFACE};
        border-radius: 0 6px 6px 0;
      }
      .inv-rect-title { margin: 0 0 4px 0; font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #92400E; }
      .inv-rect p { margin: 0; font-size: 12px; color: #78350F; line-height: 1.4; }
      .inv-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
      .inv-table th {
        padding: 10px 8px;
        border-bottom: 2px solid ${FACTURA_INK};
        text-align: left;
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: ${FACTURA_MUTED};
      }
      .inv-table th.num { text-align: right; }
      .inv-table td {
        padding: 11px 8px;
        border-bottom: 1px solid ${FACTURA_LINE};
        font-size: 13px;
        vertical-align: top;
      }
      .inv-table td.num { text-align: right; white-space: nowrap; }
      .inv-table tbody tr:last-child td { border-bottom-color: ${FACTURA_INK}; }
      .inv-totals-wrap { display: flex; justify-content: flex-end; margin-bottom: 8px; }
      .inv-totals {
        width: 280px;
        padding: 14px 16px;
        border: 1px solid ${FACTURA_LINE};
        border-radius: 8px;
        background: #fff;
      }
      .inv-totals-row {
        display: flex;
        justify-content: space-between;
        margin: 0 0 6px 0;
        font-size: 13px;
        color: ${FACTURA_INK};
      }
      .inv-totals-row span:first-child { color: ${FACTURA_MUTED}; }
      .inv-totals-total {
        display: flex;
        justify-content: space-between;
        margin: 10px 0 0 0;
        padding-top: 10px;
        border-top: 1px solid ${FACTURA_LINE};
        font-weight: 700;
        font-size: 16px;
        color: ${FACTURA_INK};
      }
      .inv-footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid ${FACTURA_LINE};
      }
      .inv-footer p { margin: 0; font-size: 12px; color: ${FACTURA_MUTED}; line-height: 1.5; }
      .inv-footer p + p { margin-top: 8px; font-size: 10px; }
      .inv-footer strong { color: ${FACTURA_INK}; font-weight: 600; }
    `;
}
