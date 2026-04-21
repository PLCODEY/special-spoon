export interface PersonalInfo {
  currentAge: number;
  lifeExpectancy: number;
  annualExpensesNow: number;
  inflationRate: number; // e.g. 0.03
}

export interface LiquidAccount {
  type: "brokerage" | "rothIra" | "401k";
  currentBalance: number;
  annualContribution: number;
  unrealizedCapitalGains: number; // brokerage only
  expectedReturn: number; // e.g. 0.07
}

export interface IlliquidInvestment {
  type: "privateEquity" | "creditFund" | "ventureCapital" | "hedgeFund" | "other";
  label: string;
  currentValue: number;
  expectedReturn: number; // e.g. 0.12
  expectedLiquidationAge: number; // when you expect to be able to access it
}

export interface RealEstateProperty {
  label: string;
  isPrimaryResidence: boolean;
  currentValue: number;
  zipCode: string;
  annualAppreciation: number; // estimated from zip region
  outstandingMortgage: number;
  mortgageRate: number;
  monthlyPayment: number;
  remainingMonths: number;
  annualRentalIncome: number; // 0 for primary residence
}

export interface Debt {
  label: string;
  balance: number;
  interestRate: number;
  monthlyPayment: number;
  remainingMonths: number;
}

export interface Child {
  currentAge: number;
  estimatedAnnualEducationCost: number; // per year of college
  yearsOfEducation: number; // e.g. 4
  collegeStartAge: number; // e.g. 18
}

export interface PassiveIncome {
  label: string;
  annualAmount: number;
  startAge: number; // e.g. 62 for Social Security
  endAge: number; // e.g. lifeExpectancy
}

export interface RetirementInputs {
  personal: PersonalInfo;
  liquidAccounts: LiquidAccount[];
  illiquidInvestments: IlliquidInvestment[];
  realEstate: RealEstateProperty[];
  otherDebts: Debt[];
  children: Child[];
  passiveIncome: PassiveIncome[];
  federalTaxRate: number; // e.g. 0.24 — for 401k/traditional IRA distributions
  capitalGainsTaxRate: number; // e.g. 0.20
}

export interface NetWorthBreakdown {
  retirementAge: number;
  yearsFromNow: number;

  // Assets
  brokerageAfterTax: number;
  rothIra: number;
  traditional401kPreTax: number;
  traditional401kAfterTax: number;
  illiquidTotal: number;
  realEstateEquity: number;
  passiveIncomeNPV: number; // present value of future passive income streams

  // Liabilities
  remainingMortgages: number;
  otherDebtsRemaining: number;
  educationCostsPV: number; // PV of future education costs not yet paid

  // Totals
  grossNetWorth: number; // all assets minus all liabilities (pre-tax on 401k)
  netNetWorth: number;   // after-tax net worth (401k discounted, cap gains tax applied)

  // Sustainability
  annualExpensesAtRetirement: number;
  requiredPortfolio4pct: number; // expenses / 0.04
  sustainabilityRatio: number; // netNetWorth / requiredPortfolio4pct
  isSustainable: boolean;
}

// ZIP code → estimated annual appreciation bucket
// Based on broad regional historical averages
export const ZIP_APPRECIATION_MAP: Record<string, { label: string; rate: number }> = {
  "high-growth": { label: "High-Growth Metro (NYC, SF, Miami, Austin)", rate: 0.065 },
  "mid-growth":  { label: "Mid-Growth Metro (Chicago, Denver, Seattle)", rate: 0.045 },
  "stable":      { label: "Stable Market (Midwest, Southeast suburbs)",  rate: 0.035 },
  "slow":        { label: "Slow Growth (Rural, Rust Belt)",               rate: 0.02  },
};

export const DEFAULT_RETURNS: Record<string, number> = {
  brokerage:     0.07,
  rothIra:       0.07,
  "401k":        0.07,
  privateEquity: 0.13,
  creditFund:    0.09,
  ventureCapital:0.15,
  hedgeFund:     0.08,
  other:         0.07,
};

