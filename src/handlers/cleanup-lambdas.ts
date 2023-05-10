import { Handler } from "aws-lambda"
import * as AWS from "aws-sdk"

const lambda = new AWS.Lambda()

async function deleteVersions(functionArn: string, versionsToKeep: string[]) {
  const match = functionArn.match(/arn:aws:lambda:[^:]+:\d+:function:([^:]+)/)
  if (!match) {
    console.error("Invalid function ARN:", functionArn)
    return
  }

  const funcName = match[1]
  const listVersionsParams = { FunctionName: functionArn }
  const { Versions } = await lambda
    .listVersionsByFunction(listVersionsParams)
    .promise()

  if (!Versions) return

  for (const version of Versions) {
    if (version.Version && versionsToKeep.includes(version.Version)) continue

    const ageInMilliseconds =
      Date.now() - Date.parse(version.LastModified ?? Date.now().toString())
    if (ageInMilliseconds < 86400000) continue

    const deleteParams = { FunctionName: funcName, Qualifier: version.Version }
    try {
      await lambda.deleteFunction(deleteParams).promise()
      console.log("Deleted version:", version.Version, "of function:", funcName)
    } catch (error) {
      console.error(
        "Failed to delete version:",
        version.Version,
        "of function:",
        funcName,
        error,
      )
    }
  }
}

export const handler: Handler = async (event) => {
  console.log(JSON.stringify(event, null, 2))
  const lambdaArns = process.env.lambdaArns as string
  const arns: string[] = JSON.parse(lambdaArns) as []
  for (const functionArn of arns) {
    await deleteVersions(functionArn, ["LATEST"])
  }
}
