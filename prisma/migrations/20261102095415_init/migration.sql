-- CreateEnum
CREATE TYPE "Role" AS ENUM ('RECRUITER', 'CLIENT');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "ParseStatus" AS ENUM ('PENDING', 'PROCESSING', 'PARSED', 'NEEDS_REVIEW', 'FAILED', 'QUEUED');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('SOURCED', 'SCREENED', 'SHORTLISTED', 'SUBMITTED', 'CLIENT_REVIEW', 'INTERVIEW', 'OFFERED', 'JOINED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('GIVEN', 'PENDING', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ConsentSource" AS ENUM ('RECRUITER_ATTESTATION', 'CANDIDATE_PORTAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "ClientDecision" AS ENUM ('PENDING', 'SHORTLISTED', 'REJECTED', 'INTERVIEW_PROPOSED');

-- CreateEnum
CREATE TYPE "CriterionType" AS ENUM ('SKILL', 'EXPERIENCE', 'NOTICE', 'LOCATION', 'CTC', 'CUSTOM');

-- CreateEnum
CREATE TYPE "DuplicateStatus" AS ENUM ('NONE', 'POSSIBLE', 'CONFIRMED', 'IGNORED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('REQUISITION_CREATED', 'SCORECARD_UPDATED', 'CV_UPLOADED', 'CV_VIEWED', 'PROFILE_EDITED', 'SCORE_RERUN', 'STAGE_CHANGED', 'SUBMITTED', 'CLIENT_VIEWED', 'CLIENT_SHORTLISTED', 'CLIENT_REJECTED', 'SLOT_PROPOSED', 'CONSENT_UPDATED', 'DELETION_REQUESTED', 'CANDIDATE_DELETED');

-- CreateEnum
CREATE TYPE "AiRunStatus" AS ENUM ('SUCCESS', 'INVALID_JSON', 'TIMEOUT', 'RATE_LIMITED', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requisition" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "jdText" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "minExpYears" INTEGER NOT NULL,
    "maxExpYears" INTEGER NOT NULL,
    "noticeMaxDays" INTEGER NOT NULL,
    "ctcMaxLpa" DOUBLE PRECISION,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Requisition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScorecardCriterion" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CriterionType" NOT NULL,
    "weight" INTEGER NOT NULL,
    "mustHave" BOOLEAN NOT NULL DEFAULT true,
    "expectedValue" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScorecardCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'GIVEN',
    "consentSource" "ConsentSource" NOT NULL DEFAULT 'RECRUITER_ATTESTATION',
    "consentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consentVersion" TEXT NOT NULL DEFAULT 'v1',
    "consentNote" TEXT,
    "deletedAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "requisitionId" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "resumeBlobKey" TEXT NOT NULL,
    "resumeFileName" TEXT NOT NULL,
    "resumeMime" TEXT NOT NULL,
    "resumeText" TEXT,
    "parsedProfile" JSONB,
    "parseStatus" "ParseStatus" NOT NULL DEFAULT 'PENDING',
    "parseReasons" JSONB,
    "parseConfidence" DOUBLE PRECISION,
    "overallScore" DOUBLE PRECISION,
    "stage" "Stage" NOT NULL DEFAULT 'SOURCED',
    "duplicateStatus" "DuplicateStatus" NOT NULL DEFAULT 'NONE',
    "duplicateOfId" TEXT,
    "fileHash" TEXT NOT NULL,
    "textHash" TEXT,
    "viewedAt" TIMESTAMP(3),
    "clientViewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "clientDecision" "ClientDecision" NOT NULL DEFAULT 'PENDING',
    "clientReason" TEXT,
    "clientNote" TEXT,
    "proposedSlots" JSONB,
    "recruiterNotes" TEXT,
    "stageChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResumeFile" (
    "applicationId" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL,

    CONSTRAINT "ResumeFile_pkey" PRIMARY KEY ("applicationId")
);

-- CreateTable
CREATE TABLE "CriterionScore" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "evidenceQuote" TEXT,
    "evidencePage" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL,
    "grounded" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CriterionScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'groq',
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "status" "AiRunStatus" NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletionRequest" (
    "id" TEXT NOT NULL,
    "candidateId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "note" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Requisition_clientId_status_idx" ON "Requisition"("clientId", "status");

-- CreateIndex
CREATE INDEX "ScorecardCriterion_requisitionId_idx" ON "ScorecardCriterion"("requisitionId");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "Candidate_phone_idx" ON "Candidate"("phone");

-- CreateIndex
CREATE INDEX "Application_requisitionId_overallScore_idx" ON "Application"("requisitionId", "overallScore");

-- CreateIndex
CREATE INDEX "Application_requisitionId_stage_idx" ON "Application"("requisitionId", "stage");

-- CreateIndex
CREATE INDEX "Application_candidateId_idx" ON "Application"("candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_requisitionId_candidateId_key" ON "Application"("requisitionId", "candidateId");

-- CreateIndex
CREATE UNIQUE INDEX "CriterionScore_applicationId_criterionId_key" ON "CriterionScore"("applicationId", "criterionId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requisition" ADD CONSTRAINT "Requisition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScorecardCriterion" ADD CONSTRAINT "ScorecardCriterion_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_requisitionId_fkey" FOREIGN KEY ("requisitionId") REFERENCES "Requisition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResumeFile" ADD CONSTRAINT "ResumeFile_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionScore" ADD CONSTRAINT "CriterionScore_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CriterionScore" ADD CONSTRAINT "CriterionScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "ScorecardCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeletionRequest" ADD CONSTRAINT "DeletionRequest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
