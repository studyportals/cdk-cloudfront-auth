import { createRemoteJWKSet, jwtVerify } from "jose"

export interface IdTokenPayload {
  sub: string
  "cognito:groups"?: string[]
  "cognito:username"?: string
  given_name?: string
  aud: string
  token_use: "id"
  auth_time: number
  name?: string
  exp: number
  iat: number
  email?: string
}

// JWKS resolver is cached at module scope so it can be reused across
// Lambda invocations (jose handles internal key caching).
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

export async function validate(
  jwtToken: string,
  jwksUri: string,
  issuer: string,
  audience: string,
): Promise<{ validationError: Error } | undefined> {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri))
  }
  try {
    await jwtVerify(jwtToken, jwks, { issuer, audience, algorithms: ["RS256"] })
    return undefined
  } catch (err) {
    return {
      validationError: err instanceof Error ? err : new Error(String(err)),
    }
  }
}

export function decodeIdToken(jwt: string): IdTokenPayload {
  const tokenBody = jwt.split(".")[1]
  const decodableTokenBody = tokenBody.replace(/-/g, "+").replace(/_/g, "/")
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return JSON.parse(Buffer.from(decodableTokenBody, "base64").toString())
}
