import { useState, useRef, type ReactNode } from 'react';
import { useOutsideClick } from '../../hooks/useOutsideClick';

interface DropdownOption<T> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface DropdownProps<T> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  renderButton?: (selected: DropdownOption<T> | undefined, isOpen: boolean) => ReactNode;
}

/**
 * Reusable dropdown component
 */
export default function Dropdown<T extends string | number>({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  buttonClassName = '',
  menuClassName = '',
  renderButton,
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useOutsideClick(containerRef as React.RefObject<HTMLElement>, () => setIsOpen(false), isOpen);

  const selectedOption = options.find(o => o.value === value);

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`dropdown ${className}`}>
      <button
        type="button"
        className={`dropdown-btn ${buttonClassName}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {renderButton ? (
          renderButton(selectedOption, isOpen)
        ) : (
          <>
            {selectedOption?.icon}
            <span className="dropdown-label">{selectedOption?.label ?? placeholder}</span>
            <span className="dropdown-caret">▾</span>
          </>
        )}
      </button>

      {isOpen && (
        <div className={`dropdown-menu ${menuClassName}`} role="listbox">
          {options.map(option => (
            <button
              key={String(option.value)}
              type="button"
              className={`dropdown-item ${option.value === value ? 'active' : ''}`}
              onClick={() => handleSelect(option.value)}
              role="option"
              aria-selected={option.value === value}
            >
              {option.icon}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
