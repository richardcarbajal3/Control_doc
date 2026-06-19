/**
 * Builds a SharePoint OneDrive URL that navigates directly to a subfolder.
 *
 * SharePoint requires the format:
 *   https://[host]/personal/[user]/_layouts/15/onedrive.aspx?id=/personal/[user]/Documents/...
 *
 * @param {string} baseUrl  - stored base URL, e.g.
 *   "https://tenant-my.sharepoint.com/personal/user/Documents/Control doc"
 * @param {...string} parts - additional path segments (contract code, transmittal, etc.)
 * @returns {string} fully-formed SharePoint folder URL
 */
export function buildOnedriveUrl(baseUrl, ...parts) {
  if (!baseUrl) return '#';
  try {
    const url = new URL(baseUrl);
    const host = url.origin;
    // basePath: /personal/user/Documents/Control doc
    const basePath = url.pathname.replace(/\/$/, '');
    const segments = basePath.split('/').filter(Boolean);
    // personalPath: /personal/user
    const personalPath = '/' + segments.slice(0, 2).join('/');
    const folderPath = basePath + (parts.length ? '/' + parts.map((p) => encodeURIComponent(p)).join('/') : '');
    return `${host}${personalPath}/_layouts/15/onedrive.aspx?id=${encodeURIComponent(folderPath)}`;
  } catch {
    return baseUrl;
  }
}
