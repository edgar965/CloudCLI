import { useTranslation } from 'react-i18next';

import { cn } from '../../../../lib/utils';

/**
 * How full the model's context window is, above the message box.
 *
 * The numbers come from the CLI itself (`getContextUsage`), not from adding up
 * what went over the wire: how much of the window is in use, where the limit
 * sits, and what it is made of. Measured in an empty directory with Haiku:
 *
 *   used 44,859 of 200,000 → 22 %
 *   System prompt 6,952 · System tools 22,257 · Memory files 10,101
 *   Skills 2,043 · Messages 3,506 · Free space 155,141
 *
 * Worth seeing, because most of a fresh window is gone before the first
 * message: instruction files and tool descriptions, not the conversation.
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

export default function ContextMeter({ usage }: { usage: ContextUsage | null }) {
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

  return (
    <div
      className="flex items-center gap-2 px-3 pt-2 text-[11px] text-muted-foreground"
      title={breakdown || undefined}
    >
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            level === 'critical' ? 'bg-red-500' : level === 'warn' ? 'bg-amber-500' : 'bg-primary/50',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>

      <span
        className={cn(
          'flex-shrink-0 tabular-nums',
          level === 'critical'
            ? 'font-medium text-red-600 dark:text-red-400'
            : level === 'warn'
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-muted-foreground/70',
        )}
      >
        {level === 'critical'
          ? t('context.nearlyFull', { percent, defaultValue: '{{percent}}% context — compacting soon' })
          : t('context.used', {
            percent,
            used: formatTokens(usage.used),
            max: formatTokens(usage.max),
            defaultValue: '{{percent}}% context · {{used}}/{{max}}',
          })}
      </span>
    </div>
  );
}
