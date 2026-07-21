# Snowflake setup walkthrough

Project: [privacy-filter-customization](../../../src/content/projects/privacy-filter-customization.md)
Status: **ready to execute**
Created: 2026-07-20

Step-by-step guide for running the `opf train` pipeline on a new Snowflake account using ML Jobs + Container Runtime on a GPU compute pool. Covers account creation through smoke training run.

---

## Step 1 — Create the account

Go to [snowflake.com/try](https://snowflake.com/try). Pick:

- **Cloud**: AWS
- **Region**: US West 2 (Oregon) — has the full GPU menu: GPU_NV_S, GPU_NV_M, GPU_L40S, GPU_R6K, and GPU_NV_L (A100, on request). Trial gives $400 credits.

After signup, verify GPU compute pools are available:

```sql
SHOW COMPUTE POOL INSTANCE FAMILIES;
```

If `GPU_NV_S` does not appear, open a support ticket asking to enable Snowpark Container Services on the trial. Usually same-day.

---

## Step 2 — Bootstrap Snowflake objects

Run as ACCOUNTADMIN (default role on a new trial):

```sql
USE ROLE ACCOUNTADMIN;

CREATE WAREHOUSE ML_WH
  WAREHOUSE_SIZE = 'X-SMALL'
  AUTO_SUSPEND = 60
  AUTO_RESUME = TRUE;

CREATE DATABASE PRIVACY_FILTER_DB;
CREATE SCHEMA PRIVACY_FILTER_DB.ML;
USE SCHEMA PRIVACY_FILTER_DB.ML;

-- Stage for training data JSONL and label_space.json
CREATE STAGE DATA_STAGE ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');

-- Stage for model checkpoints (output of opf train)
CREATE STAGE CHECKPOINTS_STAGE ENCRYPTION = (TYPE = 'SNOWFLAKE_SSE');

-- Smoke pool: 1x A10G 24 GB VRAM — covers LoRA and careful full FT
CREATE COMPUTE POOL GPU_SMOKE_POOL
  MIN_NODES = 1
  MAX_NODES = 1
  INSTANCE_FAMILY = GPU_NV_S
  AUTO_SUSPEND_SECS = 300;

-- Scale pool: 4x A10G 96 GB total — for full fine-tune
-- Swap to GPU_L40S if available in your account
CREATE COMPUTE POOL GPU_FULL_POOL
  MIN_NODES = 1
  MAX_NODES = 1
  INSTANCE_FAMILY = GPU_NV_M
  AUTO_SUSPEND_SECS = 300;
```

---

## Step 3 — Local Python environment

```bash
pip install "snowflake-ml-python>=1.8" "snowflake-connector-python[pandas]"
```

Create `~/.snowflake/connections.toml` so credentials stay out of code:

```toml
[default]
account   = "<your-account-id>"   # e.g. "abc12345.us-west-2"
user      = "<your-username>"
password  = "<your-password>"
warehouse = "ML_WH"
database  = "PRIVACY_FILTER_DB"
schema    = "ML"
role      = "ACCOUNTADMIN"
```

Test the connection:

```python
from snowflake.snowpark import Session
session = Session.builder.getOrCreate()
print(session.sql("SELECT CURRENT_REGION()").collect())
```

---

## Step 4 — Stage the taxonomy config

The `label_space.json` for the Snowflake-aligned taxonomy must be on the stage before training. Once the label design is finalized (see [taxonomy-design.md](taxonomy-design.md) when written), upload it:

```python
session.file.put(
    "label_space.json",
    "@PRIVACY_FILTER_DB.ML.DATA_STAGE",
    auto_compress=False,
)
```

Or via SnowSQL:

```bash
snowsql -c default -q "PUT file://label_space.json @PRIVACY_FILTER_DB.ML.DATA_STAGE AUTO_COMPRESS=FALSE"
```

---

## Step 5 — Write the training script

Save as `train_opf.py` locally. The Container Runtime already has PyTorch and `transformers`; only `openai-privacy-filter` and `datasets` need installing at runtime.

```python
# train_opf.py — runs inside Snowflake Container Runtime

import subprocess, os, json
from pathlib import Path


def main():
    subprocess.run(
        ["pip", "install", "openai-privacy-filter", "datasets"],
        check=True,
    )

    from datasets import load_dataset
    from snowflake.snowpark import Session

    data_dir   = Path("/tmp/opf_data")
    ckpt_dir   = Path("/tmp/checkpoint")
    stage_root = "@PRIVACY_FILTER_DB.ML.DATA_STAGE"
    ckpt_stage = "@PRIVACY_FILTER_DB.ML.CHECKPOINTS_STAGE/run_01"

    data_dir.mkdir(parents=True, exist_ok=True)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    session = Session.builder.getOrCreate()

    # Pull label_space.json from stage
    session.file.get(f"{stage_root}/label_space.json", str(data_dir))

    # Download ai4privacy English train split — [:10000] for smoke
    ds = load_dataset("ai4privacy/pii-masking-300k", split="train[:10000]")

    # Convert to opf JSONL format:
    # {"text": "...", "labels": [{"start": 0, "end": 5, "label": "NAME"}]}
    # ai4privacy has token-level span_labels; map to Snowflake taxonomy here.
    label_map: dict[str, str] = {}  # TODO: populate from taxonomy design

    with open(data_dir / "train.jsonl", "w") as f:
        for row in ds:
            spans = []
            for entity in row.get("span_labels", []):
                mapped = label_map.get(entity["label"])
                if mapped:
                    spans.append({
                        "start": entity["start"],
                        "end":   entity["end"],
                        "label": mapped,
                    })
            f.write(json.dumps({"text": row["source_text"], "labels": spans}) + "\n")

    # Run opf train
    subprocess.run([
        "opf", "train",
        "--data",        str(data_dir / "train.jsonl"),
        "--label-space", str(data_dir / "label_space.json"),
        "--output-dir",  str(ckpt_dir),
        "--epochs",      "1",
    ], check=True)

    # Upload checkpoint to stage
    for f in ckpt_dir.rglob("*"):
        if f.is_file():
            rel = f.relative_to(ckpt_dir)
            session.file.put(
                str(f),
                f"{ckpt_stage}/{rel.parent}",
                auto_compress=False,
                overwrite=True,
            )

    print("Training complete. Checkpoint at", ckpt_stage)


if __name__ == "__main__":
    main()
```

---

## Step 6 — Submit the job

```python
from snowflake.ml.jobs import submit_file

job = submit_file(
    file_path="train_opf.py",
    compute_pool="GPU_SMOKE_POOL",
    stage_name="@PRIVACY_FILTER_DB.ML.DATA_STAGE",
    runtime_environment="2.3.0",   # pin; check Container Runtime releases for latest
    session=session,
)

print("Job ID:", job.id)
print("Status:", job.status())
```

---

## Step 7 — Monitor

```python
import time

while True:
    status = job.status()
    print(status)
    if status in ("DONE", "FAILED"):
        break
    time.sleep(30)

if job.status() == "FAILED":
    print(job.logs())
```

Also visible in Snowsight under **Monitoring → Jobs**.

---

## Step 8 — Verify the checkpoint

```sql
LIST @PRIVACY_FILTER_DB.ML.CHECKPOINTS_STAGE/run_01;
```

Expect `model.safetensors`, `config.json`, `tokenizer.json`, and `tokenizer_config.json`.

---

## Step 9 — Scale to full fine-tune

Two changes to the `submit_file` call:

```python
job = submit_file(
    file_path="train_opf.py",
    compute_pool="GPU_FULL_POOL",   # 4x A10G or GPU_L40S
    stage_name="@PRIVACY_FILTER_DB.ML.DATA_STAGE",
    runtime_environment="2.3.0",
    session=session,
)
```

And in `train_opf.py`:
- Remove the `[:10000]` slice → full dataset (~150k examples after label conversion)
- Bump `--epochs` to `3`
- Change `ckpt_stage` to `run_full_01` to keep smoke and full runs separate

For multi-GPU, wrap `main()` with `PyTorchDistributor` (see [distributed-training.md](distributed-training.md) when written) instead of calling it directly. Validate single-node path first.

---

## Gotchas

**Model weight download cold start** — `opf train` fetches the 17 GB privacy-filter checkpoint from HuggingFace on first run. This adds ~5 min and burns container time. After the smoke run succeeds, copy the base weights to `@CHECKPOINTS_STAGE/base_model` and pass `--pretrained-model` pointing to the stage path on all subsequent runs.

**Credit burn** — `GPU_NV_S` costs ~3 Snowflake credits/hr. A 1-epoch smoke run on 10k examples takes roughly 20–30 min (~1.5 credits). `AUTO_SUSPEND_SECS=300` on the pool prevents idle charges between job submissions.

**HuggingFace rate limits** — if downloads throttle, add a `HF_TOKEN` environment variable. Store it as a Snowflake secret and pass it in `job_params`.

**`opf` JSONL format** — validate the conversion logic locally with `opf eval` on a handful of rows before submitting. The exact schema is in the [openai/privacy-filter README](https://github.com/openai/privacy-filter).

**Model Registry path** — `TransformersPipeline` takes a HF Hub repo id by default. To register a checkpoint from a Snowflake stage you need either a `CustomModel` wrapper (keeps everything in-account) or push the checkpoint to a private HF repo first. Decision deferred to a later step.
