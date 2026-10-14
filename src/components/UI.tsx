/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { 
  ChevronLeft,
  Clock,
  CheckCircle2,
  Eye,
  Camera,
  Video,
  Mic,
  Hand,
  Shirt,
  Smartphone,
  Radio,
  Package,
  ArrowRight,
  Sparkles,
  X
} from 'lucide-react';
import { playClick } from '../utils';

export const GeneratingState = ({ index }: { index: number }) => (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#040D08]/92 backdrop-blur-xl z-20 transition-all duration-500">
      <div className="absolute w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl animate-pulse pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center gap-6">
        <div className="relative w-12 h-12">
           <div className="absolute inset-0 rounded-full border-[1px] border-emerald-500/15" />
           <div className="absolute inset-0 rounded-full border-t-[2px] border-emerald-400 animate-[spin_1.4s_linear_infinite]" />
           <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
           </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-[10px] font-bold tracking-[0.35em] text-emerald-400 uppercase animate-pulse">Merender Visual AI</p>
          <div className="flex items-center justify-center gap-3 opacity-60">
             <div className="w-3 h-px bg-gradient-to-r from-transparent to-emerald-400" />
             <p className="text-[9px] font-medium tracking-widest text-emerald-200/70 uppercase font-mono">Scene {String(index + 1).padStart(2, '0')}</p>
             <div className="w-3 h-px bg-gradient-to-l from-transparent to-emerald-400" />
          </div>
        </div>
      </div>
  </div>
);

const GridBackground = React.memo(() => {
  const elements = React.useMemo(() => [...Array(14)].map((_, i) => ({
    id: i,
    initialX: Math.random() * 100 + "vw",
    initialY: Math.random() * 100 + "vh",
    animateX: [
      Math.random() * 100 + "vw",
      Math.random() * 100 + "vw",
      Math.random() * 100 + "vw"
    ],
    animateY: [
      Math.random() * 100 + "vh",
      Math.random() * 100 + "vh",
      Math.random() * 100 + "vh"
    ],
    duration: 14 + Math.random() * 20,
    delay: Math.random() * 10
  })), []);

  const glows = React.useMemo(() => [...Array(3)].map((_, i) => ({
    id: i,
    duration: 26 + i * 10,
    delay: i * 5
  })), []);

  return (
    <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
      {/* Base Grid Texture with subtle emerald tint */}
      <div 
        className="absolute inset-0 opacity-[0.4]" 
        style={{ 
          backgroundImage: `linear-gradient(to right, rgba(16, 185, 129, 0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(16, 185, 129, 0.08) 1px, transparent 1px)`,
          backgroundSize: '48px 48px' 
        }} 
      />
      
      {/* Accent Grid */}
      <div 
        className="absolute inset-0 opacity-[0.2]" 
        style={{ 
          backgroundImage: `linear-gradient(to right, rgba(16, 185, 129, 0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(16, 185, 129, 0.25) 1px, transparent 1px)`,
          backgroundSize: '192px 192px' 
        }} 
      />
      
      {/* Vignette Depth Masks */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#040D08] via-transparent to-[#040D08] opacity-60" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#040D08] via-transparent to-[#040D08] opacity-60" />
      <div className="absolute inset-0 [background:radial-gradient(circle_at_center,transparent_0%,rgba(4,13,8,0.7)_100%)]" />
      
      {/* Ambient Cybernetic Forest Particles */}
      {elements.map((el) => (
        <motion.div
          key={el.id}
          initial={{ 
            x: el.initialX, 
            y: el.initialY,
            opacity: 0,
            scale: 0.8,
            borderRadius: "0%"
          }}
          animate={{ 
            x: el.animateX,
            y: el.animateY,
            opacity: [0, 0.35, 0.1, 0.45, 0],
            scale: [0.8, 1.2, 0.9, 1.3, 0.8],
            borderRadius: ["0%", "20%", "50%", "25%", "0%"],
          }}
          transition={{ 
            duration: el.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: el.delay
          }}
          className="absolute w-5 h-5 bg-emerald-500/15 border border-emerald-400/30 shadow-[0_0_20px_rgba(16,185,129,0.3)]"
        />
      ))}

      {/* Atmospheric Forest Aurora Glows */}
      {glows.map((glow) => (
        <motion.div
          key={`glow-${glow.id}`}
          animate={{ 
            x: ["-10%", "110%", "-10%"],
            y: ["-10%", "110%", "-10%"],
            opacity: [0.03, 0.08, 0.03]
          }}
          transition={{ 
            duration: glow.duration, 
            repeat: Infinity, 
            ease: "linear",
            delay: glow.delay
          }}
          className="absolute w-[800px] h-[800px] bg-emerald-600/10 blur-[170px] rounded-full"
        />
      ))}
    </div>
  );
});

export const LayoutWrapper = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
  <div className={`min-h-screen bg-[#040D08] text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden ${className}`}>
    <GridBackground />
    <div className="fixed inset-0 opacity-[0.03] pointer-events-none z-1"></div>
    <div className="relative z-10 w-full h-full flex flex-col min-h-screen">
      {children}
    </div>
  </div>
);

export const CooldownBadge = ({ cooldown }: { cooldown: number }) => (
  <div className="backdrop-blur-md bg-[#071A12]/80 border border-emerald-500/30 px-3 md:px-4 py-1.5 md:py-2 rounded-full flex items-center gap-2 text-[10px] md:text-xs font-bold text-emerald-400 uppercase tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.2)] animate-pulse">
    <Clock className="w-3.5 h-3.5" /> Jeda {cooldown}s
  </div>
);

