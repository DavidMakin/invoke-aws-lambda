import AWS from 'aws-sdk/global';
import https from 'https';
import Lambda from 'aws-sdk/clients/lambda';
import { getInput, setOutput, setFailed, setSecret } from '@actions/core';

const apiVersion = '2015-03-31';

export enum ExtraOptions {
  HTTP_TIMEOUT = 'HTTP_TIMEOUT',
  MAX_RETRIES = 'MAX_RETRIES',
  SUCCEED_ON_FUNCTION_FAILURE = 'SUCCEED_ON_FUNCTION_FAILURE',
}

export enum Credentials {
  AWS_ACCESS_KEY_ID = 'AWS_ACCESS_KEY_ID',
  AWS_SECRET_ACCESS_KEY = 'AWS_SECRET_ACCESS_KEY',
  AWS_SESSION_TOKEN = 'AWS_SESSION_TOKEN',
}

export enum Props {
  FunctionName = 'FunctionName',
  InvocationType = 'InvocationType',
  LogType = 'LogType',
  ClientContext = 'ClientContext',
  Payload = 'Payload',
  Qualifier = 'Qualifier',
}

const setAWSCredentials = () => {
  const accessKeyId = getInput(Credentials.AWS_ACCESS_KEY_ID);
  setSecret(accessKeyId);

  const secretAccessKey = getInput(Credentials.AWS_SECRET_ACCESS_KEY);
  setSecret(secretAccessKey);

  const sessionToken = getInput(Credentials.AWS_SESSION_TOKEN);
  // Make sure we only mask if specified
  if (sessionToken) {
    setSecret(sessionToken);
  }

  AWS.config.credentials = {
    accessKeyId,
    secretAccessKey,
    sessionToken,
  };
};

const getParams = () => {
  return Object.keys(Props).reduce((memo, prop) => {
    const value = getInput(prop);
    return value ? { ...memo, [prop]: value } : memo;
  }, {} as Lambda.InvocationRequest);
};

const setAWSConfigOptions = () => {
  const httpTimeout = getInput(ExtraOptions.HTTP_TIMEOUT);

  if (httpTimeout) {
    AWS.config.httpOptions = { timeout: parseInt(httpTimeout, 10) };
  }

  const maxRetries = getInput(ExtraOptions.MAX_RETRIES);

  if (maxRetries) {
    AWS.config.maxRetries = parseInt(maxRetries, 10);
  }
};

export const main = async () => {
  try {
    setAWSCredentials();

    setAWSConfigOptions();

    const agent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 500,
      timeout: 600000, // 10 minutes
    });

    const params = getParams();

    const lambda = new Lambda({
      apiVersion,
      region: getInput('REGION'),
      httpOptions: { agent: agent },
    });

    const response = await lambda.invoke(params).promise();

    setOutput('response', response);

    const succeedOnFailure = getInput(ExtraOptions.SUCCEED_ON_FUNCTION_FAILURE).toLowerCase() === 'true';
    if ('FunctionError' in response && !succeedOnFailure) {
      throw new Error('Lambda invocation failed! See outputs.response for more information.');
    }
  } catch (error) {
    setFailed(error instanceof Error ? error.message : JSON.stringify(error));
  }
};
