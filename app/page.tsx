"use client";

import { useState, useEffect, useRef } from "react";

type Variable = "c1" | "v1" | "c2" | "v2";
type ConcUnit = "M" | "mM";
type VolUnit = "L" | "mL" | "µL";
type InputUnit = ConcUnit | VolUnit;

interface HistoryEntry {
  id: number;
  inputs: Record<Variable, string>;
  inputUnits: Record<Variable, InputUnit>;
  unknown: Variable;
  result: number;
  resultUnit: ConcUnit | VolUnit;
  timestamp: Date;
  note: string;
}

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

function fromSI(val: number, unit: ConcUnit | VolUnit): number {
  if (unit === "mM" || unit === "mL") return val * 1000;
  if (unit === "µL") return val * 1_000_000;
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

const SUPER_MAP: Record<string, string> = {
  "0":"⁰","1":"¹","2":"²","3":"³","4":"⁴","5":"⁵","6":"⁶","7":"⁷","8":"⁸","9":"⁹",
  "+":"⁺","-":"⁻","=":"⁼","(":"⁽",")":"⁾",
  "a":"ᵃ","b":"ᵇ","c":"ᶜ","d":"ᵈ","e":"ᵉ","f":"ᶠ","g":"ᵍ","h":"ʰ","i":"ⁱ","j":"ʲ",
  "k":"ᵏ","l":"ˡ","m":"ᵐ","n":"ⁿ","o":"ᵒ","p":"ᵖ","r":"ʳ","s":"ˢ","t":"ᵗ","u":"ᵘ",
  "v":"ᵛ","w":"ʷ","x":"ˣ","y":"ʸ","z":"ᶻ",
  "A":"ᴬ","B":"ᴮ","D":"ᴰ","E":"ᴱ","G":"ᴳ","H":"ᴴ","I":"ᴵ","J":"ᴶ","K":"ᴷ","L":"ᴸ",
  "M":"ᴹ","N":"ᴺ","O":"ᴼ","P":"ᴾ","R":"ᴿ","T":"ᵀ","U":"ᵁ","V":"ⱽ","W":"ᵂ",
};

const SUB_MAP: Record<string, string> = {
  "0":"₀","1":"₁","2":"₂","3":"₃","4":"₄","5":"₅","6":"₆","7":"₇","8":"₈","9":"₉",
  "+":"₊","-":"₋","=":"₌","(":"₍",")":"₎",
  "a":"ₐ","e":"ₑ","h":"ₕ","i":"ᵢ","j":"ⱼ","k":"ₖ","l":"ₗ","m":"ₘ","n":"ₙ","o":"ₒ",
  "p":"ₚ","r":"ᵣ","s":"ₛ","t":"ₜ","u":"ᵤ","v":"ᵥ","x":"ₓ",
};

function applyTransform(ch: string, mode: "super" | "sub" | null): string {
  if (mode === "super") return SUPER_MAP[ch] ?? ch;
  if (mode === "sub") return SUB_MAP[ch] ?? ch;
  return ch;
}

function calcKey(inputs: Record<Variable, string>, inputUnits: Record<Variable, InputUnit>, unknown: Variable, result: number, resultUnit: ConcUnit | VolUnit): string {
  const known = VARS.filter(v => v !== unknown).map(v => `${v}:${inputs[v]}${inputUnits[v]}`).join(",");
  return `${unknown}|${known}|${fmt(result)}${resultUnit}`;
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
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [nextId, setNextId] = useState(1);
  const [pendingNote, setPendingNote] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [noteTransform, setNoteTransform] = useState<"super" | "sub" | null>(null);
  const editingNoteInputRef = useRef<HTMLInputElement | null>(null);

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

  const currentResultUnit = unknownIsConc ? resultConcUnit : resultVolUnit;

  const isDuplicate = result !== null && history.some(e =>
    calcKey(e.inputs, e.inputUnits, e.unknown, e.result, e.resultUnit) ===
    calcKey(inputs, inputUnits, unknown, result, currentResultUnit)
  );

  const saveToHistory = () => {
    if (result === null || isDuplicate) return;
    const entry: HistoryEntry = {
      id: nextId,
      inputs: { ...inputs },
      inputUnits: { ...inputUnits },
      unknown,
      result,
      resultUnit: currentResultUnit,
      timestamp: new Date(),
      note: pendingNote.trim(),
    };
    setHistory(p => [entry, ...p].slice(0, 20));
    setNextId(n => n + 1);
    setPendingNote("");
  };

  const loadFromHistory = (entry: HistoryEntry) => {
    setUnknown(entry.unknown);
    setInputs({ ...entry.inputs });
    setInputUnits({ ...entry.inputUnits });
    if (VAR_META[entry.unknown].isConc) setResultConcUnit(entry.resultUnit as ConcUnit);
    else setResultVolUnit(entry.resultUnit as VolUnit);
  };

  const confirmDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(id);
  };

  const doDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistory(p => p.filter(entry => entry.id !== id));
    if (editingNoteId === id) setEditingNoteId(null);
    setConfirmDeleteId(null);
  };

  const cancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  const startEditNote = (id: number, note: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(id);
    setEditingNoteText(note);
  };

  const saveNote = (id: number) => {
    setHistory(p => p.map(e => e.id === id ? { ...e, note: editingNoteText.trim() } : e));
    setEditingNoteId(null);
    setNoteTransform(null);
  };

  const insertAtCursor = (char: string) => {
    const input = editingNoteInputRef.current;
    const curPos = input ? (input.selectionStart ?? editingNoteText.length) : editingNoteText.length;
    const endPos = input ? (input.selectionEnd ?? editingNoteText.length) : editingNoteText.length;
    const newText = editingNoteText.slice(0, curPos) + char + editingNoteText.slice(endPos);
    const newCurPos = curPos + char.length;
    setEditingNoteText(newText);
    if (input) {
      requestAnimationFrame(() => {
        if (editingNoteInputRef.current) {
          editingNoteInputRef.current.focus();
          editingNoteInputRef.current.setSelectionRange(newCurPos, newCurPos);
        }
      });
    }
  };

  const insertIntoNote = (entryId: number, char: string) => {
    if (editingNoteId !== entryId) {
      const entry = history.find(e => e.id === entryId);
      if (entry) {
        setEditingNoteId(entryId);
        setEditingNoteText((entry.note || "") + char);
      }
    } else {
      insertAtCursor(char);
    }
  };

  const handleNoteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, entryId: number) => {
    if (e.key === "Enter") { saveNote(entryId); return; }
    if (e.key === "Escape") {
      if (noteTransform) { setNoteTransform(null); return; }
      setEditingNoteId(null);
      return;
    }
    if (noteTransform && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      insertAtCursor(applyTransform(e.key, noteTransform));
    }
  };

  useEffect(() => {
    const close = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-note-ui]")) return;
      setNoteTransform(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const formatHistoryEntry = (entry: HistoryEntry) => {
    const knownParts = VARS.filter(v => v !== entry.unknown).map(v => {
      const { label, sub } = VAR_META[v];
      return `${label}${sub} = ${entry.inputs[v]} ${entry.inputUnits[v]}`;
    });
    const { label, sub } = VAR_META[entry.unknown];
    const displayVal = fmt(fromSI(entry.result, entry.resultUnit));
    return { knownParts, resultStr: `${label}${sub} = ${displayVal} ${entry.resultUnit}` };
  };

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
    <main style={{ zoom: 0.92 }} className="min-h-screen bg-[#000000] text-[#f0eee8] flex flex-col items-center py-8 px-10 font-mono">
      <div className="mb-14 text-center select-none mt-8">
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
            const volUnits: VolUnit[] = ["µL", "mL", "L"];
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
                : (["µL", "mL", "L"] as const).map(u => (
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
            <p className="px-6 pb-3 text-base text-[#6b7280]">{alt}</p>
          )}
          {result !== null && !error && (
            <div className="px-6 pb-5 space-y-3">
              <input
                type="text"
                value={pendingNote}
                onChange={e => setPendingNote(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveToHistory(); }}
                placeholder="Add a note (optional)..."
                className="w-full bg-transparent border-2 border-[#2a2e3a] rounded-lg px-4 py-2 text-sm text-[#f0eee8] placeholder:text-[#3a3f4d] outline-none focus:border-[#fe019a]/30 transition-colors"
              />
              <div className="flex items-center gap-3">
                <button
                  onClick={saveToHistory}
                  disabled={isDuplicate}
                  className={`text-sm px-4 py-2 rounded-lg border-2 transition-all ${
                    isDuplicate
                      ? "border-[#2a2e3a] text-[#3a3f4d] cursor-not-allowed"
                      : "border-[#3a3f4d] text-[#9aa0ae] hover:border-[#fe019a]/40 hover:text-[#fe019a]"
                  }`}
                >
                  + Save to history
                </button>
                {isDuplicate && <span className="text-xs text-[#4a5060]">Already saved</span>}
              </div>
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-3 pt-4 border-t-2 border-[#1e2130]">
            <div className="flex items-center justify-between">
              <p className="text-sm text-[#8891a4] tracking-widest uppercase">Recent Calculations</p>
              <button onClick={() => setHistory([])} className="text-xs text-[#4a5060] hover:text-[#ff6b6b] transition-colors">
                Clear all
              </button>
            </div>
            <div className="space-y-2">
              {history.map(entry => {
                const { knownParts, resultStr } = formatHistoryEntry(entry);
                const isEditingNote = editingNoteId === entry.id;
                return (
                  <div key={entry.id} className="relative">
                    {confirmDeleteId === entry.id ? (
                      /* Confirmation prompt — replaces entry content */
                      <div className="rounded-lg border-2 border-[#ff6b6b]/40 bg-[#0d0f14] px-6 py-5 flex items-center justify-between gap-4">
                        <p className="text-sm text-[#f0eee8]">Delete this entry?</p>
                        <div className="flex gap-3 shrink-0">
                          <button
                            onClick={e => doDelete(entry.id, e)}
                            className="text-sm px-4 py-1.5 rounded-lg border-2 border-[#ff6b6b]/50 text-[#ff6b6b] hover:bg-[#ff6b6b]/10 transition-all font-bold"
                          >
                            Delete
                          </button>
                          <button
                            onClick={cancelDelete}
                            className="text-sm px-4 py-1.5 rounded-lg border-2 border-[#3a3f4d] text-[#9aa0ae] hover:text-[#f0eee8] transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => loadFromHistory(entry)}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              loadFromHistory(entry);
                            }
                          }}
                          className="w-full text-left rounded-lg border-2 border-[#2a2e3a] bg-[#0d0f14] px-6 py-5 hover:border-[#fe019a]/30 hover:bg-[#fe019a]/5 transition-all cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-4 pr-10">
                            <div className="space-y-2 min-w-0 w-full">
                              <p className="text-2xl text-[#fe019a] font-bold truncate">{resultStr}</p>
                              <p className="text-sm text-[#555b6e] truncate">{knownParts.join("  ·  ")}</p>
                              <div className="mt-1 flex items-start gap-1.5" onClick={e => e.stopPropagation()}>
                                <div className="flex-1 min-w-0">
                                  {!isEditingNote && (
                                    <p
                                      onClick={e => startEditNote(entry.id, entry.note, e)}
                                      className={`text-md cursor-text transition-colors ${
                                        entry.note
                                          ? "text-[#8891a4] hover:text-[#f0eee8]"
                                          : "text-[#3a3f4d] hover:text-[#555b6e]"
                                      }`}
                                    >
                                      {entry.note || "Click to add a note..."}
                                    </p>
                                  )}
                                  {isEditingNote && (
                                    <div className="space-y-1.5">
                                      <div className="flex gap-2 items-center">
                                        <input
                                          ref={el => { editingNoteInputRef.current = el; }}
                                          data-note-ui
                                          autoFocus
                                          type="text"
                                          value={editingNoteText}
                                          onChange={e => setEditingNoteText(e.target.value)}
                                          onKeyDown={e => handleNoteKeyDown(e, entry.id)}
                                          className={`flex-1 bg-transparent border-b text-sm text-[#f0eee8] outline-none placeholder:text-[#3a3f4d] pb-0.5 transition-colors ${
                                            noteTransform ? "border-[#fe019a]" : "border-[#fe019a]/30"
                                          }`}
                                          placeholder={
                                            noteTransform === "super" ? "Typing as superscript..."
                                            : noteTransform === "sub" ? "Typing as subscript..."
                                            : "Add a note..."
                                          }
                                        />
                                        <button onClick={() => saveNote(entry.id)} className="text-sm text-[#fe019a] hover:text-[#f0eee8] transition-colors">Save</button>
                                        <button onClick={() => { setEditingNoteId(null); setNoteTransform(null); }} className="text-sm text-[#4a5060] hover:text-[#9aa0ae] transition-colors">Cancel</button>
                                      </div>
                                      <div
                                        data-note-ui
                                        className="flex gap-1 items-center"
                                        onClick={e => e.stopPropagation()}
                                      >
                                        <button
                                          onClick={() => { insertIntoNote(entry.id, "µ"); editingNoteInputRef.current?.focus(); }}
                                          className="px-2 py-0.5 rounded text-xs text-[#8891a4] hover:text-[#f0eee8] hover:bg-[#2a2e3a] transition-all border border-[#2a2e3a]"
                                          title="Insert µ"
                                        >
                                          µ
                                        </button>
                                        <button
                                          onClick={() => {
                                            setNoteTransform(prev => prev === "super" ? null : "super");
                                            editingNoteInputRef.current?.focus();
                                          }}
                                          className={`px-2 py-0.5 rounded text-xs transition-all border ${
                                            noteTransform === "super"
                                              ? "text-[#fe019a] bg-[#fe019a]/10 border-[#fe019a]/50"
                                              : "text-[#8891a4] hover:text-[#f0eee8] hover:bg-[#2a2e3a] border-[#2a2e3a]"
                                          }`}
                                          title="Type next characters as superscript"
                                        >
                                          x²
                                        </button>
                                        <button
                                          onClick={() => {
                                            setNoteTransform(prev => prev === "sub" ? null : "sub");
                                            editingNoteInputRef.current?.focus();
                                          }}
                                          className={`px-2 py-0.5 rounded text-xs transition-all border ${
                                            noteTransform === "sub"
                                              ? "text-[#fe019a] bg-[#fe019a]/10 border-[#fe019a]/50"
                                              : "text-[#8891a4] hover:text-[#f0eee8] hover:bg-[#2a2e3a] border-[#2a2e3a]"
                                          }`}
                                          title="Type next characters as subscript"
                                        >
                                          x₂
                                        </button>
                                        {noteTransform && (
                                          <button
                                            onClick={() => { setNoteTransform(null); editingNoteInputRef.current?.focus(); }}
                                            className="text-[10px] text-[#fe019a] hover:text-[#f0eee8] ml-1 underline-offset-2 hover:underline transition-colors"
                                          >
                                            ESC to stop
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="text-sm text-[#3a3f4d] shrink-0 transition-colors pt-0.5">
                              {entry.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={e => confirmDelete(entry.id, e)}
                          className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded text-[#555b6e] hover:text-[#ff6b6b] hover:bg-[#ff6b6b]/10 transition-all text-base"
                          title="Delete"
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="h-8" />
    </main>
  );
}