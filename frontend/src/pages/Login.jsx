import React, { useState, useContext, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import FormField from '../components/FormField';
import { validators } from '../utils/validation';

const T = {
  en: {
    title: 'Welcome Back',
    subtitle: 'Sign in to SmartIrrigate OS',
    emailLabel: 'Email Address',
    passwordLabel: 'Password',
    loginButton: 'Sign In',
    loggingIn: 'Signing in...',
    forgotPassword: 'Forgot password?',
    noAccount: "Don't have an account?",
    registerHere: 'Create one',
    emailRequired: 'Email address is required',
    invalidEmail: 'Enter a valid email address',
    passwordRequired: 'Password is required',
    loginFailed: 'Invalid email or password. Please try again.',
    orDivider: 'or',
    magicLinkBtn: 'Sign in with Magic Link (no password)',
  },
  am: {
    title: 'እንኳን ደህና መጡ',
    subtitle: 'SmartIrrigate OS ይግቡ',
    emailLabel: 'ኢሜይል አድራሻ',
    passwordLabel: 'የይለፍ ቃል',
    loginButton: 'ይግቡ',
    loggingIn: 'በመግባት ላይ...',
    forgotPassword: 'የይለፍ ቃል ረሳህው?',
    noAccount: 'መለያ የለህም?',
    registerHere: 'ይፍጠሩ',
    emailRequired: 'ኢሜይል አድራሻ ያስፈልጋል',
    invalidEmail: 'ትክክለኛ ኢሜይል አድራሻ ያስፈልጋል',
    passwordRequired: 'የይለፍ ቃል ያስፈልጋል',
    loginFailed: 'ትክክል ያልሆነ ኢሜይል ወይም የይለፍ ቃል። እንደገና ይሞክሩ።',
    orDivider: 'ወይም',
    magicLinkBtn: 'በማጂክ ሊንክ ይግቡ (የይለፍ ቃል አያስፈልግም)',
  }
};

const Login = () => {
  const [lang, setLang]          = useState(localStorage.getItem('preferredLanguage') || 'en');
  const [values, setValues]      = useState({ email: '', password: '' });
  const [touched, setTouched]    = useState({});
  const [globalError, setGlobal] = useState('');
  const [submitting, setSub]     = useState(false);

  const { login } = useContext(AuthContext);
  const navigate  = useNavigate();
  const [params]  = useSearchParams();
  const t = T[lang] || T.en;

  useEffect(() => {
    if (params.get('error') === 'magic_link_expired') {
      setGlobal('Your magic link has expired. Please request a new one.');
    }
  }, [params]);

  const errors = {
    email:    validators.email(values.email, t),
    password: values.password ? '' : t.passwordRequired,
  };
  const formValid = Object.values(errors).every(e => e === '');

  const handleChange = e => setValues(p => ({ ...p, [e.target.name]: e.target.value }));
  const handleBlur   = e => setTouched(p => ({ ...p, [e.target.name]: true }));

  // Role-aware redirect after login
  const ROLE_HOME = {
    super_administrator: '/dashboard',
    office_manager:      '/office/overview',
    farmer:              '/dashboard',
    labor:               '/labour/dashboard',
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!formValid) return;
    setSub(true);
    setGlobal('');
    const res = await login(values.email.trim().toLowerCase(), values.password);
    setSub(false);
    if (res.success) {
      // Use the returned user role to navigate to the right home page
      const home = ROLE_HOME[res.role] || '/dashboard';
      navigate(home);
    } else {
      // Make rate-limit errors more friendly
      const msg = res.error || t.loginFailed;
      const isTooMany = msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('rate');
      setGlobal(isTooMany
        ? (lang === 'am'
            ? '⏳ ብዙ ሙከራዎች። እባክዎ ከ15 ደቂቃ በኋላ እንደገና ይሞክሩ።'
            : '⏳ Too many login attempts. Please wait 15 minutes and try again.')
        : msg);
    }
  };

  return (
    <div className="auth-container">
      <div className="glass-card auth-card" style={{ maxWidth: 430, width: '100%' }}>

        {/* Header + language toggle */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.5rem' }}>
          <div>
            <h2 style={{ margin:0, color:'var(--primary)', fontSize:'1.75rem', fontWeight:700 }}>{t.title}</h2>
            <p style={{ margin:'4px 0 0', color:'var(--text-muted)', fontSize:'0.85rem' }}>{t.subtitle}</p>
          </div>
          <div style={{ display:'flex', border:'1px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
            {['en','am'].map(l => (
              <button key={l}
                onClick={() => { setLang(l); localStorage.setItem('preferredLanguage', l); }}
                style={{ padding:'4px 10px', border:'none', cursor:'pointer', fontWeight:600, fontSize:'0.78rem',
                  background: lang === l ? 'var(--primary)' : 'var(--surface)',
                  color:      lang === l ? 'white' : 'var(--text-muted)' }}>
                {l === 'en' ? 'EN' : 'አማ'}
              </button>
            ))}
          </div>
        </div>

        {/* Magic Link button */}
        <Link to="/auth/magic-link" style={{
            width:'100%', display:'flex', alignItems:'center', justifyContent:'center',
            gap:10, padding:'12px 16px', borderRadius:10,
            border:'1.5px solid var(--border)', background:'var(--surface)',
            color:'var(--text-main)', fontSize:'0.92rem', fontWeight:600,
            textDecoration:'none', marginBottom:'16px',
            boxShadow:'0 1px 3px rgba(0,0,0,0.05)', transition:'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.boxShadow='0 2px 8px rgba(21,128,61,0.15)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)';  e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)'; }}>
          <span style={{ fontSize:'1.1rem' }}>✨</span>
          {t.magicLinkBtn}
        </Link>

        {/* Divider */}
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:'16px' }}>
          <div style={{ flex:1, height:1, background:'var(--border)' }}/>
          <span style={{ fontSize:'0.78rem', color:'var(--text-muted)', fontWeight:500 }}>{t.orDivider}</span>
          <div style={{ flex:1, height:1, background:'var(--border)' }}/>
        </div>

        {/* Global error */}
        {globalError && (
          <div style={{ background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:8,
            padding:'10px 14px', marginBottom:'1rem', color:'#b91c1c',
            fontSize:'0.875rem', fontWeight:500, display:'flex', gap:8, alignItems:'center' }}>
            <span>🔒</span> {globalError}
          </div>
        )}

        {/* Email / Password form */}
        <form onSubmit={handleSubmit} noValidate>
          <FormField label={t.emailLabel} name="email" type="email" value={values.email}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.email} touched={touched.email}
            placeholder="you@example.com" required autoFocus />

          <FormField label={t.passwordLabel} name="password" type="password" value={values.password}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.password} touched={touched.password}
            placeholder="••••••••" required />

          <div style={{ textAlign:'right', marginTop:'-10px', marginBottom:'16px' }}>
            <Link to="/forgot-password" style={{ fontSize:'0.82rem', color:'var(--primary)', fontWeight:500 }}>
              {t.forgotPassword}
            </Link>
          </div>

          <button type="submit" className="btn btn-primary"
            style={{ width:'100%', padding:'12px', fontSize:'1rem', opacity: submitting ? 0.7 : 1 }}
            disabled={submitting}>
            {submitting ? t.loggingIn : t.loginButton}
          </button>
        </form>

        <p className="text-center mt-4" style={{ color:'var(--text-muted)', fontSize:'0.875rem' }}>
          {t.noAccount} <Link to="/register" style={{ fontWeight:600 }}>{t.registerHere}</Link>
        </p>

      </div>
    </div>
  );
};

export default Login;
