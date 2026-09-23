// Load .env (if present) before anything reads process.env. Imported first by the CLI.
try {
  process.loadEnvFile(".env");
} catch {
  // no .env file: rely on the real environment (e.g. GitHub Actions secrets/vars)
}
