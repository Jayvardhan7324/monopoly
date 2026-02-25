import * as React from "react"
import { motion } from "motion/react"

interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        ref={ref}
        className={`peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 ${checked ? 'bg-indigo-600' : 'bg-slate-700'} ${className}`}
        {...props}
      >
        <motion.span
          animate={{ x: checked ? 16 : 0 }}
          transition={{ type: "spring", stiffness: 700, damping: 30 }}
          className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0`}
        />
      </button>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }
