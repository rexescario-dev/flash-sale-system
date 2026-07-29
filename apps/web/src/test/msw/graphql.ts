type GraphqlBody = {
  operationName?: string;
  query?: string;
  variables?: Record<string, unknown>;
};

export async function readGraphqlBody(request: Request): Promise<GraphqlBody> {
  return (await request.json()) as GraphqlBody;
}

export function graphqlUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
  return `${apiUrl.replace(/\/$/, '')}/graphql`;
}
