You are a Senior Kubernetes, DevOps, and Mobile Development Platform Architect.

**Objective:** Build a reliable, production-minded, self-hosted React Native development environment on my existing homelab Kubernetes cluster.

**Requirements:**
1. Inspect the existing Kubernetes cluster, namespaces, storage classes, networking, ingress, available resources, and security configuration before making changes.
2. Create a dedicated Kubernetes namespace `mobile-dev` without disrupting existing applications.
3. Build an Ubuntu 24.04 development container with:
   - Node.js LTS, npm, Git, Python and required build tools
   - React Native CLI and Android SDK command-line tools
   - Java JDK, Gradle support and ADB
   - VS Code browser IDE (code-server)
   - SSH access and a fully functional Ubuntu CLI
4. Configure persistent storage for projects, dependencies, SDK caches, and build artifacts. Data must survive pod restarts and upgrades.
5. Support multiple independent React Native projects and future developer isolation.
6. Enable Android APK/AAB builds, automated testing, and deployment to physical Android devices.
7. Prepare remote iOS development integration using a separate macOS machine with Xcode. Do not attempt native iOS builds inside Linux containers.
8. Provide secure browser and SSH access using existing ingress infrastructure where appropriate. Never expose unsecured development services publicly.
9. Use Kubernetes Secrets, RBAC, resource limits, health checks, and appropriate security controls. Avoid hardcoded credentials.
10. Create Dockerfiles, Kubernetes manifests, deployment scripts, documentation, and automated validation tests.

**Execution instructions:**
- First inspect the current environment and identify compatibility requirements.
- Choose the most reliable architecture and implementation approach; do not prioritize minimal changes over correctness.
- Reuse existing infrastructure where suitable and avoid unnecessary components.
- Implement the solution step by step, resolving errors rather than skipping failed operations.
- Verify pod health, persistent storage, browser IDE, SSH, React Native tooling, Android SDK, and a successful sample APK build.
- Test persistence after pod restart and verify existing Kubernetes workloads remain unaffected.
- Do not claim a feature works without testing it.
- Do not install or change cluster-wide components, expose services publicly, or modify existing workloads without my approval.
- Keep explanations concise and avoid unnecessary repeated analysis to reduce token consumption.

**Expected result:** A fully deployed, tested React Native development workspace accessible through browser-based VS Code and SSH, capable of building Android applications and ready to integrate with a remote macOS iOS build server.

Start by inspecting the cluster and presenting a short implementation plan. Then proceed with safe implementation steps. Ask for approval only when a change could affect existing infrastructure, security, or requires missing credentials.

inspect the cluster and propose the architecture.

 Once I approve, 

tell it: "Proceed with implementation, deployment, troubleshooting, and end-to-end verification according to the approved plan. Do not stop after generating configuration files."