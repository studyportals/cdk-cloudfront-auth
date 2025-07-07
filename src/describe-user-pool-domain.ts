import * as iam from "aws-cdk-lib/aws-iam"
import { RetentionDays } from "aws-cdk-lib/aws-logs"
import * as cr from "aws-cdk-lib/custom-resources"
import { Construct } from "constructs"

interface DescribeUserPoolDomainProps {
  userPoolCustomDomain: string
  userPoolAssumedRole?: iam.IRole
}

export class DescribeUserPoolDomain extends Construct {
  readonly describeUserPool: cr.AwsCustomResource
  readonly iamPolicyStatements: iam.PolicyStatement[]
  readonly userPoolAssumedRole?: iam.IRole
  readonly userPoolId: string

  constructor(
    scope: Construct,
    id: string,
    props: DescribeUserPoolDomainProps,
  ) {
    super(scope, id)

    this.iamPolicyStatements = [
      new iam.PolicyStatement({
        actions: ["cognito-idp:DescribeUserPoolDomain"],
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
      "describe-userpool-domain",
      {
        onUpdate: {
          service: "CognitoIdentityServiceProvider",
          action: "describeUserPoolDomain",
          assumedRoleArn: props.userPoolAssumedRole?.roleArn,
          parameters: {
            Domain: props.userPoolCustomDomain,
          },
          physicalResourceId: cr.PhysicalResourceId.of(
            `describe-${props.userPoolCustomDomain}`,
          ),
          outputPaths: ["DomainDescription.UserPoolId"],
        },
        policy: cr.AwsCustomResourcePolicy.fromStatements(
          this.iamPolicyStatements,
        ),
        logRetention: RetentionDays.ONE_DAY,
      },
    )
    this.userPoolId = this.describeUserPool.getResponseField(
      "DomainDescription.UserPoolId",
    )
  }
}
