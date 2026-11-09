import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { getMeta, setMeta } from '@/lib/db';

export type StoredBillingConfig = {
  stripeCardEnabled: boolean;
  stripePixEnabled: boolean;
  encryptedStripeKey?: string;
  encryptedWebhookSecret?: string;
  modifiedAt?: string;
};

export type BillingPublicConfig = {
  stripeCardEnabled: boolean;
  stripePixEnabled: boolean;
  keyConfigured: boolean;
  webhookConfigured: boolean;
  testMode: boolean;
  liveAllowed: boolean;
};

const CONFIG_KEY = 'platform_billing_config_v1';
const DEFAULT: StoredBillingConfig = { stripeCardEnabled: false, stripePixEnabled: false };

function encryptionKey(): Buffer {
  const material = process.env.BILLING_ENCRYPTION_KEY || (process.env.NODE_ENV !== 'production' ? process.env.SESSION_SECRET : '');
  if (!material || material.length < 32) throw new Error('Configure BILLING_ENCRYPTION_KEY com pelo menos 32 caracteres.');
  return scryptSync(material, 'vigiaelus-billing-v1', 32);
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('hex'), cipher.getAuthTag().toString('hex'), data.toString('hex')].join('.');
}

function decrypt(value: string): string {
  const chunks = value.split('.');
  if (chunks.length !== 4 || chunks[0] !== 'v1') throw new Error('Formato de segredo não reconhecido.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(chunks[1], 'hex'));
  decipher.setAuthTag(Buffer.from(chunks[2], 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(chunks[3], 'hex')), decipher.final()]).toString('utf8');
}

export async function readBillingConfig(): Promise<StoredBillingConfig> {
  return (await getMeta<StoredBillingConfig>(CONFIG_KEY)) ?? { ...DEFAULT };
}

export async function billingPrivateConfig() {
  const stored = await readBillingConfig();
  const stripeKey = stored.encryptedStripeKey ? decrypt(stored.encryptedStripeKey) : (process.env.STRIPE_SECRET_KEY ?? '');
  const webhookSecret = stored.encryptedWebhookSecret ? decrypt(stored.encryptedWebhookSecret) : (process.env.STRIPE_WEBHOOK_SECRET ?? '');
  const liveAllowed = process.env.BILLING_LIVE_ENABLED === '1';
  // Nunca aceitar uma chave real sem liberação operacional explícita.
  if (stripeKey.startsWith('sk_live_') && !liveAllowed) {
    return { cardEnabled: false, pixEnabled: false, stripeKey: '', webhookSecret, liveAllowed, testMode: false };
  }
  const keyValid = stripeKey.startsWith('sk_test_') || stripeKey.startsWith('sk_live_');
  return {
    cardEnabled: Boolean(stored.stripeCardEnabled && keyValid && webhookSecret.startsWith('whsec_')),
    pixEnabled: Boolean(stored.stripePixEnabled && keyValid && webhookSecret.startsWith('whsec_')),
    stripeKey: keyValid ? stripeKey : '',
    webhookSecret,
    liveAllowed,
    testMode: !stripeKey.startsWith('sk_live_'),
  };
}

export async function publicBillingConfig(): Promise<BillingPublicConfig> {
  const priv = await billingPrivateConfig();
  return {
    stripeCardEnabled: priv.cardEnabled,
    stripePixEnabled: priv.pixEnabled,
    keyConfigured: Boolean(priv.stripeKey),
    webhookConfigured: priv.webhookSecret.startsWith('whsec_'),
    testMode: priv.testMode,
    liveAllowed: priv.liveAllowed,
  };
}

export async function saveBillingConfig(input: {
  cardEnabled: boolean; pixEnabled: boolean; stripeKey: string; webhookSecret: string;
  removeStripeKey?: boolean; removeWebhookSecret?: boolean;
}): Promise<void> {
  const prev = await readBillingConfig();
  const stripeKey = input.stripeKey.trim();
  const webhookSecret = input.webhookSecret.trim();
  if (stripeKey && !/^sk_(test|live)_[A-Za-z0-9]{12,}$/.test(stripeKey))
    throw new Error('Chave Stripe inválida; utilize uma chave secreta sk_test_ ou sk_live_.');
  if (webhookSecret && !/^whsec_[A-Za-z0-9]{12,}$/.test(webhookSecret))
    throw new Error('Assinatura do webhook inválida.');
  if (stripeKey.startsWith('sk_live_') && process.env.BILLING_LIVE_ENABLED !== '1')
    throw new Error('Cobrança real bloqueada. Configure BILLING_LIVE_ENABLED=1 apenas após homologação.');
  const saved: StoredBillingConfig = {
    stripeCardEnabled: input.cardEnabled,
    stripePixEnabled: input.pixEnabled,
    encryptedStripeKey: input.removeStripeKey ? undefined : stripeKey ? encrypt(stripeKey) : prev.encryptedStripeKey,
    encryptedWebhookSecret: input.removeWebhookSecret ? undefined : webhookSecret ? encrypt(webhookSecret) : prev.encryptedWebhookSecret,
    modifiedAt: new Date().toISOString(),
  };
  // Fail closed se habilitar sem configurar ambos. Também valida se
  // a chave anteriormente armazenada continua decifrável.
  if (saved.stripeCardEnabled || saved.stripePixEnabled) {
    if (!saved.encryptedStripeKey && !process.env.STRIPE_SECRET_KEY)
      throw new Error('Informe a chave secreta Stripe antes de habilitar recebimentos.');
    if (!saved.encryptedWebhookSecret && !process.env.STRIPE_WEBHOOK_SECRET)
      throw new Error('Informe o segredo do webhook para confirmar pagamentos com segurança.');
  }
  if (saved.encryptedStripeKey) decrypt(saved.encryptedStripeKey);
  if (saved.encryptedWebhookSecret) decrypt(saved.encryptedWebhookSecret);
  await setMeta(CONFIG_KEY, saved);
}
