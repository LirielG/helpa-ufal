DO $$
DECLARE
  duplicated text;
BEGIN
  SELECT string_agg(normalized, ', ')
    INTO duplicated
    FROM (
      SELECT lower(btrim(email)) AS normalized
        FROM "User"
       GROUP BY lower(btrim(email))
      HAVING count(*) > 1
    ) groups;

  IF duplicated IS NOT NULL THEN
    RAISE EXCEPTION 'Duplicate emails after normalization: %', duplicated;
  END IF;
END $$;

UPDATE "User" SET email = lower(btrim(email));

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_normalized_check"
  CHECK (email = lower(btrim(email)));