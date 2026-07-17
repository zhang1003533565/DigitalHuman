import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function readRequired(path) {
  const absolute = join(root, path)
  try {
    statSync(absolute)
    return readFileSync(absolute, 'utf8')
  } catch (error) {
    throw new Error(`Missing required deployment file: ${path}`)
  }
}

function assertIncludes(file, content, expected) {
  if (!content.includes(expected)) {
    throw new Error(`${file} must include: ${expected}`)
  }
}

function assertMatches(file, content, pattern) {
  if (!pattern.test(content)) {
    throw new Error(`${file} must match: ${pattern}`)
  }
}

const requiredFiles = [
  '.github/workflows/deploy.yml',
  'backend-java/Dockerfile',
  'frontend-admin/Dockerfile',
  'frontend-visitor/Dockerfile',
  'docker/nginx/admin.conf',
  'docker/nginx/visitor.conf',
  'deploy/compose.prod.yml',
  'deploy/remote/deploy.sh',
  'deploy/remote/cleanup.sh',
  'deploy/remote/README.md',
]

const files = Object.fromEntries(
  requiredFiles.map((path) => [path, readRequired(path)]),
)

const workflow = files['.github/workflows/deploy.yml']
assertIncludes('.github/workflows/deploy.yml', workflow, 'branches: [main]')
assertIncludes('.github/workflows/deploy.yml', workflow, 'docker/login-action@v4')
assertIncludes('.github/workflows/deploy.yml', workflow, 'docker/build-push-action@v7')
assertIncludes('.github/workflows/deploy.yml', workflow, 'appleboy/ssh-action')
for (const service of ['backend', 'ai-service', 'frontend-admin', 'frontend-visitor']) {
  assertIncludes('.github/workflows/deploy.yml', workflow, `service: ${service}`)
  assertMatches(
    '.github/workflows/deploy.yml',
    workflow,
    new RegExp(`DIGITALHUMAN_${service.replaceAll('-', '_').toUpperCase()}_IMAGE`, 'u'),
  )
}

const compose = files['deploy/compose.prod.yml']
for (const service of ['mysql', 'redis', 'qdrant', 'backend-java', 'ai-service', 'frontend-admin', 'frontend-visitor']) {
  assertMatches('deploy/compose.prod.yml', compose, new RegExp(`^  ${service}:`, 'mu'))
}
assertIncludes('deploy/compose.prod.yml', compose, '${DIGITALHUMAN_BACKEND_IMAGE}')
assertIncludes('deploy/compose.prod.yml', compose, '${DIGITALHUMAN_AI_SERVICE_IMAGE}')
assertIncludes('deploy/compose.prod.yml', compose, '${DIGITALHUMAN_FRONTEND_ADMIN_IMAGE}')
assertIncludes('deploy/compose.prod.yml', compose, '${DIGITALHUMAN_FRONTEND_VISITOR_IMAGE}')
assertIncludes('deploy/compose.prod.yml', compose, 'docker compose pull')

const deployScript = files['deploy/remote/deploy.sh']
assertIncludes('deploy/remote/deploy.sh', deployScript, 'docker login')
assertIncludes('deploy/remote/deploy.sh', deployScript, 'docker compose pull')
assertIncludes('deploy/remote/deploy.sh', deployScript, 'docker compose up -d')
assertIncludes('deploy/remote/deploy.sh', deployScript, './cleanup.sh')

const cleanupScript = files['deploy/remote/cleanup.sh']
assertIncludes('deploy/remote/cleanup.sh', cleanupScript, 'docker image prune')
assertIncludes('deploy/remote/cleanup.sh', cleanupScript, 'docker builder prune')
assertIncludes('deploy/remote/cleanup.sh', cleanupScript, 'DIGITALHUMAN_IMAGE_KEEP')

for (const dockerfile of ['backend-java/Dockerfile', 'frontend-admin/Dockerfile', 'frontend-visitor/Dockerfile']) {
  assertIncludes(dockerfile, files[dockerfile], 'HEALTHCHECK')
}

assertIncludes('docker/nginx/admin.conf', files['docker/nginx/admin.conf'], 'try_files $uri $uri/ /index.html')
assertIncludes('docker/nginx/visitor.conf', files['docker/nginx/visitor.conf'], 'proxy_pass http://ai-service:18755/')
assertIncludes('deploy/remote/README.md', files['deploy/remote/README.md'], 'ALIYUN_REGISTRY')
assertIncludes('deploy/remote/README.md', files['deploy/remote/README.md'], 'GitHub Secrets')

console.log('Deployment configuration contract verified.')
