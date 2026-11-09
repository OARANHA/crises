# VigiaElus — Administração comercial do proprietário

**Em desenvolvimento, sem autorização de merge nem deploy.**

## Onde acessar
- Proprietário: /plataforma (apenas conta admin cujo e-mail coincide com PLATFORM_OWNER_EMAIL ou ADMIN_EMAIL).
- Cliente: /cliente/assinatura (menu Meu plano).
- Webhook Stripe: POST /api/billing/webhook/stripe (público apenas para permitir assinatura Stripe; HMAC obrigatório).
- Orçamento operacional de IA: /impostazioni/budget. Não se confunde com receitas.

## Planos e limites
O catálogo usa BRL em centavos inteiros, preço mensal e anual, nome, descrição, identificação, máximo de projetos e fontes. O proprietário pode publicar ou ocultar planos e conceder acesso manual de forma individual.

O máximo de projetos é verificado na alteração de permissões e no acesso aos projetos do cliente com contrato. Clientes antigos sem contrato continuam como legados até uma migração consciente. O limite de fontes é referência comercial e AINDA NÃO tem bloqueio automatizado por cliente. Não prometer esta restrição como aplicada.

## Stripe Cartão
- Stripe Checkout em modo SUBSCRIPTION, preços calculados no servidor usando o plano do banco, assinatura mensal ou anual.
- O retorno à página de cliente não ativa o acesso. Só webhook com assinatura válida pode registrar pagamento e contrato.
- Confirmações, renovações, falhas, cancelamentos e estornos são tratados em eventos específicos.
- Clientes com assinatura recorrente existente usam o portal oficial Stripe; a aplicação não cria uma segunda assinatura em paralelo.

## Stripe Pix
- Stripe Checkout em modo PAYMENT, moeda BRL, pagamento único.
- O Pix não tem recorrência automática para contas Stripe brasileiras. Vigência por um mês/ano após confirmação; recompra pode estender o período.
- Disponibilidade do Pix depende da elegibilidade e da habilitação do método na conta Stripe.
- Referência oficial: https://support.stripe.com/questions/how-to-enable-pix-as-a-payment-method-in-brazil?locale=pt-BR

## Configuração do servidor
PLATFORM_OWNER_EMAIL=proprietario@exemplo.com
APP_BASE_URL=https://vigia.exemplo.com
BILLING_ENCRYPTION_KEY=SEGREDO_ALEATORIO_INDEPENDENTE_COM_32_OU_MAIS_CARACTERES
BILLING_LIVE_ENABLED=0

STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET são opcionais em ambiente do servidor; alternativamente insira ambos no painel do proprietário. Os campos secretos são criptografados com AES-256-GCM em meta; a chave BILLING_ENCRYPTION_KEY deve permanecer disponível, privada e respaldada. Em produção, a chave de criptografia específica é exigida. Segredos em produção nunca devem ser versionados.

Cobrança real (sk_live_) é bloqueada se BILLING_LIVE_ENABLED não for 1. Faça a ativação somente após homologação e autorização explícita.

## Webhook
Cadastre no Stripe a URL pública HTTPS terminada em /api/billing/webhook/stripe. Configure eventos:
- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed
- invoice.paid
- invoice.payment_failed
- customer.subscription.updated
- customer.subscription.deleted
- charge.refunded

Use o segredo whsec_ do mesmo ambiente da chave secreta Stripe (teste ou produção). Requisições sem assinatura, com corpo alterado, janela temporal superior a cinco minutos ou ambiente incompatível são recusadas.

## Arquitetura e segurança
- Tabelas incrementais: billing_plans, billing_subscriptions, billing_payments, billing_webhook_events.
- Pagamentos incluem snapshot de valor, plano e pessoa; nenhuma confirmação é aceita com preço ou usuário diferente do esperado.
- IDs de invoice e evento têm unicidade para evitar contabilização duplicada.
- Somente o proprietário pode criar planos, alterar credenciais e conceder acessos manualmente; cliente enxerga apenas seu contrato/pagamentos.
- Concessões manuais não somam ao indicador de recebimentos.
- As sessões de desenvolvimento ficam em D:\VIGIAELUS, em PGlite de QA; nada de produção foi alterado.

## Verificações e pendências de homologação
- Rodar TypeScript, ESLint e testes de faturamento.
- Testar navegação do proprietário, criação de plano, concessão e suspensão manual, cliente em desktop e celular.
- Confirmar também que contas cliente não acessam /plataforma.
- Testar Stripe Checkout em modo de teste com chaves reais de TESTE e Pix habilitado; não ativar produção sem provas reais de webhook, reembolso e cancelamento.
- Implantação comercial exige política de cancelamento, LGPD, regras fiscais brasileiras, reconciliação periódica no Stripe, observabilidade, e limites efetivos por fonte/tenant.
- Não realizar merge nem deploy sem autorização do proprietário.
