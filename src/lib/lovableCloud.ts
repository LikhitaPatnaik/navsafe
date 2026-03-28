const FALLBACK_BACKEND_URL = 'https://dkkgnyakaygahndoipte.supabase.co';

export const getBackendBaseUrl = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL?.trim();

  if (envUrl) {
    return envUrl;
  }

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID?.trim();

  if (projectId) {
    return `https://${projectId}.supabase.co`;
  }

  return FALLBACK_BACKEND_URL;
};

export const getFunctionUrl = (path: string) => {
  const normalizedPath = path.replace(/^\/+/, '');
  return `${getBackendBaseUrl()}/functions/v1/${normalizedPath}`;
};