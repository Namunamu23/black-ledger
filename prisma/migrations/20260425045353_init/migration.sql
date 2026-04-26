-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INVESTIGATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserCaseStatus" AS ENUM ('NOT_STARTED', 'ACTIVE', 'FINAL_REVIEW', 'SOLVED');

-- CreateEnum
CREATE TYPE "CaseWorkflowStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TheoryResultLabel" AS ENUM ('CORRECT', 'PARTIAL', 'INCORRECT');

-- CreateEnum
CREATE TYPE "SupportMessageStatus" AS ENUM ('NEW', 'HANDLED', 'SPAM');

-- CreateEnum
CREATE TYPE "AccessCodeKind" AS ENUM ('BUREAU_REF', 'ARTIFACT_QR', 'WITNESS_TIP', 'AUDIO_FILE');

-- CreateEnum
CREATE TYPE "HiddenEvidenceKind" AS ENUM ('RECORD', 'PERSON_DETAIL', 'TIMELINE_EVENT', 'HINT', 'AUDIO');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'INVESTIGATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseFile" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "players" TEXT NOT NULL,
    "duration" TEXT NOT NULL,
    "difficulty" TEXT NOT NULL,
    "maxStage" INTEGER NOT NULL DEFAULT 3,
    "solutionSuspect" TEXT NOT NULL DEFAULT '',
    "solutionMotive" TEXT NOT NULL DEFAULT '',
    "solutionEvidence" TEXT NOT NULL DEFAULT '',
    "debriefOverview" TEXT NOT NULL DEFAULT '',
    "debriefWhatHappened" TEXT NOT NULL DEFAULT '',
    "debriefWhyItWorked" TEXT NOT NULL DEFAULT '',
    "debriefClosing" TEXT NOT NULL DEFAULT '',
    "debriefSectionTitle" TEXT,
    "debriefIntro" TEXT,
    "heroImageUrl" TEXT,
    "workflowStatus" "CaseWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseSlugHistory" (
    "id" SERIAL NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "oldSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseAudit" (
    "id" SERIAL NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivationCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "kitSerial" TEXT,
    "caseFileId" INTEGER NOT NULL,
    "claimedByUserId" INTEGER,
    "claimedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCase" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "currentStage" INTEGER NOT NULL DEFAULT 1,
    "status" "UserCaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "firstOpenedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "UserCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCaseEvent" (
    "id" SERIAL NOT NULL,
    "userCaseId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CasePerson" (
    "id" SERIAL NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "globalPersonId" INTEGER,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "portraitUrl" TEXT,
    "unlockStage" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CasePerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseRecord" (
    "id" SERIAL NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "unlockStage" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseHint" (
    "id" SERIAL NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "unlockStage" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseHint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseCheckpoint" (
    "id" SERIAL NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "stage" INTEGER NOT NULL,
    "prompt" TEXT NOT NULL,
    "acceptedAnswers" TEXT NOT NULL,
    "successMessage" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckpointAttempt" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "stage" INTEGER NOT NULL,
    "answer" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckpointAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TheorySubmission" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "suspectName" TEXT NOT NULL,
    "motive" TEXT NOT NULL,
    "evidenceSummary" TEXT NOT NULL,
    "suspectCorrect" BOOLEAN NOT NULL DEFAULT false,
    "motiveCorrect" BOOLEAN NOT NULL DEFAULT false,
    "evidenceCorrect" BOOLEAN NOT NULL DEFAULT false,
    "score" INTEGER NOT NULL DEFAULT 0,
    "resultLabel" "TheoryResultLabel" NOT NULL,
    "feedback" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TheorySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupportMessage" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportMessageStatus" NOT NULL DEFAULT 'NEW',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalPerson" (
    "id" SERIAL NOT NULL,
    "bureauId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TEXT,
    "knownLocation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "personType" TEXT NOT NULL DEFAULT 'PERSON_OF_INTEREST',
    "classification" TEXT NOT NULL DEFAULT 'STANDARD',
    "riskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "relevanceLevel" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "profileSummary" TEXT NOT NULL DEFAULT '',
    "internalNotes" TEXT NOT NULL DEFAULT '',
    "lastUpdatedLabel" TEXT NOT NULL DEFAULT 'Recently reviewed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gender" TEXT,
    "accessLevel" TEXT NOT NULL DEFAULT 'STANDARD',
    "sourceReliability" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "confidenceLevel" TEXT NOT NULL DEFAULT 'MEDIUM',
    "watchlistFlag" TEXT NOT NULL DEFAULT 'NONE',

    CONSTRAINT "GlobalPerson_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonAlias" (
    "id" SERIAL NOT NULL,
    "globalPersonId" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL DEFAULT 'KNOWN_ALIAS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonConnection" (
    "id" SERIAL NOT NULL,
    "sourcePersonId" INTEGER NOT NULL,
    "targetPersonId" INTEGER NOT NULL,
    "connectionType" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonBehavioralProfile" (
    "id" SERIAL NOT NULL,
    "globalPersonId" INTEGER NOT NULL,
    "behavioralRead" TEXT NOT NULL DEFAULT '',
    "observedPatterns" TEXT NOT NULL DEFAULT '',
    "stressIndicators" TEXT NOT NULL DEFAULT '',
    "communicationStyle" TEXT NOT NULL DEFAULT '',
    "socialBehavior" TEXT NOT NULL DEFAULT '',
    "conflictHistory" TEXT NOT NULL DEFAULT '',
    "motiveThreads" TEXT NOT NULL DEFAULT '',
    "escalationIndicators" TEXT NOT NULL DEFAULT '',
    "analystAssessment" TEXT NOT NULL DEFAULT '',
    "analystConfidence" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonBehavioralProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonDigitalTrace" (
    "id" SERIAL NOT NULL,
    "globalPersonId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "notes" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonDigitalTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonTimelineEvent" (
    "id" SERIAL NOT NULL,
    "globalPersonId" INTEGER NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "relatedCaseSlug" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonTimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonEvidenceLink" (
    "id" SERIAL NOT NULL,
    "globalPersonId" INTEGER NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'UNASSESSED',
    "relatedCaseSlug" TEXT,
    "relatedCaseTitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonAnalystNote" (
    "id" SERIAL NOT NULL,
    "globalPersonId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonAnalystNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "kind" "AccessCodeKind" NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "unlocksTarget" JSONB NOT NULL,
    "requiresStage" INTEGER,
    "oneTimePerUser" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccessCodeRedemption" (
    "id" SERIAL NOT NULL,
    "accessCodeId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessCodeRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HiddenEvidence" (
    "id" SERIAL NOT NULL,
    "caseFileId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "HiddenEvidenceKind" NOT NULL,
    "body" TEXT NOT NULL,
    "revealOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HiddenEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CaseFile_slug_key" ON "CaseFile"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CaseSlugHistory_oldSlug_key" ON "CaseSlugHistory"("oldSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ActivationCode_code_key" ON "ActivationCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserCase_userId_caseFileId_key" ON "UserCase"("userId", "caseFileId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseCheckpoint_caseFileId_stage_key" ON "CaseCheckpoint"("caseFileId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- CreateIndex
CREATE UNIQUE INDEX "GlobalPerson_bureauId_key" ON "GlobalPerson"("bureauId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonAlias_globalPersonId_alias_key" ON "PersonAlias"("globalPersonId", "alias");

-- CreateIndex
CREATE UNIQUE INDEX "PersonBehavioralProfile_globalPersonId_key" ON "PersonBehavioralProfile"("globalPersonId");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCode_code_key" ON "AccessCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AccessCodeRedemption_accessCodeId_userId_key" ON "AccessCodeRedemption"("accessCodeId", "userId");

-- AddForeignKey
ALTER TABLE "CaseSlugHistory" ADD CONSTRAINT "CaseSlugHistory_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAudit" ADD CONSTRAINT "CaseAudit_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseAudit" ADD CONSTRAINT "CaseAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivationCode" ADD CONSTRAINT "ActivationCode_claimedByUserId_fkey" FOREIGN KEY ("claimedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCase" ADD CONSTRAINT "UserCase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCase" ADD CONSTRAINT "UserCase_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCaseEvent" ADD CONSTRAINT "UserCaseEvent_userCaseId_fkey" FOREIGN KEY ("userCaseId") REFERENCES "UserCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePerson" ADD CONSTRAINT "CasePerson_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePerson" ADD CONSTRAINT "CasePerson_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseRecord" ADD CONSTRAINT "CaseRecord_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseHint" ADD CONSTRAINT "CaseHint_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseCheckpoint" ADD CONSTRAINT "CaseCheckpoint_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointAttempt" ADD CONSTRAINT "CheckpointAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckpointAttempt" ADD CONSTRAINT "CheckpointAttempt_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheorySubmission" ADD CONSTRAINT "TheorySubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TheorySubmission" ADD CONSTRAINT "TheorySubmission_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonAlias" ADD CONSTRAINT "PersonAlias_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonConnection" ADD CONSTRAINT "PersonConnection_sourcePersonId_fkey" FOREIGN KEY ("sourcePersonId") REFERENCES "GlobalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonConnection" ADD CONSTRAINT "PersonConnection_targetPersonId_fkey" FOREIGN KEY ("targetPersonId") REFERENCES "GlobalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonBehavioralProfile" ADD CONSTRAINT "PersonBehavioralProfile_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonDigitalTrace" ADD CONSTRAINT "PersonDigitalTrace_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonTimelineEvent" ADD CONSTRAINT "PersonTimelineEvent_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonEvidenceLink" ADD CONSTRAINT "PersonEvidenceLink_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonAnalystNote" ADD CONSTRAINT "PersonAnalystNote_globalPersonId_fkey" FOREIGN KEY ("globalPersonId") REFERENCES "GlobalPerson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCode" ADD CONSTRAINT "AccessCode_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCodeRedemption" ADD CONSTRAINT "AccessCodeRedemption_accessCodeId_fkey" FOREIGN KEY ("accessCodeId") REFERENCES "AccessCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCodeRedemption" ADD CONSTRAINT "AccessCodeRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessCodeRedemption" ADD CONSTRAINT "AccessCodeRedemption_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HiddenEvidence" ADD CONSTRAINT "HiddenEvidence_caseFileId_fkey" FOREIGN KEY ("caseFileId") REFERENCES "CaseFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
