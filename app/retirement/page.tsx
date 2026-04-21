"use client";
import { useState, useMemo } from "react";
import {
  RetirementInputs, LiquidAccount, IlliquidInvestment,
  RealEstateProperty, Debt, Child, PassiveIncome,
  ZIP_APPRECIATION_MAP, DEFAULT_RETURNS,
  projectAllScenarios, recommendRetirementAge,
  NetWorthBreakdown, fmt,
} from "@/lib/retirement-calc";

// ── helpers ──────────────────────────────────────────────────────────────────
function pct(n: number) { return `${(n * 100).toFixed(1)}%`; }
function numInput(
  label: string,
  value: number,
  onChange: (v: number) => void,
  opts: { min?: number; max?: number; step?: number; prefix?: string; suffix?: string; hint?: string } = {}
) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">
        {label}
        {opts.hint && <span className="ml-2 text-xs text-slate-500">{opts.hint}</span>}
      </label>
      <div className="flex items-center gap-1">
        {opts.prefix && <span className="text-slate-400 text-sm">{opts.prefix}</span>}
        <input
          type="number"
          value={value}
          min={opts.min}
          max={opts.max}
          step={opts.step ?? 1}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
        />
        {opts.suffix && <span className="text-slate-400 text-sm">{opts.suffix}</span>}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 space-y-4">
      <h2 className="text-lg font-semibold text-white border-b border-slate-700 pb-2">{title}</h2>
      {children}
    </div>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-blue-400 hover:text-blue-300 border border-blue-700 hover:border-blue-500 rounded px-3 py-1.5 transition-colors"
    >
      + {label}
    </button>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 rounded px-2 py-1 transition-colors"
    >
      Remove
    </button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{children}</div>;
}

const ILLIQUID_TYPES: IlliquidInvestment["type"][] = ["privateEquity", "creditFund", "ventureCapital", "hedgeFund", "other"];
const ILLIQUID_LABELS: Record<IlliquidInvestment["type"], string> = {
  privateEquity: "Private Equity",
  creditFund: "Credit / Private Credit Fund",
  ventureCapital: "Venture Capital",
  hedgeFund: "Hedge Fund",
  other: "Other Illiquid",
};

// ── default state ─────────────────────────────────────────────────────────────
function defaultInputs(): RetirementInputs {
  return {
    personal: { currentAge: 45, lifeExpectancy: 90, annualExpensesNow: 120000, inflationRate: 0.03 },
    liquidAccounts: [
      { type: "brokerage", currentBalance: 500000, annualContribution: 30000, unrealizedCapitalGains: 150000, expectedReturn: 0.07 },
      { type: "rothIra",   currentBalance: 200000, annualContribution: 7000,  unrealizedCapitalGains: 0, expectedReturn: 0.07 },
      { type: "401k",      currentBalance: 800000, annualContribution: 23000, unrealizedCapitalGains: 0, expectedReturn: 0.07 },
    ],
    illiquidInvestments: [],
    realEstate: [
      {
        label: "Primary Residence",
        isPrimaryResidence: true,
        currentValue: 1200000,
        zipCode: "high-growth",
        annualAppreciation: 0.065,
        outstandingMortgage: 600000,
        mortgageRate: 0.07,
        monthlyPayment: 4500,
        remainingMonths: 300,
        annualRentalIncome: 0,
      },
    ],
    otherDebts: [],
    children: [],
    passiveIncome: [
      { label: "Social Security", annualAmount: 36000, startAge: 67, endAge: 90 },
    ],
    federalTaxRate: 0.24,
    capitalGainsTaxRate: 0.20,
  };
}

