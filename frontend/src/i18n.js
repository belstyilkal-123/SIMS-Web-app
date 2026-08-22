import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "nav": {
        "dashboard": "Dashboard",
        "staff": "Staff",
        "labour": "Labour",
        "payroll": "Payroll",
        "expenses": "Expenses",
        "expense_approvals": "Expense Approvals",
        "finance": "Finance",
        "performance": "Performance",
        "farms": "Farms",
        "approvals": "Approvals",
        "attendance": "Attendance",
        "tasks": "Tasks",
        "farm_assignments": "Farm Assignments",
        "maintenance": "Maintenance",
        "audits": "Audit Logs",
        "settings": "Profile & Settings",
        "logout": "Logout",
        "alerts": "Alerts"
      },
      "group": {
        "overview": "Overview",
        "people": "People",
        "business": "Business",
        "operations": "Operations"
      },
      "owner_dash": {
        "title": "👑 Business Overview",
        "subtitle": "Organization-wide performance and workforce summary.",
        "workforce_summary": "👥 Workforce Summary",
        "active_staff": "👤 Active Staff",
        "quick_actions": "🔗 Quick Actions"
      }
    }
  },
  am: {
    translation: {
      "nav": {
        "dashboard": "ዳሽቦርድ",
        "staff": "ሠራተኞች",
        "labour": "የጉልበት ሠራተኞች",
        "payroll": "ደሞዝ",
        "expenses": "ወጪዎች",
        "expense_approvals": "የወጪ ማረጋገጫዎች",
        "finance": "ፋይናንስ",
        "performance": "የእርሻ አፈፃፀም",
        "farms": "እርሻዎች",
        "approvals": "ማረጋገጫዎች",
        "attendance": "መገኘት",
        "tasks": "ተግባራት",
        "farm_assignments": "የእርሻ ምደባ",
        "maintenance": "የዕቃ ጥገና",
        "audits": "ምዝገቦች (Audits)",
        "settings": "መገለጫ እና ቅንብሮች",
        "logout": "ውጣ",
        "alerts": "ማሳወቂያዎች"
      },
      "group": {
        "overview": "አጠቃላይ እይታ",
        "people": "የሰው ሀይል",
        "business": "ንግድ",
        "operations": "ስራዎች"
      },
      "owner_dash": {
        "title": "👑 የንግድ አጠቃላይ እይታ",
        "subtitle": "የድርጅቱ አጠቃላይ አፈፃፀም እና የሰው ሀይል ማጠቃለያ።",
        "workforce_summary": "👥 የሰው ሀይል ማጠቃለያ",
        "active_staff": "👤 ንቁ ሠራተኞች",
        "quick_actions": "🔗 ፈጣን እርምጃዎች"
      }
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false // React already escapes values
    }
  });

export default i18n;
