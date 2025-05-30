// src/lib/keycloak.ts
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  url:  'https://auth-oan.kenpath.ai/auth',
  realm: 'Vistaar',
  clientId: 'vistaar-ui',
});

export default keycloak;