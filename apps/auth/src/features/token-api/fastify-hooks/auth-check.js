const VALIDATE_REFRESH_TOKEN = `
  SELECT 
    "t1"."id" AS "refreshToken",
    "t2"."id" AS "familyToken",
    LEAST("t1"."expires_at", "t2"."expires_at") AS "expiresAt"
  FROM "public"."refresh_tokens" AS "t1"
  LEFT JOIN "public"."family_tokens" AS "t2"
  ON "t1"."family_token" = "t2"."id"
  WHERE "t1"."id" = $1
    AND "t1"."was_used" = false
    AND "t1"."expires_at" > NOW()
    AND "t2"."is_valid" = true
  LIMIT 1
  ;
`;

const INVALIDATE_FAMILY_TOKEN = `
  UPDATE "public"."family_tokens" AS "t1"
    SET "is_valid" = false
  WHERE "id" IN (
    SELECT "t1"."family_token" FROM "public"."refresh_tokens" AS "t1"
    INNER JOIN "public"."family_tokens" AS "t2" ON "t1"."family_token" = "t2"."id"
    WHERE "t1"."id" = $1 LIMIT 1
    FOR UPDATE SKIP LOCKED
  );
`;

module.exports = async (request, reply) => {
  // Get the Refresh Token from the headers:
  const authToken = request.headers["x-auth-id"];
  if (!authToken) {
    reply.status(401).send("Access denied - authentication not found");
    return;
  }

  // Validate the Refresh Token:
  const res = await request.pg.query(VALIDATE_REFRESH_TOKEN, [authToken]);
  if (res.rowCount === 1) {
    request.auth = res.rows[0];
    return;
  }

  // Invalidate the Family Token:
  await request.pg.query(INVALIDATE_FAMILY_TOKEN, [authToken]);
  reply.status(429).send("Access denied");
};
