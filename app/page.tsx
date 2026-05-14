"use client";

import { useState, useEffect } from "react";

type Variable = "c1" | "v1" | "c2" | "v2";
type ConcUnit = "M" | "mM";
type VolUnit = "L" | "µL" | "mL";
type InputUnit = ConcUnit | VolUnit;

const VAR_META: Record<Variable, { label: string; sub: string; isConc: boolean }> = {
  c1: { label: "C", sub: "1", isConc: true },
  v1: { label: "V", sub: "1", isConc: false },
  c2: { label: "C", sub: "2", isConc: true },
  v2: { label: "V", sub: "2", isConc: false },
};

function toSI(val: number, unit: InputUnit): number {
  if (unit === "mM" || unit === "mL") return val / 1000;
  if (unit === "µL") return val / 1_000_000;
  return val;
}

function solve(siValues: Record<Variable, number | null>, unknown: Variable): number | null {
  const { c1, v1, c2, v2 } = siValues;
  switch (unknown) {
    case "c1": return c2 !== null && v2 !== null && v1 !== null && v1 !== 0 ? (c2 * v2) / v1 : null;
    case "v1": return c1 !== null && c2 !== null && v2 !== null && c1 !== 0 ? (c2 * v2) / c1 : null;
    case "c2": return c1 !== null && v1 !== null && v2 !== null && v2 !== 0 ? (c1 * v1) / v2 : null;
    case "v2": return c1 !== null && v1 !== null && c2 !== null && c2 !== 0 ? (c1 * v1) / c2 : null;
  }
}

function fmt(val: number): string {
  if (val === 0) return "0";
  if (Math.abs(val) < 1e-4 || Math.abs(val) >= 1e7) return val.toExponential(4);
  return parseFloat(val.toFixed(6)).toString();
}

const VARS: Variable[] = ["c1", "v1", "c2", "v2"];
const DEFAULT_INPUT_UNITS: Record<Variable, InputUnit> = { c1: "mM", v1: "mL", c2: "mM", v2: "mL" };

