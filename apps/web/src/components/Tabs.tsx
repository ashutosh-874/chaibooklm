interface TabsProps<T extends string> {
	tabs: { value: T; label: string }[];
	active: T;
	onChange: (value: T) => void;
}

export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
	return (
		<div style={{ display: "flex", gap: "2px", borderBottom: "1px solid var(--color-divider)", padding: "0 20px", flexShrink: 0 }}>
			{tabs.map((tab) => {
				const isActive = active === tab.value;
				return (
					<button
						key={tab.value}
						type="button"
						onClick={() => onChange(tab.value)}
						className="tab-btn"
						style={{
							border: "none",
							borderBottom: isActive ? "2px solid var(--color-accent)" : "2px solid transparent",
							borderRadius: 0,
							color: isActive ? "var(--color-accent)" : "var(--color-text)",
							opacity: isActive ? 1 : 0.7,
							padding: "12px 14px",
							fontSize: "13px",
							fontFamily: "var(--font-heading)",
							fontWeight: isActive ? 600 : 500,
							cursor: "pointer",
							transition: "color 120ms ease, opacity 120ms ease, border-color 120ms ease",
						}}
					>
						{tab.label}
					</button>
				);
			})}
		</div>
	);
}
