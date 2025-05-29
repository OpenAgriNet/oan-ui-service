// src/lib/keycloak.ts
import Keycloak from 'keycloak-js';

const keycloak = new Keycloak({
  // url: 'http://localhost:8888/',
  // url:  'http://192.168.100.195:8888/',
  url:  'https://accounts.vistaar.kenpath.ai/auth',
//   url:  'https://accounts.vistaar.kenpath.ai/auth/',
  realm: 'Vistaar',
  clientId: 'vistaar-ui',
});

export default keycloak;