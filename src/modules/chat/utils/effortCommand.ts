/**
 * `/effort` - the reasoning effort, from the message box.
 *
 * The effort is already a control next to the model name, but reaching it
 * costs a click into a menu, and it is the one setting worth changing mid
 * conversation: a question that needs thinking, then a quick follow-up.
 * The VS Code extension has the same command, and this is the same split as
 * `/browser` - it never becomes a prompt, it sets something and says so.
 *
 * Which values exist depends on the model, so they come from the catalog
 * rather than a list here: Opus offers more steps than Haiku, and OpenCode
 * offers none at all.
 */

export type EffortOption = { value: string; description?: string };

export type EffortCommandResult = {
  /** What to tell the user. */
  message: string;
  /** The value to apply, or null when nothing should change. */
  effort: string | null;
};

/** Turns "Xhigh" into "xhigh": the menu labels are capitalised, the values are not. */
const normalize = (raw: string): string => raw.trim().toLowerCase();

const listValues = (options: EffortOption[]): string =>
  options.map((option) => option.value).join(', ');

/**
 * Works out what `/effort [wert]` should do.
 *
 * Kept apart from the composer so the decision is testable on its own: it is
 * all string handling and no React.
 *
 * @param argument - What followed the command name, may be empty
 * @param current - The effort in force right now
 * @param options - What this model accepts
 */
export function resolveEffortCommand(
  argument: string,
  current: string | null,
  options: EffortOption[],
): EffortCommandResult {
  if (options.length === 0) {
    return {
      message: 'This model has no reasoning effort to set.',
      effort: null,
    };
  }

  const wanted = normalize(argument);

  // No argument: say where things stand and what else there is, rather than
  // changing anything. `/effort` alone should be safe to type.
  if (!wanted) {
    const now = current ? `Reasoning effort is **${current}**.` : 'No reasoning effort is set.';
    return { message: `${now} Available: ${listValues(options)}.`, effort: null };
  }

  const match = options.find((option) => option.value.toLowerCase() === wanted);
  if (!match) {
    return {
      message: `"${argument.trim()}" is not one of this model's efforts. Available: ${listValues(options)}.`,
      effort: null,
    };
  }

  if (current && match.value.toLowerCase() === current.toLowerCase()) {
    return { message: `Reasoning effort is already **${match.value}**.`, effort: null };
  }

  return { message: `Reasoning effort is now **${match.value}**.`, effort: match.value };
}
