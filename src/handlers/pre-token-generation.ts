import { PreTokenGenerationV2TriggerEvent } from "aws-lambda"

/**
 * Cognito Pre Token Generation trigger (V2).
 *
 * Suppresses claims not needed by the CloudFront auth handlers to reduce
 * JWT cookie size. check-auth only needs: sub, cognito:groups, cognito:username,
 * exp, iat, aud, iss, token_use for validation and authorization.
 */
export const handler = (
  event: PreTokenGenerationV2TriggerEvent,
): PreTokenGenerationV2TriggerEvent => {
  const claimsToSuppress = [
    "address",
    "birthdate",
    "cognito:roles",
    "email",
    "email_verified",
    "family_name",
    "gender",
    "given_name",
    "identities",
    "locale",
    "middle_name",
    "name",
    "nickname",
    "phone_number",
    "phone_number_verified",
    "picture",
    "preferred_username",
    "profile",
    "updated_at",
    "website",
    "zoneinfo",
  ]

  event.response = {
    claimsAndScopeOverrideDetails: {
      idTokenGeneration: {
        claimsToSuppress,
      },
    },
  }

  return event
}
