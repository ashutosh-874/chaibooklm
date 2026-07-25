import type { Source } from "../lib/api.ts";
import type { Citation } from "../lib/queryStream.ts";
import { PdfViewer } from "./PdfViewer.tsx";
import { TextViewer } from "./TextViewer.tsx";

interface SourceViewerProps {
	token: string;
	notebookId: string;
	citation: Citation;
	source: Source | undefined;
	onClose: () => void;
}

export function SourceViewer({ token, notebookId, citation, source, onClose }: SourceViewerProps) {
	const locationLabel = citation.locator.page
		? `page ${citation.locator.page}`
		: citation.locator.sourceUrl
			? "web page"
			: citation.locator.startSec != null
				? `${Math.floor(citation.locator.startSec / 60)}:${String(Math.floor(citation.locator.startSec % 60)).padStart(2, "0")}`
				: "text";

	return (
		<div className="dialog-backdrop" onClick={onClose}>
			<div className="dialog" style={{ width: "min(560px, 100%)", maxHeight: "86vh" }} onClick={(e) => e.stopPropagation()}>
				{/* Dialog Header */}
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
					<div className="dialog-title" style={{ fontSize: "16px" }}>
						{citation.sourceTitle}{" "}
						<span className="text-muted" style={{ fontSize: "13px", fontWeight: 400 }}>
							— {locationLabel}
						</span>
					</div>
					<button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={onClose}>
						<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
							<path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
						</svg>
					</button>
				</div>

				{/* Dialog Body */}
				{!source ? (
					<p className="error">Source no longer exists.</p>
				) : citation.sourceType === "PDF" ? (
					<>
						<PdfViewer token={token} notebookId={notebookId} sourceId={source.id} page={citation.locator.page ?? 1} />
						<p className="text-muted" style={{ fontSize: "11px", margin: 0, marginTop: "8px" }}>
							Highlighted lines mark the passage this citation points to. The page render streams the actual PDF page via react-pdf.
						</p>
					</>
				) : citation.sourceType === "TEXT" ? (
					<TextViewer
						text={source.originIdentifier}
						charStart={citation.locator.charStart}
						charEnd={citation.locator.charEnd}
					/>
				) : citation.sourceType === "URL" ? (
					<div className="text-viewer" style={{ overflowY: "auto", maxHeight: "50vh", fontSize: "13.5px", lineHeight: "1.7", paddingRight: "4px" }}>
						<mark style={{ background: "var(--color-accent-800)", color: "var(--color-accent-100)", padding: "2px 4px", borderRadius: "3px" }}>
							{citation.text}
						</mark>
						{citation.locator.sourceUrl && (
							<p style={{ marginTop: "12px" }}>
								<a href={citation.locator.sourceUrl} target="_blank" rel="noreferrer noopener">
									Open original page ↗
								</a>
							</p>
						)}
					</div>
				) : citation.sourceType === "YOUTUBE" && citation.locator.videoId ? (
					<div>
						<div style={{ position: "relative", width: "100%", paddingTop: "56.25%" }}>
							<iframe
								src={`https://www.youtube.com/embed/${citation.locator.videoId}?start=${Math.floor(citation.locator.startSec ?? 0)}`}
								title={citation.sourceTitle}
								allow="autoplay; encrypted-media; picture-in-picture"
								allowFullScreen
								style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: "8px" }}
							/>
						</div>
						<p className="text-muted" style={{ fontSize: "13px", marginTop: "12px", lineHeight: "1.6" }}>
							{citation.text}
						</p>
					</div>
				) : citation.sourceType === "VTT" ? (
					<div className="text-viewer" style={{ overflowY: "auto", maxHeight: "50vh", fontSize: "13.5px", lineHeight: "1.7", paddingRight: "4px" }}>
						<mark style={{ background: "var(--color-accent-800)", color: "var(--color-accent-100)", padding: "2px 4px", borderRadius: "3px" }}>
							{citation.text}
						</mark>
					</div>
				) : (
					<p>Viewer for {citation.sourceType} sources isn't built yet.</p>
				)}
			</div>
		</div>
	);
}
