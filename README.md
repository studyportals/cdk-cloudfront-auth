# CloudFront authorization with Cognito for CDK

Easily add Cognito-based authorization to your CloudFront distribution,
to place static files behind authorization.

This is based on https://github.com/henrist/cdk-cloudfront-auth.

New features: 
- Cognito clients can be created in new accounts if passed a role that can be assumed in that account
- Cognito domain can be automatically retrieved if it's not known
- `mode` is now sent as an input
- `allowedCriterias` can now be used to pass exceptions from the authorization layer
  - `allowedUserAgents?: string[]` is an array of regexes that will be used to match the current `user-agent`
  - `allowedURIs?: string[]` is an array of regexes that will be used to match the current `uri`
  - `allowedIPs?: string[]` is an array of IPs (/32) that will be used to match the current `clientIp`
- Ability to override:
  - `httpHeaders`
  - `oauthScopes`

## Usage

```bash
npm install @henrist/cdk-cloudfront-auth
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
const distribution = new cloudfront.CloudFrontWebDistribution(this, "Distribution", {
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
})
```

## Customizing authorization

The `CloudFrontAuth` construct accepts a `requireGroupAnyOf` property
that causes access to be restricted to only users in specific groups.
