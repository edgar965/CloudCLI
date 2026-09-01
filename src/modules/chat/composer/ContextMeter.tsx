import { useTranslation } from 'react-i18next';

import { cn } from '@/shared/utils';

/**
 * How full the model's context window is - and the way to do something about
 * it.
 *
 * The numbers come from the CLI itself (`getContextUsage`), not from adding up
 * what went over the wire: how much of the window is in use, where the limit
 * sits, and what it is made of. Measured in an empty directory with Haiku:
 *
 *   used 44,859 of 200,000 → 22 %
 *   System prompt 6,952 · System tools 22,257 · Memory files 10,101
 *   Skills 2,043 · Messages 3,506 · Free space 155,141
 *
 * A button rather than a readout: knowing the window is nearly full is only
 * half of it, and the other half - compacting the conversation - was a command
 * to remember and type. Clicking this sends `/compact`.
 */

export type ContextUsage = {
  used: number;
  max: number;
  rawMax?: number;
  percentage: number;
  model?: string;
  categories?: { name: string; tokens: number }[];
};

/** From here on the window is filling up; past the second, it is nearly full. */
const WARN_PERCENT = 75;
const CRITICAL_PERCENT = 90;

const formatTokens = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return String(Math.round(value));
};

type Props = {
  usage: ContextUsage | null;
  /** Sends `/compact`; without it the button is only a readout. */
  onCompact?: () => void;
  disabled?: boolean;
};

export default function ContextMeter({ usage, onCompact, disabled }: Props) {
  const { t } = useTranslation('chat');

  if (!usage || !Number.isFinite(usage.percentage) || !usage.max) {
    return null;
  }

  const percent = Math.min(100, Math.max(0, Math.round(usage.percentage)));
  const level = percent >= CRITICAL_PERCENT
    ? 'critical'
    : percent >= WARN_PERCENT
      ? 'warn'
      : 'calm';

  // The breakdown belongs in the tooltip rather than on screen: it answers
  // "why is it that full" for anyone who asks, and stays out of the way of
  // everyone who does not.
  const breakdown = (usage.categories || [])
    .filter((entry) => entry.tokens > 0)
    .map((entry) => `${entry.name}: ${entry.tokens.toLocaleString()}`)
    .join('\n');

  const title = [
    t('context.title', {
      used: usage.used.toLocaleString(),
      max: usage.max.toLocaleString(),
      defaultValue: '{{used}} of {{max}} tokens in the context window',
    }),
    breakdown,
    onCompact
      ? t('context.compactHint', {
        defaultValue: 'Click to compact the conversation (/compact)',
      })
      : '',
  ].filter(Boolean).join('\n\n');

  return (
    <button
      type="button"
      title={title}
      disabled={disabled || !onCompact}
      onClick={onCompact}
      className={cn(
        'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-[11px] font-medium tabular-nums transition-colors',
        'disabled:cursor-default disabled:opacity-70',
        level === 'critical'
          ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400'
          : level === 'warn'
            ? 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {/* A ring that fills up: the number says how much, this says it faster. */}
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 -rotate-90" aria-hidden="true">
        <circle cx="10" cy="10" r="8" fill="none" strokeWidth="4" className="stroke-current opacity-20" />
        <circle
          cx="10"
          cy="10"
          r="8"
          fill="none"
          strokeWidth="4"
          className="stroke-current"
          strokeDasharray={`${(percent / 100) * 50.27} 50.27`}
        />
      </svg>
      <span>
        {t('context.percent', { percent, defaultValue: '{{percent}}%' })}
      </span>
      <span className="hidden text-muted-foreground/70 sm:inline">
        {formatTokens(usage.used)}/{formatTokens(usage.max)}
      </span>
    </button>
  );
}
