import { executionBatch } from "../index";

test("executionBatch parsing", async () => {
  process.env.AWS_DEFAULT_REGION = "eu-west-2";
  const res = await executionBatch({
    executions: [
      {
        pipelineName: "test1424242"
      },
      {
        pipelineName: "test2",
        roleArn: "role1"
      },
      {
        pipelineName: "test3",
        roleArn: "role2"
      },
      {
        pipelineName: "test4",
        roleArn: "role1"
      },
      {
        pipelineName: "test5",
        roleArn: "role1",
        region: "eu-west-1"
      }
    ]
  });
  res.forEach(r => expect(r.error).toBeTruthy());
}, 20000);

test.skip("executionBatch real thing", async () => {
  const res = await executionBatch({
    executions: [
      {
        pipelineName: "PIPELINE1",
        region: "eu-west-1"
      },
      {
        pipelineName: "PIPELINE2",
        region: "eu-west-2",
        roleArn: "arn:aws:iam::XXXXXXXXX:role/YYYYY"
      }
    ]
  });
  res.forEach(r => expect(r.response.pipelineExecutionId).toBeTruthy());
}, 20000);
