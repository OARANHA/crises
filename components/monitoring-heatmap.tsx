import { Activity, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

type DaySourceCount = { day: string; source: string; n: number };

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function MonitoringHeatmap({ rows }: { rows: DaySourceCount[] }) {
  const now = new Date();
  const days = Array.from({ length: 14 }, (_, index) =>
    dateKey(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (13 - index))))
  );
  const totals = new Map<string, number>();
  const cells = new Map<string, number>();
  for (const row of rows) {
    const quantity = Math.max(0, Number(row.n) || 0);
    totals.set(row.source, (totals.get(row.source) ?? 0) + quantity);
    cells.set(row.source + '|' + row.day, quantity);
  }
  const sources = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const max = Math.max(1, ...cells.values());

  return (
    <section className="vigia-card vigia-monitor-board min-w-0 p-5 sm:p-6" aria-labelledby="monitor-heatmap-title">
      <div className="vigia-card-header">
        <div className="flex items-start gap-3">
          <span className="vigia-metric-icon vigia-section-symbol" aria-hidden="true"><Activity className="size-[18px]" /></span>
          <div>
            <h2 id="monitor-heatmap-title" className="vigia-section-title">Rotina de monitoramento</h2>
            <p className="vigia-section-note mt-1">Publicações por fonte nos últimos 14 dias, sem estimativas.</p>
          </div>
        </div>
        <span className="vigia-status-badge">Últimos 14 dias</span>
      </div>
      {sources.length ? (
        <>
          <div className="vigia-monitor-scroll" role="region" aria-label="Atividade diária por fonte" tabIndex={0}>
            <div className="vigia-heatmap">
              <span className="vigia-heatmap-caption">Fontes</span>
              {days.map((day) => <span key={day} className="vigia-heatmap-day">{day.slice(-2)}</span>)}
              {sources.map(([source, total], rowIndex) => (
                <div key={source} className="vigia-heatmap-row">
                  <span className="vigia-heatmap-source" title={source}>
                    <span className="vigia-heatmap-bullet" data-tone={rowIndex} aria-hidden="true" />
                    <span className="truncate">{source}</span>
                    <small>{total.toLocaleString('pt-BR')}</small>
                  </span>
                  {days.map((day) => {
                    const count = cells.get(source + '|' + day) ?? 0;
                    return (
                      <span
                        key={day}
                        className={'vigia-heat-cell' + (count > 0 ? ' is-filled' : '')}
                        data-tone={rowIndex}
                        style={count > 0 ? { opacity: 0.42 + 0.58 * count / max } : undefined}
                        title={source + ': ' + count.toLocaleString('pt-BR') + ' publicações em ' + day.slice(8, 10) + '/' + day.slice(5, 7)}
                        aria-label={source + ', ' + day + ': ' + count + ' publicações'}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="vigia-monitor-footer">
            <span>Intensidade proporcional à quantidade de publicações.</span>
            <Link href="/listening" className="vigia-subtle-link">Explorar menções <ArrowUpRight className="size-3.5" /></Link>
          </div>
        </>
      ) : (
        <div className="vigia-heatmap-empty">
          <Activity className="size-6" aria-hidden="true" />
          <p className="font-semibold">Sem atividade registrada neste período</p>
          <p className="vigia-section-note">As fontes aparecerão aqui quando houver publicações coletadas.</p>
          <Link href="/vigia" className="vigia-subtle-link">Abrir monitoramento <ArrowUpRight className="size-3.5" /></Link>
        </div>
      )}
    </section>
  );
}
