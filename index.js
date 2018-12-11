#!/usr/bin/env node
const fs = require('fs');
const jp = require('jsonpath');
const program = require('commander');
const elementRouter = require('element-router');
const gavel = require('gavel');
const tap = require('tap');

const validateRequest = async (actualRequest, expectedRequest) => {
  return new Promise((resolve, reject) => {
    gavel.isValid(actualRequest, expectedRequest, 'request', (err, gavelResult) => {
      if (err) reject(err);
      else resolve(gavelResult);
    });
  });
}

const validateResponse = async (actualResponse, expectedResponse) => {
  return new Promise((resolve, reject) => {
    gavel.isValid(actualResponse, expectedResponse, 'response', (err, gavelResult) => {
      if (err) reject(err);
      else resolve(gavelResult);
    });
  });
}

program
  .option('-a, --apidescription [name]', 'API description to validate')
  .option('-l, --log [name]', 'HAR log file to validate')
  .parse(process.argv);

const description = JSON.parse(fs.readFileSync(program.apidescription, 'utf8'));
const log = JSON.parse(fs.readFileSync(program.log, 'utf8'));

const entries = jp.query(log, '$..entries.*');

entries.forEach((item) => {
  const request = jp.query(item, '$..request')[0];
  const response = jp.query(item, '$..response')[0];

  const possibleResults = elementRouter.getResults(description, request.url, request.method);
  if (possibleResults.lenght === 0) {
    tap.fail(`${request.url} (${request.method}): Not found!`);
  } else {
    const valid = possibleResults.map((result) => {
      const actualRequestHeaders = {};
      const actualResponseHeaders = {};
      const expectedRequestHeaders = {};
      const expectedResponseHeaders = {};

      if (result.request.headers) {
        result.request.headers.forEach((item) => {
          expectedRequestHeaders[item.key] = item.value;
        });
      }

      if (result.response.headers) {
        response.headers.forEach((item) => {
          actualRequestHeaders[item.name] = item.value;
        });
      }

      if (response.headers) {
        response.headers.forEach((item) => {
          expectedResponseHeaders[item.name] = item.value;
        });
      }

      if (response.headers) {
        response.headers.forEach((item) => {
          actualResponseHeaders[item.name] = item.value;
        });
      }

      const actualRequest = {
        headers: actualRequestHeaders,
        body: request.postData.text,
      };
      const expectedRequest = {
        headers: expectedRequestHeaders,
        body: result.request.content,
      };

      const actualResponse = {
        headers: actualResponseHeaders,
        body: response.content.text,
      };
      const expectedResponse = {
        headers: expectedResponseHeaders,
        body: result.response.content,
      };

      return Promise.all([
        validateRequest(actualRequest, expectedRequest),
        validateResponse(actualResponse, expectedResponse),
      ]);
    });
    Promise.all(valid)
      .then((results) => {
        const validPair = results.find(item => item[0] === true && item[1] === true);
        if (!validPair) {
          tap.fail(`${request.url} (${request.method}): Not valid!`);
        } else {
          tap.pass(`${request.url} (${request.method}): Valid`);
        }
      });
  }
});