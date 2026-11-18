// ApnaCity CI/CD — Jenkins declarative pipeline (Step 3, 2026-11-16).
// Runs on the in-cluster JNLP agents (jenkins-agent-0/1/2). Node 22 + pnpm are
// provisioned into the agent user home (idempotent — self-heals after pod restart).
// Integration tests hit the in-cluster Postgres service directly.
pipeline {
  agent any

  environment {
    // in-cluster DB service (agents run in the cluster) — no NodePort needed
    DATABASE_URL = 'postgresql://apnacity:apnacity@postgres.apnacity.svc.cluster.local:5432/apnacity'
    NODE_DIR     = "${HOME}/.local/node"
    PATH         = "${HOME}/.local/node/bin:${env.PATH}"
    CI           = 'true'
  }

  options {
    timestamps()
    timeout(time: 30, unit: 'MINUTES')
    disableConcurrentBuilds()
    buildDiscarder(logRotator(numToKeepStr: '20'))
  }

  stages {
    stage('Toolchain') {
      steps {
        sh '''
          set -e
          NODE_VER=v22.12.0
          if [ -x "$NODE_DIR/bin/node" ] && "$NODE_DIR/bin/node" -v | grep -q v22; then
            echo "node $(node -v) present"
          else
            mkdir -p "$NODE_DIR"
            curl -fsSL "https://nodejs.org/dist/${NODE_VER}/node-${NODE_VER}-linux-x64.tar.gz" -o /tmp/node.tgz
            tar -xzf /tmp/node.tgz -C "$NODE_DIR" --strip-components=1
            rm -f /tmp/node.tgz
          fi
          if ! "$NODE_DIR/bin/pnpm" -v >/dev/null 2>&1; then
            rm -f "$NODE_DIR/bin/pnpm" "$NODE_DIR/bin/pnpx" 2>/dev/null || true
            "$NODE_DIR/bin/npm" i -g pnpm@12.16.1
          fi
          node -v && pnpm -v
        '''
      }
    }

    stage('Install') {
      steps { sh 'pnpm install --frozen-lockfile' }
    }

    stage('DB migrate (deploy)') {
      steps { sh 'pnpm --filter @apnacity/db exec prisma migrate deploy && pnpm --filter @apnacity/db exec prisma generate' }
    }

    stage('Lint') {
      steps { sh 'pnpm lint' }
    }

    stage('Typecheck') {
      steps { sh 'pnpm typecheck' }
    }

    stage('Unit + Integration tests') {
      steps {
        // JUnit XML for the Jenkins test report + trend graph
        sh 'pnpm --filter @apnacity/api exec vitest run --reporter=junit --outputFile=reports/junit.xml --reporter=default'
      }
    }

    stage('Build') {
      steps { sh 'pnpm build' }
    }

    stage('Deploy to Cluster') {
      steps {
        sh '''
          set -e
          KBIN="$HOME/.local/bin"; mkdir -p "$KBIN"
          if [ ! -x "$KBIN/kubectl" ]; then
            curl -fsSL -o "$KBIN/kubectl" "https://dl.k8s.io/release/v1.31.0/bin/linux/amd64/kubectl"
            chmod +x "$KBIN/kubectl"
          fi
          # in-cluster auth via the agent service account
          "$KBIN/kubectl" -n apnacity rollout restart deploy/api deploy/web deploy/seller-portal deploy/admin-portal
          "$KBIN/kubectl" -n apnacity rollout status deploy/api --timeout=180s
          "$KBIN/kubectl" -n apnacity rollout status deploy/seller-portal --timeout=180s
        '''
      }
    }
  }

  post {
    always {
      // publish the test report (always, even on failure) + archive build logs
      junit testResults: 'apps/api/reports/junit.xml', allowEmptyResults: true
      archiveArtifacts artifacts: 'apps/api/reports/junit.xml', allowEmptyArchive: true
    }
    success { echo "✅ ApnaCity pipeline PASSED — tests green, report published." }
    failure { echo "❌ ApnaCity pipeline FAILED — see the failing stage + test report." }
  }
}
