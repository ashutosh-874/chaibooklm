import { useEffect, useRef } from "react";

interface TextViewerProps {
	text: string;
	charStart: number;
	charEnd: number;
}

function normalize(text: string) {
	return text.replace(/\s+/g, " ").trim();
}

export function TextViewer({ text, charStart, charEnd }: TextViewerProps) {
	const markRef = useRef<HTMLElement>(null);

	useEffect(() => {
		markRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
	}, []);

	const normalized = normalize(text);
	const before = normalized.slice(0, charStart);
	const highlighted = normalized.slice(charStart, charEnd);
	const after = normalized.slice(charEnd);

	return (
		<div className="text-viewer" style={{ overflowY: "auto", maxHeight: "50vh", fontSize: "13.5px", lineHeight: "1.7", paddingRight: "4px" }}>
			<span style={{ opacity: 0.7 }}>{before}</span>
			<mark ref={markRef} style={{ background: "var(--color-accent-800)", color: "var(--color-accent-100)", padding: "2px 4px", borderRadius: "3px" }}>
				{highlighted}
			</mark>
			<span style={{ opacity: 0.7 }}>{after}</span>
		</div>
	);
}
