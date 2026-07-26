-- CreateEnum
CREATE TYPE "PodcastStatus" AS ENUM ('PENDING', 'GENERATING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "Podcast" (
    "id" TEXT NOT NULL,
    "notebookId" TEXT NOT NULL,
    "status" "PodcastStatus" NOT NULL DEFAULT 'PENDING',
    "voice" TEXT NOT NULL,
    "script" TEXT,
    "audioPath" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Podcast_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Podcast" ADD CONSTRAINT "Podcast_notebookId_fkey" FOREIGN KEY ("notebookId") REFERENCES "Notebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
