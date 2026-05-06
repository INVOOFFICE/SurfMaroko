// js/invoices.js — Devis rapide, rapport PDF historique
function newDevis() {
  nav('generate', sbItem('generate'));
  setTimeout(() => {
    const t = document.getElementById('doc-type');
    if (t) t.value = 'D';
    updateDocRef();
    updateDocStatus();
    if (typeof refreshThemedSelect === 'function') refreshThemedSelect('doc-type');
    runDGICheck();
  }, 50);
}
function generateHistPDFReport() {
  const fromEl = document.getElementById('hist-date-from');
  const toEl = document.getElementById('hist-date-to');
  const from = (fromEl?._filterValue ?? fromEl?.value) || '';
  const to = (toEl?._filterValue ?? toEl?.value) || '';

  const docs =
    typeof getHistFiltered === 'function'
      ? getHistFiltered()
      : (DB.docs || []).filter(d => (!from || d.date >= from) && (!to || d.date <= to));

  if (!docs.length) {
    toast('Aucun document pour cette période', 'err');
    return;
  }

  const s = DB.settings || {};
  const esc = typeof escapeHtml === 'function' ? escapeHtml : v => String(v == null ? '' : v);
  const cur = s.currency || 'DH';
  const fmtN = v =>
    (v || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    ' ' +
    cur;
  const typeLbl = {
    F: 'Facture',
    D: 'Devis',
    BL: 'Bon de livraison',
    AV: 'Avoir',
    BC: 'Bon de commande',
  };
  const periodLabel = from || to ? `Du ${from || '—'} au ${to || '—'}` : 'Toutes périodes';
  const periodLabelSafe = esc(periodLabel);
  const companyNameSafe = esc(s.name || 'INVO');

  const totalHT = docs.reduce((s, d) => s + (d.ht || 0), 0);
  const totalTTC = docs.reduce((s, d) => s + (d.ttc || 0), 0);
  const totalTVA = totalTTC - totalHT;
  const paye = docs.filter(d => d.status === 'Payé').reduce((s, d) => s + (d.ttc || 0), 0);
  const impaye = docs
    .filter(d => d.status === 'Impayé' || d.status === 'Envoyé')
    .reduce((s, d) => s + (d.ttc || 0), 0);

  const statusClass = st =>
    st === 'Payé' ? 'hist-status-paid' : st === 'Annulé' ? 'hist-status-cancelled' : 'hist-status-sent';

  const rows = docs
    .map(
      d => `
    <tr>
      <td>${esc(d.date || '')}</td>
      <td class="hist-ref-cell">${esc(d.ref || '')}</td>
      <td>${esc(typeLbl[d.type] || d.type || '')}</td>
      <td>${esc(d.clientName || '—')}</td>
      <td class="hist-num-cell">${fmtN(d.ht)}</td>
      <td class="hist-num-cell">${fmtN((d.ttc || 0) - (d.ht || 0))}</td>
      <td class="hist-num-cell hist-num-strong">${fmtN(d.ttc)}</td>
      <td><span class="hist-status-pill ${statusClass(d.status)}">${esc(d.status || '')}</span></td>
    </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>Rapport Historique — ${periodLabelSafe}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#1a2736;background:#fff;padding:28px 32px}
    h1{font-size:20px;font-weight:800;color:#1a3c5e;margin-bottom:3px}
    .sub{color:#5a7089;font-size:11px;margin-bottom:22px}
    .kpis{display:flex;gap:12px;margin-bottom:22px;flex-wrap:wrap}
    .kpi{flex:1;min-width:110px;background:#f4f7fa;border-radius:8px;padding:10px 14px;border-left:3px solid #09BC8A}
    .kpi.red{border-color:#ef4444}.kpi.gold{border-color:#F0A500}
    .kpi-l{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#5a7089;margin-bottom:3px}
    .kpi-v{font-size:15px;font-weight:800;color:#1a3c5e}
    .kpi.red .kpi-v{color:#ef4444}.kpi.gold .kpi-v{color:#F0A500}
    table{width:100%;border-collapse:collapse}
    th{background:#1a3c5e;color:#fff;padding:7px 9px;text-align:left;font-size:11px;font-weight:700}
    td{padding:6px 9px;border-bottom:1px solid #eef1f5;font-size:11px;vertical-align:middle}
    tr:nth-child(even) td{background:#f8f9fb}
    tfoot td{font-weight:800;background:#e8f5f0;border-top:2px solid #09BC8A;font-size:12px}
    .hist-ref-cell{font-weight:600}
    .hist-num-cell{text-align:right}
    .hist-num-strong{font-weight:700}
    .hist-status-pill{padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700}
    .hist-status-paid{background:rgba(9,188,138,.13);color:#09BC8A}
    .hist-status-cancelled{background:rgba(239,68,68,.12);color:#ef4444}
    .hist-status-sent{background:rgba(240,165,0,.12);color:#F0A500}
    .footer{margin-top:18px;font-size:10px;color:#94A8BE;text-align:center}
    @media print{body{padding:12px}@page{margin:15mm}}
  </style></head><body>
  <h1>📊 Rapport Historique Documents</h1>
  <div class="sub">${companyNameSafe} &nbsp;·&nbsp; ${periodLabelSafe} &nbsp;·&nbsp; Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  <div class="kpis">
    <div class="kpi"><div class="kpi-l">Documents</div><div class="kpi-v">${docs.length}</div></div>
    <div class="kpi"><div class="kpi-l">Total HT</div><div class="kpi-v">${fmtN(totalHT)}</div></div>
    <div class="kpi"><div class="kpi-l">TVA collectée</div><div class="kpi-v">${fmtN(totalTVA)}</div></div>
    <div class="kpi"><div class="kpi-l">Total TTC</div><div class="kpi-v">${fmtN(totalTTC)}</div></div>
    <div class="kpi"><div class="kpi-l">Encaissé</div><div class="kpi-v">${fmtN(paye)}</div></div>
    <div class="kpi red"><div class="kpi-l">Impayé</div><div class="kpi-v">${fmtN(impaye)}</div></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Référence</th><th>Type</th><th>Client</th><th class="hist-num-cell">HT</th><th class="hist-num-cell">TVA</th><th class="hist-num-cell">TTC</th><th>Statut</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr><td colspan="4">TOTAL — ${docs.length} document(s)</td><td class="hist-num-cell">${fmtN(totalHT)}</td><td class="hist-num-cell">${fmtN(totalTVA)}</td><td class="hist-num-cell">${fmtN(totalTTC)}</td><td></td></tr></tfoot>
  </table>
  ${typeof invoFooterTaglineHtml === 'function' ? invoFooterTaglineHtml('print') : '<div class="footer">INVO · © ' + new Date().getFullYear() + ' INVOOFFICE</div>'}
  <script>window.onload=()=>{window.print();}</script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=960,height=720');
  if (!win) {
    toast('Autorisez les popups pour générer le rapport', 'err');
    return;
  }
  win.document.write(html);
  win.document.close();
  toast(`📊 Rapport généré — ${docs.length} document(s)`, 'suc');
}
