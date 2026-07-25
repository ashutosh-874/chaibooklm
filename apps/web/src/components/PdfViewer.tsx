import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { api } from "../lib/api.ts";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

interface PdfViewerProps {
	token: string;
	notebookId: string;
	sourceId: string;
	page: number;
}

export function PdfViewer({ token, notebookId, sourceId, page }: PdfViewerProps) {
	const [fileData, setFileData] = useState<ArrayBuffer | null>(null);
	const [numPages, setNumPages] = useState(0);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		api
			.fetchSourceFile(token, notebookId, sourceId)
			.then((buf) => {
				if (!cancelled) setFileData(buf);
			})
			.catch((err) => {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load PDF");
			});
		return () => {
			cancelled = true;
		};
	}, [token, notebookId, sourceId]);

	const file = useMemo(() => (fileData ? { data: fileData } : null), [fileData]);

	if (error) return <p className="error">{error}</p>;
	if (!file) return <p className="text-muted" style={{ textAlign: "center", padding: "20px" }}>Loading PDF…</p>;

	return (
		<div className="pdf-viewer" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", overflow: "auto", maxHeight: "50vh", background: "var(--color-neutral-900)", borderRadius: "8px", padding: "16px" }}>
			<div style={{ boxShadow: "var(--shadow-sm)", background: "white", padding: "8px", borderRadius: "4px" }}>
				<Document file={file} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
					<Page pageNumber={page} width={400} renderTextLayer={false} renderAnnotationLayer={false} />
				</Document>
			</div>
			<p className="text-muted" style={{ fontSize: "11px", margin: 0, marginTop: "4px" }}>
				Page {page}
				{numPages ? ` of ${numPages}` : ""}
			</p>
		</div>
	);
}
