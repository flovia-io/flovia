import { useState, type ReactNode } from 'react';

interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Reusable tabs component
 */
export default function Tabs({
  tabs,
  activeTab,
  onChange,
  variant = 'default',
  size = 'md',
  className = '',
}: TabsProps) {
  return (
    <div className={`tabs tabs-${variant} tabs-${size} ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          className={`tab ${activeTab === tab.id ? 'active' : ''} ${tab.disabled ? 'disabled' : ''}`}
          onClick={() => !tab.disabled && onChange(tab.id)}
          disabled={tab.disabled}
        >
          {tab.icon && <span className="tab-icon">{tab.icon}</span>}
          <span className="tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

interface TabPanelsProps {
  activeTab: string;
  children: ReactNode;
}

interface TabPanelProps {
  id: string;
  children: ReactNode;
}

/**
 * Container for tab panels
 */
export function TabPanels({ activeTab, children }: TabPanelsProps) {
  return <div className="tab-panels">{children}</div>;
}

/**
 * Individual tab panel
 */
export function TabPanel({ id, children }: TabPanelProps) {
  return <div className="tab-panel">{children}</div>;
}
