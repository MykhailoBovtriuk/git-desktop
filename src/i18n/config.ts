import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enCommon from './en/common.json';
import enStaging from './en/staging.json';
import enGraph from './en/graph.json';
import enDiff from './en/diff.json';
import enFooter from './en/footer.json';
import enBranches from './en/branches.json';
import enMerge from './en/merge.json';
import enStash from './en/stash.json';
import enCheckout from './en/checkout.json';
import enRepo from './en/repo.json';

import ukCommon from './uk/common.json';
import ukStaging from './uk/staging.json';
import ukGraph from './uk/graph.json';
import ukDiff from './uk/diff.json';
import ukFooter from './uk/footer.json';
import ukBranches from './uk/branches.json';
import ukMerge from './uk/merge.json';
import ukStash from './uk/stash.json';
import ukCheckout from './uk/checkout.json';
import ukRepo from './uk/repo.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    defaultNS: 'common',
    resources: {
      en: {
        common: enCommon,
        staging: enStaging,
        graph: enGraph,
        diff: enDiff,
        footer: enFooter,
        branches: enBranches,
        merge: enMerge,
        stash: enStash,
        checkout: enCheckout,
        repo: enRepo,
      },
      uk: {
        common: ukCommon,
        staging: ukStaging,
        graph: ukGraph,
        diff: ukDiff,
        footer: ukFooter,
        branches: ukBranches,
        merge: ukMerge,
        stash: ukStash,
        checkout: ukCheckout,
        repo: ukRepo,
      },
    },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'] },
    interpolation: { escapeValue: false },
  });

export default i18n;
