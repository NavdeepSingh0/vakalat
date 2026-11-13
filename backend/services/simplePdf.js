/**
 * Minimal single-font PDF writer, used only to serve the fictional demo orders as real PDFs
 * (so the download + text-extraction path is exercised without bundled binary files).
 */
function toLatin1(s) {
    return String(s).replace(/[^\x20-\x7e]/g, (ch) => (ch === '\t' ? ' ' : ch.charCodeAt(0) < 256 && ch.charCodeAt(0) >= 160 ? ch : '?'));
}

function escapePdf(s) {
    return toLatin1(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLine(line, width) {
    if (line.length <= width) return [line];
    const out = [];
    let current = '';
    for (const word of line.split(/\s+/)) {
        if ((current + ' ' + word).trim().length > width) { out.push(current); current = word; }
        else current = (current + ' ' + word).trim();
    }
    if (current) out.push(current);
    return out;
}

function textToPdf(text, { width = 92, linesPerPage = 50 } = {}) {
    const lines = String(text).split(/\r?\n/).flatMap((l) => wrapLine(l, width));
    const pages = [];
    for (let i = 0; i < lines.length; i += linesPerPage) pages.push(lines.slice(i, i + linesPerPage));
    if (!pages.length) pages.push(['']);

    const objects = []; // index = object number - 1
    const add = (body) => { objects.push(body); return objects.length; };

    const catalog = add(null); // 1
    const pagesObj = add(null); // 2
    const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); // 3
    const pageIds = [];
    for (const pageLines of pages) {
        const stream = ['BT', '/F1 11 Tf', '14 TL', '56 790 Td', ...pageLines.map((l) => `(${escapePdf(l)}) Tj T*`), 'ET'].join('\n');
        const content = add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`);
        const page = add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R >>`);
        pageIds.push(page);
    }
    objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
    objects[pagesObj - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let out = '%PDF-1.4\n';
    const offsets = [];
    objects.forEach((body, i) => {
        offsets.push(Buffer.byteLength(out, 'latin1'));
        out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, 'latin1');
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, 'latin1');
}

module.exports = { textToPdf };