// ── Results panel ─────────────────────────────────────────────────────────────
function ResultsPanel({ scenarios, rec }: { scenarios: NetWorthBreakdown[]; rec: ReturnType<typeof recommendRetirementAge> }) {
  const barMax = Math.max(...scenarios.map(s => s.netNetWorth), 1);

  return (
    <div className="space-y-6">
      {/* recommendation banner */}
      <div className="bg-gradient-to-r from-blue-900/60 to-emerald-900/60 border border-blue-600 rounded-xl p-6">
        <h3 className="text-xl font-bold text-white mb-3">Retirement Age Recommendations</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { label: "Earliest Viable", age: rec.earliest, color: "text-yellow-400" },
            { label: "Comfortable", age: rec.comfortable, color: "text-blue-400" },
            { label: "Optimal / Cushioned", age: rec.optimal, color: "text-emerald-400" },
          ].map(r => (
            <div key={r.label} className="bg-slate-900/60 rounded-lg p-4">
              <div className={`text-4xl font-black ${r.color}`}>{r.age}</div>
              <div className="text-xs text-slate-400 mt-1">{r.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* net worth definition */}
      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 text-sm text-slate-400 space-y-2">
        <h4 className="text-white font-semibold">How We Define Net Worth</h4>
        <p><span className="text-slate-300">After-Tax Net Worth</span> = Brokerage (after long-term capital gains tax) + Roth IRA (tax-free) + 401k/Traditional IRA (after estimated income tax on withdrawals) + Illiquid Investments (at projected liquidation value) + Real Estate Equity (projected home value minus outstanding mortgage) + NPV of Passive Income Streams — Remaining Non-Mortgage Debt — PV of Future Education Costs.</p>
        <p className="text-slate-500">All values are projected to the target retirement age using compound growth. Real estate appreciated at regional historical rates. Inflation is applied to expense estimates. Sustainability uses the 4% safe withdrawal rule.</p>
      </div>

      {/* scenario table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="py-2 pr-4 font-medium">Retire at</th>
              <th className="py-2 pr-4 font-medium">Brokerage (AT)</th>
              <th className="py-2 pr-4 font-medium">Roth IRA</th>
              <th className="py-2 pr-4 font-medium">401k (AT)</th>
              <th className="py-2 pr-4 font-medium">Illiquid</th>
              <th className="py-2 pr-4 font-medium">RE Equity</th>
              <th className="py-2 pr-4 font-medium">Passive NPV</th>
              <th className="py-2 pr-4 font-medium">Liabilities</th>
              <th className="py-2 pr-4 font-medium text-white">Net Worth (AT)</th>
              <th className="py-2 font-medium">Sustainable?</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map(s => (
              <tr key={s.retirementAge} className="border-b border-slate-800 hover:bg-slate-800/40 transition-colors">
                <td className="py-3 pr-4 font-bold text-white">{s.retirementAge}</td>
                <td className="py-3 pr-4 text-slate-300">{fmt(s.brokerageAfterTax)}</td>
                <td className="py-3 pr-4 text-slate-300">{fmt(s.rothIra)}</td>
                <td className="py-3 pr-4 text-slate-300">{fmt(s.traditional401kAfterTax)}</td>
                <td className="py-3 pr-4 text-slate-300">{fmt(s.illiquidTotal)}</td>
                <td className="py-3 pr-4 text-slate-300">{fmt(s.realEstateEquity)}</td>
                <td className="py-3 pr-4 text-slate-300">{fmt(s.passiveIncomeNPV)}</td>
                <td className="py-3 pr-4 text-red-400">−{fmt(s.otherDebtsRemaining + s.educationCostsPV)}</td>
                <td className="py-3 pr-4 font-bold text-white">{fmt(s.netNetWorth)}</td>
                <td className="py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${s.isSustainable ? "bg-emerald-900 text-emerald-300" : "bg-red-900 text-red-300"}`}>
                    {s.isSustainable ? `✓ ${pct(s.sustainabilityRatio)} funded` : `✗ ${pct(s.sustainabilityRatio)} funded`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* bar chart */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-slate-400">After-Tax Net Worth by Retirement Age</h4>
        {scenarios.map(s => (
          <div key={s.retirementAge} className="flex items-center gap-3">
            <span className="w-10 text-right text-sm text-slate-400 shrink-0">{s.retirementAge}</span>
            <div className="flex-1 bg-slate-800 rounded-full h-6 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 flex items-center px-2 ${s.isSustainable ? "bg-emerald-600" : "bg-red-700"}`}
                style={{ width: `${Math.max(2, (s.netNetWorth / barMax) * 100)}%` }}
              >
                <span className="text-xs font-medium text-white truncate">{fmt(s.netNetWorth)}</span>
              </div>
            </div>
            <span className="w-24 text-xs text-slate-500 shrink-0">
              Need {fmt(s.requiredPortfolio4pct)}
            </span>
          </div>
        ))}
      </div>

      {/* expense breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {scenarios.filter((_, i) => [0, 2, 4, 6].includes(i)).map(s => (
          <div key={s.retirementAge} className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
            <div className="font-semibold text-white">Retire at {s.retirementAge}</div>
            <div className="flex justify-between text-slate-400">
              <span>Annual expenses (inflated)</span>
              <span className="text-white">{fmt(s.annualExpensesAtRetirement)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>4% rule portfolio needed</span>
              <span className="text-white">{fmt(s.requiredPortfolio4pct)}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>After-tax net worth</span>
              <span className={s.netNetWorth >= s.requiredPortfolio4pct ? "text-emerald-400" : "text-red-400"}>
                {fmt(s.netNetWorth)}
              </span>
            </div>
            <div className={`text-xs font-medium mt-1 ${s.isSustainable ? "text-emerald-400" : "text-red-400"}`}>
              {pct(s.sustainabilityRatio)} funded
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RetirementPlanner() {
  const [inputs, setInputs] = useState<RetirementInputs>(defaultInputs);
  const [showResults, setShowResults] = useState(false);

  const scenarios = useMemo(() => {
    try { return projectAllScenarios(inputs); } catch { return []; }
  }, [inputs]);

  const rec = useMemo(() => {
    if (scenarios.length === 0) return { earliest: 65, comfortable: 67, optimal: 70 };
    return recommendRetirementAge(scenarios);
  }, [scenarios]);

  // update helpers
  const setPersonal = (k: keyof RetirementInputs["personal"], v: number) =>
    setInputs(p => ({ ...p, personal: { ...p.personal, [k]: v } }));

  const setAccount = (i: number, patch: Partial<LiquidAccount>) =>
    setInputs(p => {
      const arr = [...p.liquidAccounts];
      arr[i] = { ...arr[i], ...patch };
      return { ...p, liquidAccounts: arr };
    });

  const addAccount = (type: LiquidAccount["type"]) =>
    setInputs(p => ({
      ...p,
      liquidAccounts: [...p.liquidAccounts, {
        type, currentBalance: 0, annualContribution: 0,
        unrealizedCapitalGains: 0, expectedReturn: DEFAULT_RETURNS[type],
      }],
    }));

  const removeAccount = (i: number) =>
    setInputs(p => ({ ...p, liquidAccounts: p.liquidAccounts.filter((_, j) => j !== i) }));

  const setIlliquid = (i: number, patch: Partial<IlliquidInvestment>) =>
    setInputs(p => {
      const arr = [...p.illiquidInvestments];
      arr[i] = { ...arr[i], ...patch };
      return { ...p, illiquidInvestments: arr };
    });

  const addIlliquid = (type: IlliquidInvestment["type"]) =>
    setInputs(p => ({
      ...p,
      illiquidInvestments: [...p.illiquidInvestments, {
        type, label: ILLIQUID_LABELS[type],
        currentValue: 0, expectedReturn: DEFAULT_RETURNS[type],
        expectedLiquidationAge: p.personal.currentAge + 10,
      }],
    }));

  const removeIlliquid = (i: number) =>
    setInputs(p => ({ ...p, illiquidInvestments: p.illiquidInvestments.filter((_, j) => j !== i) }));

  const setProp = (i: number, patch: Partial<RealEstateProperty>) =>
    setInputs(p => {
      const arr = [...p.realEstate];
      arr[i] = { ...arr[i], ...patch };
      if (patch.zipCode) arr[i].annualAppreciation = ZIP_APPRECIATION_MAP[patch.zipCode]?.rate ?? 0.04;
      return { ...p, realEstate: arr };
    });

  const addProperty = () =>
    setInputs(p => ({
      ...p,
      realEstate: [...p.realEstate, {
        label: "Property", isPrimaryResidence: false,
        currentValue: 0, zipCode: "mid-growth", annualAppreciation: 0.045,
        outstandingMortgage: 0, mortgageRate: 0.065, monthlyPayment: 0,
        remainingMonths: 360, annualRentalIncome: 0,
      }],
    }));

  const removeProperty = (i: number) =>
    setInputs(p => ({ ...p, realEstate: p.realEstate.filter((_, j) => j !== i) }));

  const setDebt = (i: number, patch: Partial<Debt>) =>
    setInputs(p => {
      const arr = [...p.otherDebts];
      arr[i] = { ...arr[i], ...patch };
      return { ...p, otherDebts: arr };
    });

  const addDebt = () =>
    setInputs(p => ({
      ...p,
      otherDebts: [...p.otherDebts, {
        label: "Debt", balance: 0, interestRate: 0.08,
        monthlyPayment: 0, remainingMonths: 60,
      }],
    }));

  const removeDebt = (i: number) =>
    setInputs(p => ({ ...p, otherDebts: p.otherDebts.filter((_, j) => j !== i) }));

  const setChild = (i: number, patch: Partial<Child>) =>
    setInputs(p => {
      const arr = [...p.children];
      arr[i] = { ...arr[i], ...patch };
      return { ...p, children: arr };
    });

  const addChild = () =>
    setInputs(p => ({
      ...p,
      children: [...p.children, {
        currentAge: 5, estimatedAnnualEducationCost: 55000,
        yearsOfEducation: 4, collegeStartAge: 18,
      }],
    }));

  const removeChild = (i: number) =>
    setInputs(p => ({ ...p, children: p.children.filter((_, j) => j !== i) }));

  const setPassive = (i: number, patch: Partial<PassiveIncome>) =>
    setInputs(p => {
      const arr = [...p.passiveIncome];
      arr[i] = { ...arr[i], ...patch };
      return { ...p, passiveIncome: arr };
    });

  const addPassive = () =>
    setInputs(p => ({
      ...p,
      passiveIncome: [...p.passiveIncome, {
        label: "Passive Income", annualAmount: 0,
        startAge: p.personal.currentAge + 20, endAge: p.personal.lifeExpectancy,
      }],
    }));

  const removePassive = (i: number) =>
    setInputs(p => ({ ...p, passiveIncome: p.passiveIncome.filter((_, j) => j !== i) }));

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* header */}
      <div className="bg-slate-950 border-b border-slate-800 px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Retirement Planner</h1>
            <p className="text-sm text-slate-400 mt-0.5">Detailed projection across investments, real estate, and family expenses</p>
          </div>
          <button
            onClick={() => setShowResults(v => !v)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors"
          >
            {showResults ? "Edit Inputs" : "Calculate"}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {showResults ? (
          <ResultsPanel scenarios={scenarios} rec={rec} />
        ) : (
          <>
            {/* ── Personal ── */}
            <Section title="Personal Information">
              <Grid>
                {numInput("Current Age", inputs.personal.currentAge, v => setPersonal("currentAge", v), { min: 18, max: 100 })}
                {numInput("Life Expectancy", inputs.personal.lifeExpectancy, v => setPersonal("lifeExpectancy", v), { min: 50, max: 110, hint: "Used to size passive income NPV" })}
                {numInput("Annual Expenses Today", inputs.personal.annualExpensesNow, v => setPersonal("annualExpensesNow", v), { prefix: "$", hint: "Total household spending per year" })}
                {numInput("Inflation Rate", inputs.personal.inflationRate * 100, v => setPersonal("inflationRate", v / 100), { suffix: "%", step: 0.1, min: 0, max: 20, hint: "Default 3%" })}
                {numInput("Federal Income Tax Rate", inputs.federalTaxRate * 100, v => setInputs(p => ({ ...p, federalTaxRate: v / 100 })), { suffix: "%", step: 1, min: 0, max: 50, hint: "Applied to 401k/trad IRA withdrawals" })}
                {numInput("Long-Term Capital Gains Rate", inputs.capitalGainsTaxRate * 100, v => setInputs(p => ({ ...p, capitalGainsTaxRate: v / 100 })), { suffix: "%", step: 1, min: 0, max: 40, hint: "Applied to brokerage gains" })}
              </Grid>
            </Section>

            {/* ── Liquid Accounts ── */}
            <Section title="Investment Accounts — Liquid">
              <p className="text-xs text-slate-500">Brokerage, Roth IRA, and 401k / Traditional IRA. Contributions stop at retirement.</p>
              {inputs.liquidAccounts.map((acct, i) => (
                <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200">
                      {acct.type === "brokerage" ? "Taxable Brokerage"
                        : acct.type === "rothIra" ? "Roth IRA"
                        : "401k / Traditional IRA"}
                    </span>
                    <RemoveButton onClick={() => removeAccount(i)} />
                  </div>
                  <Grid>
                    {numInput("Current Balance", acct.currentBalance, v => setAccount(i, { currentBalance: v }), { prefix: "$" })}
                    {numInput("Annual Contribution", acct.annualContribution, v => setAccount(i, { annualContribution: v }), { prefix: "$", hint: "Including employer match" })}
                    {numInput("Expected Annual Return", acct.expectedReturn * 100, v => setAccount(i, { expectedReturn: v / 100 }), { suffix: "%", step: 0.1, min: 0, max: 30 })}
                    {acct.type === "brokerage" && numInput(
                      "Unrealized Capital Gains",
                      acct.unrealizedCapitalGains,
                      v => setAccount(i, { unrealizedCapitalGains: v }),
                      { prefix: "$", hint: "Embedded gains in current balance" }
                    )}
                  </Grid>
                </div>
              ))}
              <div className="flex gap-3 flex-wrap">
                <AddButton onClick={() => addAccount("brokerage")} label="Add Brokerage Account" />
                <AddButton onClick={() => addAccount("rothIra")} label="Add Roth IRA" />
                <AddButton onClick={() => addAccount("401k")} label="Add 401k / Trad IRA" />
              </div>
            </Section>

            {/* ── Illiquid ── */}
            <Section title="Illiquid / Alternative Investments">
              <p className="text-xs text-slate-500">Private equity, venture capital, credit funds, hedge funds, etc. Returns shown are illustrative historical averages — adjust to your actual fund expectations.</p>
              {inputs.illiquidInvestments.map((inv, i) => (
                <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      className="bg-transparent border-b border-slate-600 text-white font-medium text-sm focus:outline-none focus:border-blue-500 flex-1"
                      value={inv.label}
                      onChange={e => setIlliquid(i, { label: e.target.value })}
                    />
                    <span className="text-xs text-slate-500">{ILLIQUID_LABELS[inv.type]}</span>
                    <RemoveButton onClick={() => removeIlliquid(i)} />
                  </div>
                  <Grid>
                    {numInput("Current / NAV Value", inv.currentValue, v => setIlliquid(i, { currentValue: v }), { prefix: "$" })}
                    {numInput("Expected Annual Return (Net)", inv.expectedReturn * 100, v => setIlliquid(i, { expectedReturn: v / 100 }), { suffix: "%", step: 0.1, hint: "Net of fees" })}
                    {numInput("Expected Liquidation Age", inv.expectedLiquidationAge, v => setIlliquid(i, { expectedLiquidationAge: v }), { hint: "Age at which you expect to receive proceeds" })}
                  </Grid>
                </div>
              ))}
              <div className="flex gap-3 flex-wrap">
                {ILLIQUID_TYPES.map(t => (
                  <AddButton key={t} onClick={() => addIlliquid(t)} label={`Add ${ILLIQUID_LABELS[t]}`} />
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs text-slate-500">
                {Object.entries(DEFAULT_RETURNS).filter(([k]) => ILLIQUID_TYPES.includes(k as IlliquidInvestment["type"])).map(([k, v]) => (
                  <div key={k} className="bg-slate-800 rounded px-2 py-1">
                    <span className="text-slate-400">{ILLIQUID_LABELS[k as IlliquidInvestment["type"]]}</span>
                    <span className="ml-1 text-slate-300">default {pct(v)}</span>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Real Estate ── */}
            <Section title="Real Estate Holdings">
              <p className="text-xs text-slate-500">Appreciation rates are estimated from historical regional averages. Adjust to your specific market. Outstanding mortgage is tracked through payoff schedule.</p>
              {inputs.realEstate.map((prop, i) => (
                <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      className="bg-transparent border-b border-slate-600 text-white font-medium text-sm focus:outline-none focus:border-blue-500 flex-1"
                      value={prop.label}
                      onChange={e => setProp(i, { label: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-xs text-slate-400">
                      <input type="checkbox" checked={prop.isPrimaryResidence} onChange={e => setProp(i, { isPrimaryResidence: e.target.checked })} />
                      Primary Residence
                    </label>
                    <RemoveButton onClick={() => removeProperty(i)} />
                  </div>
                  <Grid>
                    {numInput("Current Market Value", prop.currentValue, v => setProp(i, { currentValue: v }), { prefix: "$" })}
                    {numInput("Outstanding Mortgage", prop.outstandingMortgage, v => setProp(i, { outstandingMortgage: v }), { prefix: "$" })}
                    {numInput("Mortgage Interest Rate", prop.mortgageRate * 100, v => setProp(i, { mortgageRate: v / 100 }), { suffix: "%", step: 0.05 })}
                    {numInput("Monthly Payment (P+I)", prop.monthlyPayment, v => setProp(i, { monthlyPayment: v }), { prefix: "$" })}
                    {numInput("Remaining Months on Mortgage", prop.remainingMonths, v => setProp(i, { remainingMonths: v }), { hint: "0 if paid off" })}
                    {!prop.isPrimaryResidence && numInput("Annual Rental Income", prop.annualRentalIncome, v => setProp(i, { annualRentalIncome: v }), { prefix: "$" })}
                  </Grid>
                  <div className="flex flex-col gap-1">
                    <label className="text-sm font-medium text-slate-300">
                      Market Region / Appreciation
                      <span className="ml-2 text-xs text-slate-500">Select your market tier — appreciation is baked in</span>
                    </label>
                    <select
                      value={prop.zipCode}
                      onChange={e => setProp(i, { zipCode: e.target.value })}
                      className="bg-slate-800 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                    >
                      {Object.entries(ZIP_APPRECIATION_MAP).map(([key, val]) => (
                        <option key={key} value={key}>{val.label} — {pct(val.rate)}/yr historical</option>
                      ))}
                    </select>
                  </div>
                  <div className="text-xs text-slate-500">
                    At the selected rate of {pct(prop.annualAppreciation)}/yr, this property is projected to be worth{" "}
                    <span className="text-slate-300">
                      {scenarios[0] ? fmt(prop.currentValue * Math.pow(1 + prop.annualAppreciation, scenarios[0].yearsFromNow + (scenarios[scenarios.length - 1]?.yearsFromNow ?? 25) - scenarios[0].yearsFromNow)) : "—"}
                    </span>{" "}
                    in {(scenarios[scenarios.length - 1]?.yearsFromNow ?? 25)} years.
                  </div>
                </div>
              ))}
              <AddButton onClick={addProperty} label="Add Property" />
            </Section>

            {/* ── Other Debt ── */}
            <Section title="Outstanding Debt (Non-Mortgage)">
              <p className="text-xs text-slate-500">Student loans, auto loans, credit card balances, personal loans, etc.</p>
              {inputs.otherDebts.map((debt, i) => (
                <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      className="bg-transparent border-b border-slate-600 text-white font-medium text-sm focus:outline-none focus:border-blue-500 flex-1"
                      value={debt.label}
                      onChange={e => setDebt(i, { label: e.target.value })}
                    />
                    <RemoveButton onClick={() => removeDebt(i)} />
                  </div>
                  <Grid>
                    {numInput("Current Balance", debt.balance, v => setDebt(i, { balance: v }), { prefix: "$" })}
                    {numInput("Interest Rate", debt.interestRate * 100, v => setDebt(i, { interestRate: v / 100 }), { suffix: "%", step: 0.1 })}
                    {numInput("Monthly Payment", debt.monthlyPayment, v => setDebt(i, { monthlyPayment: v }), { prefix: "$" })}
                    {numInput("Remaining Months", debt.remainingMonths, v => setDebt(i, { remainingMonths: v }))}
                  </Grid>
                </div>
              ))}
              <AddButton onClick={addDebt} label="Add Debt" />
            </Section>

            {/* ── Children ── */}
            <Section title="Children & Education">
              <p className="text-xs text-slate-500">Education costs paid before your retirement reduce investable savings; costs after retirement are counted as liabilities. Default assumes $55K/yr private university.</p>
              {inputs.children.map((child, i) => (
                <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-200">Child {i + 1}</span>
                    <RemoveButton onClick={() => removeChild(i)} />
                  </div>
                  <Grid>
                    {numInput("Current Age", child.currentAge, v => setChild(i, { currentAge: v }), { min: 0, max: 30 })}
                    {numInput("College Start Age", child.collegeStartAge, v => setChild(i, { collegeStartAge: v }), { min: 16, max: 25 })}
                    {numInput("Years of Education", child.yearsOfEducation, v => setChild(i, { yearsOfEducation: v }), { min: 0, max: 10 })}
                    {numInput("Annual Cost (tuition + room + board)", child.estimatedAnnualEducationCost, v => setChild(i, { estimatedAnnualEducationCost: v }), { prefix: "$", hint: "All-in cost per year" })}
                  </Grid>
                  <div className="text-xs text-slate-500">
                    Total estimated education cost: <span className="text-slate-300">{fmt(child.estimatedAnnualEducationCost * child.yearsOfEducation)}</span>
                    {" "}starting in{" "}
                    <span className="text-slate-300">{child.collegeStartAge - child.currentAge} years</span>.
                  </div>
                </div>
              ))}
              <AddButton onClick={addChild} label="Add Child" />
            </Section>

            {/* ── Passive Income ── */}
            <Section title="Passive Income Streams">
              <p className="text-xs text-slate-500">Social Security, pensions, rental income, royalties, annuities, etc. No active employment income is assumed. All values are included in net worth as NPV.</p>
              {inputs.passiveIncome.map((stream, i) => (
                <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <input
                      className="bg-transparent border-b border-slate-600 text-white font-medium text-sm focus:outline-none focus:border-blue-500 flex-1"
                      value={stream.label}
                      onChange={e => setPassive(i, { label: e.target.value })}
                    />
                    <RemoveButton onClick={() => removePassive(i)} />
                  </div>
                  <Grid>
                    {numInput("Annual Amount (today's dollars)", stream.annualAmount, v => setPassive(i, { annualAmount: v }), { prefix: "$" })}
                    {numInput("Starts at Age", stream.startAge, v => setPassive(i, { startAge: v }))}
                    {numInput("Ends at Age", stream.endAge, v => setPassive(i, { endAge: v }))}
                  </Grid>
                </div>
              ))}
              <AddButton onClick={addPassive} label="Add Income Stream" />
            </Section>

            <div className="flex justify-center pt-2">
              <button
                onClick={() => setShowResults(true)}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-10 py-3 rounded-xl text-lg transition-colors"
              >
                Calculate My Retirement Scenarios →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
