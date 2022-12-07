import { Stack } from "aws-cdk-lib"
import * as cognito from "aws-cdk-lib/aws-cognito"
import { IUserPoolClient, UserPoolClient } from "aws-cdk-lib/aws-cognito"
import * as iam from "aws-cdk-lib/aws-iam"
import * as cr from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

interface ClientCreateProps {
  oauthScopes: string[]
  client: cognito.IUserPoolClient
  userPool: cognito.IUserPool
  callbackUrl: string
  identityProviders: string[]
  userPoolAssumedRole?: iam.IRole
}

export class ClientCreate extends Construct {
  readonly createClientResource: cr.AwsCustomResource
  readonly iamPolicyStatements: iam.PolicyStatement[]
  readonly userPoolAssumedRole?: iam.IRole
  private clientId: string

  constructor(scope: Construct, id: string, props: ClientCreateProps) {
    super(scope, id)
    const ClientName = `${Stack.of(this).stackName}-client`
    this.userPoolAssumedRole = props.userPoolAssumedRole

    this.iamPolicyStatements = [
      new iam.PolicyStatement({
        actions: ["cognito-idp:CreateUserPoolClient"],
        resources: [props.userPool.userPoolArn],
      }),
    ]

    if (props.userPoolAssumedRole) {
      this.iamPolicyStatements.push(
        new iam.PolicyStatement({
          actions: ["sts:AssumeRole"],
          resources: [props.userPoolAssumedRole.roleArn],
        }),
      )
    }

    this.createClientResource = new cr.AwsCustomResource(
      this,
      "create-userpool-client",
      {
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "createUserPoolClient",
          assumedRoleArn: props.userPoolAssumedRole?.roleArn,
          parameters: {
            ClientName,
            UserPoolId: props.userPool.userPoolId,
            AllowedOAuthFlowsUserPoolClient: true,
            AllowedOAuthFlows: ["code"],
            CallbackURLs: [props.callbackUrl],
            GenerateSecret: true,
            ExplicitAuthFlows: [
              "ALLOW_USER_PASSWORD_AUTH",
              "ALLOW_USER_SRP_AUTH",
              "ALLOW_REFRESH_TOKEN_AUTH",
            ],
            PreventUserExistenceErrors: "ENABLED",
            SupportedIdentityProviders: props.identityProviders,
            AllowedOAuthScopes: props.oauthScopes,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `${props.userPool.userPoolId}-${ClientName}`,
          ),
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements(
          this.iamPolicyStatements,
        ),
      },
    )
    this.clientId = this.createClientResource.getResponseField(
      "UserPoolClient.ClientId",
    )
    this.setupDeleteUserPoolClient(props.userPool.userPoolId)
  }

  private setupDeleteUserPoolClient(userPoolId: string) {
    new cr.AwsCustomResource(this, "delete-userpool-client", {
      onDelete: {
        service: "CognitoIdentityServiceProvider",
        action: "deleteUserPoolClient",
        assumedRoleArn: this.userPoolAssumedRole?.roleArn,
        parameters: {
          UserPoolId: userPoolId,
          ClientId: this.clientId,
        },
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements(
        this.iamPolicyStatements,
      ),
    })
  }

  getUserPoolClient(): IUserPoolClient {
    return UserPoolClient.fromUserPoolClientId(
      this,
      "UserPoolClient",
      this.clientId,
    )
  }
}
