"use client";
import Image from "next/image";
import { Shield, Zap, Lock, Globe, ArrowRight, ChevronRight } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Props {
  onSelectBorrower: () => void;
  onSelectLender: () => void;
}

export default function LandingPage({ onSelectBorrower, onSelectLender }: Props) {
  const { t } = useT();

  const features = [
    { icon: Shield, titleKey: "landing.features.ssi.title",   descKey: "landing.features.ssi.desc",   color: "text-indigo-400" },
    { icon: Lock,   titleKey: "landing.features.vc.title",    descKey: "landing.features.vc.desc",    color: "text-emerald-400" },
    { icon: Zap,    titleKey: "landing.features.chain.title", descKey: "landing.features.chain.desc", color: "text-amber-400" },
    { icon: Globe,  titleKey: "landing.features.pool.title",  descKey: "landing.features.pool.desc",  color: "text-sky-400" },
  ];

  // Split hero text at the last 2 words for gradient highlight
  const heroFull = t("landing.hero");
  const heroWords = heroFull.split(" ");
  const heroMain = heroWords.slice(0, -2).join(" ");
  const heroAccent = heroWords.slice(-2).join(" ");

  return (
    <div className="min-h-screen bg-[#0F1729] flex flex-col">
      {/* Navbar */}
      <nav className="px-8 py-5 flex items-center justify-between border-b border-[#2D3E5F]/50">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="DefiCredit logo"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <span className="text-lg font-semibold text-dc">DefiCredit</span>
          <span className="ml-2 px-2 py-0.5 text-xs bg-indigo-900/60 text-indigo-300 rounded-full border border-indigo-600/30">
            IOTA Testnet
          </span>
        </div>
        <a
          href="https://iota.org"
          target="_blank"
          className="text-sm text-[#94A3B8] hover:text-dc transition-colors flex items-center gap-1"
        >
          {t("landing.powered")} <ChevronRight className="w-3 h-3" />
        </a>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-20 text-center">
        {/* Hero logo */}
        <div className="mb-8">
          <Image
            src="/logo.png"
            alt="DefiCredit logo"
            width={120}
            height={120}
            className="mx-auto drop-shadow-[0_0_32px_rgba(99,102,241,0.5)]"
          />
        </div>

        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-indigo-900/40 border border-indigo-600/40 rounded-full">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-sm text-indigo-300">{t("landing.badge")}</span>
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-dc max-w-4xl leading-tight mb-6">
          {heroMain}{" "}
          <span className="gradient-text">{heroAccent}</span>
        </h1>

        <p className="text-xl text-[#94A3B8] max-w-2xl mb-14 leading-relaxed">
          {t("landing.subtitle")}
        </p>

        {/* CTA Cards */}
        <div className="flex flex-col sm:flex-row gap-5 w-full max-w-xl mb-20">
          <button
            onClick={onSelectBorrower}
            className="flex-1 group glass-card rounded-2xl p-6 text-left hover:border-indigo-500/60 hover:glow-indigo transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-indigo-400 uppercase tracking-wide">
                {t("landing.borrower.role")}
              </span>
              <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-xl font-semibold text-dc mb-2">{t("landing.borrower.title")}</h3>
            <p className="text-sm text-[#94A3B8]">{t("landing.borrower.desc")}</p>
          </button>

          <button
            onClick={onSelectLender}
            className="flex-1 group glass-card rounded-2xl p-6 text-left hover:border-emerald-500/60 transition-all duration-300"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-emerald-400 uppercase tracking-wide">
                {t("landing.lender.role")}
              </span>
              <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
            </div>
            <h3 className="text-xl font-semibold text-dc mb-2">{t("landing.lender.title")}</h3>
            <p className="text-sm text-[#94A3B8]">{t("landing.lender.desc")}</p>
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl w-full">
          {features.map(({ icon: Icon, titleKey, descKey, color }) => (
            <div key={titleKey} className="glass-card rounded-xl p-5 text-left">
              <Icon className={`w-6 h-6 ${color} mb-3`} />
              <h4 className="text-sm font-semibold text-dc mb-1">{t(titleKey)}</h4>
              <p className="text-xs text-[#94A3B8] leading-relaxed">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="px-8 py-5 border-t border-[#2D3E5F]/50 text-center">
        <p className="text-xs text-[#64748B]">{t("landing.footer")}</p>
      </footer>
    </div>
  );
}
