import { http, HttpResponse } from 'msw';

import { graphqlUrl, readGraphqlBody } from './graphql';

/**
 * Default GraphQL handler: HTTP is handled, but unmatched operationName returns a
 * deterministic GraphQL error (UNHANDLED_TEST_OPERATION). Tests override with server.use.
 */
export const handlers = [
  http.post(graphqlUrl(), async ({ request }) => {
    const body = await readGraphqlBody(request);
    return HttpResponse.json({
      errors: [
        {
          extensions: { code: 'UNHANDLED_TEST_OPERATION' },
          message: `Unhandled GraphQL operation in test: ${body.operationName ?? 'unknown'}`,
        },
      ],
    });
  }),
];
