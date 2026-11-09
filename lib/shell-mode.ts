/** Decide qual estrutura visual deve envolver a página, sem misturar perfis. */
export type ShellMode = 'public' | 'client' | 'workspace';

export function resolveShellMode(role: string | null | undefined, demoMode: boolean): ShellMode {
  if (demoMode) return 'workspace';
  if (!role) return 'public';
  return role === 'client' ? 'client' : 'workspace';
}
