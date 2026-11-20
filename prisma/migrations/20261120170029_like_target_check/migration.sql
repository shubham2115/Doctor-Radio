-- A like must target exactly one of: a case or a comment.
ALTER TABLE "Like" ADD CONSTRAINT "Like_exactly_one_target"
  CHECK (("caseId" IS NOT NULL AND "commentId" IS NULL) OR ("caseId" IS NULL AND "commentId" IS NOT NULL));
-- A comment's parent must exist in the same table (FK handles it); observation comments need a case (NOT NULL handles it).
