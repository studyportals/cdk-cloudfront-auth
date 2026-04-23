import * as cognito from "aws-cdk-lib/aws-cognito"
import * as iam from "aws-cdk-lib/aws-iam"
import * as lambda from "aws-cdk-lib/aws-lambda"
import * as cr from "aws-cdk-lib/custom-resources"
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib"
import { Construct } from "constructs"
import * as path from "path"

interface PreTokenGenerationTriggerProps {
  userPool: cognito.IUserPool
  userPoolAssumedRole?: iam.IRole
}

/**
 * Wires a Pre Token Generation V2 Lambda trigger to an existing Cognito user
 * pool to suppress unused JWT claims, reducing cookie size.
 *
 * Uses AwsCustomResource because the user pool is imported (not created here)
 * and CDK's addTrigger() only works on mutable UserPool constructs.
 */
export class PreTokenGenerationTrigger extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: PreTokenGenerationTriggerProps,
  ) {
    super(scope, id)

    const { userPool, userPoolAssumedRole } = props
    const region = Stack.of(this).region

    const preTokenGenerationLambda = new lambda.Function(
      this,
      "PreTokenGenerationFunction",
      {
        code: lambda.Code.fromAsset(
          path.join(__dirname, "../dist/pre-token-generation"),
        ),
        handler: "index.handler",
        runtime: lambda.Runtime.NODEJS_24_X,
        timeout: Duration.seconds(5),
      },
    )

    preTokenGenerationLambda.addPermission("CognitoInvokePermission", {
      principal: new iam.ServicePrincipal("cognito-idp.amazonaws.com"),
      sourceArn: userPool.userPoolArn,
    })

    const iamPolicyStatements = [
      new iam.PolicyStatement({
        actions: ["cognito-idp:UpdateUserPool"],
        resources: [userPool.userPoolArn],
      }),
    ]

    if (userPoolAssumedRole) {
      iamPolicyStatements.push(
        new iam.PolicyStatement({
          actions: ["sts:AssumeRole"],
          resources: [userPoolAssumedRole.roleArn],
        }),
      )
    }

    const sdkCallBase = {
      service: "CognitoIdentityServiceProvider",
      action: "updateUserPool",
      ...(userPoolAssumedRole
        ? { assumedRoleArn: userPoolAssumedRole.roleArn }
        : {}),
      region,
      physicalResourceId: cr.PhysicalResourceId.of(
        `${userPool.userPoolId}-pre-token-generation`,
      ),
    }

    const sdkCall: cr.AwsSdkCall = {
      ...sdkCallBase,
      parameters: {
        UserPoolId: userPool.userPoolId,
        LambdaConfig: {
          PreTokenGenerationConfig: {
            LambdaArn: preTokenGenerationLambda.functionArn,
            LambdaVersion: "V2_0",
          },
        },
      },
    }

    // On delete, set PreTokenGenerationConfig to null so only this trigger is
    // removed. The AWS API treats null on an individual LambdaConfig field as
    // "deactivate this trigger", leaving all other triggers untouched.
    const deleteCall: cr.AwsSdkCall = {
      ...sdkCallBase,
      parameters: {
        UserPoolId: userPool.userPoolId,
        LambdaConfig: {
          PreTokenGenerationConfig: null,
        },
      },
    }

    const customResource = new cr.AwsCustomResource(
      this,
      "PreTokenGenerationCustomResource",
      {
        onCreate: sdkCall,
        onUpdate: sdkCall,
        onDelete: deleteCall,
        policy: cr.AwsCustomResourcePolicy.fromStatements(iamPolicyStatements),
        removalPolicy: RemovalPolicy.DESTROY,
      },
    )

    // Ensure CloudFormation deletes the custom resource (running onDelete) before
    // the Lambda, so the user pool is cleared while the stack teardown is still
    // in progress and the rest of the stack resources still exist.
    customResource.node.addDependency(preTokenGenerationLambda)
  }
}
