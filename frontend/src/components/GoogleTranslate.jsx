import React, { useEffect, useState, useContext } from 'react';
import axios from 'axios';
import { AuthContext } from '../context/AuthContext';
import { API_URL } from '../config/api';

const GoogleTranslate = () => {
  const { user, updateProfile } = useContext(AuthContext);
  const [lang, setLang] = useState(localStorage.getItem('preferredLanguage') || 'en');

  useEffect(() => {
    let script = document.getElementById('google-translate-script');
    if (!script) {
      window.googleTranslateElementInit = () => {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'am,en',
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE
          },
          'google_translate_element'
        );
      };

      script = document.createElement('script');
      script.id = 'google-translate-script';
      script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  const changeLang = async (l) => {
    setLang(l);
    localStorage.setItem('preferredLanguage', l);
    if (l === 'am') {
      document.cookie = "googtrans=/en/am; path=/";
      document.cookie = "googtrans=/en/am; path=/; domain=" + window.location.hostname;
    } else {
      document.cookie = "googtrans=/en/en; path=/";
      document.cookie = "googtrans=/en/en; path=/; domain=" + window.location.hostname;
    }

    if (user && user.token) {
      try {
        const r = await axios.put(
          `${API_URL}/api/auth/profile`,
          { language: l },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
        updateProfile(r.data);
      } catch (err) {
        console.error('Failed to update user language', err);
      }
    }
    window.location.reload();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div id="google_translate_element" style={{ display: 'none' }}></div>
      <div className="si-lang-toggle" role="group" aria-label="Language" style={{ display: 'flex', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8, overflow: 'hidden' }}>
        {['en','am'].map(l => (
          <button key={l} onClick={() => changeLang(l)}
            style={{
              padding: '5px 11px', border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.75rem',
              background: lang === l ? 'rgba(21,128,61,0.9)' : 'transparent',
              color: lang === l ? 'white' : 'rgba(255,255,255,0.65)',
              transition: 'all 0.2s',
            }}>
            {l === 'en' ? 'EN' : 'አማ'}
          </button>
        ))}
      </div>
    </div>
  );
};

export default GoogleTranslate;
