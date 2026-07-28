## How to Run the Service

```bash
cd /home/Forge/builder
```

Make them executable:

```bash
chmod +x setup.sh start.sh stop.sh
```

Run the initial setup once:

```bash
sudo ./setup.sh
```

After that, manage the API with:

```bash
sudo ./start.sh
sudo ./stop.sh
```

Restart it after code changes:

```bash
sudo ./stop.sh
sudo ./start.sh
```

You can also restart it directly:

```bash
sudo systemctl restart forge-builder
```

Check logs:

```bash
sudo journalctl -u forge-builder -f
```

Test the API:

```bash
curl http://127.0.0.1:8010/health
```

One important point: because the service runs as `forge-builder`, repositories cloned later into `/home/Forge/repos` must remain readable by that user. Your main API should either clone repositories using the same user or assign correct ownership after cloning:

```bash
sudo chown -R forge-builder:forge-builder /home/Forge/repos/example-repo
```
