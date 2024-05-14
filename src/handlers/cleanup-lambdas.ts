import {
  LambdaClient,
  ListVersionsByFunctionCommand,
  DeleteFunctionCommand,
} from "@aws-sdk/client-lambda"
import { Handler } from "aws-lambda"

const lambdaClient = new LambdaClient({})

async function deleteVersions(functionArn: string, versionsToKeep: string[]) {
  const match = functionArn.match(/arn:aws:lambda:[^:]+:\d+:function:([^:]+)/)
  if (!match) {
    console.error("Invalid function ARN:", functionArn)
    return
  }

  const funcName = match[1]
  const listVersionsCommand = new ListVersionsByFunctionCommand({
    FunctionName: functionArn,
  })
  const response = await lambdaClient.send(listVersionsCommand)

  if (!response.Versions) return

  for (const version of response.Versions) {
    if (version.Version && versionsToKeep.includes(version.Version)) continue

    const ageInMilliseconds =
      Date.now() - Date.parse(version.LastModified ?? Date.now().toString())
    if (ageInMilliseconds < 86400000) continue

    const deleteFunctionCommand = new DeleteFunctionCommand({
      FunctionName: funcName,
      Qualifier: version.Version,
    })

    try {
      await lambdaClient.send(deleteFunctionCommand)
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
