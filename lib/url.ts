// Joins a path onto an app base URL such as CLIENT_BASE_URL, ignoring any
// trailing slashes on the base so we never emit `https://host//path`.
export const appUrl = (baseUrl: string, path = ''): string =>
  `${baseUrl.replace(/\/+$/, '')}${path}`
