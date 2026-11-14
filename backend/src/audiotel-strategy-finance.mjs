/**
 * Exact, side-effect-free financial calculations for Audiotel strategy previews.
 * Units: whole billable minutes, EUR 0.001 rates, EUR 0.01 fixed costs.
 * BigInt prevents intermediate floating-point rounding from changing rankings
 * or the owner's minimum personal net per billable minute.
 *
 * This module never handles publisher funds, transfers or tax calculations.
 * Personal retention remains an unverified user-entered assumption.
 */
export function euroFromMillieur(milli){
 if(typeof milli!=="bigint")throw new TypeError("MILLIEUR_BIGINT_REQUIRED");
 const abs=milli<0n?-milli:milli;
 const cents=(abs+5n)/10n;
 return Number(milli<0n?-cents:cents)/100;
}

export function calculateAudiotelStrategyFinance({
 minutes,appOwnRevenueMillieurPerMin,appVariableCostMillieurPerMin,
 monthlyFixedCostCents,oneOffSetupCostCents,personalRetentionBps,
 minimumPersonalNetMillieurPerMin
}){
 const revenue=BigInt(minutes)*BigInt(appOwnRevenueMillieurPerMin);
 const variableCost=BigInt(minutes)*BigInt(appVariableCostMillieurPerMin);
 const operating=revenue-variableCost-BigInt(monthlyFixedCostCents)*10n;
 const personal=personalRetentionBps===null?null:
  operating>0n?operating*BigInt(personalRetentionBps)/10000n:0n;
 const floorMet=personal===null||minutes===0?null:
  personal>=BigInt(minutes)*BigInt(minimumPersonalNetMillieurPerMin);
 return Object.freeze({
  revenue_millieur:revenue,
  variable_cost_millieur:variableCost,
  operating_millieur:operating,
  personal_millieur:personal,
  personal_floor_met:floorMet,
  monthly_app_own_revenue_eur:euroFromMillieur(revenue),
  monthly_app_variable_costs_eur:euroFromMillieur(variableCost),
  monthly_app_fixed_costs_eur:monthlyFixedCostCents/100,
  monthly_operating_before_tax_eur:euroFromMillieur(operating),
  one_off_setup_eur:oneOffSetupCostCents/100,
  estimated_personal_monthly_net_eur:personal===null?null:euroFromMillieur(personal),
  estimated_personal_net_eur_per_min:personal===null||minutes===0?null:Number(personal)/1000/minutes
 });
}

// Exact ratio checks, including boundaries within a cent, avoid converting
// BigInt company results to rounded EUR before comparing strategies.
export function atLeastShareOfBest(candidateMillieur,bestMillieur,allowedSacrificeBps){
 const candidate=BigInt(candidateMillieur);
 const best=BigInt(bestMillieur);
 return best>0n&&candidate*10000n>=best*BigInt(10000-allowedSacrificeBps);
}
