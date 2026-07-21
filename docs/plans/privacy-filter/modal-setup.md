# Modal setup walkthrough

Project: [privacy-filter-customization](../../../src/content/projects/privacy-filter-customization.md)
Status: **ready to execute**
Created: 2026-07-20

Step-by-step guide for running the `opf train` pipeline on [Modal](https://modal.com) — a serverless GPU platform where you define the container image and job in pure Python and pay per-second. This is the lowest-friction path for the PoC phase: no account tickets, no compute pools to pre-provision, scales to zero when idle.

Trade-off vs. the [Snowflake path](snowflake-setup.md): Modal runs in Modal's cloud, so it does not give you the in-account data-residency story that Snowflake does. Use Modal for fast, cheap iteration; use Snowflake when the training needs to sit next to Snowflake data.

---

## Step 1 — Install and authenticate

```bash
pip install modal
modal setup          # opens a browser to link your Modal account
```

A new Modal account includes a monthly free-credit allowance (enough for several smoke runs). Verify auth:

```bash
modal token new      # only if `modal setup` didn't complete
modal profile current
```

---

## Step 2 — Store the HuggingFace token as a secret

`opf train` pulls the base privacy-filter checkpoint (~17 GB) and the ai4privacy dataset from HuggingFace. Store a token so downloads don't throttle and private repos work:

```bash
modal secret create huggingface HF_TOKEN=hf_xxxxxxxxxxxxxxxxx
```

This is referenced in code as `modal.Secret.from_name("huggingface")` and injected as the `HF_TOKEN` env var inside the container.

---

## Step 3 — Create persistent volumes

Two volumes: one caches the base model + HF datasets across runs (so you download the 17 GB checkpoint once), the other holds output checkpoints.

```bash
modal volume create opf-hf-cache
modal volume create opf-checkpoints
```

They can also be created lazily from code (`create_if_missing=True`, shown below).

---

## Step 4 — Prepare the taxonomy config

The `label_space.json` for the Snowflake-aligned taxonomy must be available in the container. Once the label design is finalized (see `taxonomy-design.md` when written), either bake it into the image (`add_local_file`, shown in Step 5) or push it to a volume:

```bash
modal volume put opf-hf-cache ./label_space.json /label_space.json
```

The `add_local_file` approach is simpler for a single small file; the volume approach is better if the config changes often (no image rebuild).

---

## Step 5 — Write the training script

Save as `train.py` locally. The image installs `openai-privacy-filter` and its deps; the two volumes mount at `/cache/huggingface` and `/checkpoints`.

```python
# train.py — Modal serverless fine-tune for the privacy-filter

import modal

app = modal.App("privacy-filter-train")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "transformers",
        "datasets",
        "openai-privacy-filter",
    )
    # Bake the taxonomy config into the image (alternative: use a volume)
    .add_local_file("label_space.json", "/root/label_space.json")
)

hf_cache    = modal.Volume.from_name("opf-hf-cache", create_if_missing=True)
checkpoints = modal.Volume.from_name("opf-checkpoints", create_if_missing=True)

CACHE_DIR = "/cache/huggingface"
CKPT_DIR  = "/checkpoints"


@app.function(
    gpu="A10G",                       # smoke run; see Step 9 to scale up
    image=image,
    volumes={CACHE_DIR: hf_cache, CKPT_DIR: checkpoints},
    secrets=[modal.Secret.from_name("huggingface")],
    timeout=60 * 60 * 2,              # 2h ceiling; raise for full runs
)
def train(mode: str = "smoke", epochs: int = 1):
    import os, json, subprocess
    from pathlib import Path
    from datasets import load_dataset

    # Route all HF downloads/caches to the persistent volume
    os.environ["HF_HOME"] = CACHE_DIR

    data_dir = Path("/tmp/opf_data")
    data_dir.mkdir(parents=True, exist_ok=True)
    out_dir = Path(CKPT_DIR) / ("run_smoke" if mode == "smoke" else "run_full")
    out_dir.mkdir(parents=True, exist_ok=True)

    split = "train[:10000]" if mode == "smoke" else "train"
    ds = load_dataset("ai4privacy/pii-masking-300k", split=split)

    # Convert ai4privacy span_labels -> opf JSONL, mapped to Snowflake taxonomy.
    # {"text": "...", "labels": [{"start": 0, "end": 5, "label": "NAME"}]}
    label_map: dict[str, str] = {}  # TODO: populate from taxonomy design
    with open(data_dir / "train.jsonl", "w") as f:
        for row in ds:
            spans = []
            for e in row.get("span_labels", []):
                mapped = label_map.get(e["label"])
                if mapped:
                    spans.append({"start": e["start"], "end": e["end"], "label": mapped})
            f.write(json.dumps({"text": row["source_text"], "labels": spans}) + "\n")

    subprocess.run([
        "opf", "train",
        "--data",        str(data_dir / "train.jsonl"),
        "--label-space", "/root/label_space.json",
        "--output-dir",  str(out_dir),
        "--epochs",      str(epochs),
    ], check=True)

    # Persist the checkpoint files written to the mounted volume
    checkpoints.commit()
    print("Training complete. Checkpoint at", out_dir)


@app.local_entrypoint()
def main(mode: str = "smoke", epochs: int = 1):
    train.remote(mode=mode, epochs=epochs)
```

---

## Step 6 — Run the smoke job

```bash
modal run train.py                     # mode=smoke, epochs=1 by default
```

The first run builds the image (a few minutes); later runs reuse the cached layers. Logs stream live in your terminal.

For anything longer than a few minutes, run detached so a laptop disconnect doesn't kill it:

```bash
modal run --detach train.py
```

---

## Step 7 — Monitor

- **Terminal**: logs stream inline for attached runs.
- **Dashboard**: [modal.com/apps](https://modal.com/apps) shows every run, its GPU, live logs, and cost so far.
- **CLI**: `modal app logs privacy-filter-train` to tail a detached run.

---

## Step 8 — Retrieve the checkpoint

List and pull the output from the volume:

```bash
modal volume ls  opf-checkpoints
modal volume ls  opf-checkpoints run_smoke
modal volume get opf-checkpoints run_smoke ./checkpoint_smoke
```

Expect `model.safetensors`, `config.json`, `tokenizer.json`, and `tokenizer_config.json` under `run_smoke/`.

---

## Step 9 — Scale to full fine-tune

Two changes. First, bump the GPU in the decorator:

```python
@app.function(
    gpu="A100",              # or "A100-80GB", "H100"; "A100:4" for 4 GPUs
    image=image,
    volumes={CACHE_DIR: hf_cache, CKPT_DIR: checkpoints},
    secrets=[modal.Secret.from_name("huggingface")],
    timeout=60 * 60 * 6,     # full run headroom
)
```

Then invoke with the full split and more epochs:

```bash
modal run --detach train.py --mode full --epochs 3
```

For multi-GPU (`gpu="A100:4"`), `train()` should launch the trainer under `torchrun` / `accelerate` rather than calling `opf train` directly:

```python
subprocess.run([
    "torchrun", "--nproc_per_node=4", "-m", "opf.train",
    "--data", str(data_dir / "train.jsonl"),
    "--label-space", "/root/label_space.json",
    "--output-dir", str(out_dir),
    "--epochs", str(epochs),
], check=True)
```

Confirm `opf` exposes a `torchrun`-compatible module entry point before relying on this; otherwise stick to single-GPU `A100-80GB` for the full run.

---

## Gotchas

**Image build cold start** — the first `modal run` builds and caches the image (installing torch + opf is a few minutes). Subsequent runs skip it unless the `pip_install` list or `add_local_file` source changes. Keep the dependency list stable to preserve the cache.

**Base model download** — routing `HF_HOME` to the `opf-hf-cache` volume means the 17 GB checkpoint is fetched once and reused on every later run. Without this, each cold container re-downloads it (~5 min + egress).

**Volume commit** — files written to a mounted `modal.Volume` are only durable after `.commit()` (or clean function return in recent Modal versions). Call it explicitly after `opf train` writes the checkpoint.

**Cost** — Modal bills per-second while the GPU function runs and scales to zero when idle. Rough hourly rates: A10G ~$1/hr, A100-40GB ~$2/hr, H100 ~$4/hr (check [modal.com/pricing](https://modal.com/pricing) for current numbers). A 1-epoch smoke run on 10k examples is well under an hour.

**Timeouts** — the default function `timeout` is short. Set it generously for full runs and always use `--detach` so the run survives a local disconnect.

**`opf` JSONL format** — validate the span-conversion logic locally with `opf eval` on a few rows before submitting. The exact schema is in the [openai/privacy-filter README](https://github.com/openai/privacy-filter).

**Getting the model out** — for eval/serving, either `modal volume get` the checkpoint locally, push it to a private HF repo from inside the function, or serve it directly with a Modal `@app.function`/`@app.cls` inference endpoint. If the destination is the Snowflake Model Registry, pull locally then follow the registry steps in [snowflake-setup.md](snowflake-setup.md).