function compoundGrow(value: number, rate: number, years: number): number {
  return value * Math.pow(1 + rate, years);
}

function futureValueContributions(annual: number, rate: number, years: number): number {
  if (rate === 0) return annual * years;
  return annual * ((Math.pow(1 + rate, years) - 1) / rate) * (1 + rate);
}

function remainingMortgageBalance(
  principal: number,
  monthlyRate: number,
  monthlyPayment: number,
  monthsPaid: number
): number {
  if (monthlyRate === 0) return Math.max(0, principal - monthlyPayment * monthsPaid);
  const balance = principal * Math.pow(1 + monthlyRate, monthsPaid)
    - monthlyPayment * ((Math.pow(1 + monthlyRate, monthsPaid) - 1) / monthlyRate);
  return Math.max(0, balance);
}

export function projectNetWorth(
  inputs: RetirementInputs,
  targetRetirementAge: number
): NetWorthBreakdown {
  const { personal, liquidAccounts, illiquidInvestments, realEstate, otherDebts, children, passiveIncome } = inputs;
  const years = targetRetirementAge - personal.currentAge;

  if (years < 0) {
    throw new Error("Target retirement age must be >= current age");
  }

  // ── Liquid accounts ──────────────────────────────────────────────────────
  let brokerageAfterTax = 0;
  let rothIra = 0;
  let traditional401kPreTax = 0;

  for (const acct of liquidAccounts) {
    const grown = compoundGrow(acct.currentBalance, acct.expectedReturn, years)
      + futureValueContributions(acct.annualContribution, acct.expectedReturn, years);

    if (acct.type === "brokerage") {
      // Capital gains grow proportionally; apply cap gains tax on the gain portion
      const costBasis = acct.currentBalance - acct.unrealizedCapitalGains;
      const totalGain = grown - costBasis;
      const taxDue = totalGain * inputs.capitalGainsTaxRate;
      brokerageAfterTax += grown - taxDue;
    } else if (acct.type === "rothIra") {
      rothIra += grown; // tax-free
    } else {
      traditional401kPreTax += grown;
    }
  }

  const traditional401kAfterTax = traditional401kPreTax * (1 - inputs.federalTaxRate);

  // ── Illiquid investments ──────────────────────────────────────────────────
  let illiquidTotal = 0;
  for (const inv of illiquidInvestments) {
    const yearsToGrow = Math.min(years, inv.expectedLiquidationAge - personal.currentAge);
    const effectiveYears = Math.max(0, yearsToGrow);
    illiquidTotal += compoundGrow(inv.currentValue, inv.expectedReturn, effectiveYears);
  }

  // ── Real estate ───────────────────────────────────────────────────────────
  let realEstateEquity = 0;
  let remainingMortgages = 0;

  for (const prop of realEstate) {
    const futureValue = compoundGrow(prop.currentValue, prop.annualAppreciation, years);
    const monthsPaid = Math.min(years * 12, prop.remainingMonths);
    const monthlyRate = prop.mortgageRate / 12;
    const mortgageLeft = remainingMortgageBalance(
      prop.outstandingMortgage,
      monthlyRate,
      prop.monthlyPayment,
      monthsPaid
    );
    realEstateEquity += futureValue - mortgageLeft;
    remainingMortgages += mortgageLeft;
  }

  // ── Other debts ───────────────────────────────────────────────────────────
  let otherDebtsRemaining = 0;
  for (const debt of otherDebts) {
    const monthsPaid = Math.min(years * 12, debt.remainingMonths);
    const monthlyRate = debt.interestRate / 12;
    const remaining = remainingMortgageBalance(
      debt.balance,
      monthlyRate,
      debt.monthlyPayment,
      monthsPaid
    );
    otherDebtsRemaining += remaining;
  }

  // ── Education costs (PV of remaining payments) ────────────────────────────
  let educationCostsPV = 0;
  for (const child of children) {
    const collegeStartYear = child.collegeStartAge - personal.currentAge;
    for (let yr = 0; yr < child.yearsOfEducation; yr++) {
      const paymentYear = collegeStartYear + yr;
      if (paymentYear > 0 && paymentYear <= years) {
        // Already paid before retirement — reduce liquid savings (simplified: treat as sunk cost subtracted from projection)
        educationCostsPV += child.estimatedAnnualEducationCost;
      } else if (paymentYear > years) {
        // Future after retirement — count as liability
        const discounted = child.estimatedAnnualEducationCost / Math.pow(1 + 0.04, paymentYear - years);
        educationCostsPV += discounted;
      }
    }
  }

  // ── Passive income NPV ────────────────────────────────────────────────────
  // Simple NPV of passive income streams from retirement age to life expectancy
  const discountRate = 0.04;
  let passiveIncomeNPV = 0;
  for (const stream of passiveIncome) {
    const streamStart = Math.max(stream.startAge, targetRetirementAge);
    const streamEnd = Math.min(stream.endAge, personal.lifeExpectancy);
    for (let age = streamStart; age < streamEnd; age++) {
      const yr = age - targetRetirementAge;
      const inflatedAmount = compoundGrow(stream.annualAmount, personal.inflationRate, stream.startAge - personal.currentAge + yr);
      passiveIncomeNPV += inflatedAmount / Math.pow(1 + discountRate, yr);
    }
  }

  // ── Expenses ──────────────────────────────────────────────────────────────
  const annualExpensesAtRetirement = compoundGrow(personal.annualExpensesNow, personal.inflationRate, years);
  const requiredPortfolio4pct = annualExpensesAtRetirement / 0.04;

  // ── Net worth totals ──────────────────────────────────────────────────────
  const totalAssets = brokerageAfterTax + rothIra + traditional401kAfterTax
    + illiquidTotal + realEstateEquity + passiveIncomeNPV;

  const totalLiabilities = otherDebtsRemaining + educationCostsPV;

  const netNetWorth = totalAssets - totalLiabilities;

  const grossNetWorth = brokerageAfterTax + rothIra + traditional401kPreTax
    + illiquidTotal + realEstateEquity + passiveIncomeNPV - otherDebtsRemaining - educationCostsPV;

  const sustainabilityRatio = netNetWorth / requiredPortfolio4pct;

  return {
    retirementAge: targetRetirementAge,
    yearsFromNow: years,
    brokerageAfterTax,
    rothIra,
    traditional401kPreTax,
    traditional401kAfterTax,
    illiquidTotal,
    realEstateEquity,
    passiveIncomeNPV,
    remainingMortgages,
    otherDebtsRemaining,
    educationCostsPV,
    grossNetWorth,
    netNetWorth,
    annualExpensesAtRetirement,
    requiredPortfolio4pct,
    sustainabilityRatio,
    isSustainable: sustainabilityRatio >= 1.0,
  };
}

export function projectAllScenarios(inputs: RetirementInputs): NetWorthBreakdown[] {
  const ages = [50, 55, 58, 60, 62, 65, 67, 70];
  return ages
    .filter(a => a >= inputs.personal.currentAge)
    .map(a => projectNetWorth(inputs, a));
}

export function recommendRetirementAge(scenarios: NetWorthBreakdown[]): {
  earliest: number;
  comfortable: number;
  optimal: number;
} {
  const sustainable = scenarios.filter(s => s.isSustainable);
  if (sustainable.length === 0) {
    const best = scenarios.reduce((a, b) => a.sustainabilityRatio > b.sustainabilityRatio ? a : b);
    return { earliest: best.retirementAge, comfortable: best.retirementAge, optimal: best.retirementAge };
  }
  const earliest = sustainable[0].retirementAge;
  const comfortable = sustainable.find(s => s.sustainabilityRatio >= 1.25)?.retirementAge ?? sustainable[sustainable.length - 1].retirementAge;
  const optimal = sustainable.find(s => s.sustainabilityRatio >= 1.5)?.retirementAge ?? sustainable[sustainable.length - 1].retirementAge;
  return { earliest, comfortable, optimal };
}

export function fmt(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}
