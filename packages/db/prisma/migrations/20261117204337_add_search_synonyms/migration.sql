-- CreateTable
CREATE TABLE "search_synonyms" (
    "id" UUID NOT NULL,
    "term" TEXT NOT NULL,
    "synonyms" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "locale" VARCHAR(2) NOT NULL DEFAULT 'EN',

    CONSTRAINT "search_synonyms_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "search_synonyms_term_locale_key" ON "search_synonyms"("term", "locale");
