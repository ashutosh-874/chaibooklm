import { prisma } from "@chaibooklm/shared";

// Every notebook-scoped route (sources, query) needs this same check: the
// notebook must belong to the authenticated user, or the route 404s (never
// leaks whether a notebook id exists for someone else).
export async function getOwnedNotebook(notebookId: string, userId?: string) {
	return prisma.notebook.findFirst({ where: { id: notebookId, userId } });
}
