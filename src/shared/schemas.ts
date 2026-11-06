import { z } from 'zod'

const keyValueSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  enabled: z.boolean(),
  description: z.string().optional(),
  type: z.enum(['text', 'file']).optional(),
  filePath: z.string().optional()
})

const authConfigSchema = z.object({
  type: z.enum(['none', 'apikey', 'bearer', 'basic', 'digest', 'oauth2']),
  apiKey: z
    .object({
      key: z.string(),
      value: z.string(),
      in: z.enum(['header', 'query']),
      addTo: z.string().optional()
    })
    .optional(),
  bearer: z.object({ token: z.string() }).optional(),
  basic: z.object({ username: z.string(), password: z.string() }).optional(),
  digest: z.object({ username: z.string(), password: z.string() }).optional(),
  oauth2: z
    .object({
      accessToken: z.string(),
      tokenType: z.string().optional(),
      headerPrefix: z.string().optional()
    })
    .optional()
})

const requestSettingsSchema = z.object({
  timeoutMs: z.number().int().positive().max(600000),
  followRedirects: z.boolean(),
  maxRedirects: z.number().int().min(0).max(20),
  verifySsl: z.boolean()
})

export const httpRequestConfigSchema = z.object({
  method: z.string().min(1).max(20),
  url: z.string().max(8192),
  params: z.array(keyValueSchema).max(500),
  headers: z.array(keyValueSchema).max(500),
  bodyType: z.enum(['none', 'json', 'text', 'xml', 'html', 'form-data', 'urlencoded', 'binary', 'raw']),
  body: z.object({
    content: z.string().optional(),
    filePath: z.string().optional(),
    form: z.array(keyValueSchema).max(500).optional()
  }),
  auth: authConfigSchema,
  settings: requestSettingsSchema,
  preScript: z.string().max(200000).optional(),
  postScript: z.string().max(200000).optional()
})

export const idSchema = z.string().uuid()

export const sendHttpRequestInputSchema = z.object({
  config: httpRequestConfigSchema,
  /** variable map resolved by caller (main) — here only the raw instruction */
  operationId: z.string().optional()
})

export const collectionCreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional()
})

export const folderCreateSchema = z.object({
  collectionId: idSchema,
  parentFolderId: idSchema.nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional()
})

export const requestSaveSchema = z.object({
  collectionId: idSchema,
  folderId: idSchema.nullable().optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  config: httpRequestConfigSchema
})

export const environmentCreateSchema = z.object({
  name: z.string().min(1).max(200)
})

export const variableUpsertSchema = z.object({
  ownerType: z.enum(['global', 'environment', 'collection', 'folder', 'request', 'local']),
  ownerId: z.string(),
  key: z.string().min(1).max(200),
  value: z.string().max(100000),
  enabled: z.boolean(),
  isSecret: z.boolean()
})

export const scriptRunInputSchema = z.object({
  script: z.string().max(200000),
  phase: z.enum(['pre', 'post']),
  variables: z.record(z.string()),
  responseJson: z.string().optional(),
  statusCode: z.number().optional(),
  responseTimeMs: z.number().optional()
})

export const runnerInputSchema = z.object({
  collectionId: idSchema,
  folderId: idSchema.nullable().optional(),
  environmentId: idSchema.nullable().optional(),
  iterations: z.number().int().min(1).max(1000).optional(),
  delayMs: z.number().int().min(0).max(60000).optional(),
  dataJson: z.string().optional()
})

export const curlImportSchema = z.object({ curl: z.string().min(1).max(500000) })

export const wsConnectSchema = z.object({
  url: z.string().url().max(8192),
  protocols: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional()
})
