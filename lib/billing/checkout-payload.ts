import type { BillingCadence, PaymentMethod } from './logic';
export type StripeCheckoutRequest = {
  paymentId: number; userId: number; email: string; planName: string;
  amountCents: number; cadence: BillingCadence; method: PaymentMethod; baseUrl: string;
};
export function checkoutParams(input: StripeCheckoutRequest): URLSearchParams {
  if (!Number.isSafeInteger(input.paymentId) || input.paymentId < 1 ||
      !Number.isSafeInteger(input.amountCents) || input.amountCents < 100)
    throw new Error('Dados de cobrança inválidos.');
  const fields: Record<string, string> = {
    mode: input.method === 'card' ? 'subscription' : 'payment',
    'payment_method_types[0]': input.method === 'card' ? 'card' : 'pix',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'brl',
    'line_items[0][price_data][unit_amount]': String(input.amountCents),
    'line_items[0][price_data][product_data][name]': 'VigiaElus — ' + input.planName,
    'metadata[vigia_payment_id]': String(input.paymentId),
    'metadata[vigia_user_id]': String(input.userId),
    client_reference_id: String(input.userId),
    customer_email: input.email,
    success_url: input.baseUrl + '/cliente/assinatura?resultado=retorno',
    cancel_url: input.baseUrl + '/cliente/assinatura?resultado=cancelado',
  };
  if (input.method === 'card') {
    fields['line_items[0][price_data][recurring][interval]'] = input.cadence;
    fields['subscription_data[metadata][vigia_payment_id]'] = String(input.paymentId);
  } else {
    fields['payment_intent_data[metadata][vigia_payment_id]'] = String(input.paymentId);
  }
  return new URLSearchParams(fields);
}
