/**
 * pdfUtils.js — Shared PDF export / import helpers
 *
 * Export:  buildPdf(config)  → triggers browser download
 * Import:  parseCsvFile(file) → parses a CSV file into row objects
 *
 * Uses jsPDF (UMD build) + jspdf-autotable for export — the UMD build
 * avoids dynamic imports of optional peer deps (canvg, html2canvas) that
 * Vite's dev server cannot resolve.
 * Import accepts CSV so users can fill in the template and re-import data.
 */

// Use the standard ES module build — canvg/html2canvas/dompurify are aliased
// to stubs in vite.config.js since we only use autoTable (no SVG/HTML rendering)
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// ── Brand colours ─────────────────────────────────────────────────────────────
const DARK_GREEN  = [13,  36, 21];   // #0d2415  — header bg
const MID_GREEN   = [22, 163, 74];   // #16a34a  — accent
const LIGHT_GREEN = [220, 252, 231]; // #dcfce7  — alternate row
const TEXT_DARK   = [15,  23, 42];   // near-black
const TEXT_MUTED  = [100, 116, 139]; // slate-500

/**
 * buildPdf({ title, subtitle, columns, rows, totalsRow, fileName, orientation })
 *
 * @param {string}   title         — Main heading
 * @param {string}   subtitle      — Sub-heading / date range / farm name
 * @param {string[]} columns       — Column header labels
 * @param {Array[]}  rows          — 2D array of cell values (strings / numbers)
 * @param {Array}    totalsRow     — Optional footer summary row (same length as columns)
 * @param {string}   fileName      — Output file name without extension
 * @param {'p'|'l'}  orientation   — 'p' portrait (default), 'l' landscape
 */
export function buildPdf({
  title,
  subtitle = '',
  columns  = [],
  rows     = [],
  totalsRow = null,
  fileName  = 'report',
  orientation = 'p',
}) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // ── Header band ────────────────────────────────────────────────────────────
  doc.setFillColor(...DARK_GREEN);
  doc.rect(0, 0, pageW, 22, 'F');

  // Logo text
  doc.setTextColor(163, 232, 198); // #a3e8c6
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('SmartIrrigate OS', 10, 10);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  doc.text('Smart Irrigation Management System (SIMS)', 10, 16);

  // Date stamp top-right
  doc.setFontSize(8);
  doc.setTextColor(200, 230, 210);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 10, 10, { align: 'right' });

  // ── Title block ────────────────────────────────────────────────────────────
  doc.setTextColor(...TEXT_DARK);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 10, 33);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXT_MUTED);
    doc.text(subtitle, 10, 40);
  }

  const tableStartY = subtitle ? 45 : 39;

  // ── Table ──────────────────────────────────────────────────────────────────
  doc.autoTable({
    head: [columns],
    body: rows,
    foot: totalsRow ? [totalsRow] : [],
    startY: tableStartY,
    margin: { left: 10, right: 10 },
    styles: {
      fontSize: 9,
      cellPadding: 3,
      textColor: TEXT_DARK,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: DARK_GREEN,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: TEXT_DARK,
      fontStyle: 'bold',
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: LIGHT_GREEN,
    },
    columnStyles: {
      0: { fontStyle: 'bold' },
    },
    didDrawPage(data) {
      // Footer on every page
      const pg  = doc.internal.getCurrentPageInfo().pageNumber;
      const tot = doc.internal.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(...TEXT_MUTED);
      doc.text(
        `Page ${pg} of ${tot}  ·  SIMS Confidential`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 6,
        { align: 'center' }
      );
      // Bottom accent line
      doc.setDrawColor(...MID_GREEN);
      doc.setLineWidth(0.8);
      doc.line(10, doc.internal.pageSize.getHeight() - 10, pageW - 10, doc.internal.pageSize.getHeight() - 10);
    },
  });

  doc.save(`${fileName}.pdf`);
}

/**
 * buildCsvTemplate({ columns, sampleRows, fileName })
 * Exports a CSV file users can fill in and re-import.
 */
export function buildCsvTemplate({ columns, sampleRows = [], fileName = 'import_template' }) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const lines = [
    columns.map(escape).join(','),
    ...sampleRows.map(row => row.map(escape).join(',')),
  ];

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${fileName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * parseCsvFile(file) → Promise<Array<Object>>
 * Parses a CSV file (first row = headers) into an array of objects.
 * Handles quoted fields and Windows line endings.
 */
export function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        const lines = text.trim().split('\n');
        if (lines.length < 2) return resolve([]);

        const headers = parseCsvLine(lines[0]);
        const rows = lines.slice(1)
          .filter(l => l.trim())
          .map(l => {
            const vals = parseCsvLine(l);
            const obj  = {};
            headers.forEach((h, i) => { obj[h.trim()] = (vals[i] ?? '').trim(); });
            return obj;
          });

        resolve(rows);
      } catch (err) {
        reject(new Error('Failed to parse CSV: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsText(file);
  });
}

/** Parse a single CSV line respecting quoted fields. */
function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuote = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { cur += ch; }
    } else {
      if (ch === '"') { inQuote = true; }
      else if (ch === ',') { result.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  result.push(cur);
  return result;
}
