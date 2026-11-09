'use client';

import { useState } from 'react';
import { KeyRound, Check, X } from 'lucide-react';
import { SubmitButton } from './submit-button';
import { saveConnectorKeysAction } from '@/app/settings/actions';

export type KeyField = {
  env: string; label: string; hint?: string; secret: boolean;
  set: boolean; display?: string; fromEnv: boolean;
};

/**
 * Tasto + form per inserire le chiavi API di un connettore premium.
 * I segreti non vengono mai precompilati (solo mascherati come placeholder):
 * lasciarli vuoti al salvataggio li mantiene invariati.
 */
export function ConnectorKeys({ connectorId, fields }: {
  connectorId: string; fields: KeyField[];
}) {
  const [open, setOpen] = useState(false);
  const configured = fields.every((f) => f.set);
  const action = saveConnectorKeysAction.bind(null, connectorId);

  return (
    <div className="vigia-credentials mt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 rounded-md border px-3 py-2 text-xs font-medium transition ${
          configured
            ? 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10'
            : 'border-[var(--border)] text-[var(--muted)] hover:bg-[var(--panel-2)] hover:text-[var(--foreground)]'
        }`}
      >
        {configured ? <Check className="size-3" /> : <KeyRound className="size-3" />}
        {configured ? 'Chaves configuradas · editar' : 'Configurar chaves'}
      </button>

      {open && (
        <form
          action={action}
          onSubmit={() => setTimeout(() => setOpen(false), 50)}
          className="mt-2 flex flex-col gap-2 rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3"
        >
          {fields.map((f) => (
            <label key={f.env} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">
                {f.label}
                {f.hint && <span className="ml-1 font-normal text-[var(--muted)]">· {f.hint}</span>}
                {f.set && f.fromEnv && (
                  <span className="ml-1 font-normal text-amber-500/80">· attiva da variabile d’ambiente</span>
                )}
              </span>
              <input
                name={f.env}
                type={f.secret ? 'password' : 'text'}
                autoComplete="off"
                spellCheck={false}
                defaultValue={f.secret ? '' : (f.display ?? '')}
                placeholder={f.secret ? (f.set ? `${f.display ?? 'set'} · deixe vazio para manter` : 'Informe o valor') : 'Informe o valor'}
                className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-2.5 py-1.5 text-xs outline-none placeholder:text-[var(--muted)] focus:border-sky-500/50"
              />
            </label>
          ))}
          <div className="flex items-center gap-2 pt-1">
            <SubmitButton
              pendingLabel="Salvando…"
              className="rounded-md bg-sky-500 px-3 py-1 text-xs font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              Salvar chaves
            </SubmitButton>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              <X className="size-3" /> Cancelar
            </button>
          </div>
          <p className="text-[10px] leading-relaxed text-[var(--muted)]">
            As chaves são armazenadas criptografadas e utilizadas pelo ambiente. O valor completo não é exibido.
          </p>
        </form>
      )}
    </div>
  );
}
