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
	urlTitle: string;
	setUrlTitle: (val: string) => void;
	url: string;
	setUrl: (val: string) => void;
	handleAddUrl: (e: React.FormEvent) => Promise<void>;
	submittingUrl: boolean;
	youtubeTitle: string;
	setYoutubeTitle: (val: string) => void;
	youtubeVideo: string;
	setYoutubeVideo: (val: string) => void;
	handleAddYoutube: (e: React.FormEvent) => Promise<void>;
	submittingYoutube: boolean;
	vttFileInputRef: RefObject<HTMLInputElement | null>;
	handleAddVtt: (e: React.FormEvent) => Promise<void>;
	submittingVtt: boolean;
	playlistUrl: string;
	setPlaylistUrl: (val: string) => void;
	handleAddPlaylist: (e: React.FormEvent) => Promise<void>;
	submittingPlaylist: boolean;
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
	urlTitle,
	setUrlTitle,
	url,
	setUrl,
	handleAddUrl,
	submittingUrl,
	youtubeTitle,
	setYoutubeTitle,
	youtubeVideo,
	setYoutubeVideo,
	handleAddYoutube,
	submittingYoutube,
	vttFileInputRef,
	handleAddVtt,
	submittingVtt,
	playlistUrl,
	setPlaylistUrl,
	handleAddPlaylist,
	submittingPlaylist,
}: AddSourceModalProps) {
	const [activeTab, setActiveTab] = useState<"SELECT" | "PDF" | "TEXT" | "URL" | "YOUTUBE" | "VTT" | "PLAYLIST">("SELECT");

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

	const onUrlSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await handleAddUrl(e);
		onClose();
		setActiveTab("SELECT");
	};

	const onYoutubeSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await handleAddYoutube(e);
		onClose();
		setActiveTab("SELECT");
	};

	const onVttSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await handleAddVtt(e);
		onClose();
		setActiveTab("SELECT");
	};

	const onPlaylistSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		await handleAddPlaylist(e);
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
							{activeTab === "URL" && "Add web page"}
							{activeTab === "YOUTUBE" && "Add YouTube video"}
							{activeTab === "VTT" && "Add transcript(s)"}
							{activeTab === "PLAYLIST" && "Add YouTube playlist"}
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
							Choose a source type.
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

							{/* URL Tile */}
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
								onClick={() => setActiveTab("URL")}
							>
								<span style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
									URL
								</span>
								<span style={{ fontSize: "13px", fontWeight: 500, marginTop: "4px" }}>Web page</span>
							</button>

							{/* YouTube Tile */}
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
								onClick={() => setActiveTab("YOUTUBE")}
							>
								<span style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
									YT
								</span>
								<span style={{ fontSize: "13px", fontWeight: 500, marginTop: "4px" }}>YouTube link</span>
							</button>

							{/* YouTube Playlist Tile */}
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
								onClick={() => setActiveTab("PLAYLIST")}
							>
								<span style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
									YT+
								</span>
								<span style={{ fontSize: "13px", fontWeight: 500, marginTop: "4px" }}>YouTube playlist</span>
							</button>

							{/* VTT Tile */}
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
								onClick={() => setActiveTab("VTT")}
							>
								<span style={{ width: "30px", height: "30px", borderRadius: "7px", background: "var(--color-neutral-800)", color: "var(--color-neutral-200)", display: "flex", alignItems: "center", justifyCenter: "center", justifyContent: "center", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em" }}>
									VTT
								</span>
								<span style={{ fontSize: "13px", fontWeight: 500, marginTop: "4px" }}>Transcript (.vtt/.srt, or a .zip of many)</span>
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

				{activeTab === "URL" && (
					<form onSubmit={onUrlSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<div className="field">
							<label htmlFor="url-title">Title (optional)</label>
							<input
								id="url-title"
								className="input"
								type="text"
								placeholder="e.g. Article title"
								value={urlTitle}
								onChange={(e) => setUrlTitle(e.target.value)}
							/>
						</div>
						<div className="field">
							<label htmlFor="url-value">Page URL</label>
							<input
								id="url-value"
								className="input"
								type="url"
								placeholder="https://example.com/article"
								value={url}
								onChange={(e) => setUrl(e.target.value)}
								required
							/>
						</div>
						<div className="dialog-actions" style={{ marginTop: "12px" }}>
							<button type="button" className="btn btn-secondary" onClick={handleBack}>
								Back
							</button>
							<button type="submit" className="btn btn-primary" disabled={submittingUrl || !url.trim()}>
								{submittingUrl ? "Adding…" : "Add web page"}
							</button>
						</div>
					</form>
				)}

				{activeTab === "YOUTUBE" && (
					<form onSubmit={onYoutubeSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<div className="field">
							<label htmlFor="youtube-title">Title (optional)</label>
							<input
								id="youtube-title"
								className="input"
								type="text"
								placeholder="e.g. Lecture recording"
								value={youtubeTitle}
								onChange={(e) => setYoutubeTitle(e.target.value)}
							/>
						</div>
						<div className="field">
							<label htmlFor="youtube-value">Video URL or ID</label>
							<input
								id="youtube-value"
								className="input"
								type="text"
								placeholder="https://www.youtube.com/watch?v=…"
								value={youtubeVideo}
								onChange={(e) => setYoutubeVideo(e.target.value)}
								required
							/>
						</div>
						<div className="dialog-actions" style={{ marginTop: "12px" }}>
							<button type="button" className="btn btn-secondary" onClick={handleBack}>
								Back
							</button>
							<button type="submit" className="btn btn-primary" disabled={submittingYoutube || !youtubeVideo.trim()}>
								{submittingYoutube ? "Adding…" : "Add YouTube video"}
							</button>
						</div>
					</form>
				)}

				{activeTab === "PLAYLIST" && (
					<form onSubmit={onPlaylistSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<div className="field">
							<label htmlFor="playlist-url">Playlist URL</label>
							<input
								id="playlist-url"
								className="input"
								type="text"
								placeholder="https://www.youtube.com/playlist?list=…"
								value={playlistUrl}
								onChange={(e) => setPlaylistUrl(e.target.value)}
								required
							/>
						</div>
						<p className="text-muted" style={{ fontSize: "12px", margin: 0 }}>
							Each video in the playlist becomes its own source (up to 50 videos).
						</p>
						<div className="dialog-actions" style={{ marginTop: "12px" }}>
							<button type="button" className="btn btn-secondary" onClick={handleBack}>
								Back
							</button>
							<button type="submit" className="btn btn-primary" disabled={submittingPlaylist || !playlistUrl.trim()}>
								{submittingPlaylist ? "Adding…" : "Add playlist"}
							</button>
						</div>
					</form>
				)}

				{activeTab === "VTT" && (
					<form onSubmit={onVttSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
						<div className="field">
							<label htmlFor="vtt-file">Choose .vtt/.srt file, or a .zip of many</label>
							<input
								id="vtt-file"
								className="input"
								type="file"
								accept=".vtt,.srt,.zip"
								ref={vttFileInputRef}
								required
								style={{ padding: "8px" }}
							/>
						</div>
						<div className="dialog-actions" style={{ marginTop: "12px" }}>
							<button type="button" className="btn btn-secondary" onClick={handleBack}>
								Back
							</button>
							<button type="submit" className="btn btn-primary" disabled={submittingVtt}>
								{submittingVtt ? "Adding…" : "Add transcript(s)"}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}
