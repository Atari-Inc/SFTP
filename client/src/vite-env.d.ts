/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_AWS_ACCESS_KEY: string
  readonly VITE_AWS_SECRET_KEY: string
  readonly VITE_AWS_REGION: string
  readonly VITE_AWS_ROLE_ARN: string
  readonly VITE_AWS_BUCKET: string
  readonly VITE_DB_HOST: string
  readonly VITE_DB_PORT: string
  readonly VITE_DB_NAME: string
  readonly VITE_DB_USER: string
  readonly VITE_DB_PASSWORD: string
  readonly VITE_DATABASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}