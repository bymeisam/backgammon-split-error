-- AlterTable
CREATE SEQUENCE "Match_id_seq";
ALTER TABLE "Match" ALTER COLUMN "id" SET DEFAULT nextval('"Match_id_seq"');
ALTER SEQUENCE "Match_id_seq" OWNED BY "Match"."id";
ALTER TABLE "Match" ADD COLUMN "source" TEXT NOT NULL,
ADD COLUMN "sourceMatchId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "PlayerIdentity" (
    "id" SERIAL NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUserId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isMe" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PlayerIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Match_source_sourceMatchId_key" ON "Match"("source", "sourceMatchId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerIdentity_source_sourceUserId_key" ON "PlayerIdentity"("source", "sourceUserId");
