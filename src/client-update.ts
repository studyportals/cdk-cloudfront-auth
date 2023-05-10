import * as cognito from "aws-cdk-lib/aws-cognito"
import * as iam from "aws-cdk-lib/aws-iam"
import * as cr from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

interface ClientUpdateProps {
  oauthScopes: string[]
  client: cognito.IUserPoolClient
  userPool: cognito.IUserPool
  callbackUrl: string
  signOutUrl: string
  identityProviders: string[]
  userPoolAssumedRole?: iam.IRole
}

export class ClientUpdate extends Construct {
  constructor(scope: Construct, id: string, props: ClientUpdateProps) {
    super(scope, id)

    const iamPolicyStatements = [
      new iam.PolicyStatement({
        actions: ["cognito-idp:UpdateUserPoolClient"],
        resources: [props.userPool.userPoolArn],
      }),
    ]

    if (props.userPoolAssumedRole) {
      iamPolicyStatements.push(
        new iam.PolicyStatement({
          actions: ["sts:AssumeRole"],
          resources: [props.userPoolAssumedRole.roleArn],
        }),
      )
    }

    new cr.AwsCustomResource(this, "Resource", {
      onUpdate: {
        service: "CognitoIdentityServiceProvider",
        action: "updateUserPoolClient",
        assumedRoleArn: props.userPoolAssumedRole?.roleArn,
        parameters: {
          AllowedOAuthFlows: ["code"],
          AllowedOAuthFlowsUserPoolClient: true,
          SupportedIdentityProviders: props.identityProviders,
          AllowedOAuthScopes: props.oauthScopes,
          ClientId: props.client.userPoolClientId,
          CallbackURLs: [props.callbackUrl],
          LogoutURLs: [props.signOutUrl],
          UserPoolId: props.userPool.userPoolId,
        },
        physicalResourceId: cr.PhysicalResourceId.of(
          `${props.userPool.userPoolId}-${props.client.userPoolClientId}`,
        ),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements(iamPolicyStatements),
    })
  }
}
