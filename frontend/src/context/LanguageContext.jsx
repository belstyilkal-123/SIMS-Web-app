import React, { createContext, useState, useEffect, useContext } from 'react';
import { AuthContext } from './AuthContext';

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const { user } = useContext(AuthContext);

  // Priority: user profile language > localStorage > default 'en'
  const getInitialLanguage = () => {
    if (user?.language) return user.language;
    return localStorage.getItem('preferredLanguage') || 'en';
  };

  const [language, setLanguage] = useState(getInitialLanguage);

  // Sync when user logs in/changes profile language
  useEffect(() => {
    if (user?.language) {
      setLanguage(user.language);
    }
  }, [user?.language]);

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('preferredLanguage', lang);
  };

  const isAmharic = language === 'am';

  return (
    <LanguageContext.Provider value={{ language, changeLanguage, isAmharic }}>
      {children}
    </LanguageContext.Provider>
  );
};
