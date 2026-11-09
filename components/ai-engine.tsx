'use client';

import { useActionState } from 'react';
import { Check, Cpu, Save, ShieldCheck } from 'lucide-react';
import { updateAiProvider, updateAiModels, updateAiCustomRates, type ActionResult } from '@/app/settings/actions';
import { ConnectorKeys, type KeyField } from './connector-keys';

const INIT: ActionResult = { ok: false, msg: '' };

export type EngineOption = {
  id: string;
  label: string;
  configured: boolean;
  fields: KeyField[];
  models: { fast: string; smart: string };
  defaults: { fast: string; smart: string };
};

export function AiEngine({ options, active, customRates }: {
  options: EngineOption[];
  active: string;
  customRates: { input: number; output: number } | null;
}) {
  const [providerState, providerAction, providerPending] = useActionState(updateAiProvider, INIT);
  const [modelState, modelAction, modelPending] = useActionState(updateAiModels, INIT);
  const [rateState, rateAction, ratePending] = useActionState(updateAiCustomRates, INIT);
  const current = options.find((option) => option.id === active) ?? options[0];
  if (!current) return null;

  return (
    <section className="panel settings-panel px-6 py-6">
      <div className="settings-section-heading">
        <Cpu size={19} aria-hidden="true" />
        <h2>Motor de inteligência artificial</h2>
      </div>
      <p className="settings-explain mt-2 mb-5">
        Escolha o serviço que processará análises e resumos. As credenciais são privadas e gerenciadas pelo proprietário.
      </p>

      <form action={providerAction} className="grid gap-3 sm:grid-cols-2" aria-label="Escolher provedor de IA">
        {options.map((option) => (
          <button key={option.id} type="submit" name="provider" value={option.id}
            disabled={providerPending} aria-pressed={option.id === active}
            className={'settings-provider-option ' + (option.id === active ? 'is-selected' : '')}>
            <span className="settings-provider-name">
              <strong>{option.label}</strong>
              {option.id === active && <Check size={16} aria-hidden="true" />}
            </span>
            <span className="settings-provider-state">
              {option.configured ? 'Credenciais configuradas' : 'Configuração pendente'}
            </span>
          </button>
        ))}
      </form>
      {providerState.msg && (
        <p className={'settings-feedback ' + (providerState.ok ? 'is-ok' : 'is-error')} role="status">
          {providerState.msg}
        </p>
      )}

      <div className="settings-group">
        <h3>Conexão com {current.label}</h3>
        <ConnectorKeys connectorId={current.id} fields={current.fields} />
        {!current.configured && (
          <p className="settings-warning">
            Para usar este provedor, configure {current.id === 'custom' ? 'a chave de API e a URL HTTPS' : 'a chave de API'}.
            A coleta de fontes pode continuar sem IA.
          </p>
        )}
      </div>

      <div className="settings-group">
        <h3>Modelos utilizados</h3>
        <p className="settings-explain mb-3">
          Informe os identificadores exatos fornecidos pelo serviço. O modelo rápido processa volumes;
          o analítico produz resumos e interpretações.
        </p>
        <form action={modelAction} className="settings-model-form">
          <input type="hidden" name="provider" value={current.id} />
          <label>
            <span>Modelo rápido</span>
            <input name="fast" key={current.id + '-fast'} defaultValue={current.models.fast}
              placeholder={current.defaults.fast || 'ID do modelo rápido'} maxLength={160} />
          </label>
          <label>
            <span>Modelo analítico</span>
            <input name="smart" key={current.id + '-smart'} defaultValue={current.models.smart}
              placeholder={current.defaults.smart || 'ID do modelo analítico'} maxLength={160} />
          </label>
          <button type="submit" disabled={modelPending} className="settings-secondary-action">
            <Save size={15} /> {modelPending ? 'Salvando…' : 'Salvar modelos'}
          </button>
        </form>
        {modelState.msg && (
          <p role="status" className={'settings-feedback ' + (modelState.ok ? 'is-ok' : 'is-error')}>
            {modelState.msg}
          </p>
        )}
      </div>

      {current.id === 'custom' && (
        <div className="settings-group settings-custom-pricing">
          <div className="settings-section-heading">
            <ShieldCheck size={17} aria-hidden="true" />
            <h3>Custos estimados do provedor personalizado</h3>
          </div>
          <p className="settings-explain mb-3">
            Para não registrar custo zero fictício, informe as tarifas em dólares por 1 milhão de tokens.
            Sem elas, o VigiaElus não executa chamadas de IA deste provedor.
          </p>
          <form action={rateAction} className="settings-model-form">
            <label>
              <span>Entrada · USD / 1 milhão</span>
              <input type="number" name="input" min="0.000001" step="any" required
                defaultValue={customRates?.input || ''} placeholder="Ex.: 0.20" />
            </label>
            <label>
              <span>Saída · USD / 1 milhão</span>
              <input type="number" name="output" min="0.000001" step="any" required
                defaultValue={customRates?.output || ''} placeholder="Ex.: 0.80" />
            </label>
            <button type="submit" disabled={ratePending} className="settings-secondary-action">
              <Save size={15} /> {ratePending ? 'Salvando…' : 'Salvar tarifas'}
            </button>
          </form>
          {rateState.msg && (
            <p role="status" className={'settings-feedback ' + (rateState.ok ? 'is-ok' : 'is-error')}>
              {rateState.msg}
            </p>
          )}
          <p className="settings-footnote">
            O cálculo é uma estimativa baseada nas tarifas informadas; não substitui a cobrança
            e os limites definidos pelo fornecedor.
          </p>
        </div>
      )}
    </section>
  );
}
