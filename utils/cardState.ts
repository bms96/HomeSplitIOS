/**
 * Stat-card state machine for the home dashboard.
 *
 * Each card has three tones driving background color:
 *   positive (green) — nothing to worry about
 *   caution  (yellow) — attention this cycle, nothing urgent
 *   alert    (red)    — overdue or carrying over from last cycle
 *
 * Text is paired so the card reads correctly for color-blind users and
 * screen readers without relying on color alone.
 */

export type CardTone = 'positive' | 'caution' | 'alert';

export type StatCardState = {
  tone: CardTone;
  text: string;
};

/**
 * "You owe" card.
 * - positive: 0 current-cycle expenses and nothing carrying over.
 * - caution:  owe something this cycle, no carryover.
 * - alert:    carrying over unsettled debt from a prior cycle.
 */
export function computeYouOweCardState(params: {
  count: number;
  hasCarryover: boolean;
}): StatCardState {
  if (params.hasCarryover) return { tone: 'alert', text: 'Unpaid from last cycle' };
  if (params.count === 0) return { tone: 'positive', text: 'All settled up' };
  return { tone: 'caution', text: 'Due this cycle' };
}

/**
 * "Owed to you" card.
 * - positive: 0 unpaid this cycle and nothing lingering from before.
 * - caution:  roommates owe you this cycle, no carryover.
 * - alert:    roommates owe you from a prior cycle.
 */
export function computeOwedToYouCardState(params: {
  count: number;
  hasCarryover: boolean;
}): StatCardState {
  if (params.hasCarryover) return { tone: 'alert', text: 'Unpaid from last cycle' };
  if (params.count === 0) return { tone: 'positive', text: 'Fully reimbursed' };
  return { tone: 'caution', text: 'Waiting on roommates' };
}

/**
 * "Bills due" card.
 * - positive: no bills due in window and none overdue.
 * - caution:  bills due in window, none overdue.
 * - alert:    at least one bill past its due date.
 */
export function computeBillsDueCardState(params: {
  count: number;
  hasOverdue: boolean;
}): StatCardState {
  if (params.hasOverdue) return { tone: 'alert', text: 'Past due' };
  if (params.count === 0) return { tone: 'positive', text: 'All caught up' };
  return { tone: 'caution', text: 'Coming up' };
}