export default function Home() {
  const [unknown, setUnknown] = useState<Variable>("c1");
  const [inputs, setInputs] = useState<Record<Variable, string>>({ c1: "", v1: "", c2: "", v2: "" });
  const [inputUnits, setInputUnits] = useState<Record<Variable, InputUnit>>(DEFAULT_INPUT_UNITS);
  const [resultConcUnit, setResultConcUnit] = useState<ConcUnit>("mM");
  const [resultVolUnit, setResultVolUnit] = useState<VolUnit>("mL");
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState("");

  const unknownIsConc = VAR_META[unknown].isConc;

  const handleUnknown = (v: Variable) => {
    setUnknown(v);
    setInputs(p => ({ ...p, [v]: "" }));
    setResult(null);
    setError("");
  };

  const handleInput = (v: Variable, val: string) => {
    if (val === "" || /^[0-9]*\.?[0-9]*([eE][+-]?[0-9]*)?$/.test(val)) {
      setInputs(p => ({ ...p, [v]: val }));
    }
  };

  const setInputUnit = (v: Variable, unit: InputUnit) => {
    setInputUnits(p => ({ ...p, [v]: unit }));
  };

  useEffect(() => {
    const knownVars = VARS.filter(v => v !== unknown);
    const allFilled = knownVars.every(v => inputs[v] !== "");
    if (!allFilled) { setResult(null); setError(""); return; }

    const siValues: Record<Variable, number | null> = { c1: null, v1: null, c2: null, v2: null };
    for (const v of knownVars) {
      const n = parseFloat(inputs[v]);
      if (isNaN(n)) { setResult(null); setError(""); return; }
      siValues[v] = toSI(n, inputUnits[v]);
    }

    const res = solve(siValues, unknown);
    if (res === null) { setError("Cannot solve — check for zero denominators."); setResult(null); }
    else if (res < 0) { setError("Negative result — check your inputs."); setResult(null); }
    else { setError(""); setResult(res); }
  }, [inputs, unknown, inputUnits]);

  const displayResult = () => {
    if (result === null) return { val: "—", unit: "", alt: "" };
    if (unknownIsConc) {
      return resultConcUnit === "mM"
        ? { val: fmt(result * 1000), unit: "mM", alt: `= ${fmt(result)} M` }
        : { val: fmt(result), unit: "M", alt: `= ${fmt(result * 1000)} mM` };
    } else {
      if (resultVolUnit === "mL") return { val: fmt(result * 1000), unit: "mL", alt: `= ${fmt(result)} L  /  = ${fmt(result * 1_000_000)} µL` };
      if (resultVolUnit === "µL") return { val: fmt(result * 1_000_000), unit: "µL", alt: `= ${fmt(result)} L  /  = ${fmt(result * 1000)} mL` };
      return { val: fmt(result), unit: "L", alt: `= ${fmt(result * 1000)} mL  /  = ${fmt(result * 1_000_000)} µL` };
    }
  };

  const { val, unit, alt } = displayResult();

  return (
    <main style={{ zoom: 0.92 }} className="min-h-screen bg-[#000000] text-[#f0eee8] flex flex-col items-center justify-center py-8 px-10 font-mono">
      <div className="mb-14 text-center select-none">
        <h1 className="text-7xl font-bold tracking-widest text-[#fe019a] mb-3">
          C<sub className="text-4xl">1</sub>V<sub className="text-4xl">1</sub>
          <span className="text-[#666c7a] mx-5">=</span>
          C<sub className="text-4xl">2</sub>V<sub className="text-4xl">2</sub>
        </h1>
        <p className="text-sm text-[#8891a4] tracking-[0.3em] uppercase">Analise's Personal Calculator</p>
        <p className="text-xs text-[#4a5060] tracking-[0.3em] uppercase mt-1">(for VERY difficult calculations)</p>
      </div>

      <div className="w-full max-w-2xl space-y-8">
        {/* Solve for */}
        <div>
          <p className="text-sm text-[#8891a4] tracking-widest uppercase mb-3">Solve for</p>
          <div className="grid grid-cols-4 gap-3">
            {VARS.map(v => (
              <button
                key={v}
                onClick={() => handleUnknown(v)}
                className={`py-5 rounded-lg text-xl font-bold tracking-wide transition-all border-2 ${
                  unknown === v
                    ? "bg-[#fe019a] text-[#0d0f14] border-[#63083a]"
                    : "bg-transparent text-[#9aa0ae] border-[#3a3f4d] hover:border-[#63083a]/50 hover:text-[#f0eee8]"
                }`}
              >
                {VAR_META[v].label}<sub className="text-sm">{VAR_META[v].sub}</sub>
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="space-y-3">
          {VARS.map(v => {
            const { label, sub, isConc } = VAR_META[v];
            const isUnk = v === unknown;
            const curUnit = inputUnits[v];
            const concUnits: ConcUnit[] = ["mM", "M"];
            const volUnits: VolUnit[] = ["mL", "L", "µL"];
            const unitOptions = isConc ? concUnits : volUnits;

            return (
              <div key={v} className={`flex items-center rounded-lg border-2 transition-colors ${
                isUnk ? "border-[#fe019a]/25 bg-[#fe019a]/5" : "border-[#3a3f4d] bg-[#13161e]"
              }`}>
                <span className={`w-20 text-center text-xl font-bold shrink-0 py-5 border-r-2 ${
                  isUnk ? "text-[#fe019a] border-[#fe019a]/25" : "text-[#9aa0ae] border-[#3a3f4d]"
                }`}>
                  {label}<sub className="text-sm">{sub}</sub>
                </span>

                <input
                  type="text"
                  inputMode="decimal"
                  disabled={isUnk || undefined}
                  value={isUnk ? "" : inputs[v]}
                  onChange={e => handleInput(v, e.target.value)}
                  placeholder={isUnk ? "unknown" : "0.000"}
                  className={`flex-1 bg-transparent px-6 py-5 text-xl outline-none placeholder:text-[#4a5060] min-w-0 ${
                    isUnk ? "cursor-not-allowed text-[#fe019a]/30" : "text-[#f0eee8]"
                  }`}
                />

                {/* Inline unit button group */}
                <div className={`shrink-0 mr-3 flex gap-1 ${isUnk ? "invisible" : ""}`}>
                  {(unitOptions as InputUnit[]).map(u => (
                    <button
                      key={u}
                      onClick={() => setInputUnit(v, u)}
                      disabled={isUnk || undefined}
                      className={`px-3 py-2 rounded-lg text-sm font-bold tracking-wide border-2 transition-all ${
                        curUnit === u
                          ? "border-[#fe019a]/60 text-[#fe019a] bg-[#fe019a]/10"
                          : "border-[#3a3f4d] text-[#9aa0ae] hover:border-[#fe019a]/30 hover:text-[#f0eee8]"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Result */}
        <div className="rounded-lg border-2 border-[#3a3f4d] bg-[#13161e] overflow-hidden">
          <div className="flex items-center justify-between px-6 py-3 border-b-2 border-[#3a3f4d]">
            <span className="text-sm text-[#8891a4] tracking-widest uppercase">Result</span>
            <div className="flex gap-2">
              {unknownIsConc
                ? (["mM", "M"] as const).map(u => (
                    <button key={u} onClick={() => setResultConcUnit(u)}
                      className={`text-base px-4 py-1 rounded-lg transition-all font-bold ${
                        resultConcUnit === u ? "bg-[#fe019a] text-[#0d0f14]" : "text-[#9aa0ae] hover:text-[#f0eee8]"
                      }`}>{u}</button>
                  ))
                : (["mL", "L", "µL"] as const).map(u => (
                    <button key={u} onClick={() => setResultVolUnit(u)}
                      className={`text-base px-4 py-1 rounded-lg transition-all font-bold ${
                        resultVolUnit === u ? "bg-[#fe019a] text-[#0d0f14]" : "text-[#9aa0ae] hover:text-[#f0eee8]"
                      }`}>{u}</button>
                  ))
              }
            </div>
          </div>
          <div className="px-6 pt-6 pb-3 flex items-baseline gap-4">
            {error
              ? <span className="text-[#ff6b6b] text-xl">{error}</span>
              : <>
                  <span className={`text-6xl font-bold tracking-tight ${result !== null ? "text-[#fe019a]" : "text-[#3a3f4d]"}`}>{val}</span>
                  {result !== null && <span className="text-2xl text-[#9aa0ae]">{unit}</span>}
                </>
            }
          </div>
          {result !== null && !error && (
            <p className="px-6 pb-5 text-base text-[#6b7280]">{alt}</p>
          )}
        </div>
      </div>
    </main>
  );
}