// Category-related API calls. CRUD currently lives inline in pages/Categories.jsx;
// this module holds the CSV export, which needs blob/download handling.
import { API_BASE, apiFetch } from './http.js';

function filenameFromDisposition(res, fallback) {
  const cd = res.headers.get('Content-Disposition') || '';
  const match = /filename="?([^"]+)"?/i.exec(cd);
  return match ? match[1] : fallback;
}

/**
 * Fetches a category's transactions as CSV and triggers a browser download.
 * `start`/`end` are optional inclusive YYYY-MM-DD bounds — omit both to export
 * every transaction in the category. Returns the downloaded filename.
 */
export async function downloadCategoryCsv(categoryId, { start, end } = {}) {
  const params = new URLSearchParams();
  if (start) params.append('start', start);
  if (end) params.append('end', end);
  const qs = params.toString();

  const res = await apiFetch(`${API_BASE}/categories/${categoryId}/export${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    let message = 'Export failed';
    try {
      const data = await res.json();
      message = data.message || data.error || message;
    } catch {
      /* non-JSON error body — keep default message */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const filename = filenameFromDisposition(res, `category-${categoryId}.csv`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return filename;
}
