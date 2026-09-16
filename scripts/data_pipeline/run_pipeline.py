"""
Master pipeline runner for Project 98-0 historical data compilation.
Runs:
1. fetch_raw.py (Downloads latest BRef CSVs)
2. process_players.py (Builds players.json with peak 3-year averages)
3. process_opponents.py (Builds opponents.json with historical benchmark teams)
4. validate_output.py (Verifies schema and basketball consistency)
"""
import os
import sys
import subprocess

def run_step(script_name: str):
    print(f"\n==========================================")
    print(f"RUNNING: {script_name}")
    print(f"==========================================")
    env = os.environ.copy()
    env["PYTHONIOENCODING"] = "utf-8"
    cmd = [sys.executable, f"scripts/data_pipeline/{script_name}"]
    res = subprocess.run(cmd, env=env)
    if res.returncode != 0:
        print(f"FAILED at {script_name} with exit code {res.returncode}")
        sys.exit(res.returncode)

def main():
    steps = [
        "fetch_raw.py",
        "process_players.py",
        "process_opponents.py",
        "generate_coaches.py",
        "validate_output.py",
    ]
    for step in steps:
        run_step(step)
    print("\n[SUCCESS] Project 98-0 Phase 1 Historical Dataset compiled and verified successfully!")

if __name__ == "__main__":
    main()
