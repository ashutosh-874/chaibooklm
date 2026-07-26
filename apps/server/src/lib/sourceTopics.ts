import { prisma, SourceStatus } from "@chaibooklm/shared";
import { config } from "../config.ts";
import { openai } from "./openai.ts";

const EXCERPT_CHARS = 300;

// Cheap topic discovery: uses only source titles + a short excerpt from each
// (not the full indexed text) so this can run synchronously on page load
// instead of needing a queued job. Shared by both roadmap generation (pick a
// topic to build a concept progression for) and podcast generation (pick a
// topic to narrate) — the user picks one of these before the (expensive)
// retrieval-scoped generation runs.
export async function suggestTopics(notebookId: string): Promise<string[]> {
	const sources = await prisma.source.findMany({
		where: { notebookId, status: SourceStatus.READY },
		include: { chunks: { take: 1, orderBy: { chunkIndex: "asc" } } },
	});

	if (sources.length === 0) return [];

	const context = sources
		.map((source) => {
			const excerpt = source.chunks[0]?.text.slice(0, EXCERPT_CHARS) ?? "";
			return `- "${source.title}": ${excerpt}`;
		})
		.join("\n");

	const completion = await openai.chat.completions.create({
		model: config.openai.chatModel,
		temperature: 0.3,
		response_format: {
			type: "json_schema",
			json_schema: {
				name: "source_topics",
				strict: true,
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						topics: {
							type: "array",
							description: "5-8 candidate topics a learner could build a roadmap around, or hear a podcast about, based on these sources.",
							items: { type: "string" },
						},
					},
					required: ["topics"],
				},
			},
		},
		messages: [
			{
				role: "system",
				content:
					"You are a curriculum designer. Given a notebook's sources (title + short excerpt each), suggest short, " +
					"concrete topic names a learner could request a personalized learning roadmap or podcast narration for. " +
					"Prefer topics that span multiple sources when possible. Respond ONLY with the structured JSON.",
			},
			{ role: "user", content: context },
		],
	});

	const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
	return Array.isArray(parsed.topics) ? parsed.topics.filter((t: unknown) => typeof t === "string") : [];
}
