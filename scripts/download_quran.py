import os
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGET_DIR = os.path.join(BASE_DIR, "public", "audio")
BASE_URL = "https://www.truemuslims.net/Quran/Bangla/{num:03d}.mp3"
TOTAL = 114
WORKERS = 8
RETRIES = 5

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
}

def download_file(num):
    fn = f"{num:03d}.mp3"
    fp = os.path.join(TARGET_DIR, fn)
    url = BASE_URL.format(num=num)

    if os.path.exists(fp) and os.path.getsize(fp) > 50000:
        return f"[SKIP] {fn} already exists"

    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            temp_fp = fp + ".tmp"
            with urllib.request.urlopen(req, timeout=30) as resp, open(temp_fp, "wb") as f:
                while True:
                    chunk = resp.read(128 * 1024)
                    if not chunk:
                        break
                    f.write(chunk)
            
            if os.path.exists(fp):
                os.remove(fp)
            os.rename(temp_fp, fp)
            return f"[DONE] {fn} ({os.path.getsize(fp) / (1024*1024):.2f} MB)"
        except Exception as e:
            if os.path.exists(fp + ".tmp"):
                try:
                    os.remove(fp + ".tmp")
                except OSError:
                    pass
            if attempt == RETRIES:
                return f"[FAIL] {fn}: {e}"
            time.sleep(2 * attempt)

def main():
    os.makedirs(TARGET_DIR, exist_ok=True)
    print(f"Downloading Quran audio files to: {TARGET_DIR}")
    start = time.time()
    
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = {pool.submit(download_file, i): i for i in range(1, TOTAL + 1)}
        for future in as_completed(futures):
            res = future.result()
            print(res, flush=True)

    print(f"Completed in {time.time() - start:.1f}s")

if __name__ == "__main__":
    main()
