# CloudFront authorization with Cognito for CDK

Easily add Cognito-based authorization to your CloudFront distribution,
to place static files behind authorization.

This is based on https://github.com/henrist/cdk-cloudfront-auth.

New features:

- Cognito clients can be created in new accounts if passed a role that can be assumed in that account
- Cognito domain can be automatically retrieved if it's not known
- Auto-delete unusued Lambda@Edge versions
- `mode` is now sent as an input
- `allowedCriterias` can now be used to pass exceptions from the authorization layer
  - `allowedAuthorization?: string[]` is an array of allowed authroization header values that will be matched against the current `authorization` header
  - `allowedUserAgents?: string[]` is an array of regexes that will be used to match the current `user-agent`
  - `allowedURIs?: string[]` is an array of regexes that will be used to match the current `uri`
  - `allowedIPs?: string[]` is an array of IPs (/32) that will be used to match the current `clientIp`
- `concurrencySafe?` is a boolean controlling the creation of a DynamoDB holdings locks for updating the Lambda@Edge functions
- Ability to override:
  - `httpHeaders`
  - `oauthScopes`

## Usage

```bash
npm install @studyportals/cdk-cloudfront-auth
```

Deploy the Lambda@Edge functions to us-east-1:

```ts
// In a stack deployed to us-east-1.
const authLambdas = new AuthLambdas(this, "AuthLambdas", {
  regions: ["eu-west-1"], // Regions to make Lambda version params available.
})
```

Deploy the Cognito and CloudFront setup in whatever region
of your choice:

```ts
const auth = new CloudFrontAuth(this, "Auth", {
  cognitoAuthDomain: `${domain.domainName}.auth.${region}.amazoncognito.com`,
  authLambdas, // AuthLambdas from above
  userPool, // Cognito User Pool
})
const distribution = new cloudfront.Distribution(this, "Distribution", {
  defaultBehavior: auth.createProtectedBehavior(origin),
  additionalBehaviors: auth.createAuthPagesBehaviors(origin),
})
auth.updateClient("ClientUpdate", {
  signOutUrl: `https://${distribution.distributionDomainName}${auth.signOutRedirectTo}`,
  callbackUrl: `https://${distribution.distributionDomainName}${auth.callbackPath}`,
})
```

If using `CloudFrontWebDistribution` instead of `Distribution`:

```ts
const distribution = new cloudfront.CloudFrontWebDistribution(
  this,
  "Distribution",
  {
    originConfigs: [
      {
        behaviors: [
          ...auth.authPages,
          {
            isDefaultBehavior: true,
            lambdaFunctionAssociations: auth.authFilters,
          },
        ],
      },
    ],
  },
)
```

## Concurrency management

Sometimes multiple stacks may want to perfom updates to the Lambda@Edge functions. This can cause issues if the updates are not performed sequentially. To prevent this, the `concurrencySafe` property can be set to `true`. This will create a DynamoDB table that will be used to hold a lock for updating the Lambda@Edge functions. The table DynamoDB table will be created in the same region as the Lambda@Edge function and @studyportals/cdk-lambda-config knows how to handle this.

## Cleanup of old versions

When updating the Lambda@Edge functions, the old versions will not be deleted. This is because the Lambda@Edge functions are used by CloudFront and CloudFront will not allow you to delete a version that is in use. To work around this, calling the `enableAutoCleanup` on the `authLambdas`. This will create a Lambda function that will delete the old versions of the Lambda@Edge functions. This function will be triggered by a CloudWatch event that is triggered daily and tries to delete all versions that are not attached to anything. The Lambda function will be created in the same region as the Lambda@Edge function.

```ts
// In a stack deployed to us-east-1.
const authLambdas = new AuthLambdas(this, "AuthLambdas", {
  regions: ["eu-west-1"], // Regions to make Lambda version params available.
})
authLambdas.enableAutoCleanup()
```

## Customizing authorization

The `CloudFrontAuth` construct accepts a `requireGroupAnyOf` property
that causes access to be restricted to only users in specific groups.
