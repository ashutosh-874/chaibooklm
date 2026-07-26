-- CreateEnum
CREATE TYPE "FlashcardStatus" AS ENUM ('PENDING', 'GENERATING', 'CARDS_READY', 'GENERATING_QUIZ', 'QUIZ_READY', 'FAILED');

-- CreateTable
CREATE TABLE "FlashcardSet" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "status" "FlashcardStatus" NOT NULL DEFAULT 'PENDING',
    "topic" TEXT,
    "errorMessage" TEXT,
    "flashcards" JSONB,
    "quiz" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlashcardSet_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "FlashcardSet" ADD CONSTRAINT "FlashcardSet_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
