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
  }
};

const Login = () => {
  const [lang, setLang]          = useState(localStorage.getItem('preferredLanguage') || 'en');
  const [values, setValues]      = useState({ email: '', password: '' });
  const [touched, setTouched]    = useState({});
  const [globalError, setGlobal] = useState({ msg: '', status: null });
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
    owner:          '/owner/dashboard',
    admin:          '/admin/dashboard',
    office_manager: '/office/overview',
    farmer:         '/dashboard',
    labor:          '/labour/dashboard',
  };

  // Status-specific messages shown below the error
  const STATUS_MESSAGES = {
    en: {
      pending:     '⏳ Your account is under review. You will receive an email once approved.',
      rejected:    '❌ Your registration was not approved. Please contact the administrator.',
      suspended:   '🚫 Your account has been suspended. Contact the administrator for help.',
      deactivated: '⚠️ Your account has been deactivated.',
    },
    am: {
      pending:     '⏳ መለያዎ ሲፀድቅ ይጠብቁ። ኢሜይል ይደርስዎታል።',
      rejected:    '❌ ምዝገባዎ ተቀባይነት አላገኘም። አስተዳዳሪውን ያነጋግሩ።',
      suspended:   '🚫 መለያዎ ታግዷል። አስተዳዳሪውን ያነጋግሩ።',
      deactivated: '⚠️ መለያዎ ተሰርዟል።',
    },
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!formValid) return;
    setSub(true);
    setGlobal({ msg: '', status: null });
    const res = await login(values.email.trim().toLowerCase(), values.password);
    setSub(false);
    if (res.success) {
      const home = ROLE_HOME[res.role] || '/dashboard';
      navigate(home);
    } else {
      // Show status-specific message if account is pending/rejected/suspended
      const statusMsg = res.accountStatus
        ? (STATUS_MESSAGES[lang]?.[res.accountStatus] || res.error)
        : res.error || t.loginFailed;
      setGlobal({ msg: statusMsg, status: res.accountStatus });
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
                onClick={() => { setLang(l); localStorage.setItem('preferredLanguage', l); if (l === 'am') { document.cookie = 'googtrans=/en/am; path=/'; document.cookie = 'googtrans=/en/am; path=/; domain=' + window.location.hostname; } else { document.cookie = 'googtrans=/en/en; path=/'; document.cookie = 'googtrans=/en/en; path=/; domain=' + window.location.hostname; } window.location.reload(); }}
                style={{ padding:'4px 10px', border:'none', cursor:'pointer', fontWeight:600, fontSize:'0.78rem',
                  background: lang === l ? 'var(--primary)' : 'var(--surface)',
                  color:      lang === l ? 'white' : 'var(--text-muted)' }}>
                {l === 'en' ? 'EN' : 'አማ'}
              </button>
            ))}
          </div>
        </div>

        {/* Global error / status message */}
        {globalError.msg && (
          <div style={{
            background: globalError.status === 'pending' ? '#fffbeb' :
                        globalError.status === 'rejected' ? '#fee2e2' :
                        globalError.status === 'suspended' ? '#fff1f2' : '#fee2e2',
            border: `1px solid ${
              globalError.status === 'pending'   ? '#fcd34d' :
              globalError.status === 'rejected'  ? '#fca5a5' :
              globalError.status === 'suspended' ? '#fda4af' : '#fca5a5'
            }`,
            borderRadius: 8, padding: '11px 14px', marginBottom: '1rem',
            color: globalError.status === 'pending' ? '#92400e' : '#b91c1c',
            fontSize: '0.875rem', fontWeight: 500,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <span>{globalError.msg}</span>
            {globalError.status === 'pending' && (
              <Link to="/register" style={{ fontSize: '0.8rem', color: '#92400e', fontWeight: 700 }}>
                → Check registration status or register again
              </Link>
            )}
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


