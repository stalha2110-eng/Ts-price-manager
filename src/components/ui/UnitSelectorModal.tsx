import * as React from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Weight, Package, Hash, Clock, X } from "lucide-react";
import { Button } from "./Button";
import { UNITS } from "../../constants";
import { cn } from "../../lib/utils";

interface UnitSelectorModalProps {
  onClose: () => void;
  onSelect: (unit: string) => void;
  currentUnit: string;
}

export function UnitSelectorModal({ onClose, onSelect, currentUnit }: UnitSelectorModalProps) {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredUnits = UNITS.map(group => ({
    ...group,
    values: group.values.filter(v => v.toLowerCase().includes(searchTerm.toLowerCase()))
  })).filter(group => group.values.length > 0);

  const getIcon = (label: string) => {
    switch (label) {
      case 'Weight': return <Weight size={18} />;
      case 'Packaging': return <Package size={18} />;
      case 'Quantity': return <Hash size={18} />;
      default: return <Clock size={18} />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="card w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
      >
        <div className="p-6 border-b border-[var(--border)] flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Weight className="text-[var(--primary)]" /> Select Unit
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X size={20} /></Button>
        </div>

        <div className="p-4 border-b border-[var(--border)] bg-[var(--background)]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground)] opacity-40" size={16} />
            <input
              type="text"
              placeholder="Search units..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2 pl-10 pr-4 text-sm focus:outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
          {filteredUnits.length > 0 ? (
            filteredUnits.map((group, idx) => (
              <div key={`unit-group-${group.label}-${idx}`} className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-widest opacity-40 flex items-center gap-2">
                  {getIcon(group.label)} {group.label}
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {group.values.map((val, vIdx) => (
                    <button
                      key={`unit-val-${group.label}-${val}-${vIdx}`}
                      onClick={() => {
                        onSelect(val);
                        onClose();
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-all text-sm font-medium",
                        currentUnit === val 
                          ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" 
                          : "border-[var(--border)] hover:bg-[var(--background)]"
                      )}
                    >
                      <div className="h-6 w-6 rounded-lg bg-[var(--background)] flex items-center justify-center">
                        {getIcon(group.label)}
                      </div>
                      {val}
                    </button>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="py-10 text-center opacity-40 italic">No units found matching "{searchTerm}"</div>
          )}
        </div>
        
        <div className="p-4 border-t border-[var(--border)] bg-[var(--background)]">
          <p className="text-[10px] text-center opacity-40 font-bold uppercase tracking-widest">Tap any unit to select</p>
        </div>
      </motion.div>
    </motion.div>
  );
}
