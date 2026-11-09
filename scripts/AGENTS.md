# Scripts

Run from anywhere; they work relative to the project root.

- `start.sh` (Mac/Linux), `start.ps1` (Windows) - build the `pm-app` image, replace any running `pm-app` container, and run it on port 8000 with `--env-file .env` and `./data` mounted at `/app/data`.
- `stop.sh`, `stop.ps1` - remove the `pm-app` container.

Requires Docker and a `.env` file in the project root with `OPENROUTER_API_KEY` (may be empty until AI features).
