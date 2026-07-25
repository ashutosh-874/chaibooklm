import { useEffect, useMemo, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { api } from "../lib/api.ts";

// react-pdf renders via pdf.js, which needs its worker script pointed at the
// exact version it bundles — resolved as a Vite asset URL, not fetched from a CDN.
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

	// react-pdf treats a new `file` object identity as "the file changed" and
	// reloads — memoize so it only loads once per fetched buffer, not every render.
	const file = useMemo(() => (fileData ? { data: fileData } : null), [fileData]);

	if (error) return <p className="error">{error}</p>;
	if (!file) return <p>Loading PDF…</p>;

	return (
		<div className="pdf-viewer">
			<Document file={file} onLoadSuccess={({ numPages }) => setNumPages(numPages)}>
				<Page pageNumber={page} />
			</Document>
			<p className="pdf-page-label">
				Page {page}
				{numPages ? ` of ${numPages}` : ""}
			</p>
		</div>
	);
}
