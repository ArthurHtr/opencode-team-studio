# Troubleshooting

## Common issues and their solutions

### Repository cloned anywhere

The repository can be cloned anywhere:

```text
~/projects/opencode-team-studio
/opt/opencode-team-studio
C:\projects\opencode-team-studio via WSL
```

The Studio does not depend on its installation path. It only depends on `OPENCODE_CONFIG_DIR` pointing to your OpenCode configuration.

### Permission errors on the volume

**Symptom:** Container fails to start with permission denied errors.

**Cause:** The container user (UID/GID) does not match the file ownership in the mounted volume.

**Solution:** Ensure the `--user` flag matches your host user:

```bash
docker run -d \
  --name opencode-team-studio \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -e OPENCODE_CONFIG_DIR=/config \
  -p 127.0.0.1:3210:3000 \
  -v "$HOME/.config/opencode:/config" \
  ghcr.io/arthurhtr/opencode-team-studio:v0.1.0-alpha.1
```

Or set `LOCAL_UID` and `LOCAL_GID` in your `.env` file:

```env
LOCAL_UID=1000
LOCAL_GID=1000
```

### Port already in use

**Symptom:** Docker reports "port is already allocated".

**Solution:** Use a different port:

```bash
docker run -d \
  --name opencode-team-studio \
  -p 127.0.0.1:8080:3000 \
  -e HOME=/tmp \
  -e OPENCODE_CONFIG_DIR=/config \
  -v "$HOME/.config/opencode:/config" \
  ghcr.io/arthurhtr/opencode-team-studio:v0.1.0-alpha.1
```

Or stop the existing container:

```bash
docker stop opencode-team-studio
docker rm opencode-team-studio
```

### Docker is not installed or not running

**Symptom:** `docker: command not found` or connection refused.

**Solution:** Install Docker and ensure the Docker daemon is running:

```bash
# Check Docker status
docker info

# Start Docker (systemd)
sudo systemctl start docker
sudo systemctl enable docker
```

### Image cannot be pulled

**Symptom:** `manifest for ghcr.io/... not found` or pull fails.

**Solutions:**

1. Check your internet connection
2. Verify the image tag exists:
   ```bash
   docker pull ghcr.io/arthurhtr/opencode-team-studio:v0.1.0-alpha.1
   ```
3. Build locally from source:
   ```bash
   docker build -t opencode-team-studio:local .
   ```

### OpenCode configuration not found

**Symptom:** The Studio shows an empty configuration or errors about missing files.

**Solution:** Ensure the mounted directory contains a valid OpenCode configuration:

```bash
ls -la "$HOME/.config/opencode/"
# Should contain opencode.jsonc or opencode.json
```

If the directory is empty, create a minimal config:

```bash
mkdir -p "$HOME/.config/opencode"
echo '{"$schema": "https://opencode.ai/config.json"}' > "$HOME/.config/opencode/opencode.jsonc"
```

### Invalid JSONC file

**Symptom:** Apply fails with a JSON parsing error.

**Solution:** Validate your `opencode.jsonc` file:

```bash
cat "$HOME/.config/opencode/opencode.jsonc" | python3 -m json.tool
```

Or use the Studio's built-in validation — errors are displayed in the UI banner.

### Backup failure

**Symptom:** Apply fails and no backup is created.

**Solutions:**

1. Check disk space:
   ```bash
   df -h "$HOME/.config/opencode"
   ```
2. Check permissions on the config directory:
   ```bash
   ls -la "$HOME/.config/"
   ```
3. Manually create a backup:
   ```bash
   cp -r "$HOME/.config/opencode" "$HOME/.config/opencode-backup-$(date +%Y%m%d)"
   ```

### Restoring from backup

1. Open the Studio at `http://127.0.0.1:3210`
2. Navigate to the **Backups** page
3. Select the backup you want to restore
4. Click **Restore**

Or restore manually:

```bash
BACKUP_ID="2026-01-01T00-00-00-000Z"
CONFIG_DIR="$HOME/.config/opencode"

# Remove current config (except studio dirs)
find "$CONFIG_DIR" -maxdepth 1 -not -name "studio" -not -name "backups" -not -name "studio-data" -not -name "." -not -name ".." -exec rm -rf {} +

# Restore from backup
cp -r "$CONFIG_DIR/backups/$BACKUP_ID/"* "$CONFIG_DIR/"
```

### Container keeps restarting

**Symptom:** `docker ps` shows the container with "Restarting" status.

**Solutions:**

1. Check the logs:
   ```bash
   docker logs opencode-team-studio
   ```
2. Common causes:
   - Config directory not accessible (permission issue)
   - Invalid config causing startup crash
   - Insufficient disk space
3. Inspect the container:
   ```bash
   docker inspect opencode-team-studio
   ```

### Viewing logs

```bash
# Docker container
docker logs opencode-team-studio
docker logs -f opencode-team-studio    # Follow

# Docker Compose
docker compose logs -f studio
```

### Container not responding to HTTP requests

1. Verify the container is running:
   ```bash
   docker ps | grep opencode-team-studio
   ```
2. Check logs for errors:
   ```bash
   docker logs opencode-team-studio
   ```
3. Test the health endpoint:
   ```bash
   curl http://127.0.0.1:3210/api/health
   # Expected: {"status":"ok"}
   ```
4. Verify port binding:
   ```bash
   docker port opencode-team-studio
   ```

### General debugging

```bash
# Inspect container details
docker inspect opencode-team-studio

# Check mounted volumes
docker inspect opencode-team-studio --format='{{json .Mounts}}' | python3 -m json.tool

# Check environment variables
docker inspect opencode-team-studio --format='{{json .Config.Env}}' | python3 -m json.tool

# Enter the container shell
docker exec -it opencode-team-studio sh
```

### Empty configuration welcome screen

If you see a welcome screen instead of the team graph, it means no custom OpenCode configuration was detected. This is normal for a fresh setup.

To get started:

1. Click "Créer un agent" to create your first agent
2. Click "Configurer un modèle" to add a provider
3. Run `/connect` in OpenCode to authenticate providers

### Provider authentication

The Studio does not verify or manage provider authentication:

- Authentication is managed by OpenCode via `/connect`
- The Studio shows a warning banner on the Models page reminding you of this
- A model can be selected in the Studio even if the provider is not yet authenticated
- After running `/connect` in OpenCode, the model becomes available when OpenCode calls it

### Symlink traversal blocked

If you see "Sortie du dossier de configuration refusée (symlink traversal)", it means a symlink in your config directory points outside the configured root. The Studio blocks this for security.

Fix: Remove or redirect the symlink to stay within the config directory.
