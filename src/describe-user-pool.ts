import * as cognito from "aws-cdk-lib/aws-cognito"
import * as iam from "aws-cdk-lib/aws-iam"
import { RetentionDays } from "aws-cdk-lib/aws-logs"
import * as cr from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

interface DesribeUserPoolProps {
  userPool: cognito.IUserPool
  userPoolAssumedRole?: iam.IRole
}

export class DescribeUserPool extends Construct {
  readonly describeUserPool: cr.AwsCustomResource
  readonly iamPolicyStatements: iam.PolicyStatement[]
  readonly userPoolAssumedRole?: iam.IRole
  private userPoolRegion: string
  private userPoolDomain: string

  constructor(scope: Construct, id: string, props: DesribeUserPoolProps) {
    super(scope, id)

    this.iamPolicyStatements = [
      new iam.PolicyStatement({
        actions: ["cognito-idp:DescribeUserPool"],
        resources: ["*"],
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

    this.describeUserPool = new cr.AwsCustomResource(
      this,
      "describe-userpool-client",
      {
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "describeUserPool",
          assumedRoleArn: props.userPoolAssumedRole?.roleArn,
          parameters: {
            UserPoolId: props.userPool.userPoolId,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `describe-${props.userPool.userPoolId}`,
          ),
          outputPaths: ["UserPool.Domain", "UserPool.Arn"],
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements(
          this.iamPolicyStatements,
        ),
        logRetention: RetentionDays.ONE_DAY,
      },
    )
    this.userPoolDomain =
      this.describeUserPool.getResponseField("UserPool.Domain")

    this.userPoolRegion = props.userPool.userPoolArn.split(":")[3]
  }

  public getCognitoAuthDomain(): string {
    return `${this.userPoolDomain}.auth.${this.userPoolRegion}.amazoncognito.com`
  }
}
