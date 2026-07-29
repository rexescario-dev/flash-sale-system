import { GraphQLClient } from 'graphql-request';

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const graphqlClient = new GraphQLClient(`${apiUrl.replace(/\/$/, '')}/graphql`);
