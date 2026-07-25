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

// Picks the right viewer for the cited source's type and closes the shared
// modal shell — PDF/TEXT only for now, URL/YOUTUBE/VTT arrive in Phase 5-6.
export function SourceViewer({ token, notebookId, citation, source, onClose }: SourceViewerProps) {
	return (
		<div className="modal-backdrop" onClick={onClose}>
			<div className="modal-panel" onClick={(e) => e.stopPropagation()}>
				<div className="modal-header">
					<h2>{citation.sourceTitle}</h2>
					<button type="button" onClick={onClose}>
						Close
					</button>
				</div>

				{!source ? (
					<p className="error">Source no longer exists.</p>
				) : citation.sourceType === "PDF" ? (
					<PdfViewer token={token} notebookId={notebookId} sourceId={source.id} page={citation.locator.page ?? 1} />
				) : citation.sourceType === "TEXT" ? (
					<TextViewer
						text={source.originIdentifier}
						charStart={citation.locator.charStart}
						charEnd={citation.locator.charEnd}
					/>
				) : (
					<p>Viewer for {citation.sourceType} sources isn't built yet.</p>
				)}
			</div>
		</div>
	);
}
