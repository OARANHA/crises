import { getLocale } from '@/lib/i18n';
import { LoginForm } from '@/components/login-form';
import { Activity, ShieldCheck, Radio, Sparkles } from 'lucide-react';

export const metadata = { title: 'Entrar | VigiaElus' };

export default async function LoginPage() {
  const locale = await getLocale();
  return <div className="va-auth" role="main">
    <section className="va-story" aria-label="Apresentação VigiaElus">
      <div className="va-story-ambient va-orbit-one" aria-hidden="true"/>
      <div className="va-story-ambient va-orbit-two" aria-hidden="true"/>
      <div className="va-story-top"><span className="va-story-mark"><Radio size={20}/></span>
        <strong>VigiaElus</strong><span className="va-story-tag">INTELIGÊNCIA DE REPUTAÇÃO</span></div>
      <div className="va-story-content">
        <span className="va-eyebrow"><Sparkles size={15}/> INTELIGÊNCIA QUE ANTECIPA</span>
        <h2>O que importa para sua reputação, <em>sob seus olhos.</em></h2>
        <p>Transforme notícias, menções e sinais digitais em uma visão organizada para decisões melhores.</p>
        <div className="va-story-features">
          <span><Radio size={18}/> Monitoramento de fontes</span>
          <span><Activity size={18}/> Indicadores contextualizados</span>
          <span><ShieldCheck size={18}/> Acesso por projeto</span>
        </div>
      </div>
      <div className="va-story-bottom"><span className="va-live-dot"/> VigiaElus · Informação com contexto</div>
    </section>
    <section className="va-login-side" aria-label="Autenticação">
      <LoginForm locale={locale}/>
      <div className="va-login-bottom">© {new Date().getFullYear()} VigiaElus · Ambiente de acesso restrito</div>
    </section>
  </div>;
}
