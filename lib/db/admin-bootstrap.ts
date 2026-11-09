/**
 * Primeiro administrador: somente o banco vazio dispara este bootstrap.
 * Em produção nenhuma credencial conhecida pode ser provisionada.
 * Instalações locais preservam o fluxo histórico com troca obrigatória.
 */
export type AdminBootstrapEnv = Pick<NodeJS.ProcessEnv,
  'NODE_ENV' | 'ADMIN_EMAIL' | 'ADMIN_PASSWORD' | 'ADMIN_NAME'>;

export function initialAdminCredentials(env: AdminBootstrapEnv = process.env) {
  const configuredPassword = env.ADMIN_PASSWORD?.trim() || '';
  if (env.NODE_ENV === 'production' && configuredPassword.length < 12) {
    throw new Error(
      'ADMIN_PASSWORD is required (minimum 12 characters) to initialize the first production admin',
    );
  }
  const password = configuredPassword || 'changeme';
  return {
    name: env.ADMIN_NAME?.trim() || 'Admin',
    email: (env.ADMIN_EMAIL?.trim() || 'admin@example.com').toLowerCase(),
    password,
    mustChange: configuredPassword ? 0 : 1,
  };
}
