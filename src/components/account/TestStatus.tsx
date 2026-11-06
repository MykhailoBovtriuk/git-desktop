import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useAccountStore } from '../../stores/account-store';
import { testKey } from '../../lib/test-key';
import { openLogEntry, requestOrgAccess } from '../../stores/error-toast';
import { relativeTime } from '../../lib/relative-time';
import { Button, CheckIcon, ErrorIcon, SpinnerIcon, cn } from '../../shared/ui';
import type { RepoTestResult, RepoTestStepResult } from '../../types';

const REASONS = new Set(['orgAccess', 'auth', 'sshKey', 'network', 'hook', 'notRepo']);

function access(t: TFunction<'account'>, write: RepoTestStepResult | undefined): string {
  if (write?.skipped) return t('test.readOnly', { why: t(`test.skip.${write.skipped}`) });
  if (write?.behind) return t('test.readWriteBehind');
  return t('test.readWrite');
}

function reason(t: TFunction<'account'>, step: RepoTestStepResult): string {
  if (step.sshReason && step.sshReason !== 'ok') return t(`test.ssh.${step.sshReason}`);
  if (step.reasonKind && REASONS.has(step.reasonKind)) return t(`test.reason.${step.reasonKind}`);
  return step.message;
}

function hint(t: TFunction<'account'>, step: RepoTestStepResult, host: string): string | null {
  if (step.sshReason && step.sshReason !== 'ok')
    return t(`test.sshHint.${step.sshReason}`, { host });
  if (step.reasonKind === 'orgAccess') return t('test.orgAccessHint');
  if (step.reasonKind === 'auth') return t('test.authHint');
  return null;
}

function summarize(t: TFunction<'account'>, result: RepoTestResult, host: string) {
  const failed = result.steps.find(s => !s.ok);
  if (failed) {
    return {
      ok: false,
      text: t('test.failed', { reason: reason(t, failed) }),
      hint: hint(t, failed, host),
      orgAccess: failed.reasonKind === 'orgAccess',
      logId: failed.logId,
    };
  }
  const rights = access(
    t,
    result.steps.find(s => s.step === 'write'),
  );
  return {
    ok: true,
    text: t('test.passed', {
      summary: result.login ? t('test.user', { login: result.login, access: rights }) : rights,
    }),
    hint: null,
    orgAccess: false,
    logId: result.steps[result.steps.length - 1]?.logId ?? null,
  };
}

export function TestStatus({
  repoPath,
  host,
  className,
}: {
  repoPath: string;
  host: string;
  className?: string;
}) {
  const { t, i18n } = useTranslation('account');
  const key = testKey(host, repoPath);
  const result = useAccountStore(s => s.tests[key]);
  const testing = useAccountStore(s => !!s.testing[key]);
  const shown = result ? summarize(t, result, host) : null;

  return (
    <div role="status" aria-live="polite" className={testing || shown ? className : undefined}>
      {testing && (
        <p className="flex items-center gap-2 text-subtext text-xs">
          <SpinnerIcon size={12} aria-hidden="true" className="animate-spin shrink-0" />
          {t('test.running')}
        </p>
      )}
      {!testing && shown && result && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 text-xs">
            <p className={cn('flex items-center gap-2', shown.ok ? 'text-green' : 'text-red')}>
              {shown.ok ? (
                <CheckIcon size={12} aria-hidden="true" className="shrink-0" />
              ) : (
                <ErrorIcon size={12} aria-hidden="true" className="shrink-0" />
              )}
              <span>
                {shown.text}
                <span className="text-subtext">
                  {' · '}
                  {relativeTime(new Date(result.at).toISOString(), i18n?.language)}
                </span>
              </span>
            </p>
            {shown.hint && <p className="text-subtext mt-1">{shown.hint}</p>}
            {shown.orgAccess && (
              <Button
                variant="link"
                size="xs"
                className="mt-1"
                onClick={() => requestOrgAccess(repoPath, t('footer:requestAccessFailed'))}
              >
                {t('footer:requestAccess')}
              </Button>
            )}
          </div>
          {shown.logId && (
            <Button
              variant="link"
              size="xs"
              className="shrink-0"
              onClick={() => openLogEntry(shown.logId!)}
            >
              {t('logs:showInLogs')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
