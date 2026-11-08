import { RuleTester } from 'eslint';
import test, { describe } from 'node:test';
import { readabilityPlugin } from '../eslint.config.js';

RuleTester.describe = describe;
RuleTester.it = test;
RuleTester.itOnly = test.only;

const ruleTester = new RuleTester();

ruleTester.run('readability/prefer-early-return', readabilityPlugin.rules['prefer-early-return'], {
  valid: [
    {
      code: `
          function handleEvent(event) {
            if (!event) {
              return;
            }

            console.log('Valid');
            doStepOne();
            doStepTwo();
          }
        `,
    },
    {
      code: `
          function smallIf(callback) {
            if (callback) {
              callback();
            }
          }
        `,
      options: [{ minStatements: 3 }],
    },
    {
      code: `
          function ifElse(val) {
            if (val) {
              stepOne();
              stepTwo();
              stepThree();
            } else {
              fallback();
            }
          }
        `,
      options: [{ minStatements: 3 }],
    },
    {
      code: `
          function notLastStatement(val) {
            if (val) {
              stepOne();
              stepTwo();
              stepThree();
            }

            cleanUp();
          }
        `,
      options: [{ minStatements: 3 }],
    },
  ],
  invalid: [
    {
      code: `
          function runWork(data) {
            if (data) {
              console.log(data);
              stepOne();
              stepTwo();
            }
          }
        `,
      options: [{ minStatements: 3 }],
      errors: [
        {
          message:
            'Prefer an early return/guard clause instead of wrapping 3 statements in an "if" block at the end of the function.',
        },
      ],
    },
    {
      code: `
          const processItem = (item) => {
            if (item.isValid) {
              const x = item.x;
              const y = item.y;
              sendItem(x, y);
            }
          };
        `,
      options: [{ minStatements: 3 }],
      errors: [
        {
          message:
            'Prefer an early return/guard clause instead of wrapping 3 statements in an "if" block at the end of the function.',
        },
      ],
    },
  ],
});
