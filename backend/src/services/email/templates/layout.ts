const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

type LayoutParams = {
  title: string;
  heading: string;
  greeting: string;
  // Already HTML: templates build it and escape every value they interpolate.
  content: string;
};

// Table-based markup with inline styles, since many e-mail clients ignore
// <style> blocks and flex/grid layouts.
export function layout({
  title,
  heading,
  greeting,
  content,
}: LayoutParams): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
<tr>
<td align="center" style="padding:24px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background-color:#ffffff;border-radius:8px;font-family:Arial,Helvetica,sans-serif;color:#18181b;">
<tr>
<td style="padding:32px;">
<h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(heading)}</h1>
<p style="margin:0 0 16px;font-size:16px;line-height:1.5;">${escapeHtml(greeting)}</p>
${content}
</td>
</tr>
</table>
<p style="margin:16px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#71717a;">Helpa — UFAL</p>
</td>
</tr>
</table>
</body>
</html>`;
}

export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
<tr>
<td style="border-radius:6px;background-color:#2563eb;">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;font-size:16px;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
</td>
</tr>
</table>`;
}

export function codeBox(code: string): string {
  return `<p style="margin:24px 0;padding:16px;background-color:#f4f4f5;border-radius:6px;font-family:'Courier New',Courier,monospace;font-size:28px;letter-spacing:6px;text-align:center;">${escapeHtml(code)}</p>`;
}
