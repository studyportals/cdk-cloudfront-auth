import { PreTokenGenerationV2TriggerEvent } from "aws-lambda"
import { handler } from "../handlers/pre-token-generation"

describe("Pre Token Generation handler", () => {
  const createBaseTriggerEvent = (): PreTokenGenerationV2TriggerEvent =>
    ({
      request: {
        userAttributes: {
          sub: "12345",
          email: "user@example.com",
          "cognito:username": "testuser",
        },
        groupConfiguration: {
          groupsToOverride: [],
          iamRolesToOverride: [],
          preferredRole: "",
        },
      },
      response: {},
    }) as unknown as PreTokenGenerationV2TriggerEvent

  it("should suppress expected claims in the ID token", () => {
    const mockEvent = createBaseTriggerEvent()
    mockEvent.request.userAttributes.phone_number = "+1234567890"
    mockEvent.request.userAttributes.name = "Test User"
    mockEvent.request.userAttributes.picture = "https://example.com/pic.jpg"

    const result = handler(mockEvent)

    // Assert response structure is set correctly
    expect(result.response).toBeDefined()
    expect(result.response.claimsAndScopeOverrideDetails).toBeDefined()
    expect(
      result.response.claimsAndScopeOverrideDetails?.idTokenGeneration,
    ).toBeDefined()
    expect(
      result.response.claimsAndScopeOverrideDetails?.idTokenGeneration
        ?.claimsToSuppress,
    ).toBeDefined()
  })

  it("should have the correct set of claims to suppress", () => {
    const mockEvent = createBaseTriggerEvent()
    mockEvent.request.userAttributes.address = "123 Main St"
    mockEvent.request.userAttributes.birthdate = "1990-01-01"
    mockEvent.request.userAttributes["cognito:roles"] = "admin"

    const result = handler(mockEvent)

    const expectedSuppressions = [
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

    const claimsToSuppress =
      result.response.claimsAndScopeOverrideDetails?.idTokenGeneration
        ?.claimsToSuppress ?? []

    expect(claimsToSuppress).toEqual(expectedSuppressions)
  })

  it("should not mutate unrelated parts of the event", () => {
    const mockEvent = createBaseTriggerEvent()
    mockEvent.request.groupConfiguration.groupsToOverride = ["admin"]
    mockEvent.request.groupConfiguration.iamRolesToOverride = ["role1"]
    mockEvent.request.groupConfiguration.preferredRole = "role1"

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const originalRequest = JSON.parse(JSON.stringify(mockEvent.request))

    handler(mockEvent)

    // Assert request is unchanged
    expect(mockEvent.request).toEqual(originalRequest)
  })
})
