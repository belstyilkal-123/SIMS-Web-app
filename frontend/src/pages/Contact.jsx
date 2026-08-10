import React, { useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import FormField from '../components/FormField';
import { validators } from '../utils/validation';

const T = {
  en: {
    title: 'Contact Support', subtitle: 'We usually respond within 24 hours',
    thankYouTitle: 'Message sent!', thankYouMessage: 'Our support team will get back to you shortly.',
    sendAnother: '← Send another message',
    nameLabel: 'Full Name', emailLabel: 'Email Address',
    subjectLabel: 'Subject', messageLabel: 'Message',
    sendButton: 'Send Message', sending: 'Sending...',
    emailInfo: 'support@agrismart.com', phoneInfo: '+251 911 123 456',
    nameRequired: 'Your name is required',
    nameTooShort: 'Name must be at least 2 characters',
    nameTooLong: 'Name is too long',
    nameInvalidChars: 'Name contains invalid characters',
    emailRequired: 'Email address is required',
    invalidEmail: 'Enter a valid email address',
    subjectRequired: 'Subject is required',
    subjectTooShort: 'Subject must be at least 3 characters',
    subjectTooLong: 'Subject must be under 100 characters',
    messageRequired: 'Message is required',
    messageTooShort: 'Message must be at least 10 characters',
    messageTooLong: 'Message must be under 1000 characters',
    charCount: 'characters',
  },
  am: {
    title: 'ድጋፍ ያግኙ', subtitle: 'ብዙውን ጊዜ በ24 ሰዓት ውስጥ ምላሽ እንሰጣለን',
    thankYouTitle: 'መልዕክት ተልኳል!', thankYouMessage: 'የድጋፍ ቡድናችን በቅርቡ ይገናኝዎታል።',
    sendAnother: '← ሌላ መልዕክት ላክ',
    nameLabel: 'ሙሉ ስም', emailLabel: 'ኢሜይል አድራሻ',
    subjectLabel: 'ርዕሰ ጉዳይ', messageLabel: 'መልዕክት',
    sendButton: 'መልዕክት ላክ', sending: 'በመላክ ላይ...',
    emailInfo: 'support@agrismart.com', phoneInfo: '+251 911 123 456',
    nameRequired: 'ስምዎ ያስፈልጋል',
    nameTooShort: 'ስም ቢያንስ 2 ቁምፊዎች መሆን አለበት',
    nameTooLong: 'ስም በጣም ረጅም ነው',
    nameInvalidChars: 'ስም ልክ ያልሆኑ ቁምፊዎች ይዟል',
    emailRequired: 'ኢሜይል አድራሻ ያስፈልጋል',
    invalidEmail: 'ትክክለኛ ኢሜይል አድራሻ ያስፈልጋል',
    subjectRequired: 'ርዕሰ ጉዳይ ያስፈልጋል',
    subjectTooShort: 'ርዕሰ ጉዳይ ቢያንስ 3 ቁምፊዎች መሆን አለበት',
    subjectTooLong: 'ርዕሰ ጉዳይ ከ100 ቁምፊዎች በታች መሆን አለበት',
    messageRequired: 'መልዕክት ያስፈልጋል',
    messageTooShort: 'መልዕክት ቢያንስ 10 ቁምፊዎች መሆን አለበት',
    messageTooLong: 'መልዕክት ከ1000 ቁምፊዎች በታች መሆን አለበት',
    charCount: 'ቁምፊዎች',
  }
};

const Contact = () => {
  const { user } = useContext(AuthContext);
  const lang = user?.language || 'en';
  const t    = T[lang] || T.en;

  const [values, setValues]   = useState({ name: '', email: '', subject: '', message: '' });
  const [touched, setTouched] = useState({});
  const [submitted, setSub]   = useState(false);
  const [sending, setSending] = useState(false);

  // Inline validators
  const errors = {
    name:    validators.name(values.name, t),
    email:   validators.email(values.email, t),
    subject: !values.subject.trim() ? t.subjectRequired
             : values.subject.trim().length < 3 ? t.subjectTooShort
             : values.subject.trim().length > 100 ? t.subjectTooLong
             : '',
    message: validators.message(values.message, t),
  };
  const formValid = Object.values(errors).every(e => e === '');

  const handleChange = e => setValues(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleBlur   = e => setTouched(prev => ({ ...prev, [e.target.name]: true }));

  const handleSubmit = e => {
    e.preventDefault();
    setTouched({ name:true, email:true, subject:true, message:true });
    if (!formValid) return;
    setSending(true);
    // Simulate send delay (replace with real API call if needed)
    setTimeout(() => { setSending(false); setSub(true); }, 800);
  };

  if (submitted) return (
    <div className="card" style={{ maxWidth:580, margin:'0 auto', textAlign:'center', padding:'50px 40px' }}>
      <div style={{ fontSize:'3.5rem', marginBottom:16 }}>✅</div>
      <h3 style={{ color:'var(--primary)', fontSize:'1.4rem', marginBottom:10 }}>{t.thankYouTitle}</h3>
      <p style={{ color:'var(--text-muted)', marginBottom:28 }}>{t.thankYouMessage}</p>
      <button className="btn btn-outline"
        onClick={() => { setSub(false); setValues({ name:'', email:'', subject:'', message:'' }); setTouched({}); }}>
        {t.sendAnother}
      </button>
    </div>
  );

  return (
    <div className="card" style={{ maxWidth:600, margin:'0 auto' }}>
      <div style={{ marginBottom:24 }}>
        <h3 style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--text-main)', margin:0 }}>{t.title}</h3>
        <p style={{ color:'var(--text-muted)', fontSize:'0.85rem', marginTop:4 }}>{t.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0 18px' }}>
          <FormField label={t.nameLabel} name="name" value={values.name}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.name} touched={touched.name} required />
          <FormField label={t.emailLabel} name="email" type="email" value={values.email}
            onChange={handleChange} onBlur={handleBlur}
            error={errors.email} touched={touched.email} required />
        </div>

        <FormField label={t.subjectLabel} name="subject" value={values.subject}
          onChange={handleChange} onBlur={handleBlur}
          error={errors.subject} touched={touched.subject} required />

        {/* Message with character counter */}
        <div className="fv-group">
          <label className="fv-label">
            {t.messageLabel} <span className="fv-required">*</span>
          </label>
          <div className="fv-input-wrap">
            <textarea name="message" value={values.message}
              onChange={handleChange} onBlur={handleBlur} rows={5}
              style={{ width:'100%', padding:'10px 14px', borderRadius:8, resize:'vertical',
                border: `1.5px solid ${touched.message && errors.message ? '#ef4444' : touched.message && !errors.message && values.message ? '#10b981' : 'var(--border)'}`,
                background:'var(--surface)', color:'var(--text-main)', fontSize:'0.95rem', fontFamily:'inherit',
                outline:'none', boxSizing:'border-box' }} />
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:5 }}>
            {touched.message && errors.message ? (
              <p className="fv-error" role="alert"><span>⚠</span> {errors.message}</p>
            ) : <span />}
            <span style={{ fontSize:'0.73rem', color: values.message.length > 900 ? '#ef4444' : 'var(--text-muted)' }}>
              {values.message.length}/1000 {t.charCount}
            </span>
          </div>
        </div>

        <button type="submit" className="btn btn-primary"
          style={{ width:'100%', padding:'12px', fontSize:'1rem', opacity: sending ? 0.7 : 1 }}
          disabled={sending}>
          {sending ? t.sending : t.sendButton}
        </button>
      </form>

      <div style={{ marginTop:28, borderTop:'1px solid var(--border)', paddingTop:18,
        display:'flex', gap:24, justifyContent:'center', color:'var(--text-muted)', fontSize:'0.82rem' }}>
        <span>📧 {t.emailInfo}</span>
        <span>📞 {t.phoneInfo}</span>
      </div>
    </div>
  );
};

export default Contact;
