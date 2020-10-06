# CodePipeline helper functions

[![npm](https://img.shields.io/npm/v/@viperhq/pipeline.svg)](https://www.npmjs.com/package/@viperhq/pipeline)

### Running executionBatch

```JavaScript
executionBatch({
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
})
```
