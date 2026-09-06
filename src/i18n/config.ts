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
import enRebase from './en/rebase.json';
import enStash from './en/stash.json';
import enCheckout from './en/checkout.json';
import enRepo from './en/repo.json';
import enSettings from './en/settings.json';
import enAbout from './en/about.json';
import enAccount from './en/account.json';

import ukCommon from './uk/common.json';
import ukStaging from './uk/staging.json';
import ukGraph from './uk/graph.json';
import ukDiff from './uk/diff.json';
import ukFooter from './uk/footer.json';
import ukBranches from './uk/branches.json';
import ukMerge from './uk/merge.json';
import ukRebase from './uk/rebase.json';
import ukStash from './uk/stash.json';
import ukCheckout from './uk/checkout.json';
import ukRepo from './uk/repo.json';
import ukSettings from './uk/settings.json';
import ukAbout from './uk/about.json';
import ukAccount from './uk/account.json';

import nlCommon from './nl/common.json';
import nlStaging from './nl/staging.json';
import nlGraph from './nl/graph.json';
import nlDiff from './nl/diff.json';
import nlFooter from './nl/footer.json';
import nlBranches from './nl/branches.json';
import nlMerge from './nl/merge.json';
import nlRebase from './nl/rebase.json';
import nlStash from './nl/stash.json';
import nlCheckout from './nl/checkout.json';
import nlRepo from './nl/repo.json';
import nlSettings from './nl/settings.json';
import nlAbout from './nl/about.json';
import nlAccount from './nl/account.json';

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
        rebase: enRebase,
        stash: enStash,
        checkout: enCheckout,
        repo: enRepo,
        settings: enSettings,
        about: enAbout,
        account: enAccount,
      },
      uk: {
        common: ukCommon,
        staging: ukStaging,
        graph: ukGraph,
        diff: ukDiff,
        footer: ukFooter,
        branches: ukBranches,
        merge: ukMerge,
        rebase: ukRebase,
        stash: ukStash,
        checkout: ukCheckout,
        repo: ukRepo,
        settings: ukSettings,
        about: ukAbout,
        account: ukAccount,
      },
      nl: {
        common: nlCommon,
        staging: nlStaging,
        graph: nlGraph,
        diff: nlDiff,
        footer: nlFooter,
        branches: nlBranches,
        merge: nlMerge,
        rebase: nlRebase,
        stash: nlStash,
        checkout: nlCheckout,
        repo: nlRepo,
        settings: nlSettings,
        about: nlAbout,
        account: nlAccount,
      },
    },
    // No 'navigator': English is the default until the user picks a language,
    // regardless of the system locale.
    detection: { order: ['localStorage'], caches: ['localStorage'] },
    interpolation: { escapeValue: false },
  });
