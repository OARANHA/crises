'use client';

import { useActionState } from 'react';
import { Lock, RotateCcw, Save } from 'lucide-react';
import { updateApiBudget, resetApiSpend, type ActionResult } from '@/app/settings/actions';

const INIT: ActionResult = { ok: false, msg: '' };

export function CostControl({ budget, lifetimeCost, lifetimeCalls, resetAt }: {
  budget: number; lifetimeCost: number; lifetimeCalls: number; resetAt: string;
}) {
  const [budgetState, budgetAction, budgetPending] = useActionState(updateApiBudget, INIT);
  const [resetState, resetAction, resetPending] = useActionState(resetApiSpend, INIT);
  return (
    <div className="settings-cost-control">
      <div>
        <h3 className="settings-minor-heading">Teto de gasto estimado (USD)</h3>
        <form action={budgetAction} className="settings-inline-form">
          <label className="settings-compact-label">
            <span>Valor do limite</span>
            <input name="budget" type="number" step="0.5" min="0.5" defaultValue={budget} required />
          </label>
          <button type="submit" disabled={budgetPending} className="settings-secondary-action">
            <Save size={15} /> {budgetPending ? 'Salvando…' : 'Salvar limite'}
          </button>
        </form>
        {budgetState.msg && (
          <p role="status" className={'settings-feedback ' + (budgetState.ok ? 'is-ok' : 'is-error')}>
            {budgetState.msg}
          </p>
        )}
        <p className="settings-footnote">
          O teto considera o consumo estimado registrado pelo VigiaElus, não representa a fatura do provedor.
        </p>
      </div>

      <div>
        <h3 className="settings-minor-heading">Reiniciar contagem do período</h3>
        <form action={resetAction} className="settings-inline-form">
          <label className="settings-compact-label">
            <span>Senha da conta administrativa</span>
            <span className="settings-password-input">
              <Lock size={15} aria-hidden="true" />
              <input name="password" type="password" placeholder="Confirme sua senha" required />
            </span>
          </label>
          <button type="submit" disabled={resetPending} className="settings-secondary-action">
            <RotateCcw size={15} /> {resetPending ? 'Reiniciando…' : 'Reiniciar contador'}
          </button>
        </form>
        {resetState.msg && (
          <p role="status" className={'settings-feedback ' + (resetState.ok ? 'is-ok' : 'is-error')}>
            {resetState.msg}
          </p>
        )}
        <p className="settings-footnote">
          Reiniciar não exclui o histórico.
          Último reinício: {new Date(resetAt).toLocaleString('pt-BR')}.
        </p>
      </div>

      <div className="settings-total">
        <span>Consumo histórico estimado</span>
        <strong>{lifetimeCost.toLocaleString('pt-BR', { style:'currency', currency:'USD' })}</strong>
        <small>{lifetimeCalls.toLocaleString('pt-BR')} chamadas de IA registradas, independentemente do período.</small>
      </div>
    </div>
  );
}
