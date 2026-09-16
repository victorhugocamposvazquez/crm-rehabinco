/** Identificador del despliegue actual (commit en Vercel o fallback local). */
export const BUILD_ID =
  process.env.NEXT_PUBLIC_BUILD_ID ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  "dev";
