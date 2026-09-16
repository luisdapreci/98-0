"""
Fetch raw CSV datasets from sumitrodatta/bball-reference-datasets on GitHub.
Saves them into data/raw/
"""
import os
import urllib.request
import time

RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data", "raw")

FILES = {
    "Player Per Game.csv": "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/Player%20Per%20Game.csv",
    "Advanced.csv": "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/Advanced.csv",
    "Team Summaries.csv": "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/Team%20Summaries.csv",
    "Team Abbrev.csv": "https://raw.githubusercontent.com/sumitrodatta/bball-reference-datasets/master/Data/Team%20Abbrev.csv",
}

def fetch_file(filename: str, url: str) -> None:
    os.makedirs(RAW_DIR, exist_ok=True)
    target_path = os.path.join(RAW_DIR, filename)
    if os.path.exists(target_path) and os.path.getsize(target_path) > 1000:
        print(f"[CACHE] {filename} already exists ({os.path.getsize(target_path):,} bytes). Skipping download.")
        return

    print(f"[DOWNLOAD] Fetching {filename} from {url}...")
    start_time = time.time()
    req = urllib.request.Request(url, headers={"User-Agent": "Project-98-0-DataPipeline/1.0"})
    with urllib.request.urlopen(req) as resp, open(target_path, "wb") as f:
        data = resp.read()
        f.write(data)
    elapsed = time.time() - start_time
    print(f"[DONE] Saved {filename} ({len(data):,} bytes) in {elapsed:.2f}s.")

def main():
    print(f"Target raw directory: {os.path.abspath(RAW_DIR)}")
    for name, url in FILES.items():
        fetch_file(name, url)
    print("All raw files downloaded successfully!")

if __name__ == "__main__":
    main()
