import * as lambda from "aws-cdk-lib/aws-lambda"
import * as path from "path"
import { Construct } from "constructs"
import { Duration, Stack } from "aws-cdk-lib"
import { PolicyStatement } from "aws-cdk-lib/aws-iam"
import { Rule, Schedule } from "aws-cdk-lib/aws-events"
import * as eventsTargets from "aws-cdk-lib/aws-events-targets"

interface LambdaVersionsCleanupProps {
  lambdaVersions: lambda.IVersion[]
}

/**
 * Cleanups the lambda versions that were published through LambdaConfig
 */
export class LambdaVersionsCleanup extends Construct {
  constructor(scope: Construct, id: string, props: LambdaVersionsCleanupProps) {
    super(scope, id)

    const versions = props.lambdaVersions
    const cleanupLambdas = new lambda.Function(this, "CleanupLambda", {
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../dist/cleanup-lambdas"),
      ),
      handler: "index.handler",
      timeout: Duration.seconds(60),
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        lambdaArns: JSON.stringify(
          versions.map((v) => this.constructFunctionArn(v)),
        ),
      },
    })
    const scheduleExpression = "cron(1 0 * * ? *)"
    const rule = new Rule(this, "ScheduledCleanupRule", {
      schedule: Schedule.expression(scheduleExpression),
    })
    this.setupPermissions(cleanupLambdas, versions)

    rule.addTarget(new eventsTargets.LambdaFunction(cleanupLambdas))
  }

  private setupPermissions(
    lambdaFunction: lambda.Function,
    lambdaVersions: lambda.IVersion[],
  ) {
    lambdaVersions.forEach((lambdaVersion) => {
      const functionArn = this.constructFunctionArn(lambdaVersion)
      lambdaFunction.addToRolePolicy(
        new PolicyStatement({
          actions: ["lambda:DeleteFunction", "lambda:ListVersionsByFunction"],
          resources: [functionArn, `${functionArn}:*`],
        }),
      )
    })
  }

  private constructFunctionArn(
    lambdaVersion: lambda.IVersion,
    region = "us-east-1",
  ): string {
    const account = Stack.of(this).account
    const functionName = lambdaVersion.lambda.functionName

    return `arn:aws:lambda:${region}:${account}:function:${functionName}`
  }
}
