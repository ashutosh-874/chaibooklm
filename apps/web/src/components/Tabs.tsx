interface TabsProps<T extends string> {
	tabs: { value: T; label: string }[];
	active: T;
	onChange: (value: T) => void;
}

export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
	return (
		<div style={{ display: "flex", gap: "2px", borderBottom: "1px solid var(--color-divider)", padding: "0 20px", flexShrink: 0 }}>
			{tabs.map((tab) => (
				<button
					key={tab.value}
					type="button"
					onClick={() => onChange(tab.value)}
					style={{
						background: "transparent",
						border: "none",
						borderBottom: active === tab.value ? "2px solid var(--color-accent-500, currentColor)" : "2px solid transparent",
						color: "var(--color-text)",
						opacity: active === tab.value ? 1 : 0.6,
						padding: "12px 14px",
						fontSize: "13px",
						fontWeight: 500,
						cursor: "pointer",
					}}
				>
					{tab.label}
				</button>
			))}
		</div>
	);
}
