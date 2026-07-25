import { useState, type RefObject } from "react";

interface AddSourceModalProps {
	isOpen: boolean;
	onClose: () => void;
	textTitle: string;
	setTextTitle: (val: string) => void;
	text: string;
	setText: (val: string) => void;
	handleAddText: (e: React.FormEvent) => Promise<void>;
	submittingText: boolean;
	handleAddPdf: (e: React.FormEvent) => Promise<void>;
	submittingPdf: boolean;
	fileInputRef: RefObject<HTMLInputElement | null>;
}

export function AddSourceModal({
	isOpen,
	onClose,
	textTitle,
	setTextTitle,
	text,
	setText,
	handleAddText,
	submittingText,
	handleAddPdf,
	submittingPdf,
	fileInputRef,
}: AddSourceModalProps) {
	const [activeTab, setActiveTab] = useState<"SELECT" | "PDF" | "TEXT">("SELECT");

	if (!isOpen) return null;

	const handleBack = () => {
		setActiveTab("SELECT");
	};

	const onTextSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await handleAddText(e);
		onClose();
		setActiveTab("SELECT");
	};

	const onPdfSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await handleAddPdf(e);
		onClose();
		setActiveTab("SELECT");
	};

	return (
		<div className="dialog-backdrop" onClick={onClose}>
			<div className="dialog" style={{ width: "min(560px, 100%)" }} onClick={(e) => e.stopPropagation()}>
				{/* Modal Header */}
				<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						{activeTab !== "SELECT" && (
							<button type="button" className="btn btn-ghost btn-icon" style={{ width: "24px", height: "24px" }} onClick={handleBack} aria-label="Back">
								<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
									<path d="M165.66,202.34a8,8,0,0,1-11.32,11.32l-80-80a8,8,0,0,1,0-11.32l80-80a8,8,0,0,1,11.32,11.32L91.31,128Z"/>
								</svg>
							</button>
						)}
						<div className="dialog-title">
							{activeTab === "SELECT" && "Add a source"}
							{activeTab === "PDF" && "Upload PDF"}
							{activeTab === "TEXT" && "Paste text"}
						</div>
					</div>
					<button type="button" className="btn btn-ghost btn-icon" aria-label="Close" onClick={onClose}>
						<svg width="14" height="14" viewBox="0 0 256 256" fill="currentColor">
							<path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z"/>
						</svg>
					</button>
				</div>

				{/* Modal Body */}
				{activeTab === "SELECT" && (
					<>
						<div className="dialog-body" style={{ margin: 0, fontSize: "14px", opacity: 0.85 }}>
							Choose a source type. PDF and Text are ready today; URL, YouTube and VTT are coming in a later phase.
						</div>
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
							{/* PDF Tile */}
							<button
								type="button"
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-start",
									gap: "6px",
									padding: "14px",
									borderRadius: "10px",
									border: "1px solid var(--color-divider)",
									background: "var(--color-surface)",
									color: "var(--color-text)",
									cursor: "pointer",
									textAlign: "left",
									width: "100%",
								}}
								onClick={() => setActiveTab("PDF")}
							>
								<span style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
									PDF
								</span>
								<span style={{ fontSize: "13px", fontWeight: 500, marginTop: "4px" }}>Upload PDF</span>
							</button>

							{/* Text Tile */}
							<button
								type="button"
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-start",
									gap: "6px",
									padding: "14px",
									borderRadius: "10px",
									border: "1px solid var(--color-divider)",
									background: "var(--color-surface)",
									color: "var(--color-text)",
									cursor: "pointer",
									textAlign: "left",
									width: "100%",
								}}
								onClick={() => setActiveTab("TEXT")}
							>
								<span style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
									TXT
								</span>
								<span style={{ fontSize: "13px", fontWeight: 500, marginTop: "4px" }}>Paste text</span>
							</button>

							{/* URL Tile (Soon) */}
							<button
								type="button"
								disabled
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-start",
									gap: "6px",
									padding: "14px",
									borderRadius: "10px",
									border: "1px solid var(--color-divider)",
									background: "var(--color-surface)",
									color: "var(--color-text)",
									cursor: "not-allowed",
									textAlign: "left",
									width: "100%",
									opacity: 0.55,
									position: "relative",
								}}
							>
								<span style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
									URL
								</span>
								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: "4px" }}>
									<span style={{ fontSize: "13px", fontWeight: 500 }}>Web page</span>
									<span className="tag tag-neutral" style={{ fontSize: "9px", padding: "2px 6px" }}>Soon</span>
								</div>
							</button>

							{/* YouTube Tile (Soon) */}
							<button
								type="button"
								disabled
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-start",
									gap: "6px",
									padding: "14px",
									borderRadius: "10px",
									border: "1px solid var(--color-divider)",
									background: "var(--color-surface)",
									color: "var(--color-text)",
									cursor: "not-allowed",
									textAlign: "left",
									width: "100%",
									opacity: 0.55,
									position: "relative",
								}}
							>
								<span style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
									YT
								</span>
								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: "4px" }}>
									<span style={{ fontSize: "13px", fontWeight: 500 }}>YouTube link</span>
									<span className="tag tag-neutral" style={{ fontSize: "9px", padding: "2px 6px" }}>Soon</span>
								</div>
							</button>

							{/* VTT Tile (Soon) */}
							<button
								type="button"
								disabled
								style={{
									display: "flex",
									flexDirection: "column",
									alignItems: "flex-start",
									gap: "6px",
									padding: "14px",
									borderRadius: "10px",
									border: "1px solid var(--color-divider)",
									background: "var(--color-surface)",
									color: "var(--color-text)",
									cursor: "not-allowed",
									textAlign: "left",
									width: "100%",
									opacity: 0.55,
									position: "relative",
									gridColumn: "span 2",
								}}
							>
								<span style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
									VTT
								</span>
								<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: "4px" }}>
									<span style={{ fontSize: "13px", fontWeight: 500 }}>Transcript (VTT)</span>
									<span className="tag tag-neutral" style={{ fontSize: "9px", padding: "2px 6px" }}>Soon</span>
								</div>
							</button>
						</div>
					</>
				)}

				{activeTab === "PDF" && (
					<form onSubmit={onPdfSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<div className="field">
							<label htmlFor="pdf-file">Choose PDF file</label>
							<input
								id="pdf-file"
								className="input"
								type="file"
								accept="application/pdf"
								ref={fileInputRef}
								required
								style={{ padding: "8px" }}
							/>
						</div>
						<div className="dialog-actions" style={{ marginTop: "12px" }}>
							<button type="button" className="btn btn-secondary" onClick={handleBack}>
								Back
							</button>
							<button type="submit" className="btn btn-primary" disabled={submittingPdf}>
								{submittingPdf ? "Uploading…" : "Upload PDF"}
							</button>
						</div>
					</form>
				)}

				{activeTab === "TEXT" && (
					<form onSubmit={onTextSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<div className="field">
							<label htmlFor="text-title">Title (optional)</label>
							<input
								id="text-title"
								className="input"
								type="text"
								placeholder="e.g. Lecture Notes"
								value={textTitle}
								onChange={(e) => setTextTitle(e.target.value)}
							/>
						</div>
						<div className="field">
							<label htmlFor="text-content">Content</label>
							<textarea
								id="text-content"
								className="input"
								placeholder="Paste text contents here…"
								value={text}
								onChange={(e) => setText(e.target.value)}
								rows={6}
								required
							/>
						</div>
						<div className="dialog-actions" style={{ marginTop: "12px" }}>
							<button type="button" className="btn btn-secondary" onClick={handleBack}>
								Back
							</button>
							<button type="submit" className="btn btn-primary" disabled={submittingText || !text.trim()}>
								{submittingText ? "Adding…" : "Add text source"}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
