import { useEffect, useRef } from "react";

interface TextViewerProps {
	text: string;
	charStart: number;
	charEnd: number;
}

// TEXT sources are stored/chunked against whitespace-normalized text (see
// apps/worker/src/lib/chunk.ts), so charStart/charEnd are offsets into that
// normalized form, not necessarily the original raw string's exact spacing.
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
		<div className="text-viewer">
			{before}
			<mark ref={markRef}>{highlighted}</mark>
			{after}
		</div>
	);
}
