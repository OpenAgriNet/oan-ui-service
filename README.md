# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/afec2208-4af9-49f5-938f-9c74c92f89fe

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/afec2208-4af9-49f5-938f-9c74c92f89fe) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## Keycloak Authentication Setup

To enable authentication, you need a running Keycloak server. Below are steps to set up Keycloak locally and link it to this project.

### 1. Run Keycloak Locally (with Docker)

If you don't have Docker, install it from [here](https://www.docker.com/get-started/).

Start a Keycloak server with:

```sh
docker run -p 8888:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin quay.io/keycloak/keycloak:24.0.4 start-dev
```

- Keycloak will be available at http://localhost:8888
- Default admin username/password: `admin` / `admin`

### 2. Create Realm, Client, and User

1. Go to [http://localhost:8888](http://localhost:8888) and log in as admin.
2. **Create a Realm** (e.g., `Vistaar`).
3. **Create a Client**:
   - Go to 'Clients' > 'Create client'.
   - Client ID: `vistaar-ui`
   - Client type: `public`
   - Root URL: `http://localhost:8081` (or your app's URL)
   - Save and configure as needed.
4. **Create a User**:
   - Go to 'Users' > 'Add user'.
   - Set username, email, etc.
   - After creating, go to 'Credentials' tab to set a password.

### 3. Link Keycloak to This App

Edit `src/lib/keycloak.ts` to match your Keycloak server settings. For local development, use:

```ts
const keycloak = new Keycloak({
  url: 'http://localhost:8888/',
  realm: 'Vistaar',
  clientId: 'vistaar-ui',
});
```

If using a remote Keycloak server, update the `url`, `realm`, and `clientId` accordingly.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/afec2208-4af9-49f5-938f-9c74c92f89fe) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes it is!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
