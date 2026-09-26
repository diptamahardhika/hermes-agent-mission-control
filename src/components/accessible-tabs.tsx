export type AccessibleTab<T extends string> = { key: T; label: React.ReactNode };

export function AccessibleTabList<T extends string>({
  idPrefix,
  panelId,
  ariaLabel,
  tabs,
  activeTab,
  onChange,
  className,
  buttonClassName,
  buttonStyle,
  activeIndicator,
}: {
  idPrefix: string;
  panelId: string;
  ariaLabel: string;
  tabs: AccessibleTab<T>[];
  activeTab: T;
  onChange: (tab: T) => void;
  className?: string;
  buttonClassName: (active: boolean) => string;
  buttonStyle?: (active: boolean) => React.CSSProperties | undefined;
  activeIndicator?: React.ReactNode;
}) {
  function moveTabFocus(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? tabs.length - 1
        : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    onChange(nextTab.key);
    document.getElementById(`${idPrefix}-tab-${nextTab.key}`)?.focus();
  }

  return (
    <div role="tablist" aria-label={ariaLabel} aria-orientation="horizontal" className={className}>
      {tabs.map((tab, index) => {
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            id={`${idPrefix}-tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => moveTabFocus(event, index)}
            className={buttonClassName(active)}
            style={buttonStyle?.(active)}
          >
            {tab.label}
            {active && activeIndicator}
          </button>
        );
      })}
    </div>
  );
}

export function AccessibleTabPanel({
  id,
  labelledBy,
  children,
  className = "",
}: {
  id: string;
  labelledBy: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      id={id}
      role="tabpanel"
      aria-labelledby={labelledBy}
      className={className}
    >
      {children}
    </div>
  );
}
