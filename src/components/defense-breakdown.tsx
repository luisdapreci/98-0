import { calculateDefenseBreakdown } from '../engine/iq-math';
import type { BalanceRules } from '../engine/iq-math';
import type { TeamLineup } from '../engine/types';

export function DefenseBreakdown({ lineup, rules }: { lineup: TeamLineup; rules?: BalanceRules }) {
  const defense = calculateDefenseBreakdown(lineup, rules);
  const noChemistry = rules?.chemistry === 'none';
  const terms = noChemistry ? [['Individual defensive ability', defense.teamSupport] as const] : [
    ['Rim protection', defense.rimProtection],
    ['Perimeter defense', defense.perimeterDefense],
    ['Team support', defense.teamSupport],
    ['Defensive-liability penalty', defense.liabilityPenalty],
  ] as const;
  const rounding = Math.round(defense.total * 100) - 11000
    - terms.reduce((total, [, value]) => total + Math.round(value * 100), 0);
  return (
    <details className="defense-breakdown">
      <summary>DRTG {defense.total.toFixed(2)} / Defense breakdown</summary>
      <p>{noChemistry ? 'Individual defense only. Position-fit bonuses and liability penalties are disabled. Lower is better.' : 'Lower is better. Negative contributions improve defense. Team support comes from the five starters, not the sixth-man depth bonus.'}</p>
      <dl className="game-context">
        <div><dt>Baseline</dt><dd>110.00</dd></div>
        {terms.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value > 0 ? '+' : ''}{value.toFixed(2)}</dd></div>)}
        {rounding !== 0 && <div><dt>Display rounding</dt><dd>{rounding > 0 ? '+' : ''}{(rounding / 100).toFixed(2)}</dd></div>}
        <div><dt>Total DRTG</dt><dd>{defense.total.toFixed(2)}</dd></div>
      </dl>
    </details>
  );
}