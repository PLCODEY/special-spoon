"use client";
import { useEffect, useState } from "react";

const MESSAGE_TEMPLATES = [
  (name: string) => `Ooh ${name}, now THAT'S a pick! 🔥`,
  (name: string) => `${name} you absolute genius! 😘`,
  (name: string) => `Hot pick from a hot drafter. Love you ${name} 💋`,
  (name: string) => `Yowza ${name}! Looking good, picking GREAT!`,
  (name: string) => `Chef's kiss ${name}, you beautiful mind! 😍`,
  (name: string) => `That's what winners do, ${name}!`,
  (name: string) => `BOOM ${name}! Nailed it, you stunner!`,
  (name: string) => `Magnificent. Just like you, ${name}. 😏`,
  (name: string) => `Big brain ${name}, big moves, big pick! 💪`,
  (name: string) => `${name} you had me at that pick 🥰`,
  (name: string) => `Absolutely delicious pick, ${name} darling!`,
  (name: string) => `${name} is built different. What a pick! 🏆`,
  (name: string) => `The legend ${name} strikes again! 🔥`,
  (name: string) => `${name} coming in CLUTCH! Gorgeous! 😍`,
  (name: string) => `Is there anything ${name} can't do?! 💋`,
];

interface Props {
  pick: { golferName: string; drafter: string; nextPicker: string | null; odds: string } | null;
  onDone: () => void;
}

export default function PickCelebration({ pick, onDone }: Props) {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!pick) return;
    const template = MESSAGE_TEMPLATES[Math.floor(Math.random() * MESSAGE_TEMPLATES.length)];
    setMessage(template(pick.drafter));
    setAnimKey((k) => k + 1);
    setVisible(true);
    setShowCard(false);
    setShowShare(false);
    setCopied(false);
    const t1 = setTimeout(() => setShowCard(true), 650);
    const t2 = setTimeout(() => setShowShare(true), 1100);
    const t3 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 400);
    }, 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [pick, onDone]);

  if (!pick && !visible) return null;

  const shareText = pick
    ? [
        `⛳ ${pick.drafter} picks ${pick.golferName} (${pick.odds})`,
        pick.nextPicker ? `⏰ ${pick.nextPicker}, you're on the clock!` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  function handleCopy() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function dismiss() {
    setVisible(false);
    setTimeout(onDone, 400);
  }

  return (
    <div
      onClick={dismiss}
      className={`fixed inset-0 z-50 flex items-center justify-center cursor-pointer transition-opacity duration-400 ${visible ? "opacity-100" : "opacity-0"}`}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      <div className="relative flex flex-col items-center gap-4 px-8 max-w-sm w-full">

        {/* Golfer SVG */}
        <div key={animKey} className="select-none golfer-swing" style={{ fontSize: 0 }}>
          <svg width="160" height="200" viewBox="0 0 160 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="80" cy="195" rx="30" ry="6" fill="black" opacity="0.3"/>
            <line x1="70" y1="145" x2="60" y2="190" stroke="#f9a8d4" strokeWidth="8" strokeLinecap="round"/>
            <line x1="90" y1="145" x2="100" y2="190" stroke="#f9a8d4" strokeWidth="8" strokeLinecap="round"/>
            <ellipse cx="58" cy="191" rx="10" ry="5" fill="#1e293b"/>
            <ellipse cx="102" cy="191" rx="10" ry="5" fill="#1e293b"/>
            <path d="M55 120 Q80 155 105 120 Z" fill="#ec4899"/>
            <rect x="62" y="90" width="36" height="38" rx="6" fill="#ec4899"/>
            <g className="arm-swing" style={{ transformOrigin: "75px 95px" }}>
              <line x1="75" y1="95" x2="28" y2="135" stroke="#fbbf24" strokeWidth="7" strokeLinecap="round"/>
              <line x1="95" y1="95" x2="110" y2="120" stroke="#fbbf24" strokeWidth="7" strokeLinecap="round"/>
              <line x1="28" y1="135" x2="15" y2="160" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round"/>
              <rect x="8" y="158" width="16" height="8" rx="3" fill="#64748b"/>
            </g>
            <circle cx="80" cy="62" r="26" fill="#fde68a"/>
            <ellipse cx="80" cy="42" rx="26" ry="14" fill="#fbbf24"/>
            <ellipse cx="57" cy="58" rx="10" ry="18" fill="#fbbf24"/>
            <ellipse cx="103" cy="58" rx="10" ry="18" fill="#fbbf24"/>
            <ellipse cx="72" cy="38" rx="8" ry="4" fill="#fde68a" opacity="0.6"/>
            <rect x="56" y="52" width="48" height="10" rx="5" fill="#ec4899"/>
            <rect x="50" y="56" width="10" height="6" rx="3" fill="#ec4899"/>
            <circle cx="72" cy="66" r="3.5" fill="#1e293b"/>
            <circle cx="88" cy="66" r="3.5" fill="#1e293b"/>
            <circle cx="73.5" cy="64.5" r="1.2" fill="white"/>
            <circle cx="89.5" cy="64.5" r="1.2" fill="white"/>
            <path d="M72 74 Q80 81 88 74" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
            <ellipse cx="65" cy="72" rx="5" ry="3" fill="#f9a8d4" opacity="0.6"/>
            <ellipse cx="95" cy="72" rx="5" ry="3" fill="#f9a8d4" opacity="0.6"/>
          </svg>
        </div>

        {/* Pick card */}
        <div className={`w-full text-center transition-all duration-500 ${showCard ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-6 scale-95"}`}>
          <div className="bg-gray-900/90 border border-green-500/50 rounded-2xl px-6 py-5 shadow-2xl ring-2 ring-green-500/20">
            <div className="text-green-400 text-xs font-bold uppercase tracking-widest mb-1">
              {pick?.drafter}&apos;s pick
            </div>
            <div className="text-white text-2xl font-bold mb-1">
              {pick?.golferName}
            </div>
            <div className="text-gray-500 text-sm mb-3">{pick?.odds}</div>
            <div className="text-yellow-300 text-base italic font-medium">
              {message}
            </div>
          </div>
        </div>

        {/* Share / copy section */}
        <div className={`w-full transition-all duration-500 ${showShare ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div
            className="bg-gray-800/95 border border-gray-700 rounded-xl px-4 py-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Share to group chat</p>
            <pre className="text-white text-sm font-sans whitespace-pre-wrap mb-3 leading-relaxed">{shareText}</pre>
            <button
              onClick={handleCopy}
              className={`w-full py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                copied
                  ? "bg-green-600 text-white"
                  : "bg-white text-gray-900 hover:bg-gray-200 active:scale-95"
              }`}
            >
              {copied ? "Copied! ✓" : "Copy to clipboard"}
            </button>
            {pick?.nextPicker && (
              <p className="text-center text-yellow-400 text-xs mt-2 font-medium">
                ⏰ {pick.nextPicker} is on the clock
              </p>
            )}
          </div>
          <p className="text-gray-600 text-xs text-center mt-2">tap outside to dismiss</p>
        </div>

      </div>
    </div>
  );
}
