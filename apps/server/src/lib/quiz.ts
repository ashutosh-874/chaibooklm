import { config } from "../config.ts";
import { openai } from "./openai.ts";

export interface FlashcardInput {
	front: string;
	back: string;
}

export interface QuizQuestion {
	question: string;
	options: string[];
	correctIndex: number;
	explanation: string;
}

// Generates a multiple-choice quiz from an already-generated flashcard set —
// no retrieval needed (the flashcards are the whole input), so this runs
// synchronously in the request handler, same pattern as suggestTopics()
// and the query route's queryRewriting()/hydeDocument() calls.
export async function generateQuiz(flashcards: FlashcardInput[]): Promise<QuizQuestion[]> {
	const context = flashcards.map((c, i) => `${i + 1}. Q: ${c.front}\n   A: ${c.back}`).join("\n");

	const completion = await openai.chat.completions.create({
		model: config.openai.chatModel,
		temperature: 0.3,
		response_format: {
			type: "json_schema",
			json_schema: {
				name: "quiz",
				strict: true,
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						quiz: {
							type: "array",
							description: "4-6 multiple-choice questions testing recall of the given flashcards.",
							items: {
								type: "object",
								additionalProperties: false,
								properties: {
									question: { type: "string" },
									options: {
										type: "array",
										description: "Exactly 4 answer options, in the order they should be displayed.",
										items: { type: "string" },
									},
									correctIndex: { type: "integer", description: "Index (0-3) of the correct option in `options`." },
									explanation: { type: "string", description: "1 sentence explaining why the correct answer is correct." },
								},
								required: ["question", "options", "correctIndex", "explanation"],
							},
						},
					},
					required: ["quiz"],
				},
			},
		},
		messages: [
			{
				role: "system",
				content:
					"You are a quiz writer. Given a set of flashcards (question/answer pairs), write 4-6 multiple-choice " +
					"questions that test recall of the same facts — do not just restate the flashcard's front as the question " +
					"verbatim every time, vary phrasing where natural. Each question must have exactly 4 options with one " +
					"clearly correct answer; the other 3 should be plausible but wrong. Respond ONLY with the structured JSON.",
			},
			{ role: "user", content: context },
		],
	});

	const parsed = JSON.parse(completion.choices[0]?.message?.content ?? "{}");
	if (!Array.isArray(parsed.quiz)) return [];

	// Defensive validation: drop any malformed question rather than let a bad
	// correctIndex or wrong option count reach the frontend quiz UI.
	return parsed.quiz.filter(
		(q: QuizQuestion) =>
			typeof q.question === "string" &&
			Array.isArray(q.options) &&
			q.options.length === 4 &&
			Number.isInteger(q.correctIndex) &&
			q.correctIndex >= 0 &&
			q.correctIndex <= 3,
	);
}
