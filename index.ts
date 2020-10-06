import * as AWS from "aws-sdk";
import { Agent } from "https";
import { ConfigurationOptions } from "aws-sdk/lib/config-base";
import { CredentialsOptions } from "aws-sdk/lib/credentials";
import { v4 as uuid } from "uuid";

export interface Execution {
  pipelineName: string;
  region?: string;
  roleArn?: string;
}

export interface ExecutionResult extends Execution {
  response?: AWS.CodePipeline.StartPipelineExecutionOutput;
  error?: AWS.AWSError;
}

export interface ExecutionBatchArgs {
  roleSessionName?: string;
  executions: Execution[];
}

const defaultExecutionParams: () => Execution = () => ({
  pipelineName: "",
  region: process.env.AWS_DEFAULT_REGION
});

const defaultAWSSDKOpts: ConfigurationOptions = {
  httpOptions: {
    agent: new Agent({
      keepAlive: true,
      maxSockets: Infinity
    })
  },
  maxRetries: 5,
  retryDelayOptions: {
    base: 50
  }
};

interface ExecutionGroups {
  [key: string]: {
    [key: string]: {
      client: AWS.CodePipeline;
      creds?: CredentialsOptions;
      executions: Execution[];
    };
  };
}

export async function executionBatch(
  args: ExecutionBatchArgs,
  logger = (_: string) => {},
  awsSDKOverride: ConfigurationOptions = {}
): Promise<ExecutionResult[]> {
  if (!args.roleSessionName) {
    args.roleSessionName = uuid();
  }

  const executions = args.executions.map(e => ({
    ...defaultExecutionParams(),
    ...e
  }));
  const stsClient = new AWS.STS({
    ...defaultAWSSDKOpts,
    ...awsSDKOverride
  });

  const groups = executions.reduce((memo: ExecutionGroups, e) => {
    const roleGroup = e.roleArn || "default";
    memo[e.region] = memo[e.region] || {};
    memo[e.region][roleGroup] = memo[e.region][roleGroup] || {
      client: new AWS.CodePipeline({
        ...defaultAWSSDKOpts,
        ...awsSDKOverride,
        region: e.region
      }),
      executions: []
    };
    memo[e.region][roleGroup].executions.push(e);
    return memo;
  }, {});

  const promises = [];

  const res: {
    [key: string]: ExecutionResult;
  } = {};

  let executionIndex = 0;
  for (const region of Object.values(groups)) {
    for (const [roleArn, role] of Object.entries(region)) {
      if (roleArn !== "default" && !role.creds) {
        try {
          const response = await stsClient
            .assumeRole({
              RoleArn: roleArn,
              RoleSessionName: args.roleSessionName
            })
            .promise();

          role.creds = {
            accessKeyId: response.Credentials.AccessKeyId,
            secretAccessKey: response.Credentials.SecretAccessKey,
            sessionToken: response.Credentials.SessionToken
          };
        } catch (e) {
          logger(e);
          role.creds = {
            accessKeyId: "INVALID",
            secretAccessKey: "INVALID",
            sessionToken: "INVALID"
          };
        }
        role.client.config.credentials = role.creds;
      }
      for (const execution of role.executions) {
        // We have to capture the "global" variable because
        // there is an async detach here and it would use the max executionIndex
        const capturedExecutionIndex = executionIndex;
        promises.push(
          role.client
            .startPipelineExecution({
              name: execution.pipelineName
            })
            .promise()
            .then(
              r =>
                (res[capturedExecutionIndex] = {
                  ...execution,
                  response: r
                })
            )
            .catch(e => {
              logger(e);
              res[capturedExecutionIndex] = {
                ...execution,
                error: e
              };
            })
        );
        executionIndex += 1;
      }
    }
  }

  await Promise.all(promises);

  return Object.values(res);
}
