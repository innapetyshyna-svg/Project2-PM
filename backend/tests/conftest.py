import os
import tempfile
from pathlib import Path

static_dir = Path(tempfile.mkdtemp())
(static_dir / "index.html").write_text("<html><body>Kanban Studio</body></html>")
os.environ["STATIC_DIR"] = str(static_dir)
