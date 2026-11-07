'use client';
import { useState } from 'react';
import { Eye, EyeOff, Loader2, LockKeyhole, Mail, Radar } from 'lucide-react';
import { tFor, type Locale } from '@/lib/i18n-dict';

export function LoginForm({ locale }: { locale: Locale }) {
  const t = tFor(locale);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        const destination = data.redirectTo === '/cliente' ? '/cliente' : '/';
        window.location.replace(data.mustChangePassword ? '/impostazioni/account?first=1' : destination);
        return;
      }
      setError(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="va-form">
    <div className="va-form-logo"><Radar size={27}/> <span>VigiaElus</span></div>
    <span className="va-form-kicker">ÁREA SEGURA</span>
    <h1>Acesse sua inteligência.</h1>
    <p className="va-form-description">Entre para acompanhar seu monitoramento e as informações autorizadas para sua conta.</p>
    <label htmlFor="vigia-login-email"><span>E-mail</span><div className="va-field">
      <Mail size={18}/><input id="vigia-login-email" name="email" type="email" required value={email}
        onChange={e=>setEmail(e.target.value)} placeholder={t('login.email','seu@email.com')}
        autoComplete="username" autoFocus aria-label={t("login.email","E-mail profissional")}/></div></label>
    <label htmlFor="vigia-login-password"><span>Senha</span><div className="va-field">
      <LockKeyhole size={18}/><input id="vigia-login-password" name="password" type={visible?'text':'password'}
        required value={password} onChange={e=>setPassword(e.target.value)}
        placeholder="Sua senha" autoComplete="current-password" aria-label={t("login.password","Senha")}/>
      <button type="button" aria-label={visible?'Ocultar senha':'Mostrar senha'} onClick={()=>setVisible(v=>!v)}>
        {visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
    {error && <p role="alert" className="va-form-error">E-mail ou senha inválidos. Verifique os dados e tente novamente.</p>}
    <button type="submit" className="va-submit" disabled={busy || !email || !password}>
      {busy?<Loader2 size={17} className="animate-spin"/>:null}
      {busy?'Autenticando...':'Entrar no VigiaElus'} <span aria-hidden="true">→</span>
    </button>
    <p className="va-form-footer">Acesso protegido · Cada cliente visualiza apenas projetos autorizados</p>
  </form>;
}
