-- CreateEnum
CREATE TYPE "DecisionKind" AS ENUM ('CHECKER', 'CUBE');

-- CreateEnum
CREATE TYPE "ErrorSeverity" AS ENUM ('NONE', 'DOUBTFUL', 'ERROR', 'BLUNDER');

-- CreateTable
CREATE TABLE "Match" (
    "id" INTEGER NOT NULL,
    "matchLength" INTEGER,
    "opponentName" TEXT NOT NULL,
    "opponentCountry" TEXT NOT NULL,
    "opponentRating" DOUBLE PRECISION NOT NULL,
    "opponentError" DOUBLE PRECISION NOT NULL,
    "opponentScore" INTEGER NOT NULL,
    "userError" DOUBLE PRECISION NOT NULL,
    "userRating" DOUBLE PRECISION NOT NULL,
    "userScore" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "gameIndex" INTEGER NOT NULL,
    "playedAt" TIMESTAMP(3),

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Decision" (
    "id" SERIAL NOT NULL,
    "gameId" INTEGER NOT NULL,
    "eventId" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "kind" "DecisionKind" NOT NULL,
    "analysedEvent" TEXT NOT NULL,
    "countAsDecision" BOOLEAN NOT NULL,
    "rawError" DOUBLE PRECISION NOT NULL,
    "errorSeverity" "ErrorSeverity" NOT NULL,
    "isBlunder" BOOLEAN NOT NULL,
    "luck" DOUBLE PRECISION,
    "luckMwc" DOUBLE PRECISION,
    "equity" DOUBLE PRECISION,
    "mwc" DOUBLE PRECISION,
    "classification" TEXT NOT NULL,
    "matchScoreBlack" INTEGER NOT NULL,
    "matchScoreWhite" INTEGER NOT NULL,
    "crawfordState" TEXT NOT NULL,
    "cubeOwnerUserId" TEXT,
    "notationPlayed" TEXT,
    "notationBest" TEXT,
    "cubeDetail" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "myTag" TEXT,
    "raw" JSONB NOT NULL,

    CONSTRAINT "Decision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Game_matchId_gameIndex_key" ON "Game"("matchId", "gameIndex");

-- CreateIndex
CREATE INDEX "Decision_kind_classification_idx" ON "Decision"("kind", "classification");

-- CreateIndex
CREATE INDEX "Decision_userId_idx" ON "Decision"("userId");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Decision" ADD CONSTRAINT "Decision_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