export const Navbar = ({ onBack, onViewResult, cooldown = 0 }: { onBack?: () => void, onViewResult?: (() => void) | null, onReset?: () => void, cooldown?: number }) => (
  <div className="absolute top-0 left-0 right-0 z-50 px-4 md:px-12 py-4 flex items-center justify-between pointer-events-auto">
    <div>
      {onBack && (
        <button 
          onClick={() => { playClick(); onBack(); }}
          className="flex items-center gap-2 text-[11px] font-semibold text-emerald-200/60 uppercase tracking-widest hover:text-emerald-400 transition-colors group px-3 py-1.5 rounded-full hover:bg-emerald-500/10"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Kembali
        </button>
      )}
    </div>
    <div className="flex items-center gap-3">
      {cooldown > 0 && <CooldownBadge cooldown={cooldown} />}
      {onViewResult && (
        <button 
          type="button"
          onClick={() => { playClick(); onViewResult(); }} 
          className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 transition-all hover:bg-emerald-500 hover:text-black active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          title="Lihat Hasil Visual"
        >
          <Eye className="w-5 h-5" />
        </button>
      )}
    </div>
  </div>
);

export const SectionTitle = ({ title, subtitle }: { title: string, subtitle?: string }) => (
  <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
    <h2 className="text-3xl md:text-6xl font-bold tracking-tight text-white mb-4 leading-[1.15]">{title}</h2>
    {subtitle && <p className="text-zinc-400 text-sm md:text-lg font-normal leading-relaxed max-w-2xl">{subtitle}</p>}
  </div>
);

export const UploadZone = ({ image, onClick, onClear, label, icon: Icon }: { image: string | null, onClick: () => void, onClear?: () => void, label: string, icon: any }) => (
  <div className="space-y-3 group">
    <div className="flex justify-between items-center px-1">
      <span className="text-[10px] md:text-[11px] font-bold tracking-[0.2em] text-emerald-300/70 uppercase">{label}</span>
      <div className="flex items-center gap-3">
        {image && <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5"/> Siap Dipakai</span>}
        {image && onClear && (
          <button 
            onClick={(e) => { e.stopPropagation(); playClick(); onClear(); }}
            className="w-5 h-5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-90"
            title="Hapus foto"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
    <div 
      onClick={() => { playClick(); onClick(); }} 
      className={`relative w-full aspect-square rounded-[2rem] overflow-hidden cursor-pointer transition-all duration-500 border border-emerald-500/20 bg-[#07170F]/90 group-hover:border-emerald-400/50 group-hover:bg-[#0A2216] shadow-xl flex flex-col items-center justify-center`}
    >
      {image ? (
        <>
          <img src={image} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-all duration-700 scale-100 group-hover:scale-105" referrerPolicy="no-referrer" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/50 backdrop-blur-[2px]">
            <span className="px-5 py-2 rounded-full border border-emerald-400/40 bg-[#040D08]/90 text-xs font-semibold text-emerald-300 backdrop-blur-md uppercase tracking-widest shadow-lg">Ganti Foto</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-4 group-hover:scale-105 transition-transform duration-500 p-6 text-center">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-emerald-500/20 flex items-center justify-center bg-emerald-500/5 text-emerald-400/70 transition-all duration-500 group-hover:text-emerald-300 group-hover:border-emerald-400/40 group-hover:bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <Icon className="w-8 h-8 md:w-10 md:h-10" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] md:text-xs text-zinc-300 font-semibold tracking-wider uppercase">Upload Aset</p>
            <p className="text-[9px] text-zinc-500 tracking-normal">PNG, JPG, atau WebP</p>
          </div>
        </div>
      )}
    </div>
  </div>
);

export const ButtonCTA = ({ onClick, children, disabled }: { onClick: () => void, children: React.ReactNode, disabled?: boolean }) => (
  <motion.button 
    whileHover={!disabled ? { scale: 1.01, y: -2 } : {}}
    whileTap={!disabled ? { scale: 0.99, y: 0 } : {}}
    onClick={() => { playClick(); onClick(); }} 
    disabled={disabled} 
    className={`w-full py-5 rounded-[1.25rem] font-bold text-xs tracking-[0.25em] uppercase transition-all duration-300 flex items-center justify-center gap-3 shadow-[0_15px_35px_-10px_rgba(16,185,129,0.35)] disabled:opacity-30 disabled:shadow-none disabled:grayscale ${disabled ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500 text-black hover:bg-emerald-400 hover:brightness-105'}`}
  >
    {children} <ArrowRight className="w-4 h-4" />
  </motion.button>
);

export const DraggableBackButton = ({ onClick }: { onClick: () => void }) => (
  <motion.button
    drag
    dragMomentum={false}
    whileDrag={{ scale: 1.1, cursor: 'grabbing' }}
    onClick={() => { playClick(); onClick(); }}
    className="fixed bottom-10 right-10 z-[100] w-13 h-13 md:w-14 md:h-14 rounded-full bg-emerald-500 text-black flex items-center justify-center shadow-[0_10px_30px_rgba(16,185,129,0.4)] cursor-grab active:cursor-grabbing border-4 border-[#040D08] group transition-all hover:bg-emerald-400"
    title="Kembali"
  >
    <ChevronLeft className="w-7 h-7 md:w-8 md:h-8 group-hover:-translate-x-0.5 transition-transform" />
  </motion.button>
);

